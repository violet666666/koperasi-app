"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
    Users,
    GitMerge,
    Trash2,
    AlertTriangle,
    CheckCircle,
    Loader2,
    RefreshCw,
} from "lucide-react";
import { membersApi } from "@/lib/api/services";

interface DuplicateMember {
    id: number;
    nrp: string | null;
    name: string;
    memberNo: string;
    status: string;
    hasLoans: boolean;
    hasSavings: boolean;
    hasTransactions: boolean;
    createdAt: string;
}

interface DuplicateGroup {
    key: string;
    type: "nrp" | "name";
    members: DuplicateMember[];
}

export default function KelolaAnggotaPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(true);
    const [groups, setGroups] = React.useState<DuplicateGroup[]>([]);
    const [mergeTarget, setMergeTarget] = React.useState<{ source: DuplicateMember; target: DuplicateMember } | null>(null);
    const [isMerging, setIsMerging] = React.useState(false);
    const [deleteTarget, setDeleteTarget] = React.useState<DuplicateMember | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    const fetchDuplicates = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/members/duplicates");
            const data = await res.json();
            if (res.ok) {
                setGroups(data.groups || []);
            } else {
                toast.error(data.message || "Gagal memuat data duplikasi");
            }
        } catch {
            toast.error("Gagal memuat data duplikasi");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchDuplicates();
    }, [fetchDuplicates]);

    const handleMerge = async () => {
        if (!mergeTarget) return;
        setIsMerging(true);
        try {
            const res = await fetch("/api/members/merge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceId: mergeTarget.source.id,
                    targetId: mergeTarget.target.id,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                setMergeTarget(null);
                fetchDuplicates();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error("Gagal merge member");
        } finally {
            setIsMerging(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await membersApi.delete(deleteTarget.id);
            toast.success("Anggota berhasil dihapus");
            setDeleteTarget(null);
            fetchDuplicates();
        } catch (error: any) {
            const msg = error?.response?.data?.message || "Gagal menghapus anggota";
            toast.error(msg);
        } finally {
            setIsDeleting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Kelola Anggota"
                description="Deteksi duplikasi, merge, dan hapus anggota"
                backHref="/anggota"
                actions={
                    <Button variant="outline" onClick={fetchDuplicates} disabled={isLoading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                }
            />

            {groups.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <CheckCircle className="mx-auto h-12 w-12 text-emerald-500 mb-3" />
                        <p className="text-lg font-medium">Tidak Ada Duplikasi</p>
                        <p className="text-muted-foreground">Semua data anggota sudah bersih, tidak ditemukan duplikasi.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Ditemukan <strong>{groups.length}</strong> grup duplikasi
                    </div>

                    {groups.map((group, gi) => (
                        <Card key={gi} className="border-amber-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    {group.type === "nrp" ? "NRP Sama" : "Nama Mirip"}:
                                    <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{group.key}</code>
                                    <Badge variant="secondary" className="ml-auto">
                                        {group.members.length} anggota
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>ID</TableHead>
                                                <TableHead>NRP</TableHead>
                                                <TableHead>Nama</TableHead>
                                                <TableHead>No. Anggota</TableHead>
                                                <TableHead className="text-center">Pinjaman</TableHead>
                                                <TableHead className="text-center">Simpanan</TableHead>
                                                <TableHead className="text-center">Transaksi</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {group.members.map((m) => (
                                                <TableRow key={m.id}>
                                                    <TableCell className="font-mono text-xs">{m.id}</TableCell>
                                                    <TableCell className="font-mono">{m.nrp || "-"}</TableCell>
                                                    <TableCell className="font-medium">{m.name}</TableCell>
                                                    <TableCell className="text-xs">{m.memberNo}</TableCell>
                                                    <TableCell className="text-center">
                                                        {m.hasLoans ? <Badge variant="default" className="text-xs">Ada</Badge> : <Badge variant="outline" className="text-xs">-</Badge>}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {m.hasSavings ? <Badge variant="default" className="text-xs">Ada</Badge> : <Badge variant="outline" className="text-xs">-</Badge>}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {m.hasTransactions ? <Badge variant="default" className="text-xs">Ada</Badge> : <Badge variant="outline" className="text-xs">-</Badge>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={m.status === "active" ? "default" : "secondary"} className="text-xs">
                                                            {m.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            {group.members.length > 1 && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 text-xs"
                                                                    onClick={() => setMergeTarget({ source: m, target: group.members.find((x) => x.id !== m.id)! })}
                                                                >
                                                                    <GitMerge className="mr-1 h-3 w-3" />
                                                                    Merge
                                                                </Button>
                                                            )}
                                                            {!m.hasLoans && !m.hasSavings && !m.hasTransactions && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    className="h-7 text-xs"
                                                                    onClick={() => setDeleteTarget(m)}
                                                                >
                                                                    <Trash2 className="mr-1 h-3 w-3" />
                                                                    Hapus
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Merge Confirmation Dialog */}
            <AlertDialog open={!!mergeTarget} onOpenChange={(open) => !open && setMergeTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <GitMerge className="h-5 w-5" />
                            Konfirmasi Merge Anggota
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>
                                    Semua data dari <strong>{mergeTarget?.source.name} (#{mergeTarget?.source.id})</strong> akan dipindahkan ke{" "}
                                    <strong>{mergeTarget?.target.name} (#{mergeTarget?.target.id})</strong>.
                                </p>
                                <p className="text-sm">Yang akan terjadi:</p>
                                <ul className="text-sm list-disc list-inside space-y-1">
                                    <li>Semua pinjaman, simpanan, dan transaksi dipindahkan ke target</li>
                                    <li>Member source akan dihapus (soft delete)</li>
                                    <li>Akun login member source akan dinonaktifkan</li>
                                    <li>Tindakan ini tidak dapat dibatalkan</li>
                                </ul>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleMerge}
                            disabled={isMerging}
                            className="bg-amber-600 text-white hover:bg-amber-700"
                        >
                            {isMerging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Ya, Merge
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-5 w-5" />
                            Hapus Anggota
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Yakin ingin menghapus <strong>{deleteTarget?.name} (#{deleteTarget?.id})</strong>?
                            Anggota ini tidak memiliki data transaksi. Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Ya, Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
