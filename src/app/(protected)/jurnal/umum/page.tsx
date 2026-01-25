"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Save, BookOpen } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { masterApi } from "@/lib/api/services";

interface JournalLine {
    id: number;
    accountId: string;
    accountName: string;
    description: string;
    debit: number;
    credit: number;
}

interface Account {
    id: number;
    code: string;
    name: string;
    type: string;
}

export default function JurnalUmumPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(false);
    const [accounts, setAccounts] = React.useState<Account[]>([]);

    // Form state
    const [formData, setFormData] = React.useState({
        transactionDate: new Date().toISOString().split("T")[0],
        description: "",
    });

    // Journal lines
    const [lines, setLines] = React.useState<JournalLine[]>([
        { id: 1, accountId: "", accountName: "", description: "", debit: 0, credit: 0 },
        { id: 2, accountId: "", accountName: "", description: "", debit: 0, credit: 0 },
    ]);

    // Calculate totals
    const totals = React.useMemo(() => {
        const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
        return { totalDebit, totalCredit, isBalanced: totalDebit === totalCredit && totalDebit > 0 };
    }, [lines]);

    React.useEffect(() => {
        async function fetchAccounts() {
            try {
                const response = await masterApi.accounts.list();
                setAccounts((response.data as any).data || []);
            } catch (error) {
                console.error("Failed to fetch accounts:", error);
            }
        }
        fetchAccounts();
    }, []);

    // Add new line
    const addLine = () => {
        setLines([
            ...lines,
            { id: Date.now(), accountId: "", accountName: "", description: "", debit: 0, credit: 0 },
        ]);
    };

    // Remove line
    const removeLine = (id: number) => {
        if (lines.length <= 2) {
            toast.error("Minimal 2 baris jurnal");
            return;
        }
        setLines(lines.filter(l => l.id !== id));
    };

    // Update line
    const updateLine = (id: number, field: keyof JournalLine, value: string | number) => {
        setLines(lines.map(l => {
            if (l.id !== id) return l;

            if (field === "accountId") {
                const account = accounts.find(a => String(a.id) === value);
                return { ...l, accountId: String(value), accountName: account?.name || "" };
            }

            return { ...l, [field]: value };
        }));
    };

    // Submit
    const handleSubmit = async () => {
        if (!formData.description) {
            toast.error("Masukkan keterangan jurnal");
            return;
        }
        if (!totals.isBalanced) {
            toast.error("Total debit dan kredit harus sama");
            return;
        }

        setIsLoading(true);
        try {
            // In production, call POST /api/journals
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success("Jurnal berhasil disimpan");
            router.push("/jurnal/buku-besar");
        } catch (error) {
            toast.error("Gagal menyimpan jurnal");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Jurnal Umum"
                description="Buat entri jurnal manual"
                backHref="/jurnal/buku-besar"
            />

            {/* Header Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Informasi Jurnal
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
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
                </CardContent>
            </Card>

            {/* Journal Lines */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Detail Jurnal</CardTitle>
                    <Button variant="outline" size="sm" onClick={addLine}>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Baris
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
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
                                {/* Totals Row */}
                                <TableRow className="bg-muted/50 font-bold">
                                    <TableCell colSpan={2} className="text-right">
                                        TOTAL
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-emerald-600">
                                        {formatCurrency(totals.totalDebit)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-red-600">
                                        {formatCurrency(totals.totalCredit)}
                                    </TableCell>
                                    <TableCell>
                                        {totals.isBalanced && (
                                            <span className="text-emerald-600">✓</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Balance Warning */}
            {totals.totalDebit !== totals.totalCredit && totals.totalDebit > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Jurnal tidak seimbang</p>
                    <p className="text-sm">
                        Selisih: {formatCurrency(Math.abs(totals.totalDebit - totals.totalCredit))}
                    </p>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-4">
                <Button variant="outline" onClick={() => router.back()}>
                    Batal
                </Button>
                <Button onClick={handleSubmit} disabled={isLoading || !totals.isBalanced}>
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    Simpan Jurnal
                </Button>
            </div>
        </div>
    );
}
