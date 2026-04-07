import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Landmark, Clock, FileText, User, ReceiptText, AlertTriangle, Car, Tag } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { loansApi, unitTransactionsApi } from "@/lib/api";
import { toast } from "sonner";

export interface ApprovalItem {
    id: number;
    requestType: string;
    referenceId: number;
    referenceNo: string;
    description: string;
    amount?: number;
    branchId: number;
    status: "pending" | "approved" | "rejected";
    requestedBy?: { id: number; name: string };
    requestedAt: string;
    processedBy?: { id: number; name: string };
    processedAt?: string;
    notes?: string;
    metadata?: {
        // Loan fields
        tenorMonths?: number;
        purpose?: string;
        deductionSource?: string;
        productName?: string;
        memberNo?: string;
        // Void fields
        voidReason?: string;
        voidPendingReason?: string;
        kasirName?: string;
        unitType?: string;
        memberName?: string;
        memberNrp?: string;
        transactionNo?: string;
        originalAmount?: number;
        vehiclePlate?: string;
        itemCount?: number;
        saleNo?: string;
    };
}

interface ApprovalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    approval: ApprovalItem | null;
    onSuccess: () => void;
}

export function ApprovalDialog({ open, onOpenChange, approval, onSuccess }: ApprovalDialogProps) {
    const [action, setAction] = React.useState<"approve" | "reject" | null>(null);
    const [notes, setNotes] = React.useState("");
    const [processing, setProcessing] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setAction(null);
            setNotes("");
        }
    }, [open, approval?.id]);

    const processApproval = async (type: "approve" | "reject") => {
        if (!approval) return;

        if (type === "reject" && !notes.trim()) {
            toast.error("Harap isi alasan penolakan pada kolom catatan!");
            setAction("reject");
            return;
        }

        setProcessing(true);
        try {
            if (approval.requestType === "loan_application") {
                if (type === "approve") {
                    await loansApi.approve(approval.referenceId, notes);
                } else {
                    await loansApi.reject(approval.referenceId, notes);
                }
            } else if (approval.requestType === "unit_void" || approval.requestType === "void_store_sale") {
                await unitTransactionsApi.voidApprove({
                    approvalRequestNo: approval.referenceNo,
                    action: type === "approve" ? "approved" : "rejected",
                    notes: notes,
                });
            }

            toast.success(
                type === "approve"
                    ? "Pengajuan berhasil disetujui"
                    : "Pengajuan berhasil ditolak"
            );
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast.error("Gagal memproses pengajuan");
        } finally {
            setProcessing(false);
        }
    };

    if (!approval) return null;

    const isVoid = approval.requestType === "unit_void" || approval.requestType === "void_store_sale";
    const meta = approval.metadata || {};

    // Resolve void reason dari berbagai sumber (metadata atau description)
    const voidReason = isVoid
        ? (meta.voidReason ||
          meta.voidPendingReason ||
          (approval.description?.includes("—")
            ? approval.description.split("—").pop()?.trim()
            : null) ||
          approval.description ||
          "Tidak disebutkan")
        : "";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
                {/* Header (Receipt Style) */}
                <div className="bg-primary/10 p-6 flex flex-col items-center justify-center text-center">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary mb-3">
                        <ReceiptText className="h-6 w-6" />
                    </div>
                    <DialogTitle className="text-xl font-bold">Rincian Pengajuan</DialogTitle>
                    <DialogDescription className="text-balance mt-1">
                        {approval.referenceNo}
                    </DialogDescription>
                </div>

                <div className="px-6 py-4 space-y-4">
                    {/* Amount Highlight */}
                    {approval.amount && (
                        <div className="flex flex-col items-center justify-center py-2">
                            <span className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                                Total Pengajuan
                            </span>
                            <span className="text-3xl font-bold tracking-tight text-foreground">
                                {formatCurrency(approval.amount)}
                            </span>
                        </div>
                    )}

                    <Separator className="border-dashed" />

                    {/* ── VOID REQUEST PANEL ──────────────────────────────── */}
                    {isVoid ? (
                        <div className="space-y-3">
                            {/* Alasan Pembatalan - Highlighted Box */}
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5 mb-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    ALASAN PEMBATALAN DARI KASIR
                                </p>
                                <p className="text-sm text-amber-900 font-medium leading-relaxed">
                                    &ldquo;{voidReason}&rdquo;
                                </p>
                            </div>

                            {/* Detail Info Grid */}
                            <div className="grid gap-2.5 text-sm">
                                {/* Kasir Pengaju */}
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5" />
                                        Diajukan Oleh
                                    </span>
                                    <span className="font-medium">{approval.requestedBy?.name || "-"}</span>
                                </div>

                                {/* Kasir Name dari metadata */}
                                {meta.kasirName && meta.kasirName !== approval.requestedBy?.name && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5" />
                                            Kasir
                                        </span>
                                        <span className="font-medium">{meta.kasirName}</span>
                                    </div>
                                )}

                                {/* Unit */}
                                {meta.unitType && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <Tag className="h-3.5 w-3.5" />
                                            Unit
                                        </span>
                                        <Badge variant="outline" className="capitalize">
                                            {meta.unitType.replace(/_/g, " ")}
                                        </Badge>
                                    </div>
                                )}

                                {/* Anggota */}
                                {meta.memberName && meta.memberName !== "-" && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5" />
                                            Anggota
                                        </span>
                                        <div className="text-right">
                                            <p className="font-medium">{meta.memberName}</p>
                                            {meta.memberNrp && meta.memberNrp !== "-" && (
                                                <p className="text-xs text-muted-foreground">NRP: {meta.memberNrp}</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Plat Kendaraan */}
                                {meta.vehiclePlate && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <Car className="h-3.5 w-3.5" />
                                            Plat Kendaraan
                                        </span>
                                        <Badge variant="outline" className="font-mono border-slate-400">
                                            {meta.vehiclePlate}
                                        </Badge>
                                    </div>
                                )}

                                {/* No. Transaksi Asli */}
                                {(meta.transactionNo || meta.saleNo) && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground flex items-center gap-1.5">
                                            <FileText className="h-3.5 w-3.5" />
                                            No. Transaksi
                                        </span>
                                        <span className="font-mono text-xs">{meta.transactionNo || meta.saleNo}</span>
                                    </div>
                                )}

                                {/* Waktu Pengajuan */}
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        Waktu Pengajuan
                                    </span>
                                    <span className="font-medium text-right text-xs">
                                        {new Date(approval.requestedAt).toLocaleDateString("id-ID", {
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ── LOAN / OTHER REQUEST PANEL ──────────────────── */
                        <div className="grid gap-3 text-sm">
                            <div className="flex justify-between items-start">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5" />
                                    Anggota
                                </span>
                                <div className="text-right font-medium">
                                    <p>{approval.requestedBy?.name}</p>
                                    {approval.metadata?.memberNo && (
                                        <p className="text-xs text-muted-foreground">{approval.metadata.memberNo}</p>
                                    )}
                                </div>
                            </div>

                            {approval.metadata?.productName && (
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5" />
                                        Jenis
                                    </span>
                                    <span className="font-medium text-right">{approval.metadata.productName}</span>
                                </div>
                            )}

                            {approval.metadata?.tenorMonths && (
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        Tenor
                                    </span>
                                    <span className="font-medium text-right">{approval.metadata.tenorMonths} Bulan</span>
                                </div>
                            )}

                            {approval.metadata?.deductionSource && (
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center gap-1.5">
                                        <Landmark className="h-3.5 w-3.5" />
                                        Sumber Potongan
                                    </span>
                                    <Badge variant="outline" className="capitalize text-right">
                                        {approval.metadata.deductionSource}
                                    </Badge>
                                </div>
                            )}

                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    Waktu
                                </span>
                                <span className="font-medium text-right">
                                    {new Date(approval.requestedAt).toLocaleDateString("id-ID", {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>
                            </div>

                            {approval.metadata?.purpose && (
                                <div className="mt-2 text-xs p-3 bg-white dark:bg-zinc-900 border rounded-md">
                                    <span className="font-semibold block mb-1">Keperluan:</span>
                                    <span className="text-muted-foreground">{approval.metadata.purpose}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <Separator className="border-dashed" />

                    {/* Action Area & Notes */}
                    <div className="pt-2">
                        {action === "reject" || action === "approve" ? (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <Label htmlFor="notes" className="text-xs font-semibold flex items-center justify-between">
                                    {action === "reject" ? "Alasan Penolakan *" : "Catatan Tambahan (Opsional)"}
                                    <Button variant="ghost" className="h-5 px-1 py-0 text-[10px]" onClick={() => setAction(null)}>Batal</Button>
                                </Label>
                                <Textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={action === "reject" ? "Berikan alasan yang jelas..." : "Tulis pesan ke peminjam..."}
                                    className="resize-none min-h-[80px]"
                                />
                                <Button
                                    className="w-full"
                                    variant={action === "approve" ? "default" : "destructive"}
                                    onClick={() => processApproval(action)}
                                    disabled={processing || (action === "reject" && !notes.trim())}
                                >
                                    {processing ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : action === "approve" ? (
                                        <Check className="h-4 w-4 mr-2" />
                                    ) : (
                                        <X className="h-4 w-4 mr-2" />
                                    )}
                                    {processing ? "Memproses..." : action === "approve" ? "Konfirmasi Persetujuan" : "Batal Tindakan"}
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    className="border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-900 dark:hover:bg-red-900/30"
                                    onClick={() => setAction("reject")}
                                >
                                    <X className="mr-2 h-4 w-4" /> Tolak
                                </Button>
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => processApproval("approve")}
                                >
                                    <Check className="mr-2 h-4 w-4" /> Setujui
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
