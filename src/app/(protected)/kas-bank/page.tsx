"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import {
    Plus,
    ArrowUpCircle,
    ArrowDownCircle,
    Wallet,
    Building,
    ArrowLeftRight,
    FileUp,
    Loader2,
    ShoppingCart,
    CheckCircle2,
    AlertCircle,
    Eye
} from "lucide-react";
import { formatCurrency, CASH_BANK_TRANSACTION_TYPES, CASH_BANK_CATEGORIES } from "@/lib/constants";
import { cashBankApi } from "@/lib/api";

// Types
interface CashBankAccount {
    id: number;
    code: string;
    name: string;
    type: "cash" | "bank";
    bankName?: string;
    accountNumber?: string;
    currentBalance: number;
    isActive: boolean;
}

interface CashBankTransaction {
    id: number;
    transactionNo: string;
    accountId: number;
    account?: { code: string; name: string };
    type: "in" | "out";
    category?: keyof typeof CASH_BANK_CATEGORIES;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    referenceNo?: string;
    transactionDate: string;
}

interface UnitTransaction {
    id: number;
    transactionNo: string;
    unitType: string;
    description: string;
    amount: number;
    isPaid: boolean;
    paymentMethod?: string;
    transactionDate: string;
    member?: { name: string; nrp?: string };
    status?: string;
}

type ImportPreviewRow = {
    row: number;
    sheet: string;
    transactionDate: string;
    description: string;
    type: "in" | "out";
    amount: number;
    category: string;
    status: string;
};

// Account card component
function AccountCard({ account }: { account: CashBankAccount }) {
    const isCash = account.type === "cash";
    return (
        <Card>
            <CardContent className="flex items-center gap-4 p-4">
                <div className={`rounded-lg p-3 ${isCash ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                    {isCash ? <Wallet className="h-5 w-5" /> : <Building className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <p className="font-medium">{account.name}</p>
                        <Badge variant="outline" className="text-xs">{account.code}</Badge>
                    </div>
                    {account.type === "bank" && (
                        <p className="text-sm text-muted-foreground">
                            {account.bankName} - {account.accountNumber}
                        </p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(account.currentBalance)}</p>
                </div>
            </CardContent>
        </Card>
    );
}

// Transaction columns
const transactionColumns: ColumnDef<CashBankTransaction>[] = [
    {
        accessorKey: "transactionDate",
        header: "Tgl",
        cell: ({ row }) => {
            const dateValue = row.getValue("transactionDate");
            if (!dateValue) return "-";
            return new Date(dateValue as string).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
        },
    },
    {
        accessorKey: "transactionNo",
        header: "No. Bukti",
        cell: ({ row }) => <span className="font-mono text-sm font-medium text-muted-foreground">{row.getValue("transactionNo")}</span>,
    },
    {
        accessorKey: "description",
        header: "Keterangan & Kategori",
        cell: ({ row }) => {
            const catStr = row.original.category;
            const categoryObj = catStr ? CASH_BANK_CATEGORIES[catStr] : null;

            return (
                <div className="max-w-[250px]" title={row.getValue("description")}>
                    <p className="font-medium truncate whitespace-normal leading-tight text-sm">{row.getValue("description") || "-"}</p>
                    {categoryObj && (
                        <Badge variant="outline" className="text-[10px] mt-1 uppercase tracking-wider">
                            {categoryObj.label}
                        </Badge>
                    )}
                </div>
            );
        },
    },
    {
        id: "masuk",
        header: "Masuk (Debit)",
        cell: ({ row }) => {
            const type = row.original.type;
            const amount = row.original.amount;
            if (type !== "in") return <span className="text-muted-foreground">-</span>;
            return <span className="font-semibold text-emerald-600 tabular-nums">{formatCurrency(amount)}</span>;
        },
    },
    {
        id: "keluar",
        header: "Keluar (Kredit)",
        cell: ({ row }) => {
            const type = row.original.type;
            const amount = row.original.amount;
            if (type !== "out") return <span className="text-muted-foreground">-</span>;
            return <span className="font-semibold text-destructive tabular-nums">{formatCurrency(amount)}</span>;
        },
    },
    {
        accessorKey: "balanceAfter",
        header: "Saldo",
        cell: ({ row }) => {
            const balance = row.getValue("balanceAfter") as number;
            return <span className="font-bold tabular-nums text-primary">{formatCurrency(balance)}</span>;
        },
    },
];

export default function KasBankPage() {
    const [accountFilter, setAccountFilter] = React.useState("all");
    const [typeFilter, setTypeFilter] = React.useState("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [accounts, setAccounts] = React.useState<CashBankAccount[]>([]);
    const [transactions, setTransactions] = React.useState<CashBankTransaction[]>([]);
    const [unitTransactions, setUnitTransactions] = React.useState<UnitTransaction[]>([]);
    const [uploadDialog, setUploadDialog] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [importStep, setImportStep] = React.useState<"form" | "preview" | "done">("form");
    const [importPreview, setImportPreview] = React.useState<ImportPreviewRow[]>([]);
    const [importSummary, setImportSummary] = React.useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
    const [selectedUploadFile, setSelectedUploadFile] = React.useState<File | null>(null);
    const [selectedUploadAccount, setSelectedUploadAccount] = React.useState("");
    const [importFormat, setImportFormat] = React.useState("standard");
    const [koppolColumn, setKoppolColumn] = React.useState("tunai");

    // Calculate totals
    const totals = React.useMemo(() => {
        const cashTotal = accounts.filter((a) => a.type === "cash").reduce((sum, a) => sum + Number(a.currentBalance), 0);
        const bankTotal = accounts.filter((a) => a.type === "bank").reduce((sum, a) => sum + Number(a.currentBalance), 0);
        return { cash: cashTotal, bank: bankTotal, total: cashTotal + bankTotal };
    }, [accounts]);

    // Fetch data from API
    React.useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [accountsRes, transactionsRes] = await Promise.allSettled([
                    cashBankApi.accounts(),
                    cashBankApi.transactions({ perPage: 9999 }),
                ]);

                if (accountsRes.status === "fulfilled") {
                    setAccounts(accountsRes.value.data as unknown as CashBankAccount[]);
                }

                if (transactionsRes.status === "fulfilled") {
                    setTransactions(transactionsRes.value.data as unknown as CashBankTransaction[]);
                }

                // Also fetch unit transactions
                const unitRes = await fetch("/api/unit-transactions?perPage=500&sortOrder=desc");
                if (unitRes.ok) {
                    const unitJson = await unitRes.json();
                    setUnitTransactions(unitJson.data || []);
                }
            } catch (error) {
                console.error("Failed to fetch cash bank data:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, []);

    // Filter transactions
    const filteredTransactions = React.useMemo(() => {
        return transactions.filter((trx) => {
            const accountMatch = accountFilter === "all" || trx.accountId.toString() === accountFilter;
            const typeMatch = typeFilter === "all" || trx.category === typeFilter || (trx.category == null && typeFilter === "lainnya");
            return accountMatch && typeMatch;
        });
    }, [transactions, accountFilter, typeFilter]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Kas & Bank"
                description="Kelola kas tunai dan rekening bank PRIMKOPPOL"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href="/kas-bank/transfer">
                                <ArrowLeftRight className="mr-2 h-4 w-4" />
                                Transfer
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/kas-bank/transaksi/tambah">
                                <Plus className="mr-2 h-4 w-4" />
                                Transaksi Baru
                            </Link>
                        </Button>
                        <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
                            <DialogTrigger asChild>
                                <Button variant="secondary">
                                    <FileUp className="mr-2 h-4 w-4" />
                                    Import Buku Kas
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>
                                        Import Buku Kas (Excel)
                                        {importStep === "preview" && <span className="ml-2 text-sm font-normal text-muted-foreground">— Langkah 2: Preview Data</span>}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {importStep === "form"
                                            ? "Pilih akun tujuan, format file, dan unggah file Excel."
                                            : `Ditemukan ${importPreview.length} transaksi dari Excel. Periksa semua data sebelum disimpan ke database.`}
                                    </DialogDescription>
                                </DialogHeader>

                                {/* STEP 1 — Form */}
                                {importStep === "form" && (
                                    <div className="grid gap-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Akun Kas/Bank Tujuan <span className="text-destructive">*</span></Label>
                                            <Select value={selectedUploadAccount} onValueChange={setSelectedUploadAccount}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pilih akun..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {accounts.map(acc => (
                                                        <SelectItem key={acc.id} value={acc.id.toString()}>
                                                            {acc.name} ({acc.code}) — Saldo: {formatCurrency(acc.currentBalance)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Format File Excel <span className="text-destructive">*</span></Label>
                                            <Select value={importFormat} onValueChange={setImportFormat}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pilih format..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="standard">📄 Standar — 1 Kolom Debet &amp; 1 Kolom Kredit</SelectItem>
                                                    <SelectItem value="koppol_consolidated">📊 Konsolidasi KOPPOL — Kolom Tunai + BRI + JATIM</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {importFormat === "standard" && (
                                                <p className="text-xs text-muted-foreground">Format ini cocok untuk buku kas standar yang memiliki kolom: Tanggal, Uraian, Debet, Kredit.</p>
                                            )}
                                            {importFormat === "koppol_consolidated" && (
                                                <p className="text-xs text-muted-foreground">Format khusus Laporan Sisa Kas Bank KOPPOL dengan 3 kolom bank di satu file. Pilih kolom target di bawah.</p>
                                            )}
                                        </div>
                                        {importFormat === "koppol_consolidated" && (
                                            <div className="space-y-2">
                                                <Label>Target Kolom yang Diimpor <span className="text-destructive">*</span></Label>
                                                <Select value={koppolColumn} onValueChange={setKoppolColumn}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Pilih kolom target..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="tunai">💵 Kolom KAS TUNAI (Kol H &amp; I)</SelectItem>
                                                        <SelectItem value="bri">🏦 Kolom BANK BRI (Kol J &amp; K)</SelectItem>
                                                        <SelectItem value="jatim">🏦 Kolom BANK JATIM (Kol L &amp; M)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                                                    <p className="font-semibold">Struktur Kolom Excel KOPPOL:</p>
                                                    <p>• Kolom E = <strong>Keterangan / Atas Nama</strong></p>
                                                    <p>• Kolom H &amp; I = Debet &amp; Kredit <strong>Kas Tunai</strong> → Akun: KAS-002</p>
                                                    <p>• Kolom J &amp; K = Debet &amp; Kredit <strong>Bank BRI</strong> → Akun: B-001</p>
                                                    <p>• Kolom L &amp; M = Debet &amp; Kredit <strong>Bank JATIM</strong> → Akun: B-002</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label>File Excel (.xlsx) <span className="text-destructive">*</span></Label>
                                            <Input
                                                type="file"
                                                accept=".xlsx,.xls"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) setSelectedUploadFile(e.target.files[0]);
                                                }}
                                            />
                                            {selectedUploadFile && (
                                                <p className="text-xs text-emerald-600">✓ File dipilih: {selectedUploadFile.name}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2 — Preview Table */}
                                {importStep === "preview" && (
                                    <div className="py-2 space-y-3">
                                        <div className="flex gap-4 text-sm">
                                            <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                                <CheckCircle2 className="h-4 w-4" /> {importPreview.filter(r => r.type === "in").length} Transaksi Masuk
                                            </span>
                                            <span className="flex items-center gap-1 text-amber-600 font-medium">
                                                <AlertCircle className="h-4 w-4" /> {importPreview.filter(r => r.type === "out").length} Transaksi Keluar
                                            </span>
                                            <span className="text-muted-foreground">Total: {importPreview.length} baris</span>
                                        </div>
                                        <div className="rounded-md border max-h-80 overflow-y-auto text-xs">
                                            <table className="w-full">
                                                <thead className="bg-muted sticky top-0">
                                                    <tr>
                                                        <th className="p-2 text-left w-10">#</th>
                                                        <th className="p-2 text-left">Tanggal</th>
                                                        <th className="p-2 text-left">Keterangan</th>
                                                        <th className="p-2 text-center">Jenis</th>
                                                        <th className="p-2 text-right">Jumlah (Rp)</th>
                                                        <th className="p-2 text-left">Kategori</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {importPreview.map((row, i) => (
                                                        <tr key={i} className={`border-t ${row.type === "in" ? "bg-emerald-50/40" : "bg-amber-50/40"}`}>
                                                            <td className="p-2 text-muted-foreground">{row.row}</td>
                                                            <td className="p-2 whitespace-nowrap">{new Date(row.transactionDate).toLocaleDateString("id-ID")}</td>
                                                            <td className="p-2 max-w-[180px] truncate" title={row.description}>{row.description}</td>
                                                            <td className="p-2 text-center">
                                                                <span className={`rounded-full px-2 py-0.5 font-medium ${row.type === "in" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                                                    {row.type === "in" ? "Masuk" : "Keluar"}
                                                                </span>
                                                            </td>
                                                            <td className="p-2 text-right tabular-nums font-medium">{Number(row.amount).toLocaleString("id-ID")}</td>
                                                            <td className="p-2 text-muted-foreground">{row.category}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            ⚠️ Jika data sudah benar, klik <strong>Simpan ke Database</strong>. Jika ada yang salah, klik <strong>Kembali</strong> untuk mengulang.
                                        </p>
                                    </div>
                                )}

                                <DialogFooter className="gap-2">
                                    {importStep === "form" && (
                                        <>
                                            <Button variant="outline" onClick={() => { setUploadDialog(false); setImportStep("form"); setImportPreview([]); }} disabled={uploading}>
                                                Batal
                                            </Button>
                                            <Button
                                                disabled={!selectedUploadFile || !selectedUploadAccount || uploading}
                                                onClick={async () => {
                                                    if (!selectedUploadFile || !selectedUploadAccount) return;
                                                    setUploading(true);
                                                    try {
                                                        const formData = new FormData();
                                                        formData.append("file", selectedUploadFile);
                                                        formData.append("mode", "preview"); // PREVIEW MODE
                                                        formData.append("accountId", selectedUploadAccount);
                                                        formData.append("format", importFormat);
                                                        if (importFormat === "koppol_consolidated") formData.append("koppolColumn", koppolColumn);

                                                        const res = await fetch("/api/cash-bank/import", { method: "POST", body: formData });
                                                        const json = await res.json();
                                                        if (!res.ok) throw new Error(json.message || "Gagal membaca file");

                                                        const previews: ImportPreviewRow[] = json.data?.preview || [];
                                                        if (previews.length === 0) {
                                                            toast.warning("Tidak ada data yang terdeteksi dari file Excel. Pastikan format file sudah benar.");
                                                            return;
                                                        }
                                                        setImportPreview(previews);
                                                        setImportSummary({ success: json.data.success, failed: json.data.failed });
                                                        setImportStep("preview");
                                                    } catch (err: any) {
                                                        toast.error(err.message || "Terjadi kesalahan saat membaca file");
                                                    } finally {
                                                        setUploading(false);
                                                    }
                                                }}
                                            >
                                                {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Membaca...</> : <><Eye className="mr-2 h-4 w-4" />Preview Data</>}
                                            </Button>
                                        </>
                                    )}
                                    {importStep === "preview" && (
                                        <>
                                            <Button variant="outline" onClick={() => setImportStep("form")} disabled={uploading}>
                                                ← Kembali
                                            </Button>
                                            <Button
                                                disabled={uploading}
                                                onClick={async () => {
                                                    if (!selectedUploadFile || !selectedUploadAccount) return;
                                                    setUploading(true);
                                                    try {
                                                        const formData = new FormData();
                                                        formData.append("file", selectedUploadFile);
                                                        formData.append("mode", "commit"); // COMMIT
                                                        formData.append("accountId", selectedUploadAccount);
                                                        formData.append("format", importFormat);
                                                        if (importFormat === "koppol_consolidated") formData.append("koppolColumn", koppolColumn);

                                                        const res = await fetch("/api/cash-bank/import", { method: "POST", body: formData });
                                                        const json = await res.json();
                                                        if (!res.ok) throw new Error(json.message || "Gagal import");

                                                        toast.success(`✅ Berhasil mengimpor ${json.data.success} transaksi ke database!`);
                                                        setUploadDialog(false);
                                                        setImportStep("form");
                                                        setImportPreview([]);
                                                        window.location.reload();
                                                    } catch (err: any) {
                                                        toast.error(err.message || "Terjadi kesalahan saat simpan");
                                                    } finally {
                                                        setUploading(false);
                                                    }
                                                }}
                                            >
                                                {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Simpan ke Database ({importPreview.length} baris)</>}
                                            </Button>
                                        </>
                                    )}
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                    </div>
                }
            />

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Kas</p>
                            <p className="text-xl font-bold tabular-nums">{formatCurrency(totals.cash)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <Building className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Bank</p>
                            <p className="text-xl font-bold tabular-nums">{formatCurrency(totals.bank)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3 text-primary">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Keseluruhan</p>
                            <p className="text-xl font-bold tabular-nums">{formatCurrency(totals.total)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="accounts" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="accounts">Daftar Akun</TabsTrigger>
                    <TabsTrigger value="transactions">Riwayat Kas &amp; Bank</TabsTrigger>
                    <TabsTrigger value="unit-transactions"><ShoppingCart className="mr-1 h-4 w-4 inline" />Transaksi Unit</TabsTrigger>
                </TabsList>

                {/* Accounts Tab */}
                <TabsContent value="accounts" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Wallet className="h-5 w-5" /> Kas
                            </h3>
                            {accounts.filter((a) => a.type === "cash").map((account) => (
                                <AccountCard key={account.id} account={account} />
                            ))}
                            {accounts.filter((a) => a.type === "cash").length === 0 && !isLoading && (
                                <p className="text-muted-foreground text-sm">Tidak ada akun kas</p>
                            )}
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Building className="h-5 w-5" /> Bank
                            </h3>
                            {accounts.filter((a) => a.type === "bank").map((account) => (
                                <AccountCard key={account.id} account={account} />
                            ))}
                            {accounts.filter((a) => a.type === "bank").length === 0 && !isLoading && (
                                <p className="text-muted-foreground text-sm">Tidak ada akun bank</p>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* Transactions Tab */}
                <TabsContent value="transactions" className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-4">
                        <Select value={accountFilter} onValueChange={setAccountFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Akun" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Akun</SelectItem>
                                {accounts.map((acc) => (
                                    <SelectItem key={acc.id} value={acc.id.toString()}>
                                        {acc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kategori</SelectItem>
                                {Object.entries(CASH_BANK_CATEGORIES).map(([key, val]) => (
                                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DataTable
                        columns={transactionColumns}
                        data={filteredTransactions}
                        isLoading={isLoading}
                        searchPlaceholder="Cari transaksi..."
                    />
                </TabsContent>

                {/* Unit Transactions Tab */}
                <TabsContent value="unit-transactions" className="space-y-4">
                    <div className="rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="p-3 text-left">Tgl</th>
                                    <th className="p-3 text-left">No. Transaksi</th>
                                    <th className="p-3 text-left">Unit</th>
                                    <th className="p-3 text-left">Keterangan</th>
                                    <th className="p-3 text-left">Anggota</th>
                                    <th className="p-3 text-left">Metode</th>
                                    <th className="p-3 text-right">Jumlah</th>
                                    <th className="p-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unitTransactions.length === 0 && !isLoading && (
                                    <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Tidak ada data transaksi unit</td></tr>
                                )}
                                {unitTransactions.map((tx) => (
                                    <tr key={tx.id} className="border-t hover:bg-muted/30">
                                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                                            {new Date(tx.transactionDate).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                        </td>
                                        <td className="p-3 font-mono text-xs">{tx.transactionNo}</td>
                                        <td className="p-3">
                                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium capitalize">
                                                {tx.unitType?.replace("_", " ")}
                                            </span>
                                        </td>
                                        <td className="p-3 max-w-[200px] truncate" title={tx.description}>{tx.description}</td>
                                        <td className="p-3 text-sm">{tx.member?.name || "-"}<br/><span className="text-xs text-muted-foreground">{tx.member?.nrp}</span></td>
                                        <td className="p-3 text-xs capitalize">{tx.paymentMethod?.replace("_", " ") || "-"}</td>
                                        <td className="p-3 text-right font-semibold tabular-nums">{formatCurrency(Number(tx.amount))}</td>
                                        <td className="p-3 text-center">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                tx.isPaid ? "bg-emerald-100 text-emerald-700" :
                                                tx.status === "voided" ? "bg-red-100 text-red-700" :
                                                "bg-amber-100 text-amber-700"
                                            }`}>
                                                {tx.status === "voided" ? "Dibatalkan" : tx.isPaid ? "Lunas" : "Belum Bayar"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
