"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import type { DetailTransaction, DetailTransactionsResponse, CategoryBreakdown } from "../_types";

interface SHUTransactionsTabProps {
  /** "income" or "expense" — determines API source param */
  source: "income" | "expense";
  /** Year filter */
  year: number;
  /** Month filter (null = all months) */
  month?: number | null;
  /** Income group filter (only for source=income) */
  incomeGroup?: "unit" | "sp" | "lainnya" | null;
  /** Pre-selected category (from summary tab click) */
  selectedCategory?: string | null;
  /** Available categories from summary data (for filter dropdown) */
  availableCategories?: { code: string; name: string }[];
}

export function SHUTransactionsTab({
  source,
  year,
  month,
  incomeGroup,
  selectedCategory: initialCategory,
  availableCategories,
}: SHUTransactionsTabProps) {
  const [transactions, setTransactions] = React.useState<DetailTransaction[]>([]);
  const [summary, setSummary] = React.useState<{ totalAmount: number; totalItems: number; byCategory: CategoryBreakdown[] }>({
    totalAmount: 0,
    totalItems: 0,
    byCategory: [],
  });
  const [pagination, setPagination] = React.useState({ page: 1, perPage: 25, totalItems: 0, totalPages: 1 });

  const [isLoading, setIsLoading] = React.useState(false);
  const [filterCategory, setFilterCategory] = React.useState<string>(initialCategory || "all");
  const [filterMethod, setFilterMethod] = React.useState<string>("all");
  const [filterSearch, setFilterSearch] = React.useState("");
  const [searchDebounce, setSearchDebounce] = React.useState("");

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => setFilterSearch(searchDebounce), 400);
    return () => clearTimeout(timer);
  }, [searchDebounce]);

  // Fetch transactions
  const fetchTransactions = React.useCallback(async (page: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        source,
        page: String(page),
        perPage: "25",
      });
      if (month) params.set("month", String(month));
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (incomeGroup) params.set("incomeGroup", incomeGroup);
      if (filterMethod !== "all") params.set("paymentMethod", filterMethod);
      if (filterSearch) params.set("search", filterSearch);

      const res = await fetch(`/api/reports/shu/detail-transactions?${params}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data as DetailTransactionsResponse;
        setTransactions(data.transactions);
        setSummary(data.summary);
        setPagination(data.pagination);
      } else {
        setTransactions([]);
      }
    } catch {
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [year, month, source, filterCategory, incomeGroup, filterMethod, filterSearch]);

  // Refetch when filters change
  React.useEffect(() => {
    fetchTransactions(1);
  }, [fetchTransactions]);

  // Update category filter when parent sends a new selectedCategory
  React.useEffect(() => {
    setFilterCategory(initialCategory || "all");
  }, [initialCategory]);

  // Build category options: use availableCategories prop OR byCategory from API
  const categoryOptions = React.useMemo(() => {
    if (availableCategories && availableCategories.length > 0) {
      return availableCategories.map(c => ({ value: c.code, label: c.name }));
    }
    return summary.byCategory.map(c => ({ value: c.category, label: c.label }));
  }, [availableCategories, summary.byCategory]);

  const sourceLabels: Record<string, string> = {
    cash_bank: "Kas & Bank",
    unit_transaction: "Unit Layanan",
    store_sale: source === "expense" ? "HPP Toko" : "Toko",
    loan_payment: "Pinjaman",
    loan_admin_fee: "Dana Resiko",
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="Semua Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categoryOptions.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Metode</SelectItem>
            <SelectItem value="cash">Tunai</SelectItem>
            <SelectItem value="qris">QRIS</SelectItem>
            <SelectItem value="salary_cut">Potong Gaji</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[150px] max-w-[250px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 text-xs pl-8"
            placeholder="Cari keterangan..."
            value={searchDebounce}
            onChange={e => setSearchDebounce(e.target.value)}
          />
        </div>
      </div>

      {/* Summary bar */}
      {!isLoading && summary.totalItems > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
          <span>{summary.totalItems} transaksi</span>
          <span className="font-medium">
            Total: {formatCurrency(summary.totalAmount)}
          </span>
        </div>
      )}

      {/* Transaction table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : transactions.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Tanggal</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="w-[100px]">Kategori</TableHead>
                <TableHead className="w-[80px]">Sumber</TableHead>
                <TableHead className="w-[100px]">Metode</TableHead>
                <TableHead className="text-right w-[120px]">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-xs tabular-nums text-muted-foreground">
                    {tx.date}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate" title={tx.description}>
                    {tx.description}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                      {tx.categoryLabel}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {sourceLabels[tx.source] || tx.source}
                  </TableCell>
                  <TableCell className="text-xs">
                    {tx.paymentMethod ? (
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        tx.paymentMethod === "cash" || tx.paymentMethod === "Tunai"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : tx.paymentMethod === "qris" || tx.paymentMethod === "QRIS"
                          ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                      }`}>
                        {tx.paymentMethod}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${
                    tx.type === "income" ? "text-emerald-600" : "text-red-600"
                  }`}>
                    {tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">
          Tidak ada transaksi ditemukan untuk filter ini.
        </p>
      )}

      {/* Pagination */}
      {!isLoading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Halaman {pagination.page} dari {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => fetchTransactions(pagination.page - 1)}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => fetchTransactions(pagination.page + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
