import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// ====================================================================
// BARANG PRIMKOPPOL - POTONGAN GAJI BULANAN
// After frontend CSV merge, format is:
//   col 0: NRP
//   col 1: TAJIB (usually 100,000)
//   col 2: BARANG (toko credit payment)
//   col 3: SP (loan installment)
//   col 4: JUMLAH (total)
//   col 5: NAMA
//   col 6: BULAN (month number, added by frontend multi-sheet merger)
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
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];

        if (rows.length < 2) {
            return NextResponse.json({ message: "File kosong" }, { status: 400 });
        }

        const allMembers = await prisma.member.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, nrp: true, memberNo: true, tabunganWajib: true }
        });

        const memberTajibMap = new Map<number, { tajib: number; barang: number; sp: number; months: number; name: string }>();
        let totalFail = 0;
        const allResults: any[] = [];
        const processedRows = new Set<string>(); // NRP+BULAN dedup

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const nrpRaw = String(row[0] || '').trim();
            if (!nrpRaw) continue;

            // Skip header rows
            if (nrpRaw.toUpperCase() === 'NRP' || String(row[1] || '').toUpperCase().includes('TAJIB')) continue;

            const nrp = cleanNrp(nrpRaw);
            const tajib = cleanNumber(row[1]);
            const barang = cleanNumber(row[2]);
            const sp = cleanNumber(row[3]);
            const jumlah = cleanNumber(row[4]);
            const nama = String(row[5] || '').trim();
            const bulan = String(row[6] || '').trim();

            if (tajib <= 0 && barang <= 0 && sp <= 0) continue;

            // Dedup by NRP+BULAN
            const dedupKey = `${nrp}-${bulan}`;
            if (processedRows.has(dedupKey)) continue;
            processedRows.add(dedupKey);

            // Match member
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
                    row: i + 1, nrp, nama,
                    status: 'error', reason: `Anggota tidak ditemukan`
                });
                totalFail++;
                continue;
            }

            // Accumulate TAJIB, BARANG, SP per member
            const existing = memberTajibMap.get(match.id);
            if (existing) {
                existing.tajib += tajib;
                existing.barang += barang;
                existing.sp += sp;
                existing.months += 1;
            } else {
                memberTajibMap.set(match.id, { tajib, barang, sp, months: 1, name: match.name });
            }
        }

        // Build summary per member for preview
        const memberSummary: any[] = [];
        for (const [memberId, data] of memberTajibMap.entries()) {
            const member = allMembers.find(m => m.id === memberId);
            if (!member) continue;
            memberSummary.push({
                row: 0,
                nrp: member.nrp || member.memberNo,
                nama: member.name,
                memberName: member.name,
                status: 'valid',
                gaji: data.tajib + data.barang + data.sp,
                currentGaji: Number(member.tabunganWajib || 0),
                reason: `${data.months} bulan, TAJIB:` + data.tajib.toLocaleString('id-ID') + 
                        `, SP:` + data.sp.toLocaleString('id-ID') + 
                        `, BRG:` + data.barang.toLocaleString('id-ID'),
                mutasiCount: data.months,
            });
        }

        // Deduplicate errors by NRP
        const seenErrorNrps = new Set<string>();
        const uniqueErrors = allResults.filter(r => {
            if (r.status !== 'error') return false;
            if (seenErrorNrps.has(r.nrp)) return false;
            seenErrorNrps.add(r.nrp);
            return true;
        });

        if (mode === "commit" && memberTajibMap.size > 0) {
            // Direct batch updates — NO wrapping transaction (avoids timeout)
            const BATCH_SIZE = 50;
            const memberEntries = [...memberTajibMap.entries()];
            
            // Resolve createdById to prevent FK constraint violation
            const session = await auth();
            const userInfo = extractUserFromSession(session);
            let createdById = userInfo.userId;
            if (!createdById) {
                const firstUser = await prisma.user.findFirst();
                createdById = firstUser?.id || 1;
            }

            // Ensure POTONGAN BARANG product exists
            let potonganProduct = await prisma.storeProduct.findUnique({ where: { sku: 'POT_BRG_001' } });
            if (!potonganProduct) {
                potonganProduct = await prisma.storeProduct.create({
                    data: {
                        sku: 'POT_BRG_001',
                        name: 'Pemotongan Barang (Gaji)',
                        sellPrice: 0, // dynamic per trx
                        category: 'Import',
                        isActive: true,
                    }
                });
            }

            for (let batchStart = 0; batchStart < memberEntries.length; batchStart += BATCH_SIZE) {
                const batch = memberEntries.slice(batchStart, batchStart + BATCH_SIZE);
                await Promise.all(batch.map(async ([memberId, data]) => {
                    // Update Simpanan Wajib
                    if (data.tajib > 0) {
                        await prisma.member.update({
                            where: { id: memberId },
                            data: { tabunganWajib: { increment: data.tajib } }
                        });
                    }

                    // Buat Penjualan Toko (Lunas) dari potongan BARANG
                    if (data.barang > 0 && potonganProduct) {
                        const trxNo = `POS-IMP-${new Date().getTime()}-${memberId}`;
                        await prisma.storeSale.create({
                            data: {
                                saleNo: trxNo,
                                memberId: memberId,
                                totalAmount: data.barang,
                                cashReceived: data.barang,
                                changeAmount: 0,
                                paymentMethod: "cash",
                                items: {
                                    create: [{
                                        productId: potonganProduct.id,
                                        quantity: 1,
                                        unitPrice: data.barang,
                                        subtotal: data.barang
                                    }]
                                },
                                createdById: createdById, 
                            }
                        });
                    }

                    // Bayarkan Angsuran Pinjaman dari potongan SP
                    if (data.sp > 0) {
                        // Cari pinjaman paling aktif yg belum lunas
                        const activeLoan = await prisma.loan.findFirst({
                            where: { memberId: memberId, status: "active" },
                            orderBy: { disbursementDate: "asc" }
                        });

                        if (activeLoan) {
                            // Potong uang SP untuk cicilan berjalan (Asumsi tanpa bunga karena bunga 0% / 1% JS sudah dikapitalisasi)
                            const paymentNo = `PAY-IMP-${new Date().getTime()}-${memberId}`;
                            // Biaya jasa (Bunga) dianggap sudah dikapitalisasi ke dalam pokok saat disbursed, sehingga di sini pure principalPaid.
                            // Atau split secara proporsional. Namun untuk simplicity import, masuk semua ke principalPaid karena interestRate = 0
                            await prisma.loanPayment.create({
                                data: {
                                    paymentNo,
                                    loanId: activeLoan.id,
                                    memberId: memberId,
                                    branchId: 1,
                                    amount: data.sp,
                                    principalPortion: data.sp, // Semua pembayaran memotong pokok utang yg sudah include JS (1%)
                                    interestPortion: 0,
                                    lateFeePortion: 0,
                                    paymentMethod: "cash",
                                    paymentDate: new Date(),
                                    createdById: createdById,
                                }
                            });
                            
                            // Update saldo outstanding, kalau lunas maka status paid_off
                            const currentOutstanding = Number(activeLoan.principalOutstanding) - data.sp;
                            await prisma.loan.update({
                                where: { id: activeLoan.id },
                                data: {
                                    principalPaid: { increment: data.sp },
                                    principalOutstanding: Math.max(0, currentOutstanding),
                                    status: currentOutstanding <= 0 ? "paid_off" : "active",
                                    paidOffDate: currentOutstanding <= 0 ? new Date() : null,
                                }
                            });
                        }
                        // Jika tidak ada loan aktif, abaikan (bisa ditambahkan ke Tabungan Sukarela jika diinginkan, namun kita skip dulu).
                    }
                }));
            }

            try {
                const session = await auth();
                const reqInfo = extractRequestInfo(request);
                const userInfo = extractUserFromSession(session);
                await logAudit({
                    ...userInfo, ...reqInfo,
                    action: "IMPORT",
                    module: "Anggota",
                    description: `Import potongan gaji (Barang): ${memberTajibMap.size} anggota, TAJIB, SP, BARANG diakumulasi.`,
                    newData: { memberCount: memberTajibMap.size },
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
                    gaji: 0, currentGaji: 0
                }))]
            }
        });

    } catch (err: any) {
        console.error("POST /api/transactions/import-potongan error:", err);
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
