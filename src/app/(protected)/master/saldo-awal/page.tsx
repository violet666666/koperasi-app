"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    BookOpen,
    Save,
    Loader2,
    Plus,
    AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface OpeningBalance {
    id: number;
    accountCode: string;
    accountName: string;
    accountType: string;
    debitBalance: number;
    creditBalance: number;
}

export default function SaldoAwalPage() {
    const [balances, setBalances] = React.useState<OpeningBalance[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [selectedYear, setSelectedYear] = React.useState("2026");

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data
                setBalances([
                    { id: 1, accountCode: "1100", accountName: "Kas", accountType: "asset", debitBalance: 125000000, creditBalance: 0 },
                    { id: 2, accountCode: "1110", accountName: "Bank", accountType: "asset", debitBalance: 450000000, creditBalance: 0 },
                    { id: 3, accountCode: "1200", accountName: "Piutang Anggota", accountType: "asset", debitBalance: 850000000, creditBalance: 0 },
                    { id: 4, accountCode: "1300", accountName: "Aset Tetap", accountType: "asset", debitBalance: 815000000, creditBalance: 0 },
                    { id: 5, accountCode: "1310", accountName: "Akum. Penyusutan", accountType: "contra_asset", debitBalance: 0, creditBalance: 203125000 },
                    { id: 6, accountCode: "2100", accountName: "Simpanan Pokok", accountType: "liability", debitBalance: 0, creditBalance: 250000000 },
                    { id: 7, accountCode: "2110", accountName: "Simpanan Wajib", accountType: "liability", debitBalance: 0, creditBalance: 750000000 },
                    { id: 8, accountCode: "2120", accountName: "Simpanan Sukarela", accountType: "liability", debitBalance: 0, creditBalance: 450000000 },
                    { id: 9, accountCode: "3100", accountName: "Modal", accountType: "equity", debitBalance: 0, creditBalance: 300000000 },
                    { id: 10, accountCode: "3200", accountName: "SHU Tahun Lalu", accountType: "equity", debitBalance: 0, creditBalance: 286875000 },
                ]);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, [selectedYear]);

    // Calculate totals
    const totalDebit = balances.reduce((sum, b) => sum + b.debitBalance, 0);
    const totalCredit = balances.reduce((sum, b) => sum + b.creditBalance, 0);
    const isBalanced = totalDebit === totalCredit;

    // Handle balance change
    const handleBalanceChange = (id: number, side: "debit" | "credit", value: number) => {
        setBalances(prev => prev.map(b => {
            if (b.id === id) {
                return side === "debit"
                    ? { ...b, debitBalance: value }
                    : { ...b, creditBalance: value };
            }
            return b;
        }));
    };

    // Handle save
    const handleSave = async () => {
        if (!isBalanced) {
            toast.error("Saldo debit dan kredit harus balance");
            return;
        }

        setIsSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success("Saldo awal berhasil disimpan");
        } catch (error) {
            toast.error("Gagal menyimpan saldo awal");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Saldo Awal"
                description="Input saldo awal akun untuk periode baru"
                backHref="/master"
                actions={
                    <Button onClick={handleSave} disabled={isSaving || !isBalanced}>
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Simpan
                    </Button>
                }
            />

            {/* Period Selector */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <Label>Tahun Buku:</Label>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Balance Status */}
            <Card className={isBalanced ? "border-emerald-500" : "border-red-500"}>
                <CardContent className="p-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <p className="text-sm text-muted-foreground">Total Debit</p>
                            <p className="text-xl font-bold tabular-nums">{formatCurrency(totalDebit)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Kredit</p>
                            <p className="text-xl font-bold tabular-nums">{formatCurrency(totalCredit)}</p>
                        </div>
                        <div className="flex items-center">
                            {isBalanced ? (
                                <Badge className="bg-emerald-100 text-emerald-700">
                                    ✓ Balance
                                </Badge>
                            ) : (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Selisih: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                                </Badge>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Balances Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Saldo Awal Akun - Tahun {selectedYear}
                    </CardTitle>
                    <CardDescription>
                        Masukkan saldo awal untuk setiap akun di awal tahun buku
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
                                    <TableHead>Kode</TableHead>
                                    <TableHead>Nama Akun</TableHead>
                                    <TableHead>Tipe</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Kredit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {balances.map((balance) => (
                                    <TableRow key={balance.id}>
                                        <TableCell className="font-mono">{balance.accountCode}</TableCell>
                                        <TableCell>{balance.accountName}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                {balance.accountType.replace("_", " ")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="number"
                                                className="w-40 text-right ml-auto"
                                                value={balance.debitBalance || ""}
                                                onChange={(e) => handleBalanceChange(balance.id, "debit", Number(e.target.value) || 0)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="number"
                                                className="w-40 text-right ml-auto"
                                                value={balance.creditBalance || ""}
                                                onChange={(e) => handleBalanceChange(balance.id, "credit", Number(e.target.value) || 0)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {/* Totals Row */}
                                <TableRow className="bg-muted/50 font-bold">
                                    <TableCell colSpan={3}>TOTAL</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(totalDebit)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(totalCredit)}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
