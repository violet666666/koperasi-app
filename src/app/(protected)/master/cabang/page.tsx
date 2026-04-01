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
import { masterApi } from "@/lib/api";

// Branch type
interface Branch {
    id: number;
    code: string;
    name: string;
    address?: string;
    phone?: string;
    isHeadOffice: boolean;
    isActive: boolean;
}

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
                {row.original.isHeadOffice && (
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
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
            <Badge variant={row.getValue("isActive") ? "default" : "secondary"}>
                {row.getValue("isActive") ? "Aktif" : "Tidak Aktif"}
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
        isHeadOffice: branch?.isHeadOffice || false,
        isActive: branch?.isActive ?? true,
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
                        id="isHeadOffice"
                        checked={formData.isHeadOffice}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, isHeadOffice: !!checked }))}
                    />
                    <Label htmlFor="isHeadOffice" className="font-normal">Kantor Pusat</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData((p) => ({ ...p, isActive: !!checked }))}
                    />
                    <Label htmlFor="isActive" className="font-normal">Aktif</Label>
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

    // Fetch branches from API
    React.useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const response = await masterApi.branches.list();
                setBranches(response.data as unknown as Branch[]);
            } catch (error) {
                console.error("Failed to fetch branches:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, []);

    const handleSave = async (data: Partial<Branch>) => {
        try {
            if (editingBranch) {
                await masterApi.branches.update(editingBranch.id, data);
                setBranches((prev) => prev.map((b) => b.id === editingBranch.id ? { ...b, ...data } as Branch : b));
                toast.success("Cabang berhasil diperbarui");
            } else {
                const response = await masterApi.branches.create(data);
                setBranches((prev) => [...prev, response.data as unknown as Branch]);
                toast.success("Cabang berhasil ditambahkan");
            }
            setDialogOpen(false);
            setEditingBranch(undefined);
        } catch (error) {
            toast.error("Gagal menyimpan cabang");
        }
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
                description="Kelola data cabang PRIMKOPPOL"
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
                                    {editingBranch ? "Perbarui informasi cabang" : "Buat cabang baru untuk PRIMKOPPOL"}
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
