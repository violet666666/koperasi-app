"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Loader2, Plus, Trash2, Save, BookOpen, Search, ChevronLeft, ChevronRight,
    ChevronDown, ChevronUp,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { masterApi } from "@/lib/api/services";

// --- Types ---
interface JournalLineItem {
    id: number;
    accountId: number;
    accountCode: string;
    accountName: string;
    description: string;
    debit: number;
    credit: number;
}

interface JournalEntry {
    id: number;
    journalNo: string;
    transactionDate: string;
    description: string;
    sourceType?: string;
    totalDebit: number;
    totalCredit: number;
    isPosted: boolean;
    isAdjustment: boolean;
    createdBy: { id: number; name: string };
    lines: JournalLineItem[];
}

interface PaginationInfo {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
}

interface Account {
    id: number;
    code: string;
    name: string;
    type: string;
}

// --- Journal Form Line (for create dialog) ---
interface FormLine {
    id: number;
    accountId: string;
    accountName: string;
    description: string;
    debit: number;
    credit: number;
}

const SOURCE_LABELS: Record<string, string> = {
    savings: "Simpanan",
    loan: "Pinjaman",
    loan_payment: "Angsuran",
    cash_bank: "Kas/Bank",
    manual: "Manual",
    manual_general: "Manual",
    manual_adjustment: "Penyesuaian",
    store_sale: "Toko",
};

// --- Main Page ---
export default function JurnalUmumPage() {
    // List state
    const [journals, setJournals] = React.useState<JournalEntry[]>([]);
    const [pagination, setPagination] = React.useState<PaginationInfo>({
        page: 1, perPage: 25, total: 0, totalPages: 0,
    });
    const [isLoading, setIsLoading] = React.useState(true);
    const [page, setPage] = React.useState(1);
    const [search, setSearch] = React.useState("");
    const [searchInput, setSearchInput] = React.useState("");
    const [dateFrom, setDateFrom] = React.useState("");
    const [dateTo, setDateTo] = React.useState("");
    const [expandedId, setExpandedId] = React.useState<number | null>(null);

    // Create dialog state
    const [createOpen, setCreateOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [accounts, setAccounts] = React.useState<Account[]>([]);
    const [formData, setFormData] = React.useState({
        transactionDate: new Date().toISOString().split("T")[0],
        description: "",
    });
    const [lines, setLines] = React.useState<FormLine[]>([
        { id: 1, accountId: "", accountName: "", description: "", debit: 0, credit: 0 },
        { id: 2, accountId: "", accountName: "", description: "", debit: 0, credit: 0 },
    ]);

    // Fetch accounts for create dialog
    React.useEffect(() => {
        async function fetchAccounts() {
            try {
                const response = await masterApi.accounts.list();
                setAccounts((response.data as Account[]) || []);
            } catch (error) {
                console.error("Failed to fetch accounts:", error);
            }
        }
        fetchAccounts();
    }, []);

    // Fetch journals with pagination
    React.useEffect(() => {
        async function fetchJournals() {
            setIsLoading(true);
            try {
                const params = new URLSearchParams({
                    page: String(page),
                    perPage: "25",
                });
                if (search) params.set("search", search);
                if (dateFrom) params.set("dateFrom", dateFrom);
                if (dateTo) params.set("dateTo", dateTo);

                const res = await fetch(`/api/journals?${params}`);
                if (!res.ok) throw new Error("Failed");
                const json = await res.json();
                setJournals(json.data || []);
                if (json.pagination) {
                    setPagination(json.pagination);
                }
            } catch (error) {
                console.error("Failed to fetch journals:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchJournals();
    }, [page, search, dateFrom, dateTo]);

    // Search handler
    const handleSearch = () => {
        setSearch(searchInput);
        setPage(1);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    // Filter change resets page
    const handleDateFromChange = (value: string) => {
        setDateFrom(value);
        setPage(1);
    };

    const handleDateToChange = (value: string) => {
        setDateTo(value);
        setPage(1);
    };

    // Toggle expand journal detail
    const toggleExpand = (id: number) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    // --- Create Journal Dialog handlers ---
    const addLine = () => {
        setLines([
            ...lines,
            { id: Date.now(), accountId: "", accountName: "", description: "", debit: 0, credit: 0 },
        ]);
    };

    const removeLine = (id: number) => {
        if (lines.length <= 2) {
            toast.error("Minimal 2 baris jurnal");
            return;
        }
        setLines(lines.filter(l => l.id !== id));
    };

    const updateLine = (id: number, field: keyof FormLine, value: string | number) => {
        setLines(lines.map(l => {
            if (l.id !== id) return l;
            if (field === "accountId") {
                const account = accounts.find(a => String(a.id) === value);
                return { ...l, accountId: String(value), accountName: account?.name || "" };
            }
            return { ...l, [field]: value };
        }));
    };

    const formTotals = React.useMemo(() => {
        const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
        return { totalDebit, totalCredit, isBalanced: totalDebit === totalCredit && totalDebit > 0 };
    }, [lines]);

    const handleSubmit = async () => {
        if (!formData.description) {
            toast.error("Masukkan keterangan jurnal");
            return;
        }
        if (!formTotals.isBalanced) {
            toast.error("Total debit dan kredit harus sama");
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = {
                transactionDate: formData.transactionDate,
                description: formData.description,
                lines: lines.map(l => ({
                    accountId: l.accountId,
                    debit: l.debit || 0,
                    credit: l.credit || 0,
                    description: l.description,
                })),
            };

            const response = await fetch("/api/journals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Gagal menyimpan jurnal");
            }

            toast.success("Jurnal berhasil disimpan");
            setCreateOpen(false);
            // Reset form
            setFormData({ transactionDate: new Date().toISOString().split("T")[0], description: "" });
            setLines([
                { id: Date.now(), accountId: "", accountName: "", description: "", debit: 0, credit: 0 },
                { id: Date.now() + 1, accountId: "", accountName: "", description: "", debit: 0, credit: 0 },
            ]);
            // Refresh list
            setPage(1);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Gagal menyimpan jurnal";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Pagination display helpers
    const start = Math.min((page - 1) * 25 + 1, pagination.total);
    const end = Math.min(page * 25, pagination.total);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Jurnal Umum"
                description="Daftar jurnal umum dan entri manual"
                backHref="/jurnal/buku-besar"
                actions={
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Buat Jurnal
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5" />
                                    Buat Jurnal Manual
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <Label>Tanggal Transaksi</Label>
                                        <Input
                                            type="date"
                                            value={formData.transactionDate}
                                            onChange={(e) => setFormData(prev => ({ ...prev, transactionDate: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <Label>Keterangan</Label>
                                        <Textarea
                                            placeholder="Deskripsi transaksi"
                                            value={formData.description}
                                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                            rows={2}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Detail Jurnal</Label>
                                        <Button variant="outline" size="sm" onClick={addLine}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Tambah Baris
                                        </Button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[250px]">Akun</TableHead>
                                                    <TableHead>Keterangan</TableHead>
                                                    <TableHead className="w-[150px] text-right">Debit</TableHead>
                                                    <TableHead className="w-[150px] text-right">Kredit</TableHead>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {lines.map((line) => (
                                                    <TableRow key={line.id}>
                                                        <TableCell>
                                                            <Select
                                                                value={line.accountId}
                                                                onValueChange={(v) => updateLine(line.id, "accountId", v)}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Pilih akun" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {accounts.map((acc) => (
                                                                        <SelectItem key={acc.id} value={String(acc.id)}>
                                                                            {acc.code} - {acc.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                placeholder="Keterangan"
                                                                value={line.description}
                                                                onChange={(e) => updateLine(line.id, "description", e.target.value)}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                placeholder="0"
                                                                className="text-right"
                                                                value={line.debit || ""}
                                                                onChange={(e) => updateLine(line.id, "debit", Number(e.target.value))}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                placeholder="0"
                                                                className="text-right"
                                                                value={line.credit || ""}
                                                                onChange={(e) => updateLine(line.id, "credit", Number(e.target.value))}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => removeLine(line.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                <TableRow className="bg-muted/50 font-bold">
                                                    <TableCell colSpan={2} className="text-right">TOTAL</TableCell>
                                                    <TableCell className="text-right tabular-nums text-emerald-600">
                                                        {formatCurrency(formTotals.totalDebit)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-red-600">
                                                        {formatCurrency(formTotals.totalCredit)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formTotals.isBalanced && (
                                                            <span className="text-emerald-600">&#10003;</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {formTotals.totalDebit !== formTotals.totalCredit && formTotals.totalDebit > 0 && (
                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-amber-800 dark:text-amber-200">
                                        <p className="font-medium">Jurnal tidak seimbang</p>
                                        <p className="text-sm">
                                            Selisih: {formatCurrency(Math.abs(formTotals.totalDebit - formTotals.totalCredit))}
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <Button variant="outline" onClick={() => setCreateOpen(false)}>
                                        Batal
                                    </Button>
                                    <Button onClick={handleSubmit} disabled={isSubmitting || !formTotals.isBalanced}>
                                        {isSubmitting ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="mr-2 h-4 w-4" />
                                        )}
                                        Simpan Jurnal
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                }
            />

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <Label className="text-xs text-muted-foreground">Cari</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Cari no. jurnal atau keterangan..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                />
                                <Button variant="outline" size="icon" onClick={handleSearch}>
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Dari Tanggal</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => handleDateFromChange(e.target.value)}
                                className="w-[160px]"
                            />
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Sampai Tanggal</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => handleDateToChange(e.target.value)}
                                className="w-[160px]"
                            />
                        </div>
                        {(search || dateFrom || dateTo) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSearch("");
                                    setSearchInput("");
                                    setDateFrom("");
                                    setDateTo("");
                                    setPage(1);
                                }}
                            >
                                Reset Filter
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Journal List */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Daftar Jurnal
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="h-14 bg-muted animate-pulse rounded" />
                            ))}
                        </div>
                    ) : journals.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Belum ada jurnal</p>
                            <p className="text-sm">Buat jurnal baru dengan tombol di atas</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40px]"></TableHead>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>No. Jurnal</TableHead>
                                        <TableHead>Keterangan</TableHead>
                                        <TableHead>Sumber</TableHead>
                                        <TableHead className="text-right">Debit</TableHead>
                                        <TableHead className="text-right">Kredit</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {journals.map((journal) => (
                                        <React.Fragment key={journal.id}>
                                            <TableRow
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={() => toggleExpand(journal.id)}
                                            >
                                                <TableCell className="text-center">
                                                    {expandedId === journal.id ? (
                                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(journal.transactionDate).toLocaleDateString("id-ID")}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-sm text-primary">
                                                        {journal.journalNo}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="max-w-xs truncate">{journal.description}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {SOURCE_LABELS[journal.sourceType || ""] || journal.sourceType || "-"}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums text-emerald-600 font-medium">
                                                    {formatCurrency(journal.totalDebit)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums text-red-600 font-medium">
                                                    {formatCurrency(journal.totalCredit)}
                                                </TableCell>
                                                <TableCell>
                                                    {journal.isPosted ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700">Posted</Badge>
                                                    ) : (
                                                        <Badge variant="outline">Draft</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            {expandedId === journal.id && journal.lines && (
                                                <TableRow className="bg-muted/30">
                                                    <TableCell colSpan={8} className="p-4">
                                                        <div className="ml-10">
                                                            <p className="text-sm font-medium mb-2 text-muted-foreground">
                                                                Detail Jurnal
                                                            </p>
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Akun</TableHead>
                                                                        <TableHead>Keterangan</TableHead>
                                                                        <TableHead className="text-right">Debit</TableHead>
                                                                        <TableHead className="text-right">Kredit</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {journal.lines.map((line) => (
                                                                        <TableRow key={line.id}>
                                                                            <TableCell className="font-mono text-sm">
                                                                                {line.accountCode} - {line.accountName}
                                                                            </TableCell>
                                                                            <TableCell>{line.description}</TableCell>
                                                                            <TableCell className="text-right tabular-nums">
                                                                                {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                                                                            </TableCell>
                                                                            <TableCell className="text-right tabular-nums">
                                                                                {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pagination Controls */}
            {!isLoading && pagination.total > 0 && (
                <div className="flex items-center justify-between px-2 py-4">
                    <p className="text-sm text-muted-foreground">
                        Menampilkan {start}-{end} dari {pagination.total} jurnal
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Sebelumnya
                        </Button>
                        <span className="text-sm min-w-[100px] text-center">
                            Hal {page} dari {pagination.totalPages || 1}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= pagination.totalPages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            Berikutnya
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
