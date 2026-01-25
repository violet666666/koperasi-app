"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Link2,
    Save,
    Loader2,
    ArrowRight,
} from "lucide-react";

interface JournalMapping {
    id: number;
    transactionType: string;
    transactionTypeName: string;
    debitAccountId: number;
    debitAccountCode: string;
    debitAccountName: string;
    creditAccountId: number;
    creditAccountCode: string;
    creditAccountName: string;
}

interface COAOption {
    id: number;
    code: string;
    name: string;
}

const transactionTypes = [
    { type: "savings_deposit", name: "Setoran Simpanan" },
    { type: "savings_withdrawal", name: "Penarikan Simpanan" },
    { type: "loan_disbursement", name: "Pencairan Pinjaman" },
    { type: "loan_payment_principal", name: "Angsuran Pokok" },
    { type: "loan_payment_interest", name: "Angsuran Bunga" },
    { type: "cash_in", name: "Kas Masuk" },
    { type: "cash_out", name: "Kas Keluar" },
    { type: "bank_in", name: "Bank Masuk" },
    { type: "bank_out", name: "Bank Keluar" },
    { type: "depreciation", name: "Penyusutan Aset" },
];

export default function MappingJurnalPage() {
    const [mappings, setMappings] = React.useState<JournalMapping[]>([]);
    const [accounts, setAccounts] = React.useState<COAOption[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock COA
                setAccounts([
                    { id: 1, code: "1100", name: "Kas" },
                    { id: 2, code: "1110", name: "Bank" },
                    { id: 3, code: "1200", name: "Piutang Pinjaman" },
                    { id: 4, code: "2100", name: "Simpanan Pokok" },
                    { id: 5, code: "2110", name: "Simpanan Wajib" },
                    { id: 6, code: "2120", name: "Simpanan Sukarela" },
                    { id: 7, code: "4100", name: "Pendapatan Bunga" },
                    { id: 8, code: "5100", name: "Beban Bunga Simpanan" },
                    { id: 9, code: "5200", name: "Beban Penyusutan" },
                    { id: 10, code: "1300", name: "Aset Tetap" },
                    { id: 11, code: "1310", name: "Akum. Penyusutan" },
                ]);

                // Mock mappings
                setMappings([
                    { id: 1, transactionType: "savings_deposit", transactionTypeName: "Setoran Simpanan", debitAccountId: 1, debitAccountCode: "1100", debitAccountName: "Kas", creditAccountId: 6, creditAccountCode: "2120", creditAccountName: "Simpanan Sukarela" },
                    { id: 2, transactionType: "savings_withdrawal", transactionTypeName: "Penarikan Simpanan", debitAccountId: 6, debitAccountCode: "2120", debitAccountName: "Simpanan Sukarela", creditAccountId: 1, creditAccountCode: "1100", creditAccountName: "Kas" },
                    { id: 3, transactionType: "loan_disbursement", transactionTypeName: "Pencairan Pinjaman", debitAccountId: 3, debitAccountCode: "1200", debitAccountName: "Piutang Pinjaman", creditAccountId: 1, creditAccountCode: "1100", creditAccountName: "Kas" },
                    { id: 4, transactionType: "loan_payment_principal", transactionTypeName: "Angsuran Pokok", debitAccountId: 1, debitAccountCode: "1100", debitAccountName: "Kas", creditAccountId: 3, creditAccountCode: "1200", creditAccountName: "Piutang Pinjaman" },
                    { id: 5, transactionType: "loan_payment_interest", transactionTypeName: "Angsuran Bunga", debitAccountId: 1, debitAccountCode: "1100", debitAccountName: "Kas", creditAccountId: 7, creditAccountCode: "4100", creditAccountName: "Pendapatan Bunga" },
                    { id: 6, transactionType: "depreciation", transactionTypeName: "Penyusutan Aset", debitAccountId: 9, debitAccountCode: "5200", debitAccountName: "Beban Penyusutan", creditAccountId: 11, creditAccountCode: "1310", creditAccountName: "Akum. Penyusutan" },
                ]);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Handle account change
    const handleAccountChange = (mappingId: number, side: "debit" | "credit", accountId: number) => {
        const account = accounts.find(a => a.id === accountId);
        if (!account) return;

        setMappings(prev => prev.map(m => {
            if (m.id === mappingId) {
                if (side === "debit") {
                    return { ...m, debitAccountId: accountId, debitAccountCode: account.code, debitAccountName: account.name };
                } else {
                    return { ...m, creditAccountId: accountId, creditAccountCode: account.code, creditAccountName: account.name };
                }
            }
            return m;
        }));
    };

    // Handle save
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success("Mapping jurnal berhasil disimpan");
        } catch (error) {
            toast.error("Gagal menyimpan mapping");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Mapping Jurnal"
                description="Konfigurasi akun untuk jurnal otomatis"
                backHref="/master"
                actions={
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Simpan
                    </Button>
                }
            />

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        Konfigurasi Akun per Jenis Transaksi
                    </CardTitle>
                    <CardDescription>
                        Tentukan akun debit dan kredit untuk setiap jenis transaksi
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[250px]">Jenis Transaksi</TableHead>
                                    <TableHead>Akun Debit</TableHead>
                                    <TableHead className="w-[50px] text-center"></TableHead>
                                    <TableHead>Akun Kredit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mappings.map((mapping) => (
                                    <TableRow key={mapping.id}>
                                        <TableCell className="font-medium">
                                            {mapping.transactionTypeName}
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={String(mapping.debitAccountId)}
                                                onValueChange={(v) => handleAccountChange(mapping.id, "debit", Number(v))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
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
                                        <TableCell className="text-center">
                                            <ArrowRight className="h-4 w-4 text-muted-foreground inline" />
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={String(mapping.creditAccountId)}
                                                onValueChange={(v) => handleAccountChange(mapping.id, "credit", Number(v))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
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
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
