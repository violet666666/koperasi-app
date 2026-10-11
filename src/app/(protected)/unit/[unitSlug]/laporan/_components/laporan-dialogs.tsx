"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    TrendingUp,
    TrendingDown,
    PlusCircle,
    Loader2,
    AlertCircle,
    ImagePlus,
    X,
    User,
    Search,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { METHOD_LABEL, OPS_PAYMENT_METHODS, OPS_EXPENSE_CATEGORY_OPTIONS } from "../_constants";
import type { LaporanTransaction, OperationalExpense } from "../_types";


// Dipindah VERBATIM dari page.tsx (2026-10-11). Props memakai nama identifier asli
// agar JSX tidak berubah satu karakter pun.

export function ExpenseDialog({ showExpenseDialog, setShowExpenseDialog, clearExpenseFile, editExpenseId,
    expenseAmount, setExpenseAmount, expenseDesc, setExpenseDesc, expenseDate, setExpenseDate,
    expensePaymentMethod, setExpensePaymentMethod, expenseCategory, setExpenseCategory,
    expenseFileInputRef, handleExpenseFileChange, expenseReceiptPreview, expenseReceiptFile,
    unitInfo, handleSaveExpense, isSavingExpense,
}: {
    showExpenseDialog: boolean; setShowExpenseDialog: (v: boolean) => void; clearExpenseFile: () => void;
    editExpenseId: number | null; expenseAmount: string; setExpenseAmount: (v: string) => void;
    expenseDesc: string; setExpenseDesc: (v: string) => void; expenseDate: string; setExpenseDate: (v: string) => void;
    expensePaymentMethod: string; setExpensePaymentMethod: (v: string) => void;
    expenseCategory: string; setExpenseCategory: (v: string) => void;
    expenseFileInputRef: React.RefObject<HTMLInputElement | null>;
    handleExpenseFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    expenseReceiptPreview: string | null; expenseReceiptFile: File | null;
    unitInfo: { label: string }; handleSaveExpense: () => void; isSavingExpense: boolean;
}) {
    return (
        <>
            {/* ── Dialog Catat Pengeluaran ──────────────────────────────────── */}
            <Dialog open={showExpenseDialog} onOpenChange={(open) => { setShowExpenseDialog(open); if (!open) clearExpenseFile(); }}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-red-500" />
                            {editExpenseId ? "Ubah Pengeluaran Operasional" : "Catat Pengeluaran Operasional"}
                        </DialogTitle>
                        <DialogDescription>
                            Catat pengeluaran unit seperti belanja sabun, peralatan, bahan baku, dll.
                            Akan langsung mendebit kas unit ini.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="exp-amount">Nominal Pengeluaran (Rp) *</Label>
                            <Input
                                id="exp-amount"
                                type="number"
                                placeholder="0"
                                className="text-right text-lg font-bold"
                                value={expenseAmount}
                                onChange={(e) => setExpenseAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="exp-desc">Keterangan Pengeluaran *</Label>
                            <Textarea
                                id="exp-desc"
                                placeholder="Misal: Beli sabun cuci, kain lap, sikat ban, dll."
                                className="resize-none"
                                rows={3}
                                value={expenseDesc}
                                onChange={(e) => setExpenseDesc(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="exp-date">Tanggal Pengeluaran</Label>
                            <Input
                                id="exp-date"
                                type="date"
                                value={expenseDate}
                                onChange={(e) => setExpenseDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Metode Pembayaran</Label>
                            <Select value={expensePaymentMethod} onValueChange={setExpensePaymentMethod}>
                                <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                                <SelectContent>
                                    {OPS_PAYMENT_METHODS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Jenis Pengeluaran</Label>
                            <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                                <SelectTrigger><SelectValue placeholder="Pilih jenis" /></SelectTrigger>
                                <SelectContent>
                                    {OPS_EXPENSE_CATEGORY_OPTIONS.map(c => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground">
                                Belanja barang dagangan/bahan → "Belanja Barang" (dihitung via HPP, bukan beban dobel). Peralatan &amp; renovasi → "Belanja Aset".
                            </p>
                        </div>

                        {/* Upload Foto Bukti */}
                        <div className="space-y-2">
                            <Label>Foto Bukti / Struk (Opsional, maks. 2MB, JPG/PNG/WebP)</Label>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                ref={expenseFileInputRef}
                                onChange={handleExpenseFileChange}
                            />
                            {expenseReceiptPreview ? (
                                <div className="relative rounded-lg border border-dashed border-red-200 overflow-hidden">
                                    <img
                                        src={expenseReceiptPreview}
                                        alt="Preview bukti"
                                        className="w-full h-36 object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={clearExpenseFile}
                                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                                        {expenseReceiptFile?.name}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => expenseFileInputRef.current?.click()}
                                    className="w-full h-24 border-2 border-dashed border-red-200 rounded-lg flex flex-col items-center justify-center gap-1 text-red-400 hover:border-red-400 hover:text-red-600 hover:bg-red-50/50 transition-colors"
                                >
                                    <ImagePlus className="h-6 w-6" />
                                    <span className="text-xs">Klik untuk unggah foto struk / nota</span>
                                </button>
                            )}
                        </div>

                        <Separator />
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                            ⚠️ Pengeluaran ini akan langsung mendebit akun Kas Unit <strong>{unitInfo.label}</strong> tanpa memerlukan persetujuan tambahan.
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowExpenseDialog(false); clearExpenseFile(); }}>Batal</Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={handleSaveExpense}
                            disabled={isSavingExpense || !expenseAmount || !expenseDesc}
                        >
                            {isSavingExpense ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            {editExpenseId ? "Simpan Perubahan" : "Simpan Pengeluaran"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function IncomeDialog({ showIncomeDialog, setShowIncomeDialog, clearIncomeFile, editIncomeId,
    incomeJenis, setIncomeJenis, incomeMemberQuery, setIncomeMemberQuery, searchIncomeMember,
    isSearchingIncomeMember, incomeMemberResults, incomeMemberPicked, setIncomeMemberPicked,
    setIncomeMemberId, setIncomeMemberResults, incomeAmount, setIncomeAmount, incomeDesc, setIncomeDesc,
    incomeDate, setIncomeDate, incomePaymentMethod, setIncomePaymentMethod, incomeFileInputRef,
    handleIncomeFileChange, incomeReceiptPreview, incomeReceiptFile, unitInfo, handleSaveIncome, isSavingIncome,
}: {
    showIncomeDialog: boolean; setShowIncomeDialog: (v: boolean) => void; clearIncomeFile: () => void;
    editIncomeId: number | null;
    incomeJenis: "operasional" | "customer"; setIncomeJenis: (v: "operasional" | "customer") => void;
    incomeMemberQuery: string; setIncomeMemberQuery: (v: string) => void; searchIncomeMember: () => void;
    isSearchingIncomeMember: boolean; incomeMemberResults: any[]; incomeMemberPicked: any | null;
    setIncomeMemberPicked: (v: any | null) => void; setIncomeMemberId: (v: number | null) => void;
    setIncomeMemberResults: (v: any[]) => void;
    incomeAmount: string; setIncomeAmount: (v: string) => void; incomeDesc: string; setIncomeDesc: (v: string) => void;
    incomeDate: string; setIncomeDate: (v: string) => void;
    incomePaymentMethod: string; setIncomePaymentMethod: (v: string) => void;
    incomeFileInputRef: React.RefObject<HTMLInputElement | null>;
    handleIncomeFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    incomeReceiptPreview: string | null; incomeReceiptFile: File | null;
    unitInfo: { label: string }; handleSaveIncome: () => void; isSavingIncome: boolean;
}) {
    return (
        <>
            {/* ── Dialog Catat Pemasukan ────────────────────────────────────── */}
            <Dialog open={showIncomeDialog} onOpenChange={(open) => { setShowIncomeDialog(open); if (!open) clearIncomeFile(); }}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                            {editIncomeId
                                ? "Ubah Pemasukan Operasional"
                                : incomeJenis === "customer"
                                    ? "Catat Transaksi Customer"
                                    : "Catat Pemasukan Operasional"}
                        </DialogTitle>
                        <DialogDescription>
                            {editIncomeId
                                ? "Edit data pemasukan operasional unit ini."
                                : incomeJenis === "customer"
                                    ? "Catat penjualan ke customer sebagai UnitTransaction — masuk riwayat transaksi, SHU per-unit, dan poin jasa anggota (jika anggota dipilih)."
                                    : "Catat pemasukan unit di luar transaksi POS kasir, misalnya pemasukan dari transaksi lama, sewa lahan, donasi, dll. Akan langsung mengkredit kas unit ini."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Jenis Pemasukan — disabled in edit mode (edit is operasional-only) */}
                        <div className="space-y-2">
                            <Label>Jenis Pemasukan</Label>
                            <Select
                                value={incomeJenis}
                                onValueChange={(v) => setIncomeJenis(v as "operasional" | "customer")}
                                disabled={editIncomeId !== null}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="operasional">Pemasukan Operasional (sewa/dll)</SelectItem>
                                    <SelectItem value="customer">Transaksi Customer (penjualan)</SelectItem>
                                </SelectContent>
                            </Select>
                            {incomeJenis === "customer" && (
                                <p className="text-xs text-muted-foreground">
                                    Dicut sebagai UnitTransaction → masuk riwayat transaksi + SHU per-unit + poin jasa anggota.
                                </p>
                            )}
                        </div>

                        {/* Anggota (opsional, hanya saat Transaksi Customer) — pola member-picker reuse dari kasir/page.tsx */}
                        {incomeJenis === "customer" && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5" />
                                    Anggota (opsional — kosongkan jika walk-in)
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Cari NRP atau Nama anggota..."
                                        value={incomeMemberQuery}
                                        onChange={(e) => setIncomeMemberQuery(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchIncomeMember(); } }}
                                    />
                                    <Button type="button" variant="outline" onClick={searchIncomeMember} disabled={isSearchingIncomeMember}>
                                        {isSearchingIncomeMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    </Button>
                                </div>
                                {incomeMemberResults.length > 0 && (
                                    <div className="max-h-[180px] overflow-y-auto border rounded-md">
                                        {incomeMemberResults.map((m) => (
                                            <div
                                                key={m.id}
                                                className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-muted/50 ${incomeMemberPicked?.id === m.id ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                                                onClick={() => {
                                                    setIncomeMemberPicked(m);
                                                    setIncomeMemberId(m.id);
                                                    setIncomeMemberQuery("");
                                                    setIncomeMemberResults([]);
                                                }}
                                            >
                                                <div>
                                                    <p className="font-medium text-sm">{m.name}</p>
                                                    <p className="text-xs text-muted-foreground">{m.memberNo} {m.nrp ? `· NRP: ${m.nrp}` : ""}</p>
                                                </div>
                                                {incomeMemberPicked?.id === m.id && <Badge>Dipilih</Badge>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {incomeMemberPicked && (
                                    <div className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/30">
                                        <div>
                                            <p className="font-medium text-sm">{incomeMemberPicked.name}</p>
                                            <p className="text-xs text-muted-foreground">NRP: {incomeMemberPicked.nrp || "-"}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setIncomeMemberPicked(null); setIncomeMemberId(null); }}
                                            className="text-muted-foreground hover:text-red-600"
                                            aria-label="Hapus pilihan anggota"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="inc-amount">Nominal Pemasukan (Rp) *</Label>
                            <Input
                                id="inc-amount"
                                type="number"
                                placeholder="0"
                                className="text-right text-lg font-bold"
                                value={incomeAmount}
                                onChange={(e) => setIncomeAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="inc-desc">Keterangan Pemasukan *</Label>
                            <Textarea
                                id="inc-desc"
                                placeholder="Misal: Pemasukan sewa tempat, transaksi lama belum tercatat, dll."
                                className="resize-none"
                                rows={3}
                                value={incomeDesc}
                                onChange={(e) => setIncomeDesc(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="inc-date">Tanggal Pemasukan</Label>
                            <Input
                                id="inc-date"
                                type="date"
                                value={incomeDate}
                                onChange={(e) => setIncomeDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Metode Pembayaran</Label>
                            <Select value={incomePaymentMethod} onValueChange={setIncomePaymentMethod}>
                                <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                                <SelectContent>
                                    {OPS_PAYMENT_METHODS.map(m => (
                                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Upload Foto Bukti */}
                        <div className="space-y-2">
                            <Label>Foto Bukti (Opsional, maks. 2MB, JPG/PNG/WebP)</Label>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                ref={incomeFileInputRef}
                                onChange={handleIncomeFileChange}
                            />
                            {incomeReceiptPreview ? (
                                <div className="relative rounded-lg border border-dashed border-emerald-200 overflow-hidden">
                                    <img
                                        src={incomeReceiptPreview}
                                        alt="Preview bukti"
                                        className="w-full h-36 object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={clearIncomeFile}
                                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                                        {incomeReceiptFile?.name}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => incomeFileInputRef.current?.click()}
                                    className="w-full h-24 border-2 border-dashed border-emerald-200 rounded-lg flex flex-col items-center justify-center gap-1 text-emerald-400 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition-colors"
                                >
                                    <ImagePlus className="h-6 w-6" />
                                    <span className="text-xs">Klik untuk unggah foto bukti pemasukan</span>
                                </button>
                            )}
                        </div>

                        <Separator />
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                            {incomeJenis === "customer" ? (
                                <>🧾 Transaksi customer akan dicatat sebagai <strong>UnitTransaction</strong> dan masuk riwayat transaksi unit <strong>{unitInfo.label}</strong>{incomeMemberPicked ? " serta poin jasa anggota" : ""}.</>
                            ) : (
                                <>💰 Pemasukan ini akan langsung mengkredit akun Kas Unit <strong>{unitInfo.label}</strong> tanpa memerlukan persetujuan tambahan.</>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowIncomeDialog(false); clearIncomeFile(); }}>Batal</Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleSaveIncome}
                            disabled={isSavingIncome || !incomeAmount || !incomeDesc}
                        >
                            {isSavingIncome ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                            {editIncomeId ? "Simpan Perubahan" : "Simpan Pemasukan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function DeleteConfirmDialog({ deleteTarget, setDeleteTarget, deleteReason, setDeleteReason,
    isDeleting, confirmDelete,
}: {
    deleteTarget: { id: number; type: "expense" | "income" } | null;
    setDeleteTarget: (v: { id: number; type: "expense" | "income" } | null) => void;
    deleteReason: string; setDeleteReason: (v: string) => void;
    isDeleting: boolean; confirmDelete: () => void;
}) {
    return (
        <>
            {/* ── Dialog Konfirmasi Hapus ────────────────────────────────── */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="h-5 w-5" />
                            Konfirmasi Hapus
                        </DialogTitle>
                        <DialogDescription>
                            {deleteTarget?.type === "income"
                                ? "Pemasukan ini akan dihapus permanen beserta bukti fotonya. Saldo kas akan otomatis terkalkulasi ulang."
                                : "Pengeluaran ini akan dihapus permanen beserta bukti fotonya. Saldo kas akan otomatis terkalkulasi ulang."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                            Tindakan ini tidak dapat dibatalkan. Data yang dihapus akan dicatat di log audit.
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="delete-reason">Alasan Penghapusan *</Label>
                            <Textarea
                                id="delete-reason"
                                placeholder="Wajib isi alasan penghapusan..."
                                className="resize-none"
                                rows={2}
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Batal</Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={confirmDelete}
                            disabled={isDeleting || !deleteReason.trim()}
                        >
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Ya, Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function TransactionDetailDialog({ selectedTx, setSelectedTx }:
    { selectedTx: LaporanTransaction | null; setSelectedTx: (v: LaporanTransaction | null) => void }
) {
    return (
        <>
            {/* Transaction Detail Modal */}
            <Dialog open={!!selectedTx} onOpenChange={(open) => { if (!open) setSelectedTx(null); }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-base">Detail Transaksi</DialogTitle>
                    </DialogHeader>
                    {selectedTx && (
                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-muted-foreground text-xs">No. Transaksi</p>
                                    <p className="font-mono font-medium">{selectedTx.no}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Tanggal</p>
                                    <p>{new Date(selectedTx.date).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Tipe</p>
                                    <Badge variant="outline">{selectedTx.type === "store_sale" ? "Penjualan Toko" : "Transaksi Unit"}</Badge>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Metode Bayar</p>
                                    <Badge variant="outline" className={
                                        selectedTx.paymentMethod === "cash" ? "border-emerald-300 text-emerald-700" :
                                        selectedTx.paymentMethod === "qris" ? "border-blue-300 text-blue-700" :
                                        "border-indigo-300 text-indigo-700"
                                    }>
                                        {METHOD_LABEL[selectedTx.paymentMethod] || selectedTx.paymentMethod}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Pelanggan</p>
                                    <p className="font-medium">{selectedTx.memberName || "Walk-In"}</p>
                                    {selectedTx.memberNrp && <p className="text-xs text-muted-foreground">NRP: {selectedTx.memberNrp}</p>}
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Status</p>
                                    <Badge variant={selectedTx.status === "completed" ? "default" : "destructive"}>
                                        {selectedTx.status === "completed" ? "Selesai" : selectedTx.status === "voided" ? "Dibatalkan" : selectedTx.status}
                                    </Badge>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-muted-foreground text-xs mb-1">Deskripsi</p>
                                <p className="whitespace-pre-wrap break-words">{selectedTx.description}</p>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground font-medium">Total</span>
                                <span className="text-xl font-bold">{formatCurrency(selectedTx.amount)}</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
