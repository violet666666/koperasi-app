"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { DeleteConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, MoreHorizontal, Pencil, Trash2, Ban, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/constants";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SavingsAccount {
    id: number;
    accountNo: string;
    member: { id: number; name: string; memberNo: string; nrp: string };
    product: { id: number; name: string; type: string };
    balance: number;
    status: string;
    openedDate: string;
}

function StatusBadge({ status }: { status: string }) {
    if (status === "active") return <Badge variant="default" className="bg-emerald-500">Aktif</Badge>;
    if (status === "blocked") return <Badge variant="destructive">Diblokir</Badge>;
    if (status === "closed") return <Badge variant="secondary">Tutup</Badge>;
    return <Badge variant="outline">{status}</Badge>;
}

export default function SavingsAccountsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(true);
    const [accounts, setAccounts] = React.useState<SavingsAccount[]>([]);
    const [pageCount, setPageCount] = React.useState(0);
    const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 15 });
    const [searchQuery, setSearchQuery] = React.useState("");

    // Delete
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [accountToDelete, setAccountToDelete] = React.useState<{ id: number; info: string } | null>(null);

    // Create Modal
    const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
    const [memberQuery, setMemberQuery] = React.useState("");
    const [memberResult, setMemberResult] = React.useState<any>(null);
    const [products, setProducts] = React.useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = React.useState("");
    const [isCreating, setIsCreating] = React.useState(false);

    const loadData = React.useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/savings/accounts?page=${pagination.pageIndex + 1}&perPage=${pagination.pageSize}&search=${searchQuery}`);
            const json = await res.json();
            if (res.ok) {
                setAccounts(json.data || []);
                setPageCount(json.meta?.totalPages || 0);
            }
        } catch (error) {
            toast.error("Gagal mendapatkan daftar rekening");
        } finally {
            setIsLoading(false);
        }
    }, [pagination.pageIndex, pagination.pageSize, searchQuery]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    React.useEffect(() => {
        // Load products for creation modal
        fetch("/api/master/savings-products").then(res => res.json()).then(json => {
            setProducts(json.data || []);
        });
    }, []);

    const searchMember = async () => {
        if (!memberQuery) return;
        try {
            const res = await fetch(`/api/members?search=${memberQuery}&perPage=1`);
            const json = await res.json();
            if (res.ok && json.data.length > 0) {
                setMemberResult(json.data[0]);
                toast.success("Anggota ditemukan");
            } else {
                setMemberResult(null);
                toast.error("Anggota tidak ditemukan");
            }
        } catch (error) {
            toast.error("Gagal mencari anggota");
        }
    };

    const handleCreate = async () => {
        if (!memberResult || !selectedProduct) {
            toast.error("Pilih anggota dan produk simpanan");
            return;
        }
        setIsCreating(true);
        try {
            const res = await fetch("/api/savings/accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ memberId: memberResult.id, productId: selectedProduct })
            });
            const json = await res.json();
            if (res.ok) {
                toast.success("Rekening berhasil dibuka");
                setCreateDialogOpen(false);
                setMemberResult(null);
                setMemberQuery("");
                loadData();
            } else {
                toast.error(json.message);
            }
        } catch (error) {
            toast.error("Server error");
        } finally {
            setIsCreating(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!accountToDelete) return;
        try {
            const res = await fetch(`/api/savings/accounts/${accountToDelete.id}`, { method: "DELETE" });
            const json = await res.json();
            if (res.ok) {
                toast.success("Rekening berhasil dihapus");
                loadData();
            } else {
                toast.error(json.message);
            }
        } catch (e) {
            toast.error("Server error");
        } finally {
            setDeleteDialogOpen(false);
        }
    };

    const toggleStatus = async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === "active" ? "blocked" : "active";
        try {
            const res = await fetch(`/api/savings/accounts/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                toast.success("Status diubah");
                loadData();
            } else {
                toast.error("Gagal mengubah status");
            }
        } catch (e) {
            toast.error("Server error");
        }
    };

    const columns: ColumnDef<SavingsAccount>[] = React.useMemo(() => [
        {
            accessorKey: "accountNo",
            header: "No. Rekening",
            cell: ({ row }) => <span className="font-medium font-mono text-primary">{row.getValue("accountNo")}</span>
        },
        {
            accessorKey: "member",
            header: "Anggota",
            cell: ({ row }) => {
                const m = row.original.member;
                return (
                    <div>
                        <div className="font-semibold">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.memberNo || m.nrp}</div>
                    </div>
                );
            }
        },
        {
            accessorKey: "product",
            header: "Produk",
            cell: ({ row }) => <Badge variant="outline">{row.original.product.name}</Badge>
        },
        {
            accessorKey: "balance",
            header: "Saldo",
            cell: ({ row }) => <div className="font-bold tabular-nums text-emerald-600">{formatCurrency(Number(row.getValue("balance")))}</div>
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => <StatusBadge status={row.getValue("status")} />
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const acc = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Buka menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toggleStatus(acc.id, acc.status)}>
                                {acc.status === "active" ? <Ban className="mr-2 h-4 w-4 text-destructive" /> : <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />}
                                {acc.status === "active" ? "Blokir Rekening" : "Aktifkan Rekening"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => { setAccountToDelete({ id: acc.id, info: `${acc.accountNo} (${acc.member.name})` }); setDeleteDialogOpen(true); }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Hapus (Jika Saldo 0)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            }
        }
    ], []);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Buku Rekening Anggota"
                description="Kelola daftar rekening simpanan pokok, wajib, sukarela anggota"
                actions={
                    <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Buka Rekening Baru
                    </Button>
                }
            />

            <DataTable
                columns={columns}
                data={accounts}
                isLoading={isLoading}
                searchPlaceholder="Cari no rekening atau nama..."
                pageCount={pageCount}
                pagination={pagination}
                onPaginationChange={setPagination}
                manualPagination={true}
                globalFilterValue={searchQuery}
                onGlobalFilterChange={setSearchQuery}
                manualFiltering={true}
            />

            {/* Delete Confirmation */}
            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                itemName={`Rekening ${accountToDelete?.info}`}
                onConfirm={handleConfirmDelete}
                isLoading={false}
            />

            {/* Create Modal */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Buka Rekening Baru</DialogTitle>
                        <DialogDescription>Pilih anggota dan jenis produk simpanan</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Cari Anggota (Nama / NRP)</Label>
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Ketik nama atau nrp..." 
                                    value={memberQuery}
                                    onChange={(e) => setMemberQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && searchMember()}
                                />
                                <Button type="button" onClick={searchMember} variant="secondary">Cari</Button>
                            </div>
                            {memberResult && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-sm mt-2">
                                    <span className="font-bold">{memberResult.name}</span> ({memberResult.memberNo || memberResult.nrp})
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Pilih Produk Rekening</Label>
                            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih produk simpanan..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.type})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleCreate} disabled={isCreating || !memberResult || !selectedProduct}>
                            Simpan Rekening
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
