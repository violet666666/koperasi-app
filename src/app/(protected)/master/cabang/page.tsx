"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Building, Loader2, Save } from "lucide-react";
import type { Branch } from "@/types";

// Mock data
const MOCK_BRANCHES: Branch[] = [
    { id: 1, code: "PST", name: "Kantor Pusat", address: "Jl. Sudirman No. 1, Jakarta", phone: "021-1234567", is_head_office: true, is_active: true },
    { id: 2, code: "JKT", name: "Cabang Jakarta Selatan", address: "Jl. Fatmawati No. 10, Jakarta Selatan", phone: "021-7654321", is_head_office: false, is_active: true },
    { id: 3, code: "SBY", name: "Cabang Surabaya", address: "Jl. Basuki Rahmat No. 5, Surabaya", phone: "031-1234567", is_head_office: false, is_active: true },
    { id: 4, code: "BDG", name: "Cabang Bandung", address: "Jl. Braga No. 20, Bandung", phone: "022-1234567", is_head_office: false, is_active: true },
    { id: 5, code: "YGY", name: "Cabang Yogyakarta", address: "Jl. Malioboro No. 15, Yogyakarta", phone: "0274-123456", is_head_office: false, is_active: false },
];

// Table columns
const columns: ColumnDef<Branch>[] = [
    {
        accessorKey: "code",
        header: "Kode",
        cell: ({ row }) => (
            <Badge variant="outline" className="font-mono">
                {row.getValue("code")}
            </Badge>
        ),
    },
    {
        accessorKey: "name",
        header: "Nama Cabang",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{row.getValue("name")}</span>
                {row.original.is_head_office && (
                    <Badge variant="default" className="text-xs">Pusat</Badge>
                )}
            </div>
        ),
    },
    {
        accessorKey: "address",
        header: "Alamat",
        cell: ({ row }) => (
            <div className="max-w-[250px] truncate" title={row.getValue("address")}>
                {row.getValue("address") || "-"}
            </div>
        ),
    },
    {
        accessorKey: "phone",
        header: "Telepon",
        cell: ({ row }) => row.getValue("phone") || "-",
    },
    {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => (
            <Badge variant={row.getValue("is_active") ? "default" : "secondary"}>
                {row.getValue("is_active") ? "Aktif" : "Tidak Aktif"}
            </Badge>
        ),
    },
];

// Branch form component
function BranchForm({
    branch,
    onSave,
    onCancel
}: {
    branch?: Branch;
    onSave: (data: Partial<Branch>) => Promise<void>;
    onCancel: () => void;
}) {
    const [isLoading, setIsLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        code: branch?.code || "",
        name: branch?.name || "",
        address: branch?.address || "",
        phone: branch?.phone || "",
        is_head_office: branch?.is_head_office || false,
        is_active: branch?.is_active ?? true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave(formData);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <Label htmlFor="code">Kode Cabang *</Label>
                    <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                        placeholder="PST"
                        maxLength={5}
                        required
                    />
                </div>
                <div>
                    <Label htmlFor="name">Nama Cabang *</Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Kantor Pusat"
                        required
                    />
                </div>
                <div className="sm:col-span-2">
                    <Label htmlFor="address">Alamat</Label>
                    <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                        placeholder="Jl. xxx No. xx"
                    />
                </div>
                <div>
                    <Label htmlFor="phone">Telepon</Label>
                    <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="021-1234567"
                    />
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="is_head_office"
                        checked={formData.is_head_office}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, is_head_office: !!checked }))}
                    />
                    <Label htmlFor="is_head_office" className="font-normal">Kantor Pusat</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, is_active: !!checked }))}
                    />
                    <Label htmlFor="is_active" className="font-normal">Aktif</Label>
                </div>
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Batal
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Simpan
                </Button>
            </DialogFooter>
        </form>
    );
}

export default function MasterCabangPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [branches, setBranches] = React.useState<Branch[]>([]);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingBranch, setEditingBranch] = React.useState<Branch | undefined>();

    // Simulate loading
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setBranches(MOCK_BRANCHES);
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleSave = async (data: Partial<Branch>) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (editingBranch) {
            setBranches((prev) => prev.map((b) => b.id === editingBranch.id ? { ...b, ...data } : b));
            toast.success("Cabang berhasil diperbarui");
        } else {
            const newBranch = { ...data, id: Date.now() } as Branch;
            setBranches((prev) => [...prev, newBranch]);
            toast.success("Cabang berhasil ditambahkan");
        }
        setDialogOpen(false);
        setEditingBranch(undefined);
    };

    const handleEdit = (branch: Branch) => {
        setEditingBranch(branch);
        setDialogOpen(true);
    };

    const handleAdd = () => {
        setEditingBranch(undefined);
        setDialogOpen(true);
    };

    // Add edit action column
    const columnsWithActions: ColumnDef<Branch>[] = [
        ...columns,
        {
            id: "actions",
            cell: ({ row }) => (
                <Button size="sm" variant="ghost" onClick={() => handleEdit(row.original)}>
                    <Pencil className="h-4 w-4" />
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Data Cabang"
                description="Kelola data cabang koperasi"
                backHref="/master"
                actions={
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={handleAdd}>
                                <Plus className="mr-2 h-4 w-4" />
                                Tambah Cabang
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>{editingBranch ? "Edit Cabang" : "Tambah Cabang Baru"}</DialogTitle>
                                <DialogDescription>
                                    {editingBranch ? "Perbarui informasi cabang" : "Buat cabang baru untuk koperasi"}
                                </DialogDescription>
                            </DialogHeader>
                            <BranchForm
                                branch={editingBranch}
                                onSave={handleSave}
                                onCancel={() => setDialogOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                }
            />

            <DataTable
                columns={columnsWithActions}
                data={branches}
                isLoading={isLoading}
                searchPlaceholder="Cari cabang..."
                searchColumn="name"
            />
        </div>
    );
}
