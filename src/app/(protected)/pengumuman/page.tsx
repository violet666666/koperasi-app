"use client";

import * as React from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
    Calendar,
    User,
    Eye,
    Pin,
    Loader2,
    Megaphone,
} from "lucide-react";

interface Announcement {
    id: number;
    title: string;
    content: string;
    category: string;
    isPinned: boolean;
    publishedAt: string;
    author: string;
    views: number;
    status: "draft" | "published";
}

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
        accessorKey: "publishedAt",
        header: "Tanggal",
        cell: ({ row }) => new Date(row.getValue("publishedAt")).toLocaleDateString("id-ID"),
    },
    {
        accessorKey: "author",
        header: "Penulis",
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
];

export default function PengumumanPage() {
    const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Form state
    const [formData, setFormData] = React.useState({
        title: "",
        content: "",
        category: "info",
        isPinned: false,
    });

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data
                setAnnouncements([
                    { id: 1, title: "Jadwal RAT Tahun 2026", content: "RAT Tahun 2025 akan dilaksanakan pada tanggal 15 Februari 2026...", category: "event", isPinned: true, publishedAt: "2026-01-20", author: "Pengurus", views: 245, status: "published" },
                    { id: 2, title: "Promo Pinjaman Awal Tahun", content: "Dapatkan bunga spesial untuk pengajuan pinjaman bulan Januari-Februari...", category: "promo", isPinned: true, publishedAt: "2026-01-15", author: "Admin", views: 189, status: "published" },
                    { id: 3, title: "Perubahan Jam Operasional", content: "Mulai 1 Februari 2026, jam operasional kantor berubah menjadi...", category: "info", isPinned: false, publishedAt: "2026-01-10", author: "Admin", views: 156, status: "published" },
                    { id: 4, title: "Pembagian SHU Tahun 2025", content: "Pembagian SHU tahun buku 2025 akan dilaksanakan setelah RAT...", category: "policy", isPinned: false, publishedAt: "2026-01-08", author: "Pengurus", views: 312, status: "published" },
                    { id: 5, title: "Libur Hari Raya Imlek", content: "Kantor tutup pada tanggal...", category: "info", isPinned: false, publishedAt: "2026-01-05", author: "Admin", views: 98, status: "published" },
                    { id: 6, title: "Draft: Produk Baru Simpanan", content: "Produk simpanan berjangka dengan bunga...", category: "promo", isPinned: false, publishedAt: "2026-01-25", author: "Admin", views: 0, status: "draft" },
                ]);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Handle submit
    const handleSubmit = async () => {
        if (!formData.title || !formData.content) {
            toast.error("Lengkapi judul dan isi pengumuman");
            return;
        }

        setIsSubmitting(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            toast.success("Pengumuman berhasil dibuat");
            setDialogOpen(false);
            setFormData({ title: "", content: "", category: "info", isPinned: false });
        } catch (error) {
            toast.error("Gagal membuat pengumuman");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pengumuman"
                description="Kelola pengumuman dan berita koperasi"
                actions={
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Buat Pengumuman
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Buat Pengumuman Baru</DialogTitle>
                                <DialogDescription>
                                    Buat pengumuman untuk anggota koperasi
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
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    Simpan Draft
                                </Button>
                                <Button onClick={handleSubmit} disabled={isSubmitting}>
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
        </div>
    );
}
