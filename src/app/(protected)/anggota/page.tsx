"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { DeleteConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
import { Plus, MoreHorizontal, Eye, Pencil, Trash2, CreditCard, IdCard } from "lucide-react";
import { MEMBER_STATUS } from "@/lib/constants";
import { membersApi, masterApi, type Member as ApiMember } from "@/lib/api";

// Map API response to internal Member type
interface Member {
    id: number;
    member_no: string;
    branch_id?: number;
    branch?: { id: number; code?: string; name: string; is_head_office?: boolean; is_active?: boolean };
    name: string;
    phone?: string;
    email?: string;
    city?: string;
    join_date: string;
    status: "active" | "inactive" | "resigned";
}

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

// Actions dropdown component with delete confirmation
function ActionsDropdown({
    member,
    onDelete
}: {
    member: Member;
    onDelete: (id: number, name: string) => void;
}) {
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
                <DropdownMenuItem onClick={() => router.push(`/anggota/kartu`)}>
                    <IdCard className="mr-2 h-4 w-4" />
                    Cetak Kartu
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(member.id, member.name)}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}



// Map API member to internal format
function mapApiMember(apiMember: ApiMember): Member {
    return {
        id: apiMember.id,
        member_no: apiMember.memberNo,
        branch_id: apiMember.branchId,
        branch: apiMember.branch,
        name: apiMember.name,
        phone: apiMember.phone,
        email: apiMember.email,
        city: (apiMember as any).city,
        join_date: apiMember.joinDate,
        status: (apiMember.status as "active" | "inactive" | "resigned") || "active",
    };
}

export default function AnggotaListPage() {
    const router = useRouter();
    const [statusFilter, setStatusFilter] = React.useState("all");
    const [isLoading, setIsLoading] = React.useState(true);
    const [members, setMembers] = React.useState<Member[]>([]);
    const [pageCount, setPageCount] = React.useState(0);
    const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 15 });
    const [searchQuery, setSearchQuery] = React.useState("");

    // Delete confirmation state
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [memberToDelete, setMemberToDelete] = React.useState<{ id: number; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Handle delete click - opens confirmation dialog
    const handleDeleteClick = (id: number, name: string) => {
        setMemberToDelete({ id, name });
        setDeleteDialogOpen(true);
    };

    // Handle confirmed delete
    const handleConfirmDelete = async () => {
        if (!memberToDelete) return;

        try {
            setIsDeleting(true);
            await membersApi.delete(memberToDelete.id);

            // Remove from local state
            setMembers((prev) => prev.filter((m) => m.id !== memberToDelete.id));

            toast.success(`Anggota ${memberToDelete.name} berhasil dihapus`);
            setDeleteDialogOpen(false);
        } catch (error) {
            console.error("Failed to delete member:", error);
            toast.error("Gagal menghapus anggota. Silakan coba lagi.");
        } finally {
            setIsDeleting(false);
        }
    };

    // Dynamic columns with delete handler
    const columns: ColumnDef<Member>[] = React.useMemo(() => [
        {
            accessorKey: "member_no",
            header: "NRP",
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
            accessorKey: "city",
            header: "Kota/Kabupaten",
            cell: ({ row }) => row.getValue("city") || "-",
        },
        {
            accessorKey: "join_date",
            header: "Tgl Bergabung",
            cell: ({ row }) => {
                const dateValue = row.getValue("join_date");
                if (!dateValue) return "-";
                const date = new Date(dateValue as string);
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
            cell: ({ row }) => (
                <ActionsDropdown
                    member={row.original}
                    onDelete={handleDeleteClick}
                />
            ),
        },
    ], []);

    // Fetch members from API
    React.useEffect(() => {
        async function fetchData() {
            try {
                setIsLoading(true);

                // Debounce simple implementation
                const timeoutId = setTimeout(async () => {
                    try {
                        const [membersRes] = await Promise.allSettled([
                            membersApi.list({ 
                                page: pagination.pageIndex + 1, 
                                perPage: pagination.pageSize,
                                search: searchQuery || undefined,
                                // @ts-ignore - status is supported by backend but missing in type
                                status: statusFilter !== "all" ? statusFilter : undefined
                            })
                        ]);

                        if (membersRes.status === "fulfilled") {
                            const responseData = membersRes.value as any;
                            const mappedMembers = responseData.data ? responseData.data.map(mapApiMember) : [];
                            setMembers(mappedMembers);
                            setPageCount(responseData.meta?.totalPages || 0);
                        }
                    } catch (error) {
                         console.error("Failed to fetch inside timeout:", error);
                    } finally {
                        setIsLoading(false);
                    }
                }, 300);
                
                return () => clearTimeout(timeoutId);

            } catch (error) {
                console.error("Failed to fetch members setup:", error);
                setIsLoading(false);
            }
        }

        fetchData();
    }, [pagination, searchQuery, statusFilter]);

    // Server side filtering is used now, so we just pass members directly
    const filteredMembers = members;

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

            </div>

            {/* Data Table */}
            <DataTable
                columns={columns}
                data={filteredMembers}
                isLoading={isLoading}
                searchPlaceholder="Cari nama atau no. anggota..."
                pageCount={pageCount}
                pagination={pagination}
                onPaginationChange={setPagination}
                manualPagination={true}
                globalFilterValue={searchQuery}
                onGlobalFilterChange={setSearchQuery}
                manualFiltering={true}
            />

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                itemName={memberToDelete?.name || "anggota"}
                onConfirm={handleConfirmDelete}
                isLoading={isDeleting}
            />
        </div>
    );
}
