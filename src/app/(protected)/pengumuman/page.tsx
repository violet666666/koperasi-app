"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    Bell,
    Plus,
    Eye,
    Pin,
    Loader2,
    Megaphone,
    MoreHorizontal,
    Pencil,
    Trash2,
} from "lucide-react";

interface Announcement {
    id: number;
    title: string;
    content: string;
    category: string;
    isPinned: boolean;
    publishedAt: string | null;
    author: { id: number; name: string };
    views: number;
    status: "draft" | "published";
    createdAt: string;
}

export default function PengumumanPage() {
    const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [editItem, setEditItem] = React.useState<Announcement | null>(null);
    const [deleteId, setDeleteId] = React.useState<number | null>(null);

    // Form state
    const [formData, setFormData] = React.useState({
        title: "",
        content: "",
        category: "info",
        isPinned: false,
    });

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/pengumuman");
            const json = await res.json();
            if (res.ok) {
                setAnnouncements(json.data);
            }
        } catch (error) {
            console.error("Failed to fetch:", error);
            toast.error("Gagal mengambil data pengumuman");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    const resetForm = () => {
        setFormData({ title: "", content: "", category: "info", isPinned: false });
        setEditItem(null);
    };

    const openEditDialog = (item: Announcement) => {
        setEditItem(item);
        setFormData({
            title: item.title,
            content: item.content,
            category: item.category,
            isPinned: item.isPinned,
        });
        setDialogOpen(true);
    };

    // Handle submit (create or update)
    const handleSubmit = async (asStatus: "draft" | "published") => {
        if (!formData.title || !formData.content) {
            toast.error("Lengkapi judul dan isi pengumuman");
            return;
        }

        setIsSubmitting(true);
        try {
            const url = editItem ? `/api/pengumuman/${editItem.id}` : "/api/pengumuman";
            const method = editItem ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    status: asStatus,
                }),
            });

            const json = await res.json();
            if (!res.ok) {
                toast.error(json.message || "Gagal menyimpan pengumuman");
                return;
            }

            toast.success(editItem ? "Pengumuman berhasil diupdate" : "Pengumuman berhasil dibuat");
            setDialogOpen(false);
            resetForm();
            fetchData();
        } catch {
            toast.error("Gagal menyimpan pengumuman");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            const res = await fetch(`/api/pengumuman/${deleteId}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Pengumuman berhasil dihapus");
                fetchData();
            } else {
                toast.error("Gagal menghapus pengumuman");
            }
        } catch {
            toast.error("Gagal menghapus pengumuman");
        }
        setDeleteId(null);
    };

    const handleTogglePin = async (item: Announcement) => {
        try {
            const res = await fetch(`/api/pengumuman/${item.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isPinned: !item.isPinned }),
            });
            if (res.ok) {
                toast.success(item.isPinned ? "Pengumuman di-unpin" : "Pengumuman disematkan");
                fetchData();
            }
        } catch {
            toast.error("Gagal mengubah status pin");
        }
    };

    const columns: ColumnDef<Announcement>[] = [
        {
            accessorKey: "title",
            header: "Judul",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    {row.original.isPinned && (
                        <Pin className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span className="font-medium">{row.getValue("title")}</span>
                </div>
            ),
        },
        {
            accessorKey: "category",
            header: "Kategori",
            cell: ({ row }) => {
                const categoryMap: Record<string, string> = {
                    info: "Informasi",
                    event: "Kegiatan",
                    policy: "Kebijakan",
                    promo: "Promo",
                };
                return <Badge variant="outline">{categoryMap[row.getValue("category") as string] || row.getValue("category")}</Badge>;
            },
        },
        {
            accessorKey: "createdAt",
            header: "Tanggal",
            cell: ({ row }) => new Date(row.getValue("createdAt")).toLocaleDateString("id-ID"),
        },
        {
            id: "authorName",
            header: "Penulis",
            cell: ({ row }) => row.original.author?.name || "-",
        },
        {
            accessorKey: "views",
            header: "Views",
            cell: ({ row }) => (
                <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3 text-muted-foreground" />
                    {row.getValue("views")}
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                return (
                    <Badge variant={status === "published" ? "default" : "secondary"}>
                        {status === "published" ? "Terbit" : "Draft"}
                    </Badge>
                );
            },
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(row.original)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTogglePin(row.original)}>
                            <Pin className="mr-2 h-4 w-4" />
                            {row.original.isPinned ? "Unpin" : "Sematkan"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(row.original.id)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hapus
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pengumuman"
                description="Kelola pengumuman dan berita koperasi"
                actions={
                    <Dialog open={dialogOpen} onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (!open) resetForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Buat Pengumuman
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editItem ? "Edit Pengumuman" : "Buat Pengumuman Baru"}</DialogTitle>
                                <DialogDescription>
                                    {editItem ? "Ubah detail pengumuman" : "Buat pengumuman untuk anggota koperasi"}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div>
                                    <Label>Judul</Label>
                                    <Input
                                        value={formData.title}
                                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                        placeholder="Judul pengumuman"
                                    />
                                </div>
                                <div>
                                    <Label>Kategori</Label>
                                    <Select
                                        value={formData.category}
                                        onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="info">Informasi</SelectItem>
                                            <SelectItem value="event">Kegiatan</SelectItem>
                                            <SelectItem value="policy">Kebijakan</SelectItem>
                                            <SelectItem value="promo">Promo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Isi Pengumuman</Label>
                                    <Textarea
                                        value={formData.content}
                                        onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                                        placeholder="Isi pengumuman..."
                                        rows={6}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => handleSubmit("draft")} disabled={isSubmitting}>
                                    Simpan Draft
                                </Button>
                                <Button onClick={() => handleSubmit("published")} disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Terbitkan
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                }
            />

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Megaphone className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total</p>
                            <p className="text-2xl font-bold">{announcements.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <Bell className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Terbit</p>
                            <p className="text-2xl font-bold text-emerald-600">
                                {announcements.filter(a => a.status === "published").length}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                            <Pin className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Disematkan</p>
                            <p className="text-2xl font-bold text-amber-600">
                                {announcements.filter(a => a.isPinned).length}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                            <Eye className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Views</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {announcements.reduce((sum, a) => sum + a.views, 0)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            {isLoading ? (
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ) : (
                <DataTable
                    columns={columns}
                    data={announcements}
                    searchColumn="title"
                    searchPlaceholder="Cari pengumuman..."
                />
            )}

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Pengumuman?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Pengumuman yang dihapus tidak bisa dikembalikan. Apakah Anda yakin?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
