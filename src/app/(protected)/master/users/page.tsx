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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Loader2, Save, Shield, Mail } from "lucide-react";
import { usersApi, masterApi } from "@/lib/api";

// User type
interface UserData {
    id: number;
    name: string;
    email: string;
    roleId: number;
    role?: { id: number; name: string; displayName: string };
    branchId?: number;
    branch?: { id: number; name: string };
    isActive: boolean;
    createdAt: string;
}

interface Role {
    id: number;
    name: string;
    displayName: string;
}


// Table columns
const columns: ColumnDef<UserData>[] = [
    {
        accessorKey: "name",
        header: "Nama",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                        {row.original.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </span>
                </div>
                <div>
                    <p className="font-medium">{row.getValue("name")}</p>
                    <p className="text-xs text-muted-foreground">{row.original.email}</p>
                </div>
            </div>
        ),
    },
    {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
            <Badge variant="outline" className="gap-1">
                <Shield className="h-3 w-3" />
                {row.original.role?.displayName || row.original.role?.name || "-"}
            </Badge>
        ),
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
    {
        accessorKey: "createdAt",
        header: "Bergabung",
        cell: ({ row }) => {
            const date = row.getValue("createdAt") as string;
            return date ? new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-";
        },
    },
];

// User form
function UserForm({
    user,
    roles,
    onSave,
    onCancel
}: {
    user?: UserData;
    roles: Role[];
    onSave: (data: Partial<UserData> & { password?: string }) => Promise<void>;
    onCancel: () => void;
}) {
    const [isLoading, setIsLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        name: user?.name || "",
        email: user?.email || "",
        password: "",
        roleId: user?.roleId?.toString() || user?.role?.id?.toString() || "",
        isActive: user?.isActive ?? true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave({
                name: formData.name,
                email: formData.email,
                password: formData.password || undefined,
                roleId: parseInt(formData.roleId),
                isActive: formData.isActive,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <Label htmlFor="name">Nama Lengkap *</Label>
                    <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Nama pengguna"
                        required
                    />
                </div>
                <div className="sm:col-span-2">
                    <Label htmlFor="email">Email *</Label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                            className="pl-10"
                            placeholder="email@primkoppol.id"
                            required
                        />
                    </div>
                </div>
                {!user && (
                    <div className="sm:col-span-2">
                        <Label htmlFor="password">Password *</Label>
                        <Input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                            placeholder="Minimal 8 karakter"
                            required={!user}
                            minLength={8}
                        />
                    </div>
                )}
                <div>
                    <Label htmlFor="role">Role *</Label>
                    <Select
                        value={formData.roleId}
                        onValueChange={(value) => setFormData((p) => ({ ...p, roleId: value }))}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih role" />
                        </SelectTrigger>
                        <SelectContent>
                            {roles.map((role) => (
                                <SelectItem key={role.id} value={role.id.toString()}>
                                    {role.displayName || role.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData((p) => ({ ...p, isActive: !!checked }))}
                />
                <Label htmlFor="isActive" className="font-normal">Pengguna Aktif</Label>
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

export default function MasterUsersPage() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [users, setUsers] = React.useState<UserData[]>([]);
    const [roles, setRoles] = React.useState<Role[]>([]);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingUser, setEditingUser] = React.useState<UserData | undefined>();

    // Fetch data from API
    React.useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);
                const [usersRes, rolesRes] = await Promise.all([
                    usersApi.list(),
                    usersApi.roles(),
                ]);
                setUsers(usersRes.data as unknown as UserData[]);
                setRoles(rolesRes.data as unknown as Role[]);
            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, []);

    const handleSave = async (data: Partial<UserData> & { password?: string }) => {
        try {
            if (editingUser) {
                await usersApi.update(editingUser.id, data);
                setUsers((prev) => prev.map((u) => u.id === editingUser.id ? { ...u, ...data } as UserData : u));
                toast.success("Pengguna berhasil diperbarui");
            } else {
                const response = await usersApi.create(data);
                setUsers((prev) => [...prev, response.data as unknown as UserData]);
                toast.success("Pengguna berhasil ditambahkan");
            }
            setDialogOpen(false);
            setEditingUser(undefined);
        } catch (error) {
            toast.error("Gagal menyimpan pengguna");
        }
    };

    const handleEdit = (user: UserData) => {
        setEditingUser(user);
        setDialogOpen(true);
    };

    const handleAdd = () => {
        setEditingUser(undefined);
        setDialogOpen(true);
    };

    const columnsWithActions: ColumnDef<UserData>[] = [
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
                title="Manajemen User"
                description="Kelola pengguna dan hak akses sistem"
                backHref="/master"
                actions={
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={handleAdd}>
                                <Plus className="mr-2 h-4 w-4" />
                                Tambah User
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>{editingUser ? "Edit User" : "Tambah User Baru"}</DialogTitle>
                                <DialogDescription>
                                    {editingUser ? "Perbarui informasi pengguna" : "Buat pengguna baru untuk sistem"}
                                </DialogDescription>
                            </DialogHeader>
                            <UserForm
                                user={editingUser}
                                roles={roles}
                                onSave={handleSave}
                                onCancel={() => setDialogOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                }
            />

            <DataTable
                columns={columnsWithActions}
                data={users}
                isLoading={isLoading}
                searchPlaceholder="Cari pengguna..."
                searchColumn="name"
            />
        </div>
    );
}
