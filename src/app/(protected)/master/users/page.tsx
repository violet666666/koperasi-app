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
import { Plus, Pencil, Users, Loader2, Save, Shield, Mail } from "lucide-react";
import type { User, Branch, Role } from "@/types";

// Mock data
const MOCK_ROLES: Role[] = [
    { id: 1, name: "admin", display_name: "Administrator", permissions: ["*"] },
    { id: 2, name: "manager", display_name: "Manajer Cabang", permissions: ["view_all", "approve"] },
    { id: 3, name: "teller", display_name: "Teller", permissions: ["manage_transactions"] },
    { id: 4, name: "accounting", display_name: "Akuntansi", permissions: ["view_journals", "manage_journals"] },
];

const MOCK_BRANCHES: Branch[] = [
    { id: 1, code: "PST", name: "Kantor Pusat", is_head_office: true, is_active: true },
    { id: 2, code: "JKT", name: "Cabang Jakarta", is_head_office: false, is_active: true },
    { id: 3, code: "SBY", name: "Cabang Surabaya", is_head_office: false, is_active: true },
];

interface UserData {
    id: number;
    name: string;
    email: string;
    role: Role;
    branch_id: number | null;
    branch: Branch | null;
    is_active: boolean;
    created_at: string;
}

const MOCK_USERS: UserData[] = [
    { id: 1, name: "Admin Pusat", email: "admin@koperasi.id", role: MOCK_ROLES[0], branch_id: 1, branch: MOCK_BRANCHES[0], is_active: true, created_at: "2024-01-01" },
    { id: 2, name: "Manajer Jakarta", email: "manager.jkt@koperasi.id", role: MOCK_ROLES[1], branch_id: 2, branch: MOCK_BRANCHES[1], is_active: true, created_at: "2024-02-15" },
    { id: 3, name: "Teller 1", email: "teller1@koperasi.id", role: MOCK_ROLES[2], branch_id: 2, branch: MOCK_BRANCHES[1], is_active: true, created_at: "2024-03-01" },
    { id: 4, name: "Akuntan", email: "accounting@koperasi.id", role: MOCK_ROLES[3], branch_id: 1, branch: MOCK_BRANCHES[0], is_active: true, created_at: "2024-03-15" },
    { id: 5, name: "Teller Surabaya", email: "teller.sby@koperasi.id", role: MOCK_ROLES[2], branch_id: 3, branch: MOCK_BRANCHES[2], is_active: false, created_at: "2024-04-01" },
];

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
                {row.original.role.display_name}
            </Badge>
        ),
    },
    {
        accessorKey: "branch",
        header: "Cabang",
        cell: ({ row }) => row.original.branch?.name || "-",
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
    {
        accessorKey: "created_at",
        header: "Bergabung",
        cell: ({ row }) => new Date(row.getValue("created_at")).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
    },
];

// User form
function UserForm({
    user,
    onSave,
    onCancel
}: {
    user?: UserData;
    onSave: (data: Partial<UserData>) => Promise<void>;
    onCancel: () => void;
}) {
    const [isLoading, setIsLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        name: user?.name || "",
        email: user?.email || "",
        password: "",
        role_id: user?.role.id.toString() || "",
        branch_id: user?.branch_id?.toString() || "",
        is_active: user?.is_active ?? true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const role = MOCK_ROLES.find((r) => r.id.toString() === formData.role_id);
            const branch = MOCK_BRANCHES.find((b) => b.id.toString() === formData.branch_id);
            await onSave({
                name: formData.name,
                email: formData.email,
                role: role,
                branch_id: formData.branch_id ? parseInt(formData.branch_id) : null,
                branch: branch || null,
                is_active: formData.is_active,
            } as Partial<UserData>);
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
                            placeholder="email@koperasi.id"
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
                        value={formData.role_id}
                        onValueChange={(value) => setFormData((p) => ({ ...p, role_id: value }))}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih role" />
                        </SelectTrigger>
                        <SelectContent>
                            {MOCK_ROLES.map((role) => (
                                <SelectItem key={role.id} value={role.id.toString()}>
                                    {role.display_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="branch">Cabang</Label>
                    <Select
                        value={formData.branch_id}
                        onValueChange={(value) => setFormData((p) => ({ ...p, branch_id: value }))}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Semua cabang" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Semua Cabang</SelectItem>
                            {MOCK_BRANCHES.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id.toString()}>
                                    {branch.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Checkbox
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData((p) => ({ ...p, is_active: !!checked }))}
                />
                <Label htmlFor="is_active" className="font-normal">Pengguna Aktif</Label>
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
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingUser, setEditingUser] = React.useState<UserData | undefined>();

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setUsers(MOCK_USERS);
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const handleSave = async (data: Partial<UserData>) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (editingUser) {
            setUsers((prev) => prev.map((u) => u.id === editingUser.id ? { ...u, ...data } : u));
            toast.success("Pengguna berhasil diperbarui");
        } else {
            const newUser = { ...data, id: Date.now(), created_at: new Date().toISOString() } as UserData;
            setUsers((prev) => [...prev, newUser]);
            toast.success("Pengguna berhasil ditambahkan");
        }
        setDialogOpen(false);
        setEditingUser(undefined);
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
