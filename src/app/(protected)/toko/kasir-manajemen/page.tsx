"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    UserCog,
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Power,
    PowerOff,
    Users,
    UserCheck,
    UserX,
} from "lucide-react";
import { useSession } from "next-auth/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CashierIdentity {
    id: number;
    username: string;
    displayName: string;
    isActive: boolean;
    parentUserId: number;
    createdAt: string;
}

interface KasirUser {
    id: number;
    name: string;
    email: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KasirManajemenPage() {
    const { data: session } = useSession();
    const unitType = (session?.user?.unitType as string) || "toko";

    // Data state
    const [identities, setIdentities] = React.useState<CashierIdentity[]>([]);
    const [kasirUsers, setKasirUsers] = React.useState<KasirUser[]>([]);
    const [loading, setLoading] = React.useState(true);

    // Add dialog
    const [addOpen, setAddOpen] = React.useState(false);
    const [addForm, setAddForm] = React.useState({
        parentUserId: "",
        username: "",
        pin: "",
        displayName: "",
    });
    const [adding, setAdding] = React.useState(false);

    // Edit dialog
    const [editOpen, setEditOpen] = React.useState(false);
    const [editTarget, setEditTarget] = React.useState<CashierIdentity | null>(null);
    const [editForm, setEditForm] = React.useState({
        displayName: "",
        pin: "",
    });
    const [editing, setEditing] = React.useState(false);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = React.useState<CashierIdentity | null>(null);
    const [deleting, setDeleting] = React.useState(false);

    // Toggle active
    const [togglingId, setTogglingId] = React.useState<number | null>(null);

    // -------------------------------------------------------------------------
    // Fetch data
    // -------------------------------------------------------------------------

    const fetchIdentities = React.useCallback(async () => {
        try {
            const res = await fetch("/api/toko/cashier-identities");
            if (!res.ok) throw new Error();
            const json = await res.json();
            setIdentities(json.data || []);
        } catch {
            toast.error("Gagal memuat data identitas kasir");
        }
    }, []);

    const fetchKasirUsers = React.useCallback(async () => {
        try {
            // Fetch users with role=kasir filtered by same unitType
            const res = await fetch(
                `/api/users?perPage=100&search=kasir`
            );
            if (!res.ok) throw new Error();
            const json = await res.json();
            // Filter to only kasir-role users that belong to the same unit
            const users: KasirUser[] = (json.data || [])
                .filter(
                    (u: Record<string, unknown>) =>
                        (u.role as Record<string, unknown>)?.name === "kasir" &&
                        (u.unitType === unitType || u.unitType === undefined)
                )
                .map((u: Record<string, unknown>) => ({
                    id: u.id as number,
                    name: (u.name as string) || "",
                    email: (u.email as string) || "",
                }));
            setKasirUsers(users);
        } catch {
            // Non-critical — the dropdown just won't have options
            console.error("Failed to fetch kasir users for dropdown");
        }
    }, [unitType]);

    React.useEffect(() => {
        async function load() {
            setLoading(true);
            await Promise.all([fetchIdentities(), fetchKasirUsers()]);
            setLoading(false);
        }
        load();
    }, [fetchIdentities, fetchKasirUsers]);

    // -------------------------------------------------------------------------
    // Add handler
    // -------------------------------------------------------------------------

    const handleAdd = async () => {
        if (!addForm.parentUserId) {
            toast.error("Pilih akun kasir induk terlebih dahulu");
            return;
        }
        if (!addForm.username || !/^[a-zA-Z0-9_]{3,20}$/.test(addForm.username)) {
            toast.error("Username harus 3-20 karakter alfanumerik");
            return;
        }
        if (!addForm.pin || !/^\d{4,6}$/.test(addForm.pin)) {
            toast.error("PIN harus 4-6 digit angka");
            return;
        }
        if (!addForm.displayName.trim()) {
            toast.error("Nama tampilan wajib diisi");
            return;
        }

        setAdding(true);
        try {
            const res = await fetch("/api/toko/cashier-identities", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    parentUserId: parseInt(addForm.parentUserId),
                    username: addForm.username,
                    pin: addForm.pin,
                    displayName: addForm.displayName.trim(),
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal menambahkan kasir");

            toast.success(`Kasir "${addForm.displayName}" berhasil ditambahkan`);
            setAddOpen(false);
            setAddForm({ parentUserId: "", username: "", pin: "", displayName: "" });
            await fetchIdentities();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Gagal menambahkan kasir";
            toast.error(message);
        } finally {
            setAdding(false);
        }
    };

    // -------------------------------------------------------------------------
    // Edit handler
    // -------------------------------------------------------------------------

    const openEdit = (identity: CashierIdentity) => {
        setEditTarget(identity);
        setEditForm({ displayName: identity.displayName, pin: "" });
        setEditOpen(true);
    };

    const handleEdit = async () => {
        if (!editTarget) return;
        if (!editForm.displayName.trim()) {
            toast.error("Nama tampilan wajib diisi");
            return;
        }
        if (editForm.pin && !/^\d{4,6}$/.test(editForm.pin)) {
            toast.error("PIN baru harus 4-6 digit angka");
            return;
        }

        setEditing(true);
        try {
            const body: Record<string, string> = {
                displayName: editForm.displayName.trim(),
            };
            if (editForm.pin) {
                body.pin = editForm.pin;
            }

            const res = await fetch(`/api/toko/cashier-identities/${editTarget.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal memperbarui kasir");

            toast.success(`Kasir "${editForm.displayName}" berhasil diperbarui`);
            setEditOpen(false);
            setEditTarget(null);
            await fetchIdentities();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Gagal memperbarui kasir";
            toast.error(message);
        } finally {
            setEditing(false);
        }
    };

    // -------------------------------------------------------------------------
    // Toggle active handler
    // -------------------------------------------------------------------------

    const handleToggle = async (identity: CashierIdentity) => {
        setTogglingId(identity.id);
        try {
            const res = await fetch(`/api/toko/cashier-identities/${identity.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !identity.isActive }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal mengubah status");

            toast.success(
                identity.isActive
                    ? `Kasir "${identity.displayName}" dinonaktifkan`
                    : `Kasir "${identity.displayName}" diaktifkan kembali`
            );
            await fetchIdentities();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Gagal mengubah status";
            toast.error(message);
        } finally {
            setTogglingId(null);
        }
    };

    // -------------------------------------------------------------------------
    // Delete handler
    // -------------------------------------------------------------------------

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/toko/cashier-identities/${deleteTarget.id}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Gagal menghapus kasir");

            toast.success(json.message || "Kasir berhasil dihapus");
            setDeleteTarget(null);
            await fetchIdentities();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Gagal menghapus kasir";
            toast.error(message);
        } finally {
            setDeleting(false);
        }
    };

    // -------------------------------------------------------------------------
    // Stats
    // -------------------------------------------------------------------------

    const stats = React.useMemo(() => {
        const active = identities.filter((i) => i.isActive).length;
        const inactive = identities.filter((i) => !i.isActive).length;
        return { total: identities.length, active, inactive };
    }, [identities]);

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    if (loading) {
        return (
            <div className="space-y-6">
                <PageHeader title="Manajemen Kasir" description="Kelola identitas sub-akun kasir" />
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <Skeleton className="h-16 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Manajemen Kasir"
                description="Kelola identitas sub-akun kasir untuk setiap perangkat"
                backHref="/toko"
                actions={
                    <Button onClick={() => setAddOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Tambah Kasir
                    </Button>
                }
            />

            {/* ── Stats Cards ─────────────────────────────────────────── */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Kasir</p>
                            <p className="text-2xl font-bold">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <UserCheck className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Aktif</p>
                            <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                            <UserX className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Nonaktif</p>
                            <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Table ───────────────────────────────────────────────── */}
            {identities.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 px-6 py-12 text-center">
                    <UserCog className="mx-auto h-10 w-10 text-primary/40 mb-3" />
                    <h3 className="text-lg font-semibold mb-1">Belum Ada Kasir</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Tambahkan identitas kasir pertama untuk mulai mengelola sub-akun kasir.
                    </p>
                    <Button onClick={() => setAddOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Tambah Kasir Pertama
                    </Button>
                </div>
            ) : (
                <Card>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Username</TableHead>
                                    <TableHead>Nama Tampilan</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Dibuat</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {identities.map((identity) => (
                                    <TableRow
                                        key={identity.id}
                                        className={!identity.isActive ? "opacity-50" : ""}
                                    >
                                        <TableCell>
                                            <span className="font-mono text-sm">
                                                {identity.username}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {identity.displayName}
                                        </TableCell>
                                        <TableCell>
                                            {identity.isActive ? (
                                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                    Aktif
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                    Nonaktif
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(identity.createdAt).toLocaleDateString("id-ID", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 px-2"
                                                    onClick={() => openEdit(identity)}
                                                    title="Edit kasir"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={`h-8 px-2 ${
                                                        identity.isActive
                                                            ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                            : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                    }`}
                                                    onClick={() => handleToggle(identity)}
                                                    disabled={togglingId === identity.id}
                                                    title={
                                                        identity.isActive
                                                            ? "Nonaktifkan kasir"
                                                            : "Aktifkan kasir"
                                                    }
                                                >
                                                    {togglingId === identity.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : identity.isActive ? (
                                                        <PowerOff className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Power className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => setDeleteTarget(identity)}
                                                    title="Hapus kasir"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {/* ── Add Dialog ──────────────────────────────────────────── */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserCog className="h-5 w-5" />
                            Tambah Kasir Baru
                        </DialogTitle>
                        <DialogDescription>
                            Buat identitas sub-akun kasir baru. Kasir akan menggunakan username dan PIN
                            ini untuk login di perangkat.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label htmlFor="parentUser">Akun Kasir Induk *</Label>
                            <Select
                                value={addForm.parentUserId}
                                onValueChange={(v) =>
                                    setAddForm((prev) => ({ ...prev, parentUserId: v }))
                                }
                            >
                                <SelectTrigger id="parentUser" className="mt-1.5">
                                    <SelectValue placeholder="Pilih akun kasir induk..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {kasirUsers.length === 0 ? (
                                        <SelectItem value="_none" disabled>
                                            Tidak ada akun kasir ditemukan
                                        </SelectItem>
                                    ) : (
                                        kasirUsers.map((u) => (
                                            <SelectItem key={u.id} value={String(u.id)}>
                                                {u.name} ({u.email})
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                Akun user dengan role kasir yang menjadi induk dari identitas ini
                            </p>
                        </div>
                        <div>
                            <Label htmlFor="addUsername">Username *</Label>
                            <Input
                                id="addUsername"
                                placeholder="Contoh: kasir1"
                                value={addForm.username}
                                onChange={(e) =>
                                    setAddForm((prev) => ({
                                        ...prev,
                                        username: e.target.value,
                                    }))
                                }
                                className="mt-1.5"
                                maxLength={20}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                3-20 karakter, alfanumerik atau underscore
                            </p>
                        </div>
                        <div>
                            <Label htmlFor="addPin">PIN *</Label>
                            <Input
                                id="addPin"
                                type="password"
                                inputMode="numeric"
                                placeholder="4-6 digit"
                                value={addForm.pin}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                                    setAddForm((prev) => ({ ...prev, pin: val }));
                                }}
                                className="mt-1.5"
                                maxLength={6}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                PIN 4-6 digit angka untuk login kasir
                            </p>
                        </div>
                        <div>
                            <Label htmlFor="addDisplayName">Nama Tampilan *</Label>
                            <Input
                                id="addDisplayName"
                                placeholder="Contoh: Siti Kasir Pagi"
                                value={addForm.displayName}
                                onChange={(e) =>
                                    setAddForm((prev) => ({
                                        ...prev,
                                        displayName: e.target.value,
                                    }))
                                }
                                className="mt-1.5"
                                maxLength={50}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>
                            Batal
                        </Button>
                        <Button onClick={handleAdd} disabled={adding} className="gap-2">
                            {adding ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                            Tambah
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Edit Dialog ─────────────────────────────────────────── */}
            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditOpen(false);
                        setEditTarget(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-5 w-5" />
                            Edit Kasir — {editTarget?.username}
                        </DialogTitle>
                        <DialogDescription>
                            Ubah nama tampilan atau ganti PIN kasir. Kosongkan PIN jika tidak ingin
                            mengubahnya.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label htmlFor="editDisplayName">Nama Tampilan *</Label>
                            <Input
                                id="editDisplayName"
                                value={editForm.displayName}
                                onChange={(e) =>
                                    setEditForm((prev) => ({
                                        ...prev,
                                        displayName: e.target.value,
                                    }))
                                }
                                className="mt-1.5"
                                maxLength={50}
                            />
                        </div>
                        <div>
                            <Label htmlFor="editPin">PIN Baru (opsional)</Label>
                            <Input
                                id="editPin"
                                type="password"
                                inputMode="numeric"
                                placeholder="Kosongkan jika tidak diubah"
                                value={editForm.pin}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                                    setEditForm((prev) => ({ ...prev, pin: val }));
                                }}
                                className="mt-1.5"
                                maxLength={6}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Isi hanya jika ingin mengganti PIN. 4-6 digit angka.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setEditOpen(false);
                                setEditTarget(null);
                            }}
                            disabled={editing}
                        >
                            Batal
                        </Button>
                        <Button onClick={handleEdit} disabled={editing} className="gap-2">
                            {editing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Pencil className="h-4 w-4" />
                            )}
                            Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirmation ─────────────────────────────────── */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Kasir?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Anda akan menghapus kasir{" "}
                            <strong>{deleteTarget?.displayName}</strong> (@
                            {deleteTarget?.username}). Kasir akan dinonaktifkan (soft delete) dan tidak
                            dapat login lagi. Data transaksi yang sudah ada tidak akan terpengaruh.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
                        >
                            {deleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
