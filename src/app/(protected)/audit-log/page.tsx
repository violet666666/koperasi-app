"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { ExportButton, formatDateExport } from "@/components/patterns/export-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Activity,
    User,
    Calendar,
    Search,
    Filter,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Edit,
    Plus,
    Trash2,
    Eye,
    LogIn,
    LogOut,
} from "lucide-react";

interface AuditLog {
    id: number;
    timestamp: string;
    userId: number;
    userName: string;
    userRole: string;
    action: string;
    module: string;
    description: string;
    ipAddress: string;
    userAgent: string;
    status: "success" | "failed" | "warning";
    details?: Record<string, any>;
}

// Action type to icon mapping
const actionIcons: Record<string, React.ReactNode> = {
    create: <Plus className="h-3 w-3" />,
    update: <Edit className="h-3 w-3" />,
    delete: <Trash2 className="h-3 w-3" />,
    view: <Eye className="h-3 w-3" />,
    login: <LogIn className="h-3 w-3" />,
    logout: <LogOut className="h-3 w-3" />,
    approve: <CheckCircle className="h-3 w-3" />,
    reject: <XCircle className="h-3 w-3" />,
};

const columns: ColumnDef<AuditLog>[] = [
    {
        accessorKey: "timestamp",
        header: "Waktu",
        cell: ({ row }) => {
            const date = new Date(row.getValue("timestamp"));
            return (
                <div className="flex flex-col">
                    <span className="text-sm font-medium">
                        {date.toLocaleDateString("id-ID")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {date.toLocaleTimeString("id-ID")}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "userName",
        header: "Pengguna",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <div className="rounded-full bg-primary/10 p-1.5">
                    <User className="h-3 w-3 text-primary" />
                </div>
                <div>
                    <span className="font-medium">{row.getValue("userName")}</span>
                    <Badge variant="outline" className="ml-2 text-xs">
                        {row.original.userRole}
                    </Badge>
                </div>
            </div>
        ),
    },
    {
        accessorKey: "action",
        header: "Aksi",
        cell: ({ row }) => {
            const action = row.getValue("action") as string;
            const icon = actionIcons[action.toLowerCase()] || <Activity className="h-3 w-3" />;
            return (
                <Badge variant="outline" className="gap-1">
                    {icon}
                    {action}
                </Badge>
            );
        },
    },
    {
        accessorKey: "module",
        header: "Modul",
        cell: ({ row }) => (
            <Badge variant="secondary">{row.getValue("module")}</Badge>
        ),
    },
    {
        accessorKey: "description",
        header: "Deskripsi",
        cell: ({ row }) => (
            <span className="text-sm max-w-[300px] truncate block">
                {row.getValue("description")}
            </span>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            const statusConfig: Record<string, { icon: React.ReactNode; className: string }> = {
                success: { icon: <CheckCircle className="h-3 w-3" />, className: "bg-emerald-100 text-emerald-700" },
                failed: { icon: <XCircle className="h-3 w-3" />, className: "bg-red-100 text-red-700" },
                warning: { icon: <AlertCircle className="h-3 w-3" />, className: "bg-amber-100 text-amber-700" },
            };
            const config = statusConfig[status] || statusConfig.success;
            return (
                <Badge className={`gap-1 ${config.className}`}>
                    {config.icon}
                    {status}
                </Badge>
            );
        },
    },
    {
        accessorKey: "ipAddress",
        header: "IP Address",
        cell: ({ row }) => (
            <span className="font-mono text-xs">{row.getValue("ipAddress")}</span>
        ),
    },
];

// Export columns configuration
const exportColumns = [
    { key: "timestamp", header: "Waktu", format: (v: string) => formatDateExport(v) },
    { key: "userName", header: "Pengguna" },
    { key: "userRole", header: "Role" },
    { key: "action", header: "Aksi" },
    { key: "module", header: "Modul" },
    { key: "description", header: "Deskripsi" },
    { key: "status", header: "Status" },
    { key: "ipAddress", header: "IP Address" },
];

export default function AuditLogPage() {
    const [logs, setLogs] = React.useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [filterModule, setFilterModule] = React.useState<string>("all");
    const [filterAction, setFilterAction] = React.useState<string>("all");
    const [filterUser, setFilterUser] = React.useState<string>("");

    // Fetch data
    React.useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 500));

                // Mock data - would come from API with role-based filtering
                setLogs([
                    { id: 1, timestamp: "2026-01-26T02:45:00", userId: 1, userName: "admin", userRole: "Admin", action: "Login", module: "Auth", description: "Login berhasil dari browser Chrome", ipAddress: "192.168.1.100", userAgent: "Chrome/120", status: "success" },
                    { id: 2, timestamp: "2026-01-26T02:40:00", userId: 2, userName: "Budi Santoso", userRole: "Teller", action: "Create", module: "Simpanan", description: "Setoran simpanan anggota A-001 Rp 500.000", ipAddress: "192.168.1.101", userAgent: "Chrome/120", status: "success" },
                    { id: 3, timestamp: "2026-01-26T02:35:00", userId: 1, userName: "admin", userRole: "Admin", action: "Approve", module: "Pinjaman", description: "Persetujuan pinjaman PJ-2026-0015 Rp 50.000.000", ipAddress: "192.168.1.100", userAgent: "Chrome/120", status: "success" },
                    { id: 4, timestamp: "2026-01-26T02:30:00", userId: 3, userName: "Siti Rahayu", userRole: "Kasir", action: "Create", module: "Toko", description: "Penjualan POS - 5 item Rp 250.000", ipAddress: "192.168.1.102", userAgent: "Chrome/120", status: "success" },
                    { id: 5, timestamp: "2026-01-26T02:25:00", userId: 2, userName: "Budi Santoso", userRole: "Teller", action: "Update", module: "Anggota", description: "Update data anggota A-123", ipAddress: "192.168.1.101", userAgent: "Chrome/120", status: "success" },
                    { id: 6, timestamp: "2026-01-26T02:20:00", userId: 4, userName: "unknown", userRole: "Guest", action: "Login", module: "Auth", description: "Login gagal - password salah", ipAddress: "192.168.1.200", userAgent: "Firefox/115", status: "failed" },
                    { id: 7, timestamp: "2026-01-26T02:15:00", userId: 1, userName: "admin", userRole: "Admin", action: "Delete", module: "Master", description: "Hapus produk simpanan PS-005", ipAddress: "192.168.1.100", userAgent: "Chrome/120", status: "warning" },
                    { id: 8, timestamp: "2026-01-26T02:10:00", userId: 1, userName: "admin", userRole: "Admin", action: "Create", module: "User", description: "Tambah user baru: operator1", ipAddress: "192.168.1.100", userAgent: "Chrome/120", status: "success" },
                    { id: 9, timestamp: "2026-01-26T02:05:00", userId: 2, userName: "Budi Santoso", userRole: "Teller", action: "Create", module: "Angsuran", description: "Bayar angsuran PJ-2026-0012 Rp 2.500.000", ipAddress: "192.168.1.101", userAgent: "Chrome/120", status: "success" },
                    { id: 10, timestamp: "2026-01-26T02:00:00", userId: 1, userName: "admin", userRole: "Admin", action: "Logout", module: "Auth", description: "Logout dari sistem", ipAddress: "192.168.1.100", userAgent: "Chrome/120", status: "success" },
                ]);
            } catch (error) {
                console.error("Failed to fetch:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    // Stats
    const stats = React.useMemo(() => {
        const today = new Date().toDateString();
        const todayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === today);
        return {
            totalToday: todayLogs.length,
            successCount: todayLogs.filter(l => l.status === "success").length,
            failedCount: todayLogs.filter(l => l.status === "failed").length,
            uniqueUsers: new Set(todayLogs.map(l => l.userId)).size,
        };
    }, [logs]);

    // Filtered logs
    const filteredLogs = React.useMemo(() => {
        return logs.filter(log => {
            if (filterModule !== "all" && log.module !== filterModule) return false;
            if (filterAction !== "all" && log.action.toLowerCase() !== filterAction) return false;
            if (filterUser && !log.userName.toLowerCase().includes(filterUser.toLowerCase())) return false;
            return true;
        });
    }, [logs, filterModule, filterAction, filterUser]);

    // Get unique modules and actions for filters
    const modules = [...new Set(logs.map(l => l.module))];
    const actions = [...new Set(logs.map(l => l.action.toLowerCase()))];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Audit Log"
                description="Riwayat aktivitas sistem berdasarkan role"
                actions={
                    <ExportButton
                        data={filteredLogs}
                        columns={exportColumns}
                        filename="audit_log"
                        title="Audit Log"
                        subtitle={`Diekspor pada ${new Date().toLocaleString("id-ID")}`}
                    />
                }
            />

            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-primary/10 p-3">
                            <Activity className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Aktivitas Hari Ini</p>
                            <p className="text-2xl font-bold">{stats.totalToday}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30">
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Sukses</p>
                            <p className="text-2xl font-bold text-emerald-600">{stats.successCount}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
                            <XCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Gagal</p>
                            <p className="text-2xl font-bold text-red-600">{stats.failedCount}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                            <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Pengguna Aktif</p>
                            <p className="text-2xl font-bold text-blue-600">{stats.uniqueUsers}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-[200px] max-w-xs">
                            <Input
                                placeholder="Cari pengguna..."
                                value={filterUser}
                                onChange={(e) => setFilterUser(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <Select value={filterModule} onValueChange={setFilterModule}>
                            <SelectTrigger className="w-[150px] h-9">
                                <SelectValue placeholder="Modul" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Modul</SelectItem>
                                {modules.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterAction} onValueChange={setFilterAction}>
                            <SelectTrigger className="w-[150px] h-9">
                                <SelectValue placeholder="Aksi" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Aksi</SelectItem>
                                {actions.map(a => (
                                    <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {(filterModule !== "all" || filterAction !== "all" || filterUser) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setFilterModule("all");
                                    setFilterAction("all");
                                    setFilterUser("");
                                }}
                            >
                                Reset
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

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
                    data={filteredLogs}
                    searchColumn="description"
                    searchPlaceholder="Cari di deskripsi..."
                />
            )}
        </div>
    );
}
