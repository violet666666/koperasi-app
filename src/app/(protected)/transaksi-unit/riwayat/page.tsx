"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { unitTransactionsApi, type UnitTransaction } from "@/lib/api/services";
import { formatCurrency } from "@/lib/utils";
import { Plus, Download, FileText, XCircle, Pencil, Search, Loader2, Printer, Car, ChevronDown, ChevronRight, Eye, Receipt, Package, Tag, User, Clock, CreditCard, AlertTriangle, ShoppingBag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";
import { DatePeriodFilter, matchesDateRange, type DateRange } from "@/components/patterns/date-period-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/hooks";
import { Separator } from "@/components/ui/separator";

// Extended type to include items from StoreSale mapping
interface TransactionItem {
    id: number;
    productId: number;
    productName: string;
    productSku: string | null;
    productCategory: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
}

type EnrichedTransaction = UnitTransaction & {
    items?: TransactionItem[];
    customerName?: string | null;
    cashReceived?: number | null;
    changeAmount?: number | null;
    voidReason?: string | null;
    voidRequestedAt?: string | null;
    voidRequestedBy?: string | null;
};

// Helper: parse plat nomor dari field notes
function parsePlat(notes: string | null | undefined): string | null {
    if (!notes) return null;
    const match = notes.match(/\[PLAT:([^\]]+)\]/);
    return match ? match[1].trim() : null;
}

const txExportColumns: ExportColumn[] = [
    { header: "No. Transaksi", key: "transactionNo", width: 20 },
    { header: "Tanggal", key: "transactionDate", width: 15, format: (v) => v ? new Date(v as string).toLocaleDateString("id-ID") : "-" },
    { header: "Anggota", key: "member.name", width: 25 },
    { header: "NRP", key: "member.nrp", width: 12 },
    { header: "Unit", key: "unitType", width: 15 },
    { header: "Plat Nomor", key: "notes", width: 14, format: (v) => parsePlat(v as string) || "-" },
    { header: "Keterangan", key: "description", width: 30 },
    { header: "Nominal", key: "amount", width: 18, format: (v) => formatCurrency(Number(v || 0)) },
    { header: "Status", key: "isPaid", width: 12, format: (v) => v ? "LUNAS" : "BELUM LUNAS" },
];

export default function RiwayatTransaksiUnitPage() {
    const { user } = useAuth();
    const userUnitType = (user as any)?.unitType as string | null | undefined;
    const _roleName = typeof user?.role === "string" ? user.role : (user?.role as any)?.name ?? "";
    const isOperator = _roleName === "operator" || user?.permissions?.includes("manage_all");

    const [page, setPage] = React.useState(1);
    const [perPage, setPerPage] = React.useState(9999);
    const [dateRange, setDateRange] = React.useState<DateRange>({ start: null, end: null, mode: "all", label: "Semua Data" });
    const [filterUnit, setFilterUnit] = React.useState<string>(userUnitType || "all");
    const [filterStatus, setFilterStatus] = React.useState<string>("all");

    const queryClient = useQueryClient();
    const [isVoidModalOpen, setIsVoidModalOpen] = React.useState(false);
    const [selectedTx, setSelectedTx] = React.useState<EnrichedTransaction | null>(null);
    const [voidReason, setVoidReason] = React.useState("");
    const [isSubmittingVoid, setIsSubmittingVoid] = React.useState(false);

    // Detail dialog
    const [isDetailOpen, setIsDetailOpen] = React.useState(false);
    const [detailTx, setDetailTx] = React.useState<EnrichedTransaction | null>(null);

    // Edit NRP (Admin only)
    const isAdmin = _roleName === "admin";
    const [isEditNrpOpen, setIsEditNrpOpen] = React.useState(false);
    const [editTx, setEditTx] = React.useState<EnrichedTransaction | null>(null);
    const [nrpInput, setNrpInput] = React.useState("");
    const [editMemberFound, setEditMemberFound] = React.useState<any | null>(null);
    const [isSearchingNrp, setIsSearchingNrp] = React.useState(false);
    const [isSavingNrp, setIsSavingNrp] = React.useState(false);

    // Edit Plat Nomor + Keterangan
    const [isEditDetailsOpen, setIsEditDetailsOpen] = React.useState(false);
    const [editDetailsTx, setEditDetailsTx] = React.useState<EnrichedTransaction | null>(null);
    const [editPlat, setEditPlat] = React.useState("");
    const [editDesc, setEditDesc] = React.useState("");
    const [isSavingDetails, setIsSavingDetails] = React.useState(false);

    const openDetail = (tx: EnrichedTransaction) => {
        setDetailTx(tx);
        setIsDetailOpen(true);
    };

    const searchMemberByNrp = async (nrp: string) => {
        if (!nrp || nrp.length < 4) { setEditMemberFound(null); return; }
        setIsSearchingNrp(true);
        try {
            const res = await fetch(`/api/members/lookup?q=${encodeURIComponent(nrp)}`);
            const json = await res.json();
            if (json.data?.length > 0) {
                const exact = json.data.find((m: any) => m.nrp === nrp || m.memberNo === nrp);
                setEditMemberFound(exact || null);
            } else {
                setEditMemberFound(null);
            }
        } catch { setEditMemberFound(null); } finally { setIsSearchingNrp(false); }
    };

    const saveEditNrp = async () => {
        if (!editTx || !editMemberFound) return;
        setIsSavingNrp(true);
        try {
            const res = await fetch(`/api/unit-transactions/${editTx.id}/member`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ memberId: editMemberFound.id }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal menyimpan");
            toast.success(`Anggota ${editMemberFound.name} berhasil dikaitkan ke transaksi ${editTx.transactionNo}`);
            setIsEditNrpOpen(false);
            setEditTx(null);
            setNrpInput("");
            setEditMemberFound(null);
            queryClient.invalidateQueries({ queryKey: ["unit-transactions"] });
        } catch (err: any) {
            toast.error(err.message);
        } finally { setIsSavingNrp(false); }
    };

    const saveEditDetails = async () => {
        if (!editDetailsTx) return;
        setIsSavingDetails(true);
        try {
            const res = await fetch(`/api/unit-transactions/${editDetailsTx.id}/details`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    vehiclePlate: editPlat,
                    description: editDesc,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal menyimpan");
            toast.success(`Detail transaksi ${editDetailsTx.transactionNo} berhasil diperbarui`);
            setIsEditDetailsOpen(false);
            setEditDetailsTx(null);
            queryClient.invalidateQueries({ queryKey: ["unit-transactions"] });
        } catch (err: any) {
            toast.error(err.message);
        } finally { setIsSavingDetails(false); }
    };

    const { data: response, isLoading } = useQuery({
        queryKey: ["unit-transactions", page, perPage],
        queryFn: () => unitTransactionsApi.list({ page, perPage }),
    });

    const filteredData = React.useMemo(() => {
        if (!response?.data) return [];
        return (response.data as unknown as EnrichedTransaction[]).filter(tx => {
            const matchesDate = matchesDateRange(tx.transactionDate, dateRange);
            const matchesUnit = filterUnit === "all" ? true : tx.unitType === filterUnit;
            const txStatus = (tx as any).status || "completed";
            const matchesStatus = filterStatus === "all" ? true
                : filterStatus === "lunas" ? (tx.isPaid && txStatus !== "voided")
                : filterStatus === "belum_lunas" ? (!tx.isPaid && txStatus !== "voided" && txStatus !== "pending_void")
                : filterStatus === "pending_void" ? (txStatus === "pending_void")
                : filterStatus === "voided" ? (txStatus === "voided")
                : true;
            return matchesDate && matchesUnit && matchesStatus;
        });
    }, [response, dateRange, filterUnit, filterStatus]);

    React.useEffect(() => {
        if (userUnitType && !isOperator) {
            setFilterUnit(userUnitType);
        }
    }, [userUnitType, isOperator]);

    const getUnitName = (type: string) => {
        const types: Record<string, string> = {
            toko: "Toko",
            simpan_pinjam: "Simpan Pinjam",
            fotocopy: "FotoCopy",
            cuci_mobil: "Cuci Mobil",
            fitness: "Fitness",
            barbershop: "Barbershop",
            playstation: "Play Station",
            laundry: "Laundry",
            resto_cafe: "Resto & Cafe",
            coffe_latar: "Coffe Latar",
        };
        return types[type] || type;
    };

    const getUnitIcon = (type: string) => {
        const icons: Record<string, React.ReactNode> = {
            toko: <ShoppingBag className="h-4 w-4" />,
            cuci_mobil: <Car className="h-4 w-4" />,
        };
        return icons[type] || <Package className="h-4 w-4" />;
    };

    const getPaymentLabel = (method?: string | null) => {
        const label: Record<string, string> = { cash: "Tunai", qris: "QRIS", salary_cut: "Potong Gaji" };
        return method ? (label[method] || method) : "-";
    };

    const getPaymentColor = (method?: string | null) => {
        if (method === "cash") return "border-emerald-300 text-emerald-700 bg-emerald-50/50";
        if (method === "qris") return "border-blue-300 text-blue-700 bg-blue-50/50";
        if (method === "salary_cut") return "border-indigo-300 text-indigo-700 bg-indigo-50/50";
        return "";
    };

    const isTokoView = filterUnit === "toko";

    const columns: ColumnDef<EnrichedTransaction>[] = React.useMemo(() => {
        // Common status renderer
        const renderStatus = (tx: EnrichedTransaction) => {
            const baseStatus = (tx as any).status || "completed";
            if (baseStatus === "pending_void") return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">PENDING VOID</Badge>;
            if (baseStatus === "voided") return <Badge variant="secondary" className="line-through text-muted-foreground">DIBATALKAN</Badge>;
            return (
                <Badge variant={tx.isPaid ? "default" : "destructive"} className={tx.isPaid ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                    {tx.isPaid ? "LUNAS" : "BELUM LUNAS"}
                </Badge>
            );
        };

        const renderActions = (tx: EnrichedTransaction) => {
            const baseStatus = (tx as any).status || "completed";
            const isVoidable = baseStatus === "completed";
            const canEditNrp = (isAdmin || isOperator) && !tx.memberId;
            const canEditDetails = (isAdmin || isOperator) && baseStatus !== "voided" && tx.unitType === "cuci_mobil";
            return (
                <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-8 text-slate-600 hover:text-slate-700 hover:bg-slate-50" title="Detail Transaksi" onClick={(e) => { e.stopPropagation(); openDetail(tx); }}>
                        <Eye className="h-4 w-4" />
                    </Button>
                    {canEditNrp && (
                        <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Tambah NRP Anggota" onClick={(e) => { e.stopPropagation(); setEditTx(tx); setNrpInput(""); setEditMemberFound(null); setIsEditNrpOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                    )}
                    {canEditDetails && (
                        <Button variant="ghost" size="sm" className="h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50" title="Edit Plat Nomor & Keterangan" onClick={(e) => { e.stopPropagation(); const currentPlat = parsePlat((tx as any).notes) || ""; setEditDetailsTx(tx); setEditPlat(currentPlat); setEditDesc(tx.description || ""); setIsEditDetailsOpen(true); }}>
                            <Car className="h-4 w-4" />
                        </Button>
                    )}
                    {isVoidable && (
                        <Button variant="ghost" size="sm" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); setSelectedTx(tx); setVoidReason(""); setIsVoidModalOpen(true); }}>
                            <XCircle className="h-4 w-4 mr-1" />
                            Void
                        </Button>
                    )}
                </div>
            );
        };

        // ============================================================
        // TOKO-SPECIFIC COLUMNS (optimized for retail POS tracking)
        // ============================================================
        if (isTokoView) {
            return [
                {
                    id: "expand",
                    header: () => null,
                    cell: ({ row }: { row: any }) => {
                        const tx = row.original as EnrichedTransaction;
                        const hasItems = tx.items && tx.items.length > 0;
                        if (!hasItems) return <span className="w-5 inline-block" />;
                        return (
                            <button onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }} className="p-1 rounded hover:bg-muted transition-colors">
                                {row.getIsExpanded() ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </button>
                        );
                    },
                    size: 40,
                },
                {
                    header: "Waktu",
                    accessorKey: "transactionDate",
                    cell: ({ row }: { row: any }) => {
                        const tx = row.original as EnrichedTransaction;
                        const dateObj = new Date((tx as any).createdAt || tx.transactionDate);
                        return (
                            <div className="text-sm whitespace-nowrap">
                                <div className="font-medium">{format(dateObj, "dd MMM yyyy", { locale: id })}</div>
                                <div className="text-xs text-muted-foreground font-mono">{format(dateObj, "HH:mm:ss", { locale: id })}</div>
                            </div>
                        );
                    },
                },
                {
                    header: "No. Transaksi",
                    accessorKey: "transactionNo",
                    cell: ({ row }: { row: any }) => {
                        const tx = row.original as EnrichedTransaction;
                        const baseStatus = (tx as any).status || "completed";
                        return (
                            <button
                                onClick={(e) => { e.stopPropagation(); openDetail(tx); }}
                                className="text-left hover:underline font-medium text-primary"
                                title="Klik untuk lihat detail struk"
                            >
                                {tx.transactionNo}
                                {baseStatus === "voided" && (
                                    <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0">VOID</Badge>
                                )}
                            </button>
                        );
                    },
                },
                {
                    header: "Anggota / NRP",
                    accessorKey: "memberId",
                    cell: ({ row }: { row: any }) => {
                        const tx = row.original as EnrichedTransaction;
                        return (
                            <div>
                                <div className="font-medium text-sm">{tx.member?.name || tx.customerName || <span className="text-muted-foreground">Umum</span>}</div>
                                {tx.member?.nrp && (
                                    <div className="text-[10px] text-muted-foreground font-mono">{tx.member.nrp}</div>
                                )}
                            </div>
                        );
                    },
                },
                {
                    header: "Kasir",
                    accessorKey: "createdBy",
                    cell: ({ row }: { row: any }) => {
                        const tx = row.original as EnrichedTransaction;
                        return <span className="text-sm text-muted-foreground">{(tx as any).createdBy?.name || "-"}</span>;
                    },
                },
                {
                    header: "Ringkasan",
                    id: "ringkasan",
                    cell: ({ row }: { row: any }) => {
                        const tx = row.original as EnrichedTransaction;
                        const hasItems = tx.items && tx.items.length > 0;
                        if (!hasItems) return <span className="text-muted-foreground text-sm">-</span>;
                        const totalQty = tx.items!.reduce((s, i) => s + i.quantity, 0);
                        const topItems = tx.items!.slice(0, 2);
                        return (
                            <div className="text-sm">
                                <Badge variant="secondary" className="text-xs">{totalQty} barang</Badge>
                                <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]" title={tx.items!.map(i => i.productName).join(", ")}>
                                    {topItems.map(i => i.productName).join(", ")}{tx.items!.length > 2 ? ` +${tx.items!.length - 2}` : ""}
                                </div>
                            </div>
                        );
                    },
                },
                {
                    header: "Nominal",
                    accessorKey: "amount",
                    cell: ({ row }: { row: any }) => <div className="font-semibold tabular-nums">{formatCurrency((row.original as EnrichedTransaction).amount)}</div>,
                },
                {
                    header: "Metode & Status",
                    id: "metodeStatus",
                    cell: ({ row }: { row: any }) => {
                        const tx = row.original as EnrichedTransaction;
                        return (
                            <div className="flex flex-col gap-1">
                                <Badge variant="outline" className={`text-[10px] w-fit ${getPaymentColor(tx.paymentMethod)}`}>{getPaymentLabel(tx.paymentMethod)}</Badge>
                                {renderStatus(tx)}
                            </div>
                        );
                    },
                },
                { header: "Aksi", id: "actions", cell: ({ row }: { row: any }) => renderActions(row.original as EnrichedTransaction) },
            ] as ColumnDef<EnrichedTransaction>[];
        }

        // ============================================================
        // DEFAULT COLUMNS (all other units — unchanged layout)
        // ============================================================
        return [
            {
                id: "expand",
                header: () => null,
                cell: ({ row }: { row: any }) => {
                    const tx = row.original as EnrichedTransaction;
                    const hasItems = tx.items && tx.items.length > 0;
                    if (!hasItems && tx.unitType !== "toko") return <span className="w-5 inline-block" />;
                    return (
                        <button onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }} className="p-1 rounded hover:bg-muted transition-colors">
                            {row.getIsExpanded() ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </button>
                    );
                },
                size: 40,
            },
            { header: "No. Transaksi", accessorKey: "transactionNo", cell: ({ row }: { row: any }) => <div className="font-medium text-primary">{(row.original as EnrichedTransaction).transactionNo}</div> },
            {
                header: "Tanggal", accessorKey: "transactionDate",
                cell: ({ row }: { row: any }) => {
                    const tx = row.original as EnrichedTransaction;
                    const dateObj = new Date((tx as any).createdAt || tx.transactionDate);
                    return <div className="text-sm">{format(dateObj, "dd MMM yyyy", { locale: id })}<div className="text-[10px] text-muted-foreground mt-0.5">{format(dateObj, "HH:mm", { locale: id })} WIB</div></div>;
                },
            },
            {
                header: "Anggota / Pelanggan", accessorKey: "memberId",
                cell: ({ row }: { row: any }) => {
                    const tx = row.original as EnrichedTransaction;
                    return (
                        <div>
                            <div className="font-medium">{tx.member?.name || tx.customerName || "-"}</div>
                            {tx.member?.nrp && <div className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-sm bg-muted inline-block mt-1">NRP: {tx.member.nrp}</div>}
                        </div>
                    );
                },
            },
            ...(isOperator ? [{ header: "Unit", accessorKey: "unitType", cell: ({ row }: { row: any }) => <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200 uppercase text-[10px] whitespace-nowrap">{getUnitName((row.original as EnrichedTransaction).unitType)}</Badge> } as ColumnDef<EnrichedTransaction>] : []),
            {
                header: "Keterangan / Jasa", accessorKey: "description",
                cell: ({ row }: { row: any }) => {
                    const tx = row.original as EnrichedTransaction;
                    const hasItems = tx.items && tx.items.length > 0;
                    return (
                        <div className="max-w-[200px]">
                            <div className="truncate" title={tx.description || undefined}>{tx.description || "-"}</div>
                            {hasItems && <div className="text-[10px] text-muted-foreground mt-0.5">{tx.items!.length} produk</div>}
                        </div>
                    );
                },
            },
            ...(filterUnit === "cuci_mobil" ? [{ header: "Plat Nomor", id: "platNomor", cell: ({ row }: { row: any }) => { const plat = parsePlat((row.original as any).notes); return plat ? <Badge variant="outline" className="font-mono text-xs bg-slate-50 border-slate-300 text-slate-700 tracking-wider">{plat}</Badge> : <span className="text-muted-foreground text-xs">-</span>; } } as ColumnDef<EnrichedTransaction>] : []),
            { header: "Nominal", accessorKey: "amount", cell: ({ row }: { row: any }) => <div className="font-medium">{formatCurrency((row.original as EnrichedTransaction).amount)}</div> },
            { header: "Status", accessorKey: "status", cell: ({ row }: { row: any }) => renderStatus(row.original as EnrichedTransaction) },
            { header: "Metode", accessorKey: "paymentMethod", cell: ({ row }: { row: any }) => { const method = (row.original as EnrichedTransaction).paymentMethod; return <Badge variant="outline" className={`text-[10px] ${getPaymentColor(method)}`}>{getPaymentLabel(method)}</Badge>; } },
            { header: "Aksi", id: "actions", cell: ({ row }: { row: any }) => renderActions(row.original as EnrichedTransaction) },
        ] as ColumnDef<EnrichedTransaction>[];
    }, [isTokoView, isOperator, isAdmin, filterUnit]);

    // Expanded row renderer
    const renderExpandedRow = React.useCallback(({ original: tx }: { original: EnrichedTransaction }) => {
        const hasItems = tx.items && tx.items.length > 0;
        if (!hasItems) {
            return (
                <div className="px-12 py-3 bg-muted/30 text-sm text-muted-foreground">
                    Tidak ada detail item untuk transaksi ini.
                </div>
            );
        }

        const totalDiscount = tx.items.reduce((sum, i) => sum + i.discount * i.quantity, 0);

        return (
            <div className="px-8 py-3 bg-muted/30 border-t">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Detail Produk ({tx.items!.length} item)
                </div>
                <div className="rounded-lg border bg-background overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b">
                                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Produk</th>
                                <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground w-16">Qty</th>
                                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-28">Harga</th>
                                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-24">Diskon</th>
                                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-28">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tx.items!.map((item, idx) => (
                                <tr key={item.id} className={idx % 2 === 1 ? "bg-slate-50/50" : ""}>
                                    <td className="px-3 py-2">
                                        <div className="font-medium text-sm">{item.productName}</div>
                                        {item.productCategory && (
                                            <div className="text-[10px] text-muted-foreground">{item.productCategory}</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-center">{item.quantity}</td>
                                    <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                                    <td className="px-3 py-2 text-right">
                                        {item.discount > 0 ? (
                                            <span className="text-red-500">-{formatCurrency(item.discount * item.quantity)}</span>
                                        ) : "-"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                                </tr>
                            ))}
                        </tbody>
                        {totalDiscount > 0 && (
                            <tfoot>
                                <tr className="border-t bg-slate-50">
                                    <td colSpan={3} className="px-3 py-2 text-xs text-muted-foreground text-right">Total Diskon</td>
                                    <td className="px-3 py-2 text-right text-xs font-medium text-red-500">-{formatCurrency(totalDiscount)}</td>
                                    <td></td>
                                </tr>
                                <tr className="border-t font-semibold">
                                    <td colSpan={4} className="px-3 py-2 text-right">Total</td>
                                    <td className="px-3 py-2 text-right">{formatCurrency(tx.amount)}</td>
                                </tr>
                            </tfoot>
                        )}
                        {totalDiscount === 0 && (
                            <tfoot>
                                <tr className="border-t font-semibold bg-slate-50">
                                    <td colSpan={4} className="px-3 py-2 text-right">Total</td>
                                    <td className="px-3 py-2 text-right">{formatCurrency(tx.amount)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        );
    }, []);

    const submitVoidRequest = async () => {
        if (!selectedTx) return;
        if (!voidReason.trim()) {
            toast.error("Alasan void harus diisi");
            return;
        }

        setIsSubmittingVoid(true);
        try {
            const res = await fetch("/api/unit-transactions/void-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    transactionNo: selectedTx.transactionNo,
                    reason: voidReason,
                }),
            });

            const resData = await res.json();
            if (!res.ok) {
                throw new Error(resData.message || "Gagal mengajukan void");
            }

            toast.success(resData.message || "Pengajuan void berhasil dikirim.");
            setIsVoidModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["unit-transactions"] });
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSubmittingVoid(false);
        }
    };

    const handlePrint = React.useCallback(() => {
        const unitLabel = filterUnit === "all" ? "Semua Unit" : getUnitName(filterUnit);
        const statusLabel = filterStatus === "all" ? "Semua Status"
            : filterStatus === "lunas" ? "Lunas"
            : filterStatus === "belum_lunas" ? "Belum Lunas"
            : filterStatus === "pending_void" ? "Pending Void"
            : "Dibatalkan";
        const periodLabel = dateRange.label || "Semua Data";

        const rows = filteredData.map((tx) => {
            const plat = parsePlat((tx as any).notes);
            return `
                <tr>
                    <td>${tx.transactionNo}</td>
                    <td>${format(new Date(tx.transactionDate), "d MMM yyyy", { locale: id })}</td>
                    <td>${tx.member?.name || tx.customerName || "-"}<br/><small style="color:#666">${tx.member?.nrp ? "NRP: " + tx.member.nrp : ""}</small></td>
                    <td>${getUnitName(tx.unitType)}</td>
                    <td>${plat || "-"}</td>
                    <td>${tx.description || "-"}</td>
                    <td style="text-align:right">${formatCurrency(tx.amount)}</td>
                    <td>${tx.isPaid ? "LUNAS" : "BELUM LUNAS"}</td>
                </tr>
            `;
        }).join("");

        const total = filteredData.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        const win = window.open("", "_blank");
        if (!win) return;
        win.document.write(`
            <!DOCTYPE html><html><head>
            <title>Riwayat Transaksi Unit</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
                .header { text-align: center; margin-bottom: 16px; }
                .header img { height: 48px; margin-bottom: 4px; }
                .header h2 { margin: 0; font-size: 14px; font-weight: bold; }
                .header p { margin: 2px 0; font-size: 11px; color: #444; }
                .meta { display: flex; gap: 20px; margin-bottom: 12px; font-size: 10px; }
                .meta span { background: #f3f4f6; padding: 3px 8px; border-radius: 4px; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #1e293b; color: white; padding: 6px 8px; font-size: 10px; text-align: left; }
                td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
                tr:nth-child(even) td { background: #f9fafb; }
                .total-row td { font-weight: bold; border-top: 2px solid #1e293b; background: #f1f5f9; }
                @media print { body { margin: 8px; } }
            </style>
            </head><body>
            <div class="header">
                <img src="/logo.png" onerror="this.style.display='none'" />
                <h2>PRIMKOPPOL RESOR LUMAJANG</h2>
                <p>Riwayat Transaksi Unit</p>
                <p>Dicetak: ${new Date().toLocaleString("id-ID")}</p>
            </div>
            <div class="meta">
                <span>Periode: <strong>${periodLabel}</strong></span>
                <span>Unit: <strong>${unitLabel}</strong></span>
                <span>Status: <strong>${statusLabel}</strong></span>
                <span>Total: <strong>${filteredData.length} transaksi</strong></span>
            </div>
            <table>
                <thead><tr>
                    <th>No. Transaksi</th><th>Tanggal</th><th>Anggota</th><th>Unit</th><th>Plat Nomor</th><th>Keterangan</th><th>Nominal</th><th>Status</th>
                </tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr class="total-row">
                    <td colspan="6">TOTAL (${filteredData.length} transaksi)</td>
                    <td style="text-align:right">${formatCurrency(total)}</td>
                    <td></td>
                </tr></tfoot>
            </table>
            </body></html>
        `);
        win.document.close();
        win.print();
    }, [filteredData, filterUnit, filterStatus, dateRange]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Riwayat Transaksi Unit"
                description="Monitor semua transaksi dari unit-unit PRIMKOPPOL"
                actions={(
                    <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => exportToExcel(filteredData as unknown as Record<string, unknown>[], txExportColumns, "Riwayat_Transaksi_Unit", "Transaksi")}>
                            <Download className="mr-2 h-4 w-4" />
                            Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportToPDF(filteredData as unknown as Record<string, unknown>[], txExportColumns, "Riwayat Transaksi Unit - PRIMKOPPOL Resor Lumajang", "Riwayat_Transaksi_Unit")}>
                            <FileText className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            Cetak
                        </Button>
                        <Button asChild>
                            <Link href="/transaksi-unit">
                                <Plus className="mr-2 h-4 w-4" />
                                Input Transaksi Baru
                            </Link>
                        </Button>
                    </div>
                )}
            />

            <Card>
                <CardContent className="p-4 space-y-3">
                    <DatePeriodFilter onChange={setDateRange} showImportNote />
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
                        <div className="flex items-center gap-2">
                            <Label className="text-sm text-muted-foreground whitespace-nowrap">Filter Unit:</Label>
                            {isOperator ? (
                                <Select value={filterUnit} onValueChange={setFilterUnit}>
                                    <SelectTrigger className="h-8 w-[180px]">
                                        <SelectValue placeholder="Pilih Unit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Unit</SelectItem>
                                        <SelectItem value="cuci_mobil">Cuci Mobil</SelectItem>
                                        <SelectItem value="barbershop">Barbershop</SelectItem>
                                        <SelectItem value="playstation">Play Station</SelectItem>
                                        <SelectItem value="fitness">Fitness</SelectItem>
                                        <SelectItem value="laundry">Laundry</SelectItem>
                                        <SelectItem value="resto_cafe">Resto &amp; Cafe</SelectItem>
                                        <SelectItem value="toko">Toko</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 capitalize">
                                    {getUnitName(filterUnit)}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-sm text-muted-foreground whitespace-nowrap">Filter Status:</Label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="h-8 w-[180px]">
                                    <SelectValue placeholder="Semua Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Status</SelectItem>
                                    <SelectItem value="lunas">Lunas</SelectItem>
                                    <SelectItem value="belum_lunas">Belum Lunas (Piutang)</SelectItem>
                                    <SelectItem value="pending_void">Pending Void</SelectItem>
                                    <SelectItem value="voided">Dibatalkan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {dateRange.mode !== "all" && (
                            <p className="text-xs text-muted-foreground">Periode: <strong>{dateRange.label}</strong></p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <DataTable
                columns={columns}
                data={filteredData}
                isLoading={isLoading}
                renderExpandedRow={renderExpandedRow}
                getRowCanExpand={({ original: tx }) => !!(tx.items && tx.items.length > 0)}
            />

            {/* Void Request Dialog */}
            <Dialog open={isVoidModalOpen} onOpenChange={setIsVoidModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ajukan Pembatalan (Void)</DialogTitle>
                        <DialogDescription>
                            Anda akan mengajukan void untuk transaksi <strong>{selectedTx?.transactionNo}</strong> senilai{" "}
                            <strong>{formatCurrency(selectedTx?.amount || 0)}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Show items preview if toko */}
                        {selectedTx?.items && selectedTx.items.length > 0 && (
                            <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produk dalam transaksi:</p>
                                {selectedTx.items.map(item => (
                                    <div key={item.id} className="flex justify-between text-sm">
                                        <span>{item.productName} x{item.quantity}</span>
                                        <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                                    </div>
                                ))}
                                <Separator />
                                <div className="flex justify-between font-semibold text-sm">
                                    <span>Total</span>
                                    <span>{formatCurrency(selectedTx.amount)}</span>
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="voidReason">Alasan Void <span className="text-red-500">*</span></Label>
                            <Textarea
                                id="voidReason"
                                placeholder="Jelaskan alasan mengapa transaksi ini harus dibatalkan..."
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                rows={3}
                            />
                        </div>
                        <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm border border-amber-200">
                            <strong>Perhatian:</strong> Pengajuan ini memerlukan persetujuan Admin Unit sebelum transaksi benar-benar dibatalkan (dibuatkan Jurnal Pembalik). Limit plafon piutang anggota baru akan dikembalikan setelah void disetujui.
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsVoidModalOpen(false)} disabled={isSubmittingVoid}>
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={submitVoidRequest} disabled={isSubmittingVoid}>
                            {isSubmittingVoid ? "Memproses..." : "Ajukan Void"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Transaction Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-primary" />
                            Detail Transaksi
                        </DialogTitle>
                        <DialogDescription>
                            Informasi lengkap transaksi {detailTx?.transactionNo}
                        </DialogDescription>
                    </DialogHeader>
                    {detailTx && (
                        <div className="space-y-5 py-2">
                            {/* Transaction Header */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Receipt className="h-3 w-3" /> No. Transaksi</p>
                                    <p className="font-semibold text-sm">{detailTx.transactionNo}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Tanggal</p>
                                    <p className="text-sm">{format(new Date((detailTx as any).createdAt || detailTx.transactionDate), "dd MMM yyyy, HH:mm", { locale: id })} WIB</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Pelanggan</p>
                                    <p className="text-sm font-medium">{detailTx.member?.name || detailTx.customerName || "Umum"}</p>
                                    {detailTx.member?.nrp && (
                                        <p className="text-xs text-muted-foreground">NRP: {detailTx.member.nrp}</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Unit</p>
                                    <Badge variant="outline" className="text-xs uppercase">{getUnitName(detailTx.unitType)}</Badge>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> Metode Bayar</p>
                                    <Badge variant="outline" className={`text-xs ${getPaymentColor(detailTx.paymentMethod)}`}>{getPaymentLabel(detailTx.paymentMethod)}</Badge>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">Status</p>
                                    {(() => {
                                        const baseStatus = (detailTx as any).status || "completed";
                                        if (baseStatus === "pending_void") return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-xs">PENDING VOID</Badge>;
                                        if (baseStatus === "voided") return <Badge variant="secondary" className="line-through text-muted-foreground text-xs">DIBATALKAN</Badge>;
                                        return <Badge variant={detailTx.isPaid ? "default" : "destructive"} className={`text-xs ${detailTx.isPaid ? "bg-emerald-500" : ""}`}>{detailTx.isPaid ? "LUNAS" : "BELUM LUNAS"}</Badge>;
                                    })()}
                                </div>
                            </div>

                            {/* Keterangan */}
                            {detailTx.description && (
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Keterangan</p>
                                    <p className="text-sm bg-muted/50 rounded-md px-3 py-2">{detailTx.description}</p>
                                </div>
                            )}

                            {/* Items table for toko */}
                            {detailTx.items && detailTx.items.length > 0 && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                            <ShoppingBag className="h-3.5 w-3.5" />
                                            Daftar Produk ({detailTx.items.length} item)
                                        </p>
                                        <div className="rounded-lg border overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b">
                                                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Produk</th>
                                                        <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground w-14">Qty</th>
                                                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-24">Harga Satuan</th>
                                                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-20">Diskon</th>
                                                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-24">Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detailTx.items.map((item, idx) => (
                                                        <tr key={item.id} className={idx % 2 === 1 ? "bg-slate-50/50" : ""}>
                                                            <td className="px-3 py-2">
                                                                <div className="font-medium">{item.productName}</div>
                                                                {item.productCategory && (
                                                                    <Badge variant="outline" className="text-[10px] mt-0.5 h-4 px-1">{item.productCategory}</Badge>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-center">{item.quantity}</td>
                                                            <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                                                            <td className="px-3 py-2 text-right">
                                                                {item.discount > 0
                                                                    ? <span className="text-red-500 text-xs">-{formatCurrency(item.discount)}/pcs</span>
                                                                    : <span className="text-muted-foreground">-</span>
                                                                }
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Payment Summary */}
                            <Separator />
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Item</span>
                                    <span>{detailTx.items?.length ?? "-"}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Transaksi</span>
                                    <span className="font-bold text-lg">{formatCurrency(detailTx.amount)}</span>
                                </div>
                                {detailTx.cashReceived != null && detailTx.cashReceived > 0 && (
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Dibayar</span>
                                            <span>{formatCurrency(detailTx.cashReceived)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Kembalian</span>
                                            <span>{formatCurrency(detailTx.changeAmount || 0)}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Kasir</span>
                                    <span>{(detailTx as any).createdBy?.name || "-"}</span>
                                </div>
                            </div>

                            {/* Void info */}
                            {(() => {
                                const baseStatus = (detailTx as any).status || "completed";
                                if (baseStatus === "voided" || baseStatus === "pending_void") {
                                    return (
                                        <>
                                            <Separator />
                                            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-1.5">
                                                <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    {baseStatus === "voided" ? "Transaksi Dibatalkan" : "Menunggu Persetujuan Void"}
                                                </p>
                                                {detailTx.voidReason && (
                                                    <p className="text-sm text-red-600">Alasan: {detailTx.voidReason}</p>
                                                )}
                                                {detailTx.voidRequestedAt && (
                                                    <p className="text-xs text-red-500">
                                                        Diajukan: {format(new Date(detailTx.voidRequestedAt), "dd MMM yyyy, HH:mm", { locale: id })} WIB
                                                    </p>
                                                )}
                                                {detailTx.voidRequestedBy && (
                                                    <p className="text-xs text-red-500">Oleh: {detailTx.voidRequestedBy}</p>
                                                )}
                                            </div>
                                        </>
                                    );
                                }
                                return null;
                            })()}

                            {/* Notes */}
                            {(detailTx as any).notes && !detailTx.items?.length && (
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Catatan</p>
                                    <p className="text-sm bg-muted/50 rounded-md px-3 py-2">{(detailTx as any).notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit NRP Dialog (Admin Only) */}
            <Dialog open={isEditNrpOpen} onOpenChange={(open) => { setIsEditNrpOpen(open); if (!open) { setNrpInput(""); setEditMemberFound(null); }}}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Anggota Transaksi</DialogTitle>
                        <DialogDescription>
                            Tambahkan/ubah NRP anggota untuk transaksi <strong>{editTx?.transactionNo}</strong>.
                            Hanya Admin Unit yang dapat melakukan ini.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Masukkan NRP atau Nomor Anggota</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Contoh: 80040123"
                                    value={nrpInput}
                                    onChange={(e) => {
                                        setNrpInput(e.target.value);
                                        setEditMemberFound(null);
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && searchMemberByNrp(nrpInput)}
                                />
                                <Button onClick={() => searchMemberByNrp(nrpInput)} disabled={isSearchingNrp} variant="outline">
                                    {isSearchingNrp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        {editMemberFound ? (
                            <div className="p-3 border rounded-lg bg-emerald-50 border-emerald-200">
                                <p className="text-sm font-semibold text-emerald-800">Anggota Ditemukan</p>
                                <p className="font-medium mt-1">{editMemberFound.name}</p>
                                <p className="text-xs text-muted-foreground">NRP: {editMemberFound.nrp || "-"} | No. Anggota: {editMemberFound.memberNo}</p>
                            </div>
                        ) : nrpInput.length >= 4 && !isSearchingNrp ? (
                            <p className="text-sm text-red-600">NRP tidak ditemukan. Coba tekan Enter atau klik ikon pencarian.</p>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditNrpOpen(false)}>Batal</Button>
                        <Button onClick={saveEditNrp} disabled={!editMemberFound || isSavingNrp}>
                            {isSavingNrp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Simpan Anggota
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Edit Details Dialog (Plat Nomor + Keterangan) */}
            <Dialog open={isEditDetailsOpen} onOpenChange={(open) => { setIsEditDetailsOpen(open); if (!open) { setEditDetailsTx(null); setEditPlat(""); setEditDesc(""); } }}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Car className="h-5 w-5 text-amber-500" />
                            Edit Plat Nomor & Keterangan
                        </DialogTitle>
                        <DialogDescription>
                            Perbarui plat nomor kendaraan dan/atau keterangan untuk transaksi{" "}
                            <strong>{editDetailsTx?.transactionNo}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit-plat">Plat Nomor Kendaraan</Label>
                            <Input
                                id="edit-plat"
                                placeholder="Contoh: AB 1234 CD"
                                value={editPlat}
                                onChange={(e) => setEditPlat(e.target.value.toUpperCase())}
                            />
                            <p className="text-xs text-muted-foreground">Kosongkan untuk menghapus plat nomor.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-desc">Keterangan / Jasa</Label>
                            <Textarea
                                id="edit-desc"
                                placeholder="Misal: Motor Cuci Biasa, Mobil Premium, dll."
                                className="resize-none"
                                rows={3}
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDetailsOpen(false)}>Batal</Button>
                        <Button
                            onClick={saveEditDetails}
                            disabled={isSavingDetails}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isSavingDetails ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
