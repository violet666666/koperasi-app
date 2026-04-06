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
import { Plus, Download, FileText, XCircle, Pencil, Search, Loader2, Printer, Car } from "lucide-react";
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
    const isOperator = user?.role?.name === "operator" || user?.permissions?.includes("manage_all");

    const [page, setPage] = React.useState(1);
    const [perPage, setPerPage] = React.useState(9999);
    const [dateRange, setDateRange] = React.useState<DateRange>({ start: null, end: null, mode: "all", label: "Semua Data" });
    // Unit filter
    const [filterUnit, setFilterUnit] = React.useState<string>(userUnitType || "all");
    // Status filter
    const [filterStatus, setFilterStatus] = React.useState<string>("all");

    // Void state
    const queryClient = useQueryClient();
    const [isVoidModalOpen, setIsVoidModalOpen] = React.useState(false);
    const [selectedTx, setSelectedTx] = React.useState<UnitTransaction | null>(null);
    const [voidReason, setVoidReason] = React.useState("");
    const [isSubmittingVoid, setIsSubmittingVoid] = React.useState(false);

    // Edit NRP (Admin only)
    const isAdmin = user?.role?.name === "admin";
    const [isEditNrpOpen, setIsEditNrpOpen] = React.useState(false);
    const [editTx, setEditTx] = React.useState<UnitTransaction | null>(null);
    const [nrpInput, setNrpInput] = React.useState("");
    const [editMemberFound, setEditMemberFound] = React.useState<any | null>(null);
    const [isSearchingNrp, setIsSearchingNrp] = React.useState(false);
    const [isSavingNrp, setIsSavingNrp] = React.useState(false);

    // Edit Plat Nomor + Keterangan
    const [isEditDetailsOpen, setIsEditDetailsOpen] = React.useState(false);
    const [editDetailsTx, setEditDetailsTx] = React.useState<UnitTransaction | null>(null);
    const [editPlat, setEditPlat] = React.useState("");
    const [editDesc, setEditDesc] = React.useState("");
    const [isSavingDetails, setIsSavingDetails] = React.useState(false);

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
        return (response.data as unknown as UnitTransaction[]).filter(tx => {
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

    // Sync unit filter to user's unitType if they're not operator
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
        };
        return types[type] || type;
    };

    const columns: ColumnDef<UnitTransaction>[] = [
        {
            header: "No. Transaksi",
            accessorKey: "transactionNo",
            cell: ({ row }) => (
                <div className="font-medium text-primary">{row.original.transactionNo}</div>
            ),
        },
        {
            header: "Tanggal",
            accessorKey: "transactionDate",
            cell: ({ row }) => {
                const tx = row.original;
                const dateObj = new Date((tx as any).createdAt || tx.transactionDate);
                return (
                    <div className="text-sm">
                        {format(dateObj, "dd MMM yyyy", { locale: id })}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                            {format(dateObj, "HH:mm", { locale: id })} WIB
                        </div>
                    </div>
                );
            },
        },
        {
            header: "Anggota / Pelanggan",
            accessorKey: "memberId",
            cell: ({ row }) => {
                const tx = row.original;
                return (
                    <div>
                        <div className="font-medium">{tx.member?.name || "-"}</div>
                        {tx.member?.nrp && (
                            <div className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-sm bg-muted inline-block mt-1">
                                NRP: {tx.member.nrp}
                            </div>
                        )}
                    </div>
                );
            },
        },
        // Kolom Unit hanya tampil jika Operator (lihat semua unit)
        ...(isOperator ? [{
            header: "Unit",
            accessorKey: "unitType",
            cell: ({ row }: { row: any }) => (
                <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200 uppercase text-[10px] whitespace-nowrap">
                    {getUnitName(row.original.unitType)}
                </Badge>
            ),
        } as ColumnDef<UnitTransaction>] : []),
        {
            header: "Keterangan / Jasa",
            accessorKey: "description",
            cell: ({ row }) => (
                <div className="max-w-[200px] truncate" title={row.original.description}>
                    {row.original.description || "-"}
                </div>
            ),
        },
        // Kolom Plat Nomor HANYA untuk unit Cuci Mobil (tidak tampil di semua / all unit mode)
        ...(filterUnit === "cuci_mobil" ? [{
            header: "Plat Nomor",
            id: "platNomor",
            cell: ({ row }: { row: any }) => {
                const plat = parsePlat((row.original as any).notes);
                if (!plat) return <span className="text-muted-foreground text-xs">-</span>;
                return (
                    <Badge variant="outline" className="font-mono text-xs bg-slate-50 border-slate-300 text-slate-700 tracking-wider">
                        🚗 {plat}
                    </Badge>
                );
            },
        } as ColumnDef<UnitTransaction>] : []),
        {
            header: "Nominal",
            accessorKey: "amount",
            cell: ({ row }) => <div className="text-right font-medium">{formatCurrency(row.original.amount)}</div>,
        },
        {
            header: "Status",
            accessorKey: "status",
            cell: ({ row }) => {
                const tx = row.original;
                const baseStatus = (tx as any).status || "completed";
                
                if (baseStatus === "pending_void") {
                    return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">PENDING VOID</Badge>;
                }
                if (baseStatus === "voided") {
                    return <Badge variant="secondary" className="line-through text-muted-foreground">DIBATALKAN</Badge>;
                }
                
                return (
                    <Badge
                        variant={tx.isPaid ? "default" : "destructive"}
                        className={tx.isPaid ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                    >
                        {tx.isPaid ? "LUNAS" : "BELUM LUNAS"}
                    </Badge>
                );
            },
        },
        // Kolom Metode Bayar
        {
            header: "Metode",
            accessorKey: "paymentMethod",
            cell: ({ row }) => {
                const method = row.original.paymentMethod;
                const label: Record<string, string> = { cash: "Tunai", qris: "QRIS", salary_cut: "Potong Gaji" };
                const colorClass = method === "cash" ? "border-emerald-300 text-emerald-700" : method === "qris" ? "border-blue-300 text-blue-700" : "border-indigo-300 text-indigo-700";
                return <Badge variant="outline" className={`text-[10px] ${colorClass}`}>{method ? (label[method] || method) : "-"}</Badge>;
            },
        },
        {
            header: "Aksi",
            id: "actions",
            cell: ({ row }) => {
                const tx = row.original;
                const baseStatus = (tx as any).status || "completed";
                const isVoidable = baseStatus === "completed";
                const canEditNrp = (isAdmin || isOperator) && !tx.memberId;
                const canEditDetails = (isAdmin || isOperator) && baseStatus !== "voided";

                return (
                    <div className="flex gap-1">
                        {canEditNrp && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="Tambah NRP Anggota"
                                onClick={() => {
                                    setEditTx(tx);
                                    setNrpInput("");
                                    setEditMemberFound(null);
                                    setIsEditNrpOpen(true);
                                }}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        )}
                        {canEditDetails && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                title="Edit Plat Nomor & Keterangan"
                                onClick={() => {
                                    const currentPlat = parsePlat((tx as any).notes) || "";
                                    setEditDetailsTx(tx);
                                    setEditPlat(currentPlat);
                                    setEditDesc(tx.description || "");
                                    setIsEditDetailsOpen(true);
                                }}
                            >
                                <Car className="h-4 w-4" />
                            </Button>
                        )}
                        {isVoidable && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                    setSelectedTx(tx);
                                    setVoidReason("");
                                    setIsVoidModalOpen(true);
                                }}
                            >
                                <XCircle className="h-4 w-4 mr-1" />
                                Void
                            </Button>
                        )}
                        {!isVoidable && !canEditNrp && !canEditDetails && <span className="text-muted-foreground text-xs text-center block">-</span>}
                    </div>
                );
            },
        },
    ];

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

    // Print handler — menggunakan filteredData sesuai filter aktif
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
                    <td>${tx.member?.name || "-"}<br/><small style="color:#666">${tx.member?.nrp ? "NRP: " + tx.member.nrp : ""}</small></td>
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
                <span>📅 Periode: <strong>${periodLabel}</strong></span>
                <span>🏬 Unit: <strong>${unitLabel}</strong></span>
                <span>💳 Status: <strong>${statusLabel}</strong></span>
                <span>📊 Total: <strong>${filteredData.length} transaksi</strong></span>
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
                                    <SelectItem value="lunas">✅ Lunas</SelectItem>
                                    <SelectItem value="belum_lunas">🔴 Belum Lunas (Piutang)</SelectItem>
                                    <SelectItem value="pending_void">⏳ Pending Void</SelectItem>
                                    <SelectItem value="voided">⛔ Dibatalkan</SelectItem>
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
                                <p className="text-sm font-semibold text-emerald-800">✅ Anggota Ditemukan</p>
                                <p className="font-medium mt-1">{editMemberFound.name}</p>
                                <p className="text-xs text-muted-foreground">NRP: {editMemberFound.nrp || "-"} | No. Anggota: {editMemberFound.memberNo}</p>
                            </div>
                        ) : nrpInput.length >= 4 && !isSearchingNrp ? (
                            <p className="text-sm text-red-600">❌ NRP tidak ditemukan. Coba tekan Enter atau klik ikon 🔍.</p>
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
                            <Label htmlFor="edit-plat">🚗 Plat Nomor Kendaraan</Label>
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
