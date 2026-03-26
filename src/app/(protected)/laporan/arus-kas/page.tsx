"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface CashFlowItem { description: string; amount: number; }
interface CashFlowData {
    openingBalance: number;
    closingBalance: number;
    operating: { inflows: CashFlowItem[]; outflows: CashFlowItem[]; net: number };
    investing: { inflows: CashFlowItem[]; outflows: CashFlowItem[]; net: number };
    financing: { inflows: CashFlowItem[]; outflows: CashFlowItem[]; net: number };
    netChange: number;
}

export default function ArusKasPage() {
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = React.useState<string>(String(now.getMonth() + 1).padStart(2, "0"));
    const [selectedYear, setSelectedYear] = React.useState<string>(String(now.getFullYear()));
    const [data, setData] = React.useState<CashFlowData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                // Fetch journal lines grouped by account type for the period
                const month = parseInt(selectedMonth);
                const year = parseInt(selectedYear);
                const res = await fetch(`/api/journals?period=all`);
                if (!res.ok) throw new Error("Failed");
                const json = await res.json();
                const journals = json.data || [];

                // Filter to selected month/year
                const filtered = journals.filter((j: any) => {
                    const d = new Date(j.transactionDate);
                    return d.getMonth() + 1 === month && d.getFullYear() === year;
                });

                // Aggregate by sourceType into categories
                const opIn: Record<string, number> = {};
                const opOut: Record<string, number> = {};
                const invIn: Record<string, number> = {};
                const invOut: Record<string, number> = {};
                const finIn: Record<string, number> = {};
                const finOut: Record<string, number> = {};

                const opInLabels: Record<string, string> = {
                    loan_payment: "Penerimaan Angsuran Pinjaman",
                    savings: "Penerimaan Simpanan Anggota",
                    store_sale: "Pendapatan Toko",
                    manual: "Transaksi Manual",
                    cash_bank: "Transaksi Kas/Bank",
                };

                for (const j of filtered) {
                    const src = j.sourceType || "manual";
                    const net = j.totalDebit - j.totalCredit; // positive = debit > credit

                    if (["savings", "loan_payment", "store_sale", "cash_bank", "manual"].includes(src)) {
                        // Operating
                        if (j.totalDebit > 0) {
                            const label = opInLabels[src] || src;
                            opIn[label] = (opIn[label] || 0) + j.totalDebit;
                        }
                        if (j.totalCredit > 0 && src !== "loan_payment") {
                            const label = src === "loan" ? "Pencairan Pinjaman" : `Pengeluaran ${opInLabels[src] || src}`;
                            opOut[label] = (opOut[label] || 0) + j.totalCredit;
                        }
                    } else if (src === "loan") {
                        // Financing - loan disbursements
                        finOut["Pencairan Pinjaman Anggota"] = (finOut["Pencairan Pinjaman Anggota"] || 0) + j.totalDebit;
                    }
                }

                const toItems = (obj: Record<string, number>, negative = false): CashFlowItem[] =>
                    Object.entries(obj).map(([description, amount]) => ({ description, amount: negative ? -amount : amount }));

                const opInflowItems = toItems(opIn);
                const opOutflowItems = toItems(opOut, true);
                const netOp = opInflowItems.reduce((s, i) => s + i.amount, 0) + opOutflowItems.reduce((s, i) => s + i.amount, 0);

                const invInflowItems = toItems(invIn);
                const invOutflowItems = toItems(invOut, true);
                const netInv = invInflowItems.reduce((s, i) => s + i.amount, 0) + invOutflowItems.reduce((s, i) => s + i.amount, 0);

                const finInflowItems = toItems(finIn);
                const finOutflowItems = toItems(finOut, true);
                const netFin = finInflowItems.reduce((s, i) => s + i.amount, 0) + finOutflowItems.reduce((s, i) => s + i.amount, 0);

                const netChange = netOp + netInv + netFin;

                setData({
                    openingBalance: 0, // Would need balance sheet data
                    closingBalance: netChange,
                    operating: { inflows: opInflowItems, outflows: opOutflowItems, net: netOp },
                    investing: { inflows: invInflowItems, outflows: invOutflowItems, net: netInv },
                    financing: { inflows: finInflowItems, outflows: finOutflowItems, net: netFin },
                    netChange,
                });
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [selectedMonth, selectedYear]);

    const monthName = new Date(2000, Number(selectedMonth) - 1).toLocaleDateString("id-ID", { month: "long" });
    const currentYear = new Date().getFullYear();

    return (
        <div className="space-y-6">
            <PageHeader title="Laporan Arus Kas" description="Pergerakan kas per periode"
                actions={<Button variant="outline"><Download className="mr-2 h-4 w-4" />Export Excel</Button>} />

            <Card><CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-center">
                    <span className="text-sm text-muted-foreground">Periode:</span>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {["01","02","03","04","05","06","07","08","09","10","11","12"].map(m => (
                                <SelectItem key={m} value={m}>{new Date(2000, parseInt(m) - 1).toLocaleDateString("id-ID", { month: "long" })}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {[currentYear - 2, currentYear - 1, currentYear].map(y => (
                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent></Card>

            {data && (
                <div className="grid gap-4 sm:grid-cols-3">
                    <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-muted p-3"><Wallet className="h-5 w-5 text-muted-foreground" /></div><div><p className="text-sm text-muted-foreground">Saldo Awal</p><p className="text-lg font-bold tabular-nums">{formatCurrency(data.openingBalance)}</p></div></CardContent></Card>
                    <Card><CardContent className="flex items-center gap-4 p-4">
                        <div className={`rounded-lg p-3 ${data.netChange >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                            {data.netChange >= 0 ? <ArrowUpCircle className="h-5 w-5 text-emerald-600" /> : <ArrowDownCircle className="h-5 w-5 text-red-600" />}
                        </div>
                        <div><p className="text-sm text-muted-foreground">Perubahan Kas</p><p className={`text-lg font-bold tabular-nums ${data.netChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>{data.netChange >= 0 ? "+" : ""}{formatCurrency(data.netChange)}</p></div>
                    </CardContent></Card>
                    <Card className="border-primary"><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-primary/10 p-3"><Wallet className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Saldo Akhir</p><p className="text-xl font-bold tabular-nums text-primary">{formatCurrency(data.closingBalance)}</p></div></CardContent></Card>
                </div>
            )}

            {isLoading ? (
                <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
            ) : data ? (
                <Card>
                    <CardHeader><CardTitle className="text-lg">Laporan Arus Kas</CardTitle><CardDescription>Periode {monthName} {selectedYear}</CardDescription></CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader><TableRow><TableHead>Keterangan</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                            <TableBody>
                                <TableRow className="bg-blue-50 dark:bg-blue-900/20">
                                    <TableCell colSpan={2} className="font-bold text-blue-700 dark:text-blue-300">ARUS KAS DARI AKTIVITAS OPERASI</TableCell>
                                </TableRow>
                                {data.operating.inflows.map((item, idx) => (
                                    <TableRow key={`op-in-${idx}`}><TableCell className="pl-6">{item.description}</TableCell><TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(item.amount)}</TableCell></TableRow>
                                ))}
                                {data.operating.outflows.map((item, idx) => (
                                    <TableRow key={`op-out-${idx}`}><TableCell className="pl-6">{item.description}</TableCell><TableCell className="text-right tabular-nums text-red-600">({formatCurrency(Math.abs(item.amount))})</TableCell></TableRow>
                                ))}
                                <TableRow className="bg-blue-100/50 dark:bg-blue-900/30 font-semibold">
                                    <TableCell>Arus Kas Bersih Aktivitas Operasi</TableCell>
                                    <TableCell className={`text-right tabular-nums ${data.operating.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(data.operating.net)}</TableCell>
                                </TableRow>

                                {(data.investing.inflows.length > 0 || data.investing.outflows.length > 0) && (
                                    <>
                                        <TableRow className="bg-purple-50 dark:bg-purple-900/20"><TableCell colSpan={2} className="font-bold text-purple-700 dark:text-purple-300">ARUS KAS DARI AKTIVITAS INVESTASI</TableCell></TableRow>
                                        {data.investing.inflows.concat(data.investing.outflows).map((item, idx) => (
                                            <TableRow key={`inv-${idx}`}><TableCell className="pl-6">{item.description}</TableCell><TableCell className={`text-right tabular-nums ${item.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{item.amount >= 0 ? formatCurrency(item.amount) : `(${formatCurrency(Math.abs(item.amount))})`}</TableCell></TableRow>
                                        ))}
                                        <TableRow className="bg-purple-100/50 dark:bg-purple-900/30 font-semibold"><TableCell>Arus Kas Bersih Aktivitas Investasi</TableCell><TableCell className={`text-right tabular-nums ${data.investing.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(data.investing.net)}</TableCell></TableRow>
                                    </>
                                )}

                                {(data.financing.inflows.length > 0 || data.financing.outflows.length > 0) && (
                                    <>
                                        <TableRow className="bg-amber-50 dark:bg-amber-900/20"><TableCell colSpan={2} className="font-bold text-amber-700 dark:text-amber-300">ARUS KAS DARI AKTIVITAS PENDANAAN</TableCell></TableRow>
                                        {data.financing.inflows.concat(data.financing.outflows).map((item, idx) => (
                                            <TableRow key={`fin-${idx}`}><TableCell className="pl-6">{item.description}</TableCell><TableCell className={`text-right tabular-nums ${item.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>{item.amount >= 0 ? formatCurrency(item.amount) : `(${formatCurrency(Math.abs(item.amount))})`}</TableCell></TableRow>
                                        ))}
                                        <TableRow className="bg-amber-100/50 dark:bg-amber-900/30 font-semibold"><TableCell>Arus Kas Bersih Aktivitas Pendanaan</TableCell><TableCell className={`text-right tabular-nums ${data.financing.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(data.financing.net)}</TableCell></TableRow>
                                    </>
                                )}

                                <TableRow className="bg-muted font-bold"><TableCell>Kenaikan/(Penurunan) Kas Bersih</TableCell><TableCell className={`text-right tabular-nums ${data.netChange >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(data.netChange)}</TableCell></TableRow>
                                <TableRow className="bg-primary/10 font-bold text-lg"><TableCell>Saldo Kas Akhir Periode</TableCell><TableCell className="text-right tabular-nums text-primary">{formatCurrency(data.closingBalance)}</TableCell></TableRow>

                                {data.operating.inflows.length === 0 && data.operating.outflows.length === 0 && (
                                    <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Tidak ada transaksi pada periode ini</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
