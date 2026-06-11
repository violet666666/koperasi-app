"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/constants";
import { Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface SavingsAccount {
    id: number;
    accountNo: string;
    balance: number;
    target: number;
    progress: number;
    monthlyTarget: number;
    status: string;
    openedDate: string;
    member: { id: number; memberNo: string; name: string; nrp: string | null };
    product: { id: number; code: string; name: string; type: string };
}

export default function TabunganListPage() {
    const router = useRouter();
    const [accounts, setAccounts] = React.useState<SavingsAccount[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [pageCount, setPageCount] = React.useState(0);
    const [pagination, setPagination] = React.useState({ page: 1, perPage: 15 });
    const [searchQuery, setSearchQuery] = React.useState("");
    const [typeFilter, setTypeFilter] = React.useState<string>("all");

    const fetchAccounts = React.useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(pagination.page),
                perPage: String(pagination.perPage),
                ...(searchQuery && { search: searchQuery }),
                ...(typeFilter !== "all" && { type: typeFilter }),
            });
            const res = await fetch(`/api/haji-umrah/savings?${params}`);
            if (res.ok) {
                const json = await res.json();
                setAccounts(json.data);
                setPageCount(json.meta.totalPages);
            }
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat data tabungan");
        } finally {
            setLoading(false);
        }
    }, [pagination, searchQuery, typeFilter]);

    React.useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

    const columns: ColumnDef<SavingsAccount>[] = React.useMemo(() => [
        {
            accessorKey: "accountNo",
            header: "No. Rekening",
            cell: ({ row }) => (
                <button
                    onClick={() => router.push(`/haji-umrah/tabungan/${row.original.id}`)}
                    className="text-primary hover:underline font-mono text-sm"
                >
                    {row.original.accountNo}
                </button>
            ),
        },
        {
            accessorKey: "member.name",
            header: "Anggota",
            cell: ({ row }) => (
                <div>
                    <p className="font-medium">{row.original.member.name}</p>
                    <p className="text-xs text-muted-foreground">{row.original.member.nrp || row.original.member.memberNo}</p>
                </div>
            ),
        },
        {
            accessorKey: "product.name",
            header: "Produk",
            cell: ({ row }) => (
                <Badge variant={row.original.product.type === "tabungan_haji" ? "default" : "secondary"}>
                    {row.original.product.name}
                </Badge>
            ),
        },
        {
            accessorKey: "balance",
            header: "Saldo",
            cell: ({ row }) => (
                <span className="font-medium">{formatCurrency(row.original.balance)}</span>
            ),
        },
        {
            id: "progress",
            header: "Progress",
            cell: ({ row }) => {
                const { progress, target } = row.original;
                if (!target || target <= 0) return <span className="text-muted-foreground">—</span>;
                return (
                    <div className="flex items-center gap-2 min-w-[140px]">
                        <div className="flex-1 bg-muted rounded-full h-2.5">
                            <div
                                className={`h-2.5 rounded-full transition-all ${
                                    progress >= 100 ? "bg-green-500" : progress >= 80 ? "bg-yellow-500" : "bg-primary"
                                }`}
                                style={{ width: `${Math.min(100, progress)}%` }}
                            />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{progress}%</span>
                    </div>
                );
            },
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
                <Badge variant={row.original.status === "active" ? "default" : "secondary"}>
                    {row.original.status === "active" ? "Aktif" : "Tutup"}
                </Badge>
            ),
        },
    ], [router]);

    // ── Buka Rekening Dialog ──
    const [bukaDialogOpen, setBukaDialogOpen] = React.useState(false);
    const [bukaSubmitting, setBukaSubmitting] = React.useState(false);
    const [products, setProducts] = React.useState<Array<{ id: number; code: string; name: string; type: string; targetAmount: number | null }>>([]);
    const [memberSearch, setMemberSearch] = React.useState("");
    const [memberResults, setMemberResults] = React.useState<Array<{ id: number; name: string; memberNo: string; nrp: string | null }>>([]);
    const [bukaForm, setBukaForm] = React.useState({
        memberId: 0,
        memberName: "",
        productId: "",
        targetAmount: "",
        monthlyTarget: "",
        maturityDate: "",
    });

    // Load products for dialog
    React.useEffect(() => {
        if (bukaDialogOpen) {
            fetch("/api/haji-umrah/products").then(r => r.json()).then(j => setProducts(j.data || [])).catch(() => {});
        }
    }, [bukaDialogOpen]);

    // Member search
    React.useEffect(() => {
        if (memberSearch.length < 2) { setMemberResults([]); return; }
        const timer = setTimeout(() => {
            fetch(`/api/members?search=${encodeURIComponent(memberSearch)}&perPage=10`)
                .then(r => r.json())
                .then(j => setMemberResults(j.data || []))
                .catch(() => {});
        }, 300);
        return () => clearTimeout(timer);
    }, [memberSearch]);

    function selectMember(m: { id: number; name: string; memberNo: string; nrp: string | null }) {
        setBukaForm(f => ({ ...f, memberId: m.id, memberName: m.name }));
        setMemberSearch(m.name);
        setMemberResults([]);
    }

    // Auto-fill target from product default
    React.useEffect(() => {
        const product = products.find(p => p.id === parseInt(bukaForm.productId));
        if (product?.targetAmount && !bukaForm.targetAmount) {
            setBukaForm(f => ({ ...f, targetAmount: String(product.targetAmount) }));
        }
    }, [bukaForm.productId, products]);

    async function handleBukaRekening() {
        if (!bukaForm.memberId || !bukaForm.productId) {
            toast.error("Pilih anggota dan produk terlebih dahulu");
            return;
        }
        setBukaSubmitting(true);
        try {
            const res = await fetch("/api/haji-umrah/savings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    memberId: bukaForm.memberId,
                    productId: parseInt(bukaForm.productId),
                    targetAmount: bukaForm.targetAmount ? parseFloat(bukaForm.targetAmount) : undefined,
                    monthlyTarget: bukaForm.monthlyTarget ? parseFloat(bukaForm.monthlyTarget) : undefined,
                    maturityDate: bukaForm.maturityDate || undefined,
                }),
            });
            if (res.ok) {
                toast.success("Rekening berhasil dibuka!");
                setBukaDialogOpen(false);
                setBukaForm({ memberId: 0, memberName: "", productId: "", targetAmount: "", monthlyTarget: "", maturityDate: "" });
                setMemberSearch("");
                fetchAccounts();
            } else {
                const json = await res.json();
                toast.error(json.message || "Gagal membuka rekening");
            }
        } catch (err) {
            console.error(err);
            toast.error("Terjadi kesalahan");
        } finally {
            setBukaSubmitting(false);
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tabungan Haji & Umrah"
                description="Daftar rekening tabungan haji dan umrah anggota"
                actions={
                    <Button onClick={() => setBukaDialogOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" /> Buka Rekening
                    </Button>
                }
            />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama, NRP, atau no rekening..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
                        className="pl-10"
                    />
                </div>
                <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPagination((p) => ({ ...p, page: 1 })); }}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Semua Produk" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Produk</SelectItem>
                        <SelectItem value="tabungan_haji">Tabungan Haji</SelectItem>
                        <SelectItem value="tabungan_umrah">Tabungan Umrah</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={accounts}
                pageCount={pageCount}
                pageIndex={pagination.page - 1}
                pageSize={pagination.perPage}
                onPaginationChange={(updater) => {
                    const newPagination = typeof updater === "function" ? updater({ pageIndex: pagination.page - 1, pageSize: pagination.perPage }) : updater;
                    setPagination({ page: newPagination.pageIndex + 1, perPage: newPagination.pageSize });
                }}
                loading={loading}
            />

            {/* Buka Rekening Dialog */}
            <Dialog open={bukaDialogOpen} onOpenChange={setBukaDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Buka Rekening Tabungan</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Cari Anggota *</Label>
                            <div className="relative">
                                <Input
                                    placeholder="Ketik nama atau NRP..."
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                />
                                {bukaForm.memberName && (
                                    <Badge variant="secondary" className="mt-1">✓ {bukaForm.memberName}</Badge>
                                )}
                                {memberResults.length > 0 && (
                                    <div className="absolute z-50 w-full bg-background border rounded-md shadow-lg mt-1 max-h-40 overflow-auto">
                                        {memberResults.map((m) => (
                                            <button key={m.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm" onClick={() => selectMember(m)}>
                                                <p className="font-medium">{m.name}</p>
                                                <p className="text-xs text-muted-foreground">{m.nrp || m.memberNo}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <Label>Produk Tabungan *</Label>
                            <Select value={bukaForm.productId} onValueChange={(v) => setBukaForm(f => ({ ...f, productId: v }))}>
                                <SelectTrigger><SelectValue placeholder="Pilih produk..." /></SelectTrigger>
                                <SelectContent>
                                    {products.map((p) => (
                                        <SelectItem key={p.id} value={String(p.id)}>
                                            {p.name} ({p.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Target Tabungan</Label>
                                <Input type="number" value={bukaForm.targetAmount} onChange={(e) => setBukaForm(f => ({ ...f, targetAmount: e.target.value }))} placeholder="Auto dari produk" />
                            </div>
                            <div>
                                <Label>Target Bulanan</Label>
                                <Input type="number" value={bukaForm.monthlyTarget} onChange={(e) => setBukaForm(f => ({ ...f, monthlyTarget: e.target.value }))} placeholder="Opsional" />
                            </div>
                        </div>

                        <div>
                            <Label>Target Tanggal Tercapai</Label>
                            <Input type="date" value={bukaForm.maturityDate} onChange={(e) => setBukaForm(f => ({ ...f, maturityDate: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBukaDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleBukaRekening} disabled={bukaSubmitting || !bukaForm.memberId || !bukaForm.productId}>
                            {bukaSubmitting ? "Memproses..." : "Buka Rekening"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
