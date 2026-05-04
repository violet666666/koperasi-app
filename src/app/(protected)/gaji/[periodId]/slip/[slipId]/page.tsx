"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Printer } from "lucide-react";
import { useAuth } from "@/lib/hooks";

// -- Types --
interface PeriodInfo {
    id: number;
    periodName: string;
    periodMonth: number;
    periodYear: number;
}

interface SlipData {
    id: number;
    period: PeriodInfo;
    nrp: string;
    nama: string;
    pangkat: string;
    gajiBersih: number;
    tunkin: number;
    potTajib: number;
    potSP: number;
    potBarang: number;
    potSukarela: number;
    potKoperasiLain: number;
    totalPotKoperasi: number;
    sisaGaji: number;
    sisaTunkin: number;
    otherDeductions: Record<string, number> | null;
    jumlahPotNonBRI: number;
    jumlahPotBRI: number;
    terimaBersih: number;
    sisaRekening: number;
    bisaDiambilATM: number;
    memberId: number | null;
}

// -- Helpers --
function formatRp(amount: number): string {
    if (amount === 0) return "-";
    return (
        "Rp " +
        amount.toLocaleString("id-ID")
    );
}

const MONTH_NAMES_ID = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Kunci otherDeductions yang termasuk potongan BRI */
function isBRIKey(key: string): boolean {
    const lower = key.toLowerCase();
    return (
        lower.includes("bri") ||
        lower.includes("sudirman") ||
        (lower.includes("cabang") && !lower.includes("koperasi")) ||
        lower.includes("unit lain")
    );
}

/** Label potongan koperasi yang terstruktur */
const KOPERASI_ITEMS: Array<{ label: string; key: string }> = [
    { label: "Tajip Primkoppol", key: "potTajib" },
    { label: "SP Pinjaman", key: "potSP" },
    { label: "Barang Primkoppol", key: "potBarang" },
    { label: "Simp. Sukarela", key: "potSukarela" },
    { label: "Koperasi Lain", key: "potKoperasiLain" },
];

export default function SlipGajiPage() {
    const params = useParams<{ periodId: string; slipId: string }>();
    const { user } = useAuth();
    const printRef = React.useRef<HTMLDivElement>(null);

    const periodId = params.periodId;
    const slipId = params.slipId;

    const [slipData, setSlipData] = React.useState<SlipData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [fetchError, setFetchError] = React.useState("");

    // Fetch slip detail
    React.useEffect(() => {
        const fetchSlip = async () => {
            setIsLoading(true);
            setFetchError("");
            try {
                const res = await fetch(`/api/payroll/${periodId}/slip/${slipId}`);
                const json = await res.json();
                if (!res.ok)
                    throw new Error(json.message || "Gagal memuat data slip");
                setSlipData(json.data);
            } catch (err: unknown) {
                const msg =
                    err instanceof Error
                        ? err.message
                        : "Gagal memuat data slip gaji";
                setFetchError(msg);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSlip();
    }, [periodId, slipId]);

    // Print handler - window.open pattern
    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent || !slipData) return;
        const win = window.open("", "_blank", "width=800,height=900");
        if (!win) return;
        win.document.write(`
            <html>
            <head>
                <title>Slip Gaji - ${slipData.nama}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 12px;
                        padding: 20px;
                        color: #000;
                        max-width: 680px;
                        margin: 0 auto;
                    }
                    .slip-box {
                        border: 1px solid #000;
                        padding: 16px;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .line { border-top: 1px dashed #333; margin: 6px 0; }
                    .row { display: flex; justify-content: space-between; line-height: 1.6; }
                    .row-label { min-width: 200px; }
                    .row-value { text-align: right; font-family: 'Courier New', monospace; white-space: nowrap; }
                    .section-title { font-weight: bold; margin-top: 4px; line-height: 1.8; }
                    .indent { padding-left: 16px; }
                    .total-row { font-weight: bold; }
                    .internal { color: #666; font-style: italic; }
                    .signature-section { margin-top: 20px; }
                    .signature-row { display: flex; justify-content: space-between; margin-top: 40px; }
                    .signature-col { text-align: center; min-width: 160px; }
                    .signature-line { margin-top: 60px; border-bottom: 1px solid #000; }
                    @media print {
                        body { padding: 0; }
                        .slip-box { border: none; }
                    }
                </style>
            </head>
            <body>${printContent.innerHTML}</body>
            </html>
        `);
        win.document.close();
        setTimeout(() => {
            if (!win.closed) {
                win.print();
                setTimeout(() => {
                    if (!win.closed) win.close();
                }, 1000);
            }
        }, 300);
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Slip Gaji"
                    backHref={`/gaji/${periodId}`}
                    backLabel="Kembali ke Detail Periode"
                />
                <Card>
                    <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Memuat data slip gaji...
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Error state
    if (fetchError || !slipData) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Slip Gaji"
                    backHref={`/gaji/${periodId}`}
                    backLabel="Kembali ke Detail Periode"
                />
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="py-4 text-red-700">
                        {fetchError || "Data slip tidak ditemukan"}
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Parse otherDeductions
    const other = slipData.otherDeductions ?? {};
    const nonBRIEntries = Object.entries(other).filter(
        ([key]) => !isBRIKey(key)
    );
    const briEntries = Object.entries(other).filter(([key]) =>
        isBRIKey(key)
    );

    // Date string: "Lumajang, 4 Mei 2026"
    const today = new Date();
    const dateStr = `Lumajang, ${today.getDate()} ${MONTH_NAMES_ID[slipData.period.periodMonth]} ${slipData.period.periodYear}`;

    return (
        <div className="space-y-6">
            <PageHeader
                title={`Slip Gaji - ${slipData.nama}`}
                description={`Periode: ${slipData.period.periodName}`}
                backHref={`/gaji/${periodId}`}
                backLabel="Kembali ke Detail Periode"
                actions={
                    <Button onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Cetak Slip
                    </Button>
                }
            />

            {/* Slip Preview Container */}
            <div className="flex justify-center">
                <div
                    ref={printRef}
                    className="font-mono text-xs bg-white text-black p-4 rounded border max-w-[700px] w-full"
                    style={{ borderStyle: "solid" }}
                >
                    {/* ============================
                        Header
                       ============================ */}
                    <div className="text-center font-bold text-sm leading-snug">
                        KOPERASI PRIMKOPPOL
                    </div>
                    <div className="text-center text-xs">POLRES LUMAJANG</div>

                    <div className="border-t border-dashed border-gray-400 my-2" />

                    <div className="text-center font-bold text-sm">
                        SLIP GAJI &amp; POTONGAN
                    </div>
                    <div className="text-center">
                        Periode: {slipData.period.periodName}
                    </div>

                    <div className="border-t border-dashed border-gray-400 my-2" />

                    {/* ============================
                        Identity
                       ============================ */}
                    <div className="space-y-0.5">
                        <div className="flex justify-between">
                            <span>
                                Nama<span className="inline-block w-[32ch]">&nbsp;: {slipData.nama}</span>
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>
                                Pangkat<span className="inline-block w-[28ch]">&nbsp;: {slipData.pangkat}</span>
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>
                                NRP<span className="inline-block w-[32ch]">&nbsp;: {slipData.nrp}</span>
                            </span>
                        </div>
                    </div>

                    <div className="border-t border-dashed border-gray-400 my-2" />

                    {/* ============================
                        Gaji Bersih
                       ============================ */}
                    <div className="flex justify-between font-bold">
                        <span>GAJI BERSIH</span>
                        <span className="tabular-nums">{formatRp(slipData.gajiBersih)}</span>
                    </div>

                    <div className="border-t border-dashed border-gray-400 my-2" />

                    {/* ============================
                        Potongan Koperasi
                       ============================ */}
                    <div className="font-bold">POTONGAN KOPERASI PRIMKOPPOL:</div>
                    {KOPERASI_ITEMS.map((item) => {
                        const val = slipData[item.key as keyof SlipData] as number;
                        if (val === 0) return null;
                        return (
                            <div key={item.key} className="flex justify-between pl-4">
                                <span>{item.label}</span>
                                <span className="tabular-nums">{formatRp(val)}</span>
                            </div>
                        );
                    })}
                    <div className="flex justify-between font-bold border-t border-dashed border-gray-300 mt-1 pt-1">
                        <span>TOTAL POT KOPERASI</span>
                        <span className="tabular-nums">
                            {formatRp(slipData.totalPotKoperasi)}
                        </span>
                    </div>

                    <div className="border-t border-dashed border-gray-400 my-2" />

                    {/* ============================
                        Potongan Lainnya (non-BRI)
                       ============================ */}
                    <div className="font-bold">POTONGAN LAINNYA:</div>
                    {nonBRIEntries.map(([key, val]) => (
                        <div key={key} className="flex justify-between pl-4">
                            <span>{key}</span>
                            <span className="tabular-nums">{formatRp(val)}</span>
                        </div>
                    ))}

                    <div className="border-t border-dashed border-gray-400 my-2" />

                    {/* ============================
                        Jumlah Potongan Non BRI + BRI section
                       ============================ */}
                    <div className="flex justify-between font-bold">
                        <span>JML POTONGAN NON BRI</span>
                        <span className="tabular-nums">
                            {formatRp(slipData.jumlahPotNonBRI)}
                        </span>
                    </div>

                    {briEntries.length > 0 && (
                        <>
                            {briEntries.map(([key, val]) => (
                                <div key={key} className="flex justify-between pl-4">
                                    <span>{key}</span>
                                    <span className="tabular-nums">{formatRp(val)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between font-bold">
                                <span>JML POTONGAN BRI</span>
                                <span className="tabular-nums">
                                    {formatRp(slipData.jumlahPotBRI)}
                                </span>
                            </div>
                        </>
                    )}

                    <div className="border-t border-dashed border-gray-400 my-2" />

                    {/* ============================
                        Summary
                       ============================ */}
                    <div className="flex justify-between font-bold">
                        <span>TERIMA BERSIH</span>
                        <span className="tabular-nums">
                            {formatRp(slipData.terimaBersih)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>SISA DI REKENING</span>
                        <span className="tabular-nums">
                            {formatRp(slipData.sisaRekening)}
                        </span>
                    </div>
                    <div className="flex justify-between font-bold">
                        <span>BISA DIAMBIL DI ATM</span>
                        <span className="tabular-nums">
                            {formatRp(slipData.bisaDiambilATM)}
                        </span>
                    </div>

                    <div className="border-t border-dashed border-gray-400 my-2" />

                    {/* ============================
                        Internal section (kalkulasi koperasi)
                       ============================ */}
                    <div className="flex justify-between text-gray-500 italic">
                        <span>*) Sisa Gaji (internal)</span>
                        <span className="tabular-nums">{formatRp(slipData.sisaGaji)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 italic">
                        <span>*) Sisa Tunkin (internal)</span>
                        <span className="tabular-nums">{formatRp(slipData.sisaTunkin)}</span>
                    </div>
                    <div className="text-gray-500 italic text-[10px] mt-1">
                        * = kalkulasi koperasi, bukan dari BRI
                    </div>

                    <div className="border-t border-dashed border-gray-400 my-2" />

                    {/* ============================
                        Signature
                       ============================ */}
                    <div className="text-right mt-4">{dateStr}</div>
                    <div className="flex justify-between mt-8">
                        <div className="text-center w-[200px]">
                            <div className="font-bold">Ketua Koperasi</div>
                            <div style={{ marginTop: "60px" }}>(_________)</div>
                        </div>
                        <div className="text-center w-[200px]">
                            <div className="font-bold">Bendahara</div>
                            <div style={{ marginTop: "60px" }}>(_________)</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
