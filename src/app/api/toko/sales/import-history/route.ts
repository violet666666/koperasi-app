import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// ====================================================================
// IMPORT HISTORY BELANJA TOKO (MULTI-BULAN)
// This strictly reads ONLY the 'BARANG' column and maps it to StoreSale
// It ignores TAJIB and SP to prevent double-count
// Format is: NRP, TAJIB, BARANG, SP, JUMLAH, NAMA, BULAN
// ====================================================================

export async function POST(request: Request) {
    try {
        const formData: any = await request.formData();
        const file = formData.get("file") as File | null;
        const mode = (formData.get("mode") as string) || "preview";

        if (!file) {
            return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        let allRows: { row: string[], sheetName: string, rowIndex: number }[] = [];
        for (const sheetName of workbook.SheetNames) {
            const ws = workbook.Sheets[sheetName];
            const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];
            for (let i = 0; i < sheetRows.length; i++) {
                allRows.push({ row: sheetRows[i], sheetName, rowIndex: i });
            }
        }

        if (allRows.length < 2) {
            return NextResponse.json({ message: "File kosong" }, { status: 400 });
        }

        const allMembers = await prisma.member.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, nrp: true, memberNo: true }
        });

        // Store accumulations per member across months for StoreSale creation
        const memberSalesMap = new Map<number, { totalBarang: number; months: Set<string>; name: string; records: { bulan: string, barang: number }[] }>();
        let totalFail = 0;
        const allResults: any[] = [];
        const processedRows = new Set<string>(); // NRP+BULAN dedup

        for (let i = 0; i < allRows.length; i++) {
            const { row, sheetName, rowIndex } = allRows[i];
            const nrpRaw = String(row[0] || '').trim();
            if (!nrpRaw) continue;

            if (nrpRaw.toUpperCase() === 'NRP' || String(row[1] || '').toUpperCase().includes('TAJIB')) continue;

            const nrp = cleanNrp(nrpRaw);
            const barang = cleanNumber(row[2]); // ONLY extracts BARANG (Col 2)
            const nama = String(row[5] || '').trim();
            // Get month based on sheetName prioritizing, then column 6 fallback
            let bulan = extractMonthInt(sheetName, String(row[6] || '').trim());

            if (barang <= 0) continue;

            // Normalize month (in case it wasn't parsed strictly)
            if (!bulan) bulan = "1"; // Default to jan if missing

            const dedupKey = `${nrp}-${bulan}`;
            if (processedRows.has(dedupKey)) continue;
            processedRows.add(dedupKey);

            let match = allMembers.find(m => m.nrp === nrp || m.memberNo === nrp);
            if (!match && nama) {
                const cleanNama = cleanNameForMatch(nama);
                const matches = allMembers.filter(m => {
                    const mClean = cleanNameForMatch(m.name);
                    return mClean === cleanNama || mClean.startsWith(cleanNama) || cleanNama.startsWith(mClean);
                });
                if (matches.length === 1) match = matches[0];
            }

            if (!match) {
                allResults.push({
                    row: rowIndex + 1, nrp, nama,
                    status: 'error', reason: `Anggota tidak ditemukan`
                });
                totalFail++;
                continue;
            }

            const existing = memberSalesMap.get(match.id);
            if (existing) {
                existing.totalBarang += barang;
                existing.months.add(bulan);
                existing.records.push({ bulan, barang });
            } else {
                memberSalesMap.set(match.id, {
                    totalBarang: barang,
                    months: new Set([bulan]),
                    name: match.name,
                    records: [{ bulan, barang }]
                });
            }
        }

        const memberSummary: any[] = [];
        for (const [memberId, data] of memberSalesMap.entries()) {
            const member = allMembers.find(m => m.id === memberId);
            if (!member) continue;

            // Format array of month numbers back to names for better preview reading
            const monthNamesArr = Array.from(data.months).map(m => getMonthNameFromInt(m));
            const monthLabel = monthNamesArr.length > 2 ? `${monthNamesArr.length} bulan (${monthNamesArr[0]}..)` : monthNamesArr.join(", ");

            memberSummary.push({
                row: 0,
                nrp: member.nrp || member.memberNo,
                nama: member.name,
                memberName: member.name, // Renders badge "BARU" vs "Dilewati" on frontend automatically if this exists
                status: 'valid',
                totalBarang: data.totalBarang,
                reason: `+ Hist. ${monthLabel}`,
                isNewMember: false,
            });
        }

        // Distinct errors
        const seenErrorNrps = new Set<string>();
        const uniqueErrors = allResults.filter(r => {
            if (r.status !== 'error') return false;
            if (seenErrorNrps.has(r.nrp)) return false;
            seenErrorNrps.add(r.nrp);
            return true;
        });

        if (mode === "commit" && memberSalesMap.size > 0) {
            const BATCH_SIZE = 50;
            const memberEntries = [...memberSalesMap.entries()];

            const session = await auth();
            const userInfo = extractUserFromSession(session);
            let createdById = userInfo.userId;
            if (!createdById) {
                const firstUser = await prisma.user.findFirst();
                createdById = firstUser?.id || 1;
            }

            let potonganProduct = await prisma.storeProduct.findUnique({ where: { sku: 'POT_BRG_001' } });
            if (!potonganProduct) {
                potonganProduct = await prisma.storeProduct.create({
                    data: {
                        sku: 'POT_BRG_001',
                        name: 'History Pembelian Toko (Import Excel)',
                        sellPrice: 0,
                        category: 'Import',
                        isActive: true,
                    }
                });
            }

            for (let batchStart = 0; batchStart < memberEntries.length; batchStart += BATCH_SIZE) {
                const batch = memberEntries.slice(batchStart, batchStart + BATCH_SIZE);
                await Promise.all(batch.map(async ([memberId, data]) => {

                    // Creates exactly 1 StoreSale per Month so the transaction dates spread out realistically
                    for (const record of data.records) {
                        const yr = new Date().getFullYear();
                        const mStr = getMonthNameFromInt(record.bulan);
                        const mNum = parseInt(record.bulan, 10);
                        const mockDate = new Date(yr, mNum > 0 ? mNum - 1 : 0, 25);  // Approximate 25th payload

                        const trxNo = `POS-HIS-${mStr.toUpperCase()}-${new Date().getTime()}-${memberId}`;
                        await prisma.storeSale.create({
                            data: {
                                saleNo: trxNo,
                                memberId: memberId,
                                totalAmount: record.barang,
                                cashReceived: record.barang, // Paid fully via salary deduction history
                                changeAmount: 0,
                                paymentMethod: "cash", // Simulates paid status
                                items: {
                                    create: [{
                                        productId: potonganProduct!.id,
                                        quantity: 1,
                                        unitPrice: record.barang,
                                        subtotal: record.barang
                                    }]
                                },
                                createdById: createdById,
                                createdAt: mockDate, // Set the actual database timestamp backwards to match historical bounds if possible
                            }
                        });
                    }
                }));
            }

            try {
                const session = await auth();
                const reqInfo = extractRequestInfo(request);
                const userInfo = extractUserFromSession(session);
                await logAudit({
                    ...userInfo, ...reqInfo,
                    action: "IMPORT", module: "Toko",
                    description: `Import Beban Belanja Toko: ${memberSalesMap.size} anggota dari Excel Multi-sheet.`,
                    newData: { memberCount: memberSalesMap.size },
                });
            } catch (e) { }
        }

        return NextResponse.json({
            data: {
                totalRows: memberSummary.length + uniqueErrors.length,
                success: memberSummary.length,
                failed: uniqueErrors.length,
                preview: [...memberSummary, ...uniqueErrors.map(e => ({
                    row: e.row, nrp: e.nrp, nama: e.nama,
                    status: 'error', reason: e.reason,
                    totalBarang: 0
                }))]
            }
        });

    } catch (err: any) {
        console.error("POST /api/toko/sales/import-history error:", err);
        return NextResponse.json({ message: "Gagal memproses file: " + err.message }, { status: 500 });
    }
}

function cleanNrp(raw: string): string {
    return String(raw).replace(/['"]/g, '').replace(/\.0$/, '').trim();
}

function cleanNumber(raw: string | number | undefined): number {
    if (raw === undefined || raw === null) return 0;
    if (typeof raw === 'number') return raw;
    const s = String(raw).trim();
    if (s === '-' || s === '') return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function cleanNameForMatch(name: string): string {
    if (!name) return "";
    let clean = String(name).replace(/['"]/g, '').trim().toUpperCase();
    clean = clean.split(',')[0].trim();
    const titles = [' S.I.K.', ' SIK', ' S.H.', ' SH', ' S.PD.', ' S.PD', ' S.T.K.', ' STK', ' S.SOS.', ' S.SOS', ' S.E.', ' SE', ' S.IP.', ' SIP', ' M.H.', ' MH', ' M.SC.', ' MSC', ' M.M.', ' MM', ' S.T.', ' ST', ' S.PT.', ' SPT', ' S.OR.'];
    let changed = true;
    while (changed) {
        changed = false;
        for (const t of titles) {
            if (clean.endsWith(t) || clean.endsWith(t.replace(/\./g, ''))) {
                clean = clean.substring(0, clean.length - t.length).trim();
                changed = true;
            }
        }
    }
    return clean.replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

function getMonthNameFromInt(monthInt: string): string {
    const map: Record<string, string> = {
        '1': 'Jan', '2': 'Feb', '3': 'Mar', '4': 'Apr', '5': 'Mei', '6': 'Jun',
        '7': 'Jul', '8': 'Agu', '9': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Des'
    };
    return map[monthInt] || `Bulan ${monthInt}`;
}

function extractMonthInt(sheetName: string, fallbackNum: string): string {
    const s = sheetName.toUpperCase();
    if (s.includes('JAN')) return "1";
    if (s.includes('PEB') || s.includes('FEB')) return "2";
    if (s.includes('MAR')) return "3";
    if (s.includes('APR')) return "4";
    if (s.includes('MEI') || s.includes('MAY')) return "5";
    if (s.includes('JUN')) return "6";
    if (s.includes('JUL')) return "7";
    if (s.includes('AGU') || s.includes('AUG')) return "8";
    if (s.includes('SEP')) return "9";
    if (s.includes('OKT') || s.includes('OCT')) return "10";
    if (s.includes('NOV')) return "11";
    if (s.includes('DES') || s.includes('DEC')) return "12";

    const parsedFallback = parseInt(fallbackNum);
    // Only accept fallback if it represents a valid real month, to avoid interpreting random column text/numbers natively
    if (!isNaN(parsedFallback) && parsedFallback >= 1 && parsedFallback <= 12) {
        return String(parsedFallback);
    }
    return "1"; // Safest fallback
}
