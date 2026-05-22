/**
 * Direct payroll import script for Mei 2026 (POLRES + POLSEK)
 * Handles 2-row merged header structure in POT GAJI sheet.
 * Column 36 (AK) = JUMLAH GAJI DITERIMA = terimaBersih = sisaGaji
 * Usage: node scripts/import-payroll-mei.js
 */
const { PrismaClient } = require("@prisma/client");
const XLSX = require("xlsx");
const path = require("path");

const prisma = new PrismaClient();

const MONTH_NAMES = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER",
];

const KOPERASI_FIELDS = {
  "TAJIP": "potTajib", "TAJIB": "potTajib", "TABUNGAN WAJIB": "potTajib",
  "SP PRIMKOPPOL": "potSP", "SP PRIM": "potSP", "ANGSURAN SP": "potSP",
  "BARANG PRIMKOPPOL": "potBarang", "BARANG PRIM": "potBarang",
  "SUKARELA": "potSukarela", "SIMPANAN SUKARELA": "potSukarela",
  "SIMPedes KOPERASI": "potKoperasiLain", "KOPERASI BHY": "potKoperasiLain",
};

const SUMMARY_FIELDS = {
  "JUMLAH POT NON": "jumlahPotNonBRI", "JUMLAH POTONGAN NON": "jumlahPotNonBRI", "JML POT NON": "jumlahPotNonBRI",
  "POT NON KRETAP": "jumlahPotNonBRI",
  "JUMLAH POT KRETAP": "jumlahPotBRI", "JUMLAH POTONGAN BRI": "jumlahPotBRI", "JML POT BRI": "jumlahPotBRI",
  "JUMLAH GAJI DITERIMA": "terimaBersih", "JML GAJI DITERIMA": "terimaBersih", "GAJI DITERIMA": "terimaBersih",
  "GAJI DITERIMA": "terimaBersih",
};

const IDENTITY_FIELDS = {
  "NO": "no", "PANGKAT": "pangkat", "NAMA": "nama", "NRP": "nrp",
  "NIP": "nrp", "NRP/NIP": "nrp", "JML GAJI": "gajiBersih", "GAJI BERSIH": "gajiBersih",
};

function cleanNumber(raw) {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === "number") return raw;
  const s = String(raw).trim();
  if (s === "-" || s === "" || s === "Rp" || s === "Rp.") return 0;
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeHeader(h) {
  return String(h).toUpperCase().trim().replace(/[^A-Z0-9\s/]/g, "").replace(/\s+/g, " ");
}

function matchKeyword(header, keywords) {
  const normalized = normalizeHeader(header);
  for (const [keyword, value] of Object.entries(keywords)) {
    if (normalized.includes(keyword)) return value;
  }
  return null;
}

const DEFAULT_SISA_REKENING = 100_000;

/**
 * Build column mapping from 2-row merged header structure.
 * Row 0 = top-level headers, Row 1 = sub-headers.
 * Combined = "Row0 Row1" for each column.
 */
function buildColumnMap(row0, row1) {
  const colMap = {};
  for (let col = 0; col < Math.max(row0.length, row1.length); col++) {
    const h0 = String(row0[col] || "").trim();
    const h1 = String(row1[col] || "").trim();
    const combined = normalizeHeader(`${h0} ${h1}`);
    const header = h0 || h1;
    if (!header) continue;

    // Priority: summary > koperasi > identity
    const summaryField = matchKeyword(combined, SUMMARY_FIELDS);
    if (summaryField) { colMap[col] = { type: "summary", field: summaryField, label: combined }; continue; }

    const koperasiField = matchKeyword(combined, KOPERASI_FIELDS);
    if (koperasiField) { colMap[col] = { type: "koperasi", field: koperasiField, label: combined }; continue; }

    // For identity, match on individual header parts — but skip if already mapped at lower column
    const identityField = matchKeyword(h0, IDENTITY_FIELDS) || matchKeyword(h1, IDENTITY_FIELDS);
    if (identityField) {
      const alreadyMapped = Object.values(colMap).some((m) => m.type === "identity" && m.field === identityField);
      if (alreadyMapped) {
        colMap[col] = { type: "other", field: header, label: combined };
      } else {
        colMap[col] = { type: "identity", field: identityField, label: combined };
      }
      continue;
    }

    if (combined.includes("BRI") || combined.includes("SUDIRMAN") || combined.includes("CABANG") || combined.includes("UNIT LAIN")) {
      colMap[col] = { type: "bri", field: header, label: combined };
      continue;
    }

    if (!["NO", "URUT", "KETERANGAN", "KET", "REKENING", "NO REK", "NPWP"].some((skip) => combined.includes(skip))) {
      colMap[col] = { type: "other", field: header, label: combined };
    }
  }
  return colMap;
}

async function importFile(filePath, sourceType) {
  console.log(`\n========== Importing: ${path.basename(filePath)} (${sourceType}) ==========`);

  const workbook = XLSX.readFile(filePath);

  let sheetName = workbook.SheetNames.find((s) => s.toUpperCase().includes("POT GAJI"));
  if (!sheetName) {
    sheetName = workbook.SheetNames.find((s) => s.toUpperCase().includes("POTONGAN"));
  }
  if (!sheetName) {
    console.error("  ERROR: Sheet 'POT GAJI' tidak ditemukan. Available:", workbook.SheetNames);
    return;
  }
  console.log(`  Sheet: "${sheetName}"`);

  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

  // Find header rows: look for row containing NAMA + PANGKAT or NAMA + NO
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowStr = rows[i].join(" ").toUpperCase();
    if (rowStr.includes("NAMA") && (rowStr.includes("PANGKAT") || rowStr.includes("NO"))) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    console.error("  ERROR: Header row not found");
    return;
  }

  const row0 = rows[headerRowIdx];
  const row1 = rows[headerRowIdx + 1] || [];

  // Build column map from 2-row merged headers
  const colMap = buildColumnMap(row0, row1);

  console.log(`  Header rows: ${headerRowIdx} + ${headerRowIdx + 1}`);
  console.log(`  Column mapping:`);
  for (const [col, m] of Object.entries(colMap)) {
    if (m.type === "identity" || m.type === "summary" || m.type === "koperasi") {
      console.log(`    [${col}] ${m.label} → ${m.type}.${m.field}`);
    }
  }

  // Determine data start row: skip column number row, empty rows
  let dataStartRow = headerRowIdx + 2;
  // Skip column number row (all numbers) and empty rows
  for (let i = headerRowIdx + 2; i < Math.min(headerRowIdx + 8, rows.length); i++) {
    const r = rows[i];
    if (!r || r.length < 3) { dataStartRow = i + 1; continue; }
    // Check if this is a column number row (first 3 values are all single digits)
    const first3 = [r[0], r[1], r[2]].map((v) => String(v || "").trim());
    if (first3.every((v) => /^\d+$/.test(v) && parseInt(v) <= 10) && parseInt(first3[0]) === 1 && parseInt(first3[1]) === 2) {
      dataStartRow = i + 1;
      continue;
    }
    // Check if this row is a totals/zero row
    const isZeroRow = first3.every((v) => v === "0" || v === "");
    if (isZeroRow) { dataStartRow = i + 1; continue; }
    // Found actual data start
    dataStartRow = i;
    break;
  }

  // Find identity columns directly
  const namaCol = Object.entries(colMap).find(([, m]) => m.field === "nama")?.[0];
  const pangkatCol = Object.entries(colMap).find(([, m]) => m.field === "pangkat")?.[0];
  const gajiCol = Object.entries(colMap).find(([, m]) => m.field === "gajiBersih")?.[0];
  const nrpCol = Object.entries(colMap).find(([, m]) => m.field === "nrp")?.[0];

  console.log(`  Data starts at row ${dataStartRow}`);
  console.log(`  Identity cols: nama=[${namaCol}] pangkat=[${pangkatCol}] gaji=[${gajiCol}] nrp=[${nrpCol || "none"}]`);

  // Parse period from file name
  const fileName = path.basename(filePath);
  let periodMonth = 5; // Mei
  let periodYear = 2026;
  for (let m = 0; m < MONTH_NAMES.length; m++) {
    if (fileName.toUpperCase().includes(MONTH_NAMES[m])) { periodMonth = m + 1; break; }
  }
  const yearMatch = fileName.match(/(20\d{2})/);
  if (yearMatch) periodYear = parseInt(yearMatch[1]);
  const periodName = `${MONTH_NAMES[periodMonth - 1].charAt(0) + MONTH_NAMES[periodMonth - 1].slice(1).toLowerCase()} ${periodYear}`;
  console.log(`  Period: ${periodName} (${sourceType})`);

  // Check if already exists
  const existing = await prisma.payrollPeriod.findUnique({
    where: { periodMonth_periodYear_sourceType: { periodMonth, periodYear, sourceType } },
  });
  if (existing) {
    console.log(`  SKIP: Period already exists (id=${existing.id})`);
    return;
  }

  // Load members
  const allMembers = await prisma.member.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, nrp: true, memberNo: true, tunlesKinerja: true },
  });
  console.log(`  Members loaded: ${allMembers.length}`);

  // Build name lookup map for faster matching
  const nameMap = new Map();
  for (const m of allMembers) {
    const clean = m.name.toUpperCase().replace(/[^A-Z\s]/g, "").trim();
    if (!nameMap.has(clean)) nameMap.set(clean, []);
    nameMap.get(clean).push(m);
  }

  // Track seen member IDs to deduplicate within same file
  const seenMemberIds = new Set();

  // Parse data rows
  const slips = [];
  const skippedRows = [];

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) { skippedRows.push(i + 1); continue; }

    const nama = namaCol ? String(row[namaCol] || "").trim() : "";
    const pangkat = pangkatCol ? String(row[pangkatCol] || "").trim() : "";
    const gajiBersih = gajiCol ? cleanNumber(row[gajiCol]) : 0;
    const nrp = nrpCol ? String(row[nrpCol] || "").replace(/['"]/g, "").replace(/\.0$/, "").trim() : "";

    // Skip header/total/empty rows
    if (!nama || nama.toUpperCase() === "NAMA" || nama.toUpperCase().includes("JUMLAH") || nama.toUpperCase().includes("TOTAL")) { skippedRows.push(i + 1); continue; }
    if (!nrp && !nama) { skippedRows.push(i + 1); continue; }
    if (/^\d+(\.\d+)?$/.test(nama)) { skippedRows.push(i + 1); continue; }

    const otherDeductions = {};
    const slip = {
      nrp, nama, pangkat, gajiBersih,
      tunkin: 0,
      potTajib: 0, potSP: 0, potBarang: 0, potSukarela: 0, potKoperasiLain: 0,
      totalPotKoperasi: 0, sisaGaji: 0, sisaTunkin: 0,
      otherDeductions,
      jumlahPotNonBRI: 0, jumlahPotBRI: 0,
      terimaBersih: 0, sisaRekening: DEFAULT_SISA_REKENING, bisaDiambilATM: 0,
      memberId: null,
    };

    for (const [colStr, mapping] of Object.entries(colMap)) {
      const col = parseInt(colStr);
      const val = cleanNumber(row[col]);

      if (mapping.type === "koperasi" && mapping.field) {
        slip[mapping.field] = val;
      } else if (mapping.type === "summary" && mapping.field) {
        slip[mapping.field] = val;
      } else if (mapping.type === "other" || mapping.type === "bri") {
        if (mapping.field && val !== 0) otherDeductions[mapping.field] = val;
      }
    }

    // Match member by NRP first, then by name
    let member = null;
    if (nrp) {
      member = allMembers.find((m) => m.nrp === nrp || m.memberNo === nrp);
    }
    if (!member && nama) {
      const cleanNama = nama.toUpperCase().replace(/[^A-Z\s]/g, "").trim();
      // Exact match first
      const exactMatches = nameMap.get(cleanNama);
      if (exactMatches && exactMatches.length === 1) {
        member = exactMatches[0];
      } else if (exactMatches && exactMatches.length > 1) {
        // Multiple exact matches — use first
        member = exactMatches[0];
      } else {
        // Partial match
        member = allMembers.find((m) => {
          const mClean = m.name.toUpperCase().replace(/[^A-Z\s]/g, "").trim();
          return mClean.includes(cleanNama) || cleanNama.includes(mClean);
        });
      }
    }

    slip.memberId = member?.id || null;
    slip.tunkin = member?.tunlesKinerja ? Number(member.tunlesKinerja) : 0;

    // Skip if already seen this member (deduplicate within same file)
    if (slip.memberId && seenMemberIds.has(slip.memberId)) {
      skippedRows.push(i + 1);
      continue;
    }
    if (slip.memberId) seenMemberIds.add(slip.memberId);

    // Generate unique NRP if empty (schema has @@unique [periodId, nrp])
    if (!slip.nrp && member?.nrp) {
      slip.nrp = member.nrp;
    } else if (!slip.nrp) {
      slip.nrp = `NO-NRP-${sourceType.toUpperCase()}-${i}`;
    }

    slip.totalPotKoperasi = slip.potTajib + slip.potSP + slip.potBarang + slip.potSukarela + slip.potKoperasiLain;
    slip.sisaGaji = slip.terimaBersih;
    slip.sisaTunkin = Math.max(0, slip.tunkin);
    slip.bisaDiambilATM = Math.max(0, slip.terimaBersih - slip.sisaRekening);

    slips.push(slip);
  }

  const matched = slips.filter((s) => s.memberId).length;
  console.log(`  Parsed: ${slips.length} rows, ${matched} matched to members, ${skippedRows.length} skipped`);

  if (slips.length === 0) {
    console.error("  ERROR: No valid rows parsed. Aborting.");
    return;
  }

  // Show sample preview
  console.log(`\n  Preview (first 5 rows):`);
  for (const s of slips.slice(0, 5)) {
    console.log(`    ${s.pangkat} ${s.nama} | gaji=${s.gajiBersih} | potNonBRI=${s.jumlahPotNonBRI} | potBRI=${s.jumlahPotBRI} | terimaBersih=${s.terimaBersih} | sisaGaji=${s.sisaGaji} | matched=${!!s.memberId}`);
  }

  // Create period + slips in transaction
  console.log(`\n  Creating PayrollPeriod + ${slips.length} PayrollSlips...`);

  const adminUser = await prisma.user.findFirst({
    where: { email: "operator@koperasi.com" },
    select: { id: true },
  });
  const adminId = adminUser?.id || 1;

  const period = await prisma.$transaction(async (tx) => {
    const p = await tx.payrollPeriod.create({
      data: {
        periodName,
        periodMonth,
        periodYear,
        sourceFile: fileName,
        sourceType,
        status: "processed",
        totalMembers: slips.length,
        totalGaji: slips.reduce((sum, s) => sum + s.gajiBersih, 0),
        totalPotongan: slips.reduce((sum, s) => sum + s.totalPotKoperasi, 0),
        createdById: adminId,
      },
    });

    const BATCH = 100;
    for (let i = 0; i < slips.length; i += BATCH) {
      const batch = slips.slice(i, i + BATCH);
      await tx.payrollSlip.createMany({
        data: batch.map((s) => ({
          periodId: p.id,
          memberId: s.memberId,
          nrp: s.nrp,
          nama: s.nama,
          pangkat: s.pangkat,
          gajiBersih: s.gajiBersih,
          tunkin: s.tunkin,
          potTajib: s.potTajib,
          potSP: s.potSP,
          potBarang: s.potBarang,
          potSukarela: s.potSukarela,
          potKoperasiLain: s.potKoperasiLain,
          totalPotKoperasi: s.totalPotKoperasi,
          sisaGaji: s.sisaGaji,
          sisaTunkin: s.sisaTunkin,
          otherDeductions: s.otherDeductions,
          jumlahPotNonBRI: s.jumlahPotNonBRI,
          jumlahPotBRI: s.jumlahPotBRI,
          terimaBersih: s.terimaBersih,
          sisaRekening: s.sisaRekening,
          bisaDiambilATM: s.bisaDiambilATM,
        })),
      });
    }

    // Sync sisaGaji to Member records
    let syncCount = 0;
    for (const s of slips) {
      if (s.memberId && s.sisaGaji > 0) {
        await tx.member.update({
          where: { id: s.memberId },
          data: { sisaGaji: s.sisaGaji },
        });
        syncCount++;
      }
    }
    console.log(`  Synced sisaGaji for ${syncCount} members`);

    return p;
  }, { timeout: 120000 });

  console.log(`  DONE: Period "${periodName}" (${sourceType}) created with id=${period.id}`);
  console.log(`  Total: ${slips.length} slips, ${matched} matched to members`);
}

async function main() {
  const docsDir = path.resolve(__dirname, "..", "integrasi-akun-asli", "docs-mei");

  const polresFile = path.join(docsDir, "5. GAJI MEI 2026 POLRES.xls");
  const polsekFile = path.join(docsDir, "E. GAJI MEI 2026 POLSEK.xls");

  const fs = require("fs");
  for (const f of [polresFile, polsekFile]) {
    if (!fs.existsSync(f)) {
      console.error(`File not found: ${f}`);
      process.exit(1);
    }
    console.log(`Found: ${f} (${(fs.statSync(f).size / 1024).toFixed(0)} KB)`);
  }

  // Import POLRES first, then POLSEK
  await importFile(polresFile, "polres");
  await importFile(polsekFile, "polsek");

  // Verify result
  const members = await prisma.member.findMany({
    where: { deletedAt: null, sisaGaji: { not: null } },
    select: { id: true, sisaGaji: true },
  });
  console.log(`\n========== SUMMARY ==========`);
  console.log(`Members with sisaGaji set: ${members.length}`);
  const totalSisaGaji = members.reduce((sum, m) => sum + (Number(m.sisaGaji) || 0), 0);
  console.log(`Total sisaGaji: Rp ${totalSisaGaji.toLocaleString("id-ID")}`);

  // Count unmatched slips
  const allSlips = await prisma.payrollSlip.findMany({
    where: { memberId: null },
    select: { nama: true, nrp: true },
  });
  if (allSlips.length > 0) {
    console.log(`\nUnmatched slips (${allSlips.length}):`);
    for (const s of allSlips.slice(0, 10)) {
      console.log(`  ${s.nrp || "NO_NRP"} | ${s.nama}`);
    }
    if (allSlips.length > 10) console.log(`  ... and ${allSlips.length - 10} more`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FATAL:", e);
  prisma.$disconnect();
  process.exit(1);
});
