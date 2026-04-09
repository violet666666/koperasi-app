"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/constants";
import { Wallet, Landmark, Banknote } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

interface BankAccount {
    id: number;
    code: string;
    name: string;
    currentBalance: number;
}

interface DashboardBankAccountsProps {
    accounts?: BankAccount[];
    isLoading?: boolean;
}

export function DashboardBankAccounts({ accounts = [], isLoading = false }: DashboardBankAccountsProps) {
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

    return (
        <Card className="flex flex-col h-full border-blue-200 dark:border-blue-900 shadow-sm">
            <CardHeader className="pb-3 border-b border-blue-100 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            Saldo Rekening Kas & Bank
                        </CardTitle>
                        <CardDescription>
                            Total dana: <span className="font-bold text-foreground">{isLoading ? "..." : formatCurrency(totalBalance)}</span>
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
                {isLoading ? (
                    <div className="p-4 space-y-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : accounts.length > 0 ? (
                    <div className="divide-y divide-border">
                        {accounts.map((acc) => {
                            const isTunai = acc.name.toLowerCase().includes("tunai");
                            return (
                                <Link href={`/kas-bank`} key={acc.id}>
                                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${isTunai ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                {isTunai ? <Banknote className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm leading-none mb-1">{acc.name}</p>
                                                <p className="text-xs text-muted-foreground">{acc.code}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-sm tabular-nums">
                                                {formatCurrency(acc.currentBalance)}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                        <Landmark className="h-10 w-10 text-muted-foreground/30 mb-2" />
                        <p>Tidak ada data rekening.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
