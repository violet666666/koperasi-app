"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, MoreHorizontal, Eye, Pencil, Trash2, CreditCard } from "lucide-react";
import type { Member } from "@/types";
import { MEMBER_STATUS } from "@/lib/constants";

// Mock data for development
const MOCK_MEMBERS: Member[] = [
    {
        id: 1,
        member_no: "A-001",
        branch_id: 1,
        branch: { id: 1, code: "PST", name: "Kantor Pusat", is_head_office: true, is_active: true },
        name: "Budi Santoso",
        nik: "3201234567890001",
        gender: "male",
        phone: "08123456789",
        email: "budi@email.com",
        address: "Jl. Mawar No. 10, Jakarta",
        city: "Jakarta Pusat",
        province: "DKI Jakarta",
        join_date: "2024-01-15",
        status: "active",
        created_at: "2024-01-15T10:00:00Z",
        updated_at: "2024-06-20T14:30:00Z",
    },
    {
        id: 2,
        member_no: "A-002",
        branch_id: 1,
        branch: { id: 1, code: "PST", name: "Kantor Pusat", is_head_office: true, is_active: true },
        name: "Siti Aminah",
        nik: "3201234567890002",
        gender: "female",
        phone: "08234567890",
        email: "siti@email.com",
        address: "Jl. Melati No. 20, Jakarta",
        city: "Jakarta Selatan",
        province: "DKI Jakarta",
        join_date: "2024-02-20",
        status: "active",
        created_at: "2024-02-20T09:00:00Z",
        updated_at: "2024-02-20T09:00:00Z",
    },
    {
        id: 3,
        member_no: "A-003",
        branch_id: 2,
        branch: { id: 2, code: "JKT", name: "Cabang Jakarta", is_head_office: false, is_active: true },
        name: "Joko Widodo",
        nik: "3201234567890003",
        gender: "male",
        phone: "08345678901",
        email: "joko@email.com",
        address: "Jl. Kenanga No. 30, Bekasi",
        city: "Bekasi",
        province: "Jawa Barat",
        join_date: "2024-03-10",
        status: "active",
        created_at: "2024-03-10T11:00:00Z",
        updated_at: "2024-03-10T11:00:00Z",
    },
    {
        id: 4,
        member_no: "A-004",
        branch_id: 2,
        branch: { id: 2, code: "JKT", name: "Cabang Jakarta", is_head_office: false, is_active: true },
        name: "Dewi Lestari",
        nik: "3201234567890004",
        gender: "female",
        phone: "08456789012",
        email: "dewi@email.com",
        address: "Jl. Anggrek No. 40, Depok",
        city: "Depok",
        province: "Jawa Barat",
        join_date: "2024-04-05",
        status: "inactive",
        created_at: "2024-04-05T08:00:00Z",
        updated_at: "2024-08-15T16:00:00Z",
    },
    {
        id: 5,
        member_no: "A-005",
        branch_id: 3,
        branch: { id: 3, code: "SBY", name: "Cabang Surabaya", is_head_office: false, is_active: true },
        name: "Ahmad Ridwan",
        nik: "3201234567890005",
        gender: "male",
        phone: "08567890123",
        email: "ahmad@email.com",
        address: "Jl. Dahlia No. 50, Surabaya",
        city: "Surabaya",
        province: "Jawa Timur",
        join_date: "2024-05-12",
        status: "active",
        created_at: "2024-05-12T10:30:00Z",
        updated_at: "2024-05-12T10:30:00Z",
    },
];

// Status badge component
function StatusBadge({ status }: { status: keyof typeof MEMBER_STATUS }) {
    const config = MEMBER_STATUS[status];
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        success: "default",
        secondary: "secondary",
        destructive: "destructive",
    };

    return (
        <Badge variant={variants[config.color] || "secondary"} className="capitalize">
            {config.label}
        </Badge>
    );
}

// Actions dropdown component
function ActionsDropdown({ member }: { member: Member }) {
    const router = useRouter();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Buka menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push(`/anggota/${member.id}`)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Lihat Detail
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/anggota/${member.id}/edit`)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/anggota/buku/${member.id}`)}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Buku Anggota
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// Table columns definition
const columns: ColumnDef<Member>[] = [
    {
        accessorKey: "member_no",
        header: "No. Anggota",
        cell: ({ row }) => (
            <Link
                href={`/anggota/${row.original.id}`}
                className="font-medium text-primary hover:underline"
            >
                {row.getValue("member_no")}
            </Link>
        ),
    },
    {
        accessorKey: "name",
        header: "Nama",
        cell: ({ row }) => (
            <div>
                <div className="font-medium">{row.getValue("name")}</div>
                <div className="text-sm text-muted-foreground">{row.original.phone}</div>
            </div>
        ),
    },
    {
        accessorKey: "branch",
        header: "Cabang",
        cell: ({ row }) => row.original.branch?.name || "-",
        filterFn: (row, id, value) => {
            return value === "all" || row.original.branch_id === parseInt(value);
        },
    },
    {
        accessorKey: "city",
        header: "Kota",
        cell: ({ row }) => row.getValue("city") || "-",
    },
    {
        accessorKey: "join_date",
        header: "Tgl Bergabung",
        cell: ({ row }) => {
            const date = new Date(row.getValue("join_date"));
            return date.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
        },
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
        filterFn: (row, id, value) => {
            return value === "all" || row.getValue(id) === value;
        },
    },
    {
        id: "actions",
        cell: ({ row }) => <ActionsDropdown member={row.original} />,
    },
];

export default function AnggotaListPage() {
    const router = useRouter();
    const [statusFilter, setStatusFilter] = React.useState("all");
    const [branchFilter, setBranchFilter] = React.useState("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [members, setMembers] = React.useState<Member[]>([]);

    // Simulate data loading
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setMembers(MOCK_MEMBERS);
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    // Filter data
    const filteredMembers = React.useMemo(() => {
        return members.filter((member) => {
            const statusMatch = statusFilter === "all" || member.status === statusFilter;
            const branchMatch = branchFilter === "all" || member.branch_id === parseInt(branchFilter);
            return statusMatch && branchMatch;
        });
    }, [members, statusFilter, branchFilter]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Daftar Anggota"
                description="Kelola data anggota koperasi"
                actions={
                    <Button asChild>
                        <Link href="/anggota/tambah">
                            <Plus className="mr-2 h-4 w-4" />
                            Tambah Anggota
                        </Link>
                    </Button>
                }
            />

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="inactive">Tidak Aktif</SelectItem>
                        <SelectItem value="resigned">Keluar</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Cabang" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Cabang</SelectItem>
                        <SelectItem value="1">Kantor Pusat</SelectItem>
                        <SelectItem value="2">Cabang Jakarta</SelectItem>
                        <SelectItem value="3">Cabang Surabaya</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={filteredMembers}
                isLoading={isLoading}
                searchPlaceholder="Cari nama atau no. anggota..."
                onRowClick={(row) => router.push(`/anggota/${row.id}`)}
            />
        </div>
    );
}
