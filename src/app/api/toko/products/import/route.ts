import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// POST /api/toko/products/import
export async function POST(request: Request) {
    try {
        const formData: any = await request.formData();
        const file = formData.get("file") as File | null;
        const mode = (formData.get("mode") as string) || "preview"; // preview, commit

        if (!file) {
            return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
        }

        // Read file ArrayBuffer and parse with XLSX
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as string[][];

        // Filter out empty rows
        rows = rows.filter(row => row.some(cell => cell && String(cell).trim() !== ""));

        if (rows.length === 0) {
            return NextResponse.json({ message: "File kosong atau format tidak valid" }, { status: 400 });
        }

        // Find header row
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(20, rows.length); i++) {
            const rowStr = rows[i].join(" ").toLowerCase();
            if (rowStr.includes("kode") || rowStr.includes("sku") || rowStr.includes("nama") || rowStr.includes("barang") || rowStr.includes("rak")) {
                headerRowIndex = i;
                break;
            }
        }

        const headers = rows[headerRowIndex].map(h => String(h).toLowerCase().trim());
        const dataRows = rows.slice(headerRowIndex + 1);

        // Map column indices safely
        const kodeIdx = headers.findIndex(h => h === "kode" || h === "sku");
        const namaIdx = headers.findIndex(h => h.includes("nama"));
        const rakIdx = headers.findIndex(h => h === "rak" || h === "kategori" || h === "category");
        const stockGdgIdx = headers.findIndex(h => h.includes("gdg") || h.includes("gudang"));
        const stockTokoIdx = headers.findIndex(h => h.includes("toko") && !h.includes("total") && !h.includes("harga"));
        const totalStockIdx = headers.findIndex(h => h.includes("total") || h === "stock");
        const satuanIdx = headers.findIndex(h => h === "sat" || (h.includes("satuan") && !h.includes("harga")));
        // Detect harga jual: "@ harga sat" or "harga jual" — must NOT collide with satuanIdx
        const hargaJualIdx = headers.findIndex(h => h.includes("@") || (h.includes("harga") && !h.includes("pokok")));
        const hargaPokokIdx = headers.findIndex(h => h.includes("pokok") || h.includes("hpp") || h === "hrgpokok");

        if (kodeIdx === -1 || namaIdx === -1) {
            return NextResponse.json(
                { data: { success: 0, failed: 0, error: "Kolom KODE dan Nama Barang wajib ada di header file.", preview: [] } }
            );
        }

        const existingProducts = await prisma.storeProduct.findMany({
            where: { deletedAt: null },
            select: { id: true, sku: true, name: true, stock: true, stockGdg: true, stockToko: true, sellPrice: true }
        });

        const results: any[] = [];
        const upsertMap = new Map<string, any>();
        const resultMap = new Map<string, any>();
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (row.length === 0) continue;

            const skuVal = row[kodeIdx];
            const nameVal = row[namaIdx];
            const sku = skuVal !== undefined && skuVal !== null ? String(skuVal).trim() : '';
            const name = nameVal !== undefined && nameVal !== null ? String(nameVal).trim() : '';
            
            if (!sku || !name || name.toUpperCase() === 'NAMA BARANG') continue;

            const category = rakIdx !== -1 && row[rakIdx] ? String(row[rakIdx]).trim() : '';
            const stockGdg = stockGdgIdx !== -1 ? cleanNumber(row[stockGdgIdx]) : 0;
            const stockToko = stockTokoIdx !== -1 ? cleanNumber(row[stockTokoIdx]) : 0;
            const stock = totalStockIdx !== -1 ? cleanNumber(row[totalStockIdx]) : (stockGdg + stockToko);
            const unit = satuanIdx !== -1 && row[satuanIdx] ? String(row[satuanIdx]).trim() || 'pcs' : 'pcs';
            
            // For prices, default to 0
            let sellPrice = hargaJualIdx !== -1 ? cleanNumber(row[hargaJualIdx]) : 0;
            const costPrice = hargaPokokIdx !== -1 ? cleanNumber(row[hargaPokokIdx]) : 0;
            
            // if we somehow couldn't find a sell price column, we can't accept it if it's new
            const existing = existingProducts.find(p => p.sku === sku);
            const isNew = !existing;

            if (sellPrice <= 0 && isNew) {
                results.push({
                    row: i + 2, sku, name, stockGdg, stockToko, stock, sellPrice,
                    status: 'error', reason: 'Produk Baru: Harga Jual (@ Harga Sat) tidak valid atau 0'
                });
                failCount++;
                continue;
            }
            
            if (sellPrice <= 0 && existing) {
                // If existing and sell price invalid from CSV, keep the existing one to be safe
                sellPrice = Number(existing.sellPrice);
            }

            if (resultMap.has(sku)) {
                results.push({
                    row: i + 2, sku, name, category, stockGdg, stockToko, stock, unit, sellPrice, costPrice,
                    isNew, status: 'error', reason: 'SKU Ganda/Duplikat di dalam file Excel',
                    currentStock: null,
                    currentSellPrice: null
                });
                failCount++;
                continue;
            }

            if (mode === "commit") {
                upsertMap.set(sku, prisma.storeProduct.upsert({
                    where: { sku },
                    update: {
                        name, category, costPrice, sellPrice, stock, stockGdg, stockToko, unit
                    },
                    create: {
                        sku, name, category, costPrice, sellPrice, stock, stockGdg, stockToko, unit,
                        minStock: Math.max(Math.ceil(stock * 0.1), 5)
                    }
                }));
            }

            successCount++;
            resultMap.set(sku, {
                row: i + 2, sku, name, category, stockGdg, stockToko, stock, unit, sellPrice, costPrice,
                isNew, status: 'valid', reason: null,
                currentStock: existing ? existing.stock : null,
                currentSellPrice: existing ? Number(existing.sellPrice) : null
            });
        }
        
        const finalResults = Array.from(resultMap.values());
        results.push(...finalResults);

        if (mode === "commit" && upsertMap.size > 0) {
            // Run exactly one promise per unique SKU, in batches of 50
            const upserts = Array.from(upsertMap.values());
            const BATCH_SIZE = 50;
            for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
                const batch = upserts.slice(i, i + BATCH_SIZE);
                await Promise.all(batch);
            }
        }

        try {
            if (mode === "commit") {
                const session = await auth();
                const reqInfo = extractRequestInfo(request);
                const userInfo = extractUserFromSession(session);
                await logAudit({
                    ...userInfo, ...reqInfo,
                    action: "IMPORT", module: "Toko",
                    description: `Import produk toko: ${successCount} berhasil, ${failCount} gagal`,
                    newData: { mode, totalRows: finalResults.length, success: successCount, failed: failCount },
                });
            }
        } catch (e) { /* silent fail for audit */ }

        return NextResponse.json({
            data: {
                mode,
                totalRows: results.length,
                success: successCount,
                failed: failCount,
                preview: results,
            }
        });

    } catch (error) {
        console.error("POST /api/toko/products/import error:", error);
        return NextResponse.json(
            { message: "Gagal memproses import data. Pastikan format file benar." },
            { status: 500 }
        );
    }
}

function cleanNumber(raw: string | number | undefined | null): number {
    if (raw === undefined || raw === null) return 0;
    if (typeof raw === 'number') return raw;
    const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}
