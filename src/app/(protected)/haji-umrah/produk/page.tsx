"use client";

import React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/constants";
import { Plus, Edit2 } from "lucide-react";
import { toast } from "sonner";

interface Product {
    id: number;
    code: string;
    name: string;
    type: string;
    minimumAmount: number;
    targetAmount: number | null;
    adminFeeType: string | null;
    adminFeeValue: number | null;
    linkedBankName: string | null;
    allowEarlyWithdraw: boolean;
    isActive: boolean;
}

export default function ProdukPage() {
    const [products, setProducts] = React.useState<Product[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<Product | null>(null);
    const [saving, setSaving] = React.useState(false);

    const [form, setForm] = React.useState({
        code: "",
        name: "",
        type: "tabungan_haji",
        minimumAmount: "100000",
        targetAmount: "50000000",
        adminFeeType: "percent",
        adminFeeValue: "0.5",
        linkedBankName: "BSI",
    });

    const fetchProducts = React.useCallback(async () => {
        try {
            const res = await fetch("/api/haji-umrah/products");
            if (res.ok) {
                const json = await res.json();
                setProducts(json.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { fetchProducts(); }, [fetchProducts]);

    function openCreate() {
        setEditing(null);
        setForm({ code: "", name: "", type: "tabungan_haji", minimumAmount: "100000", targetAmount: "50000000", adminFeeType: "percent", adminFeeValue: "0.5", linkedBankName: "BSI" });
        setDialogOpen(true);
    }

    function openEdit(product: Product) {
        setEditing(product);
        setForm({
            code: product.code,
            name: product.name,
            type: product.type,
            minimumAmount: String(product.minimumAmount),
            targetAmount: String(product.targetAmount ?? ""),
            adminFeeType: product.adminFeeType ?? "percent",
            adminFeeValue: String(product.adminFeeValue ?? ""),
            linkedBankName: product.linkedBankName ?? "BSI",
        });
        setDialogOpen(true);
    }

    async function handleSave() {
        setSaving(true);
        try {
            const payload = {
                code: form.code,
                name: form.name,
                type: form.type,
                minimumAmount: parseFloat(form.minimumAmount) || 0,
                targetAmount: form.targetAmount ? parseFloat(form.targetAmount) : null,
                adminFeeType: form.adminFeeType || null,
                adminFeeValue: form.adminFeeValue ? parseFloat(form.adminFeeValue) : null,
                linkedBankName: form.linkedBankName || null,
            };

            let res: Response;
            if (editing) {
                res = await fetch(`/api/haji-umrah/products/${editing.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } else {
                res = await fetch("/api/haji-umrah/products", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }

            if (res.ok) {
                toast.success("Produk berhasil disimpan");
                setDialogOpen(false);
                fetchProducts();
            } else {
                const json = await res.json();
                toast.error(json.message || "Gagal menyimpan produk");
            }
        } catch (err) {
            console.error(err);
            toast.error("Terjadi kesalahan");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Produk Tabungan"
                description="Kelola produk tabungan Haji & Umrah"
                backHref="/haji-umrah"
                backLabel="Dashboard"
                actions={
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Tambah Produk
                    </Button>
                }
            />

            {/* Product Cards */}
            <div className="grid gap-4 sm:grid-cols-2">
                {loading ? (
                    <p>Memuat...</p>
                ) : products.length === 0 ? (
                    <p className="text-muted-foreground col-span-2 text-center py-10">Belum ada produk</p>
                ) : (
                    products.map((product) => (
                        <Card key={product.id}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">{product.name}</CardTitle>
                                        <p className="text-sm text-muted-foreground">{product.code}</p>
                                    </div>
                                    <Badge variant={product.type === "tabungan_haji" ? "default" : "secondary"}>
                                        {product.type === "tabungan_haji" ? "Haji" : "Umrah"}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Minimum Setoran</span>
                                    <span>{formatCurrency(product.minimumAmount)}</span>
                                </div>
                                {product.targetAmount && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Target</span>
                                        <span>{formatCurrency(Number(product.targetAmount))}</span>
                                    </div>
                                )}
                                {product.adminFeeValue != null && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Admin Fee</span>
                                        <span>{product.adminFeeType === "percent" ? `${product.adminFeeValue}%` : formatCurrency(Number(product.adminFeeValue))}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Bank Partner</span>
                                    <span>{product.linkedBankName || "—"}</span>
                                </div>
                                <div className="pt-2">
                                    <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                                        <Edit2 className="mr-1 h-3 w-3" /> Edit
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Kode</Label>
                                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="TH" disabled={!!editing} />
                            </div>
                            <div>
                                <Label>Tipe</Label>
                                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))} disabled={!!editing}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="tabungan_haji">Tabungan Haji</SelectItem>
                                        <SelectItem value="tabungan_umrah">Tabungan Umrah</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label>Nama Produk</Label>
                            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tabungan Haji" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Minimum Setoran</Label>
                                <Input type="number" value={form.minimumAmount} onChange={(e) => setForm((f) => ({ ...f, minimumAmount: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Target Tabungan</Label>
                                <Input type="number" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))} placeholder="Opsional" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Admin Fee Type</Label>
                                <Select value={form.adminFeeType} onValueChange={(v) => setForm((f) => ({ ...f, adminFeeType: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percent">Persen (%)</SelectItem>
                                        <SelectItem value="fixed">Fixed (Rp)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Admin Fee Value</Label>
                                <Input type="number" step="0.01" value={form.adminFeeValue} onChange={(e) => setForm((f) => ({ ...f, adminFeeValue: e.target.value }))} placeholder="0.5" />
                            </div>
                        </div>
                        <div>
                            <Label>Bank Partner</Label>
                            <Input value={form.linkedBankName} onChange={(e) => setForm((f) => ({ ...f, linkedBankName: e.target.value }))} placeholder="BSI" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Menyimpan..." : editing ? "Update" : "Simpan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
