"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash, Package } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { useAuth } from "@/lib/hooks";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";

export default function LayananUnitPage({ params }: { params: Promise<{ unitSlug: string }> }) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    // In Next.js 15+, params is a promise
    const resolvedParams = React.use(params);
    const unitSlug = resolvedParams.unitSlug;
    const unitType = unitSlug ? unitSlug.replace(/-/g, '_') : '';

    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingPackage, setEditingPackage] = React.useState<any>(null);
    const [formData, setFormData] = React.useState({
        name: "",
        description: "",
        price: "0",
        isActive: true,
        sortOrder: 0
    });

    const formatUnitName = (slug: string) => {
        return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    // Query for packages
    const { data: packages = [], isLoading } = useQuery({
        queryKey: ["unit-packages", unitSlug],
        queryFn: async () => {
            const res = await fetch(`/api/unit/${unitSlug}/packages`);
            if (!res.ok) throw new Error("Gagal mengambil data paket");
            return res.json();
        }
    });

    // Mutation for create/update
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const isEdit = !!editingPackage;
            const url = isEdit ? `/api/unit/${unitSlug}/packages/${editingPackage.id}` : `/api/unit/${unitSlug}/packages`;
            const res = await fetch(url, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(await res.text() || "Gagal menyimpan paket");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["unit-packages", unitSlug] });
            toast.success("Paket layanan berhasil disimpan");
            setIsDialogOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.message || "Gagal menyimpan paket");
        }
    });

    // Mutation for delete
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/unit/${unitSlug}/packages/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Gagal menghapus paket");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["unit-packages", unitSlug] });
            toast.success("Paket layanan berhasil dihapus");
        },
        onError: (err: any) => {
            toast.error(err.message || "Gagal menghapus paket");
        }
    });

    const handleOpenDialog = (pkg?: any) => {
        if (pkg) {
            setEditingPackage(pkg);
            setFormData({
                name: pkg.name,
                description: pkg.description || "",
                price: pkg.price.toString(),
                isActive: pkg.isActive,
                sortOrder: pkg.sortOrder
            });
        } else {
            setEditingPackage(null);
            setFormData({
                name: "",
                description: "",
                price: "0",
                isActive: true,
                sortOrder: packages.length + 1
            });
        }
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.price || isNaN(Number(formData.price))) {
            toast.error("Nama dan harga paket wajib diisi dengan benar");
            return;
        }
        saveMutation.mutate({
            ...formData,
            price: Number(formData.price),
            sortOrder: Number(formData.sortOrder)
        });
    };

    const handleDelete = (id: number) => {
        if (window.confirm("Apakah Anda yakin ingin menghapus paket layanan ini?")) {
            deleteMutation.mutate(id);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <PageHeader
                title={`Kelola Layanan: ${formatUnitName(unitSlug)}`}
                description="Manajemen daftar paket layanan dan harga untuk unit operasional"
            />

            <div className="flex justify-end mb-4">
                <Button onClick={() => handleOpenDialog()} className="bg-gemini-blue hover:bg-gemini-blue/90 text-white shadow-lg">
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Layanan
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.map((pkg: any) => (
                    <Card key={pkg.id} className="overflow-hidden border-border/40 hover:shadow-md transition-all">
                        <CardHeader className={`pb-3 ${pkg.isActive ? 'bg-muted/30' : 'bg-muted/10 opacity-70'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg font-bold text-foreground">
                                        {pkg.name}
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                        {pkg.description || "Tidak ada deskripsi"}
                                    </p>
                                </div>
                                <Badge variant={pkg.isActive ? "default" : "secondary"}>
                                    {pkg.isActive ? "Aktif" : "Nonaktif"}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 flex items-center justify-between">
                            <div className="text-2xl font-bold text-gemini-blue">
                                {formatCurrency(pkg.price)}
                            </div>
                            <div className="flex space-x-2">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleOpenDialog(pkg)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(pkg.id)}>
                                    <Trash className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                
                {packages.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-1">Belum ada paket layanan</h3>
                        <p className="text-sm">Klik tombol tambah untuk membuat paket layanan baru.</p>
                    </div>
                )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingPackage ? "Edit Paket Layanan" : "Tambah Paket Layanan"}</DialogTitle>
                        <DialogDescription>
                            Tentukan nama dan harga paket untuk ditampilkan di mesin Kasir POS.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Paket</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Cth: Potong Rambut Standar"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price">Harga (Rp)</Label>
                            <Input
                                id="price"
                                type="number"
                                min="0"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Deskripsi (Opsional)</Label>
                            <Input
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Cth: Termasuk cuci & styling"
                            />
                        </div>
                        <div className="flex items-center justify-between border rounded-lg p-3">
                            <div className="space-y-0.5">
                                <Label htmlFor="isActive">Status Aktif</Label>
                                <p className="text-xs text-muted-foreground">Tampilkan di aplikasi kasir</p>
                            </div>
                            <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={saveMutation.isPending}>
                                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Simpan
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
