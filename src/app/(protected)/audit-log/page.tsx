"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/patterns/page-header";
import { DataTable } from "@/components/patterns/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    Activity, User, Filter, CheckCircle, XCircle, AlertCircle,
    Edit, Plus, Trash2, Eye, LogIn, LogOut, Download, Shield,
    FileText, Search, Globe, Monitor, Clock, Hash,
} from "lucide-react";

interface AuditLog {
    id: number; timestamp: string;
    userId: number | null; userName: string; userEmail: string | null; userRole: string;
    sessionId: string | null;
    action: string; module: string; description: string;
    targetId: string | null; targetType: string | null;
    oldData: string | null; newData: string | null;
    ipAddress: string | null; userAgent: string | null;
    requestMethod: string | null; requestUrl: string | null;
    status: string; errorMessage: string | null;
    duration: number | null; metadata: string | null;
    unitType: string | null;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }

const actionIcons: Record<string, React.ReactNode> = {
    CREATE: <Plus className="h-3 w-3" />, UPDATE: <Edit className="h-3 w-3" />,
    DELETE: <Trash2 className="h-3 w-3" />, VIEW: <Eye className="h-3 w-3" />,
    LOGIN: <LogIn className="h-3 w-3" />, LOGOUT: <LogOut className="h-3 w-3" />,
    LOGIN_FAILED: <XCircle className="h-3 w-3" />,
    APPROVE: <CheckCircle className="h-3 w-3" />, REJECT: <XCircle className="h-3 w-3" />,
    IMPORT: <FileText className="h-3 w-3" />, EXPORT: <Download className="h-3 w-3" />,
    PASSWORD_CHANGE: <Shield className="h-3 w-3" />,
};

const actionColors: Record<string, string> = {
    CREATE: "bg-emerald-100 text-emerald-700", UPDATE: "bg-blue-100 text-blue-700",
    DELETE: "bg-red-100 text-red-700", LOGIN: "bg-emerald-100 text-emerald-700",
    LOGOUT: "bg-slate-100 text-slate-700", LOGIN_FAILED: "bg-red-100 text-red-700",
    APPROVE: "bg-emerald-100 text-emerald-700", REJECT: "bg-red-100 text-red-700",
    IMPORT: "bg-purple-100 text-purple-700", EXPORT: "bg-amber-100 text-amber-700",
    PASSWORD_CHANGE: "bg-amber-100 text-amber-700",
};

function DetailDialog({ log }: { log: AuditLog }) {
    let oldDataParsed = null;
    let newDataParsed = null;
    let metadataParsed = null;
    try { if (log.oldData) oldDataParsed = JSON.parse(log.oldData); } catch { }
    try { if (log.newData) newDataParsed = JSON.parse(log.newData); } catch { }
    try { if (log.metadata) metadataParsed = JSON.parse(log.metadata); } catch { }

    return (
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" /> Detail Audit Log #{log.id}
                </DialogTitle>
                <DialogDescription>Informasi lengkap aktivitas sistem</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><Label className="text-xs text-muted-foreground">Waktu</Label><p className="font-medium">{new Date(log.timestamp).toLocaleString("id-ID")}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Status</Label>
                        <Badge className={log.status === "success" ? "bg-emerald-100 text-emerald-700" : log.status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>{log.status}</Badge>
                    </div>
                </div>
                <Separator />
                <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Pengguna</Label>
                    <p className="font-medium">{log.userName} {log.userEmail && <span className="text-sm text-muted-foreground">({log.userEmail})</span>}</p>
                    <p className="text-sm text-muted-foreground">Role: {log.userRole}</p>
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> Aksi</Label>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge className={actionColors[log.action] || "bg-slate-100 text-slate-700"}>{log.action}</Badge>
                        <Badge variant="outline">{log.module}</Badge>
                    </div>
                    <p className="mt-1 text-sm">{log.description}</p>
                </div>
                {(log.targetId || log.targetType) && (
                    <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" /> Target</Label>
                        <p className="text-sm">{log.targetType} #{log.targetId}</p>
                    </div>
                )}
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> IP Address</Label>
                        <p className="font-mono text-sm">{log.ipAddress || "-"}</p>
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Request</Label>
                        <p className="font-mono text-sm">{log.requestMethod || "-"}</p>
                    </div>
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Monitor className="h-3 w-3" /> User Agent</Label>
                    <p className="font-mono text-xs break-all bg-muted p-2 rounded">{log.userAgent || "-"}</p>
                </div>
                {log.requestUrl && (
                    <div>
                        <Label className="text-xs text-muted-foreground">Request URL</Label>
                        <p className="font-mono text-xs break-all bg-muted p-2 rounded">{log.requestUrl}</p>
                    </div>
                )}
                {log.errorMessage && (
                    <div>
                        <Label className="text-xs text-muted-foreground text-red-600">Error</Label>
                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{log.errorMessage}</p>
                    </div>
                )}
                {(oldDataParsed || newDataParsed) && (
                    <>
                        <Separator />
                        <div>
                            <Label className="text-xs text-muted-foreground">Data Changes</Label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {oldDataParsed && (
                                    <div>
                                        <p className="text-xs font-medium text-red-600 mb-1">Before</p>
                                        <pre className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-auto max-h-48">{JSON.stringify(oldDataParsed, null, 2)}</pre>
                                    </div>
                                )}
                                {newDataParsed && (
                                    <div>
                                        <p className="text-xs font-medium text-emerald-600 mb-1">After</p>
                                        <pre className="text-xs bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded overflow-auto max-h-48">{JSON.stringify(newDataParsed, null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
                {metadataParsed && (
                    <div>
                        <Label className="text-xs text-muted-foreground">Metadata Tambahan</Label>
                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">{JSON.stringify(metadataParsed, null, 2)}</pre>
                    </div>
                )}
            </div>
        </DialogContent>
    );
}

export default function AuditLogPage() {
    const [logs, setLogs] = React.useState<AuditLog[]>([]);
    const [pagination, setPagination] = React.useState<Pagination>({ page: 1, limit: 200, total: 0, totalPages: 0 });
    const [isLoading, setIsLoading] = React.useState(true);

    // Filters
    const [filterModule, setFilterModule] = React.useState<string>("all");
    const [filterAction, setFilterAction] = React.useState<string>("all");
    const [filterStatus, setFilterStatus] = React.useState<string>("all");
    const [searchQuery, setSearchQuery] = React.useState<string>("");
    const [dateFrom, setDateFrom] = React.useState<string>("");
    const [dateTo, setDateTo] = React.useState<string>("");
    const [filterUnitType, setFilterUnitType] = React.useState<string>("all");
    const [filterUserRole, setFilterUserRole] = React.useState<string>("all");
    const [selectedLog, setSelectedLog] = React.useState<AuditLog | null>(null);

    const fetchLogs = React.useCallback(async (page = 1) => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "200" });
            if (filterModule !== "all") params.set("module", filterModule);
            if (filterAction !== "all") params.set("action", filterAction);
            if (filterStatus !== "all") params.set("status", filterStatus);
            if (searchQuery) params.set("search", searchQuery);
            if (dateFrom) params.set("dateFrom", dateFrom);
            if (dateTo) params.set("dateTo", dateTo);
            if (filterUnitType !== "all") params.set("unitType", filterUnitType);
            if (filterUserRole !== "all") params.set("userRole", filterUserRole);

            const res = await fetch(`/api/audit-logs?${params}`);
            if (!res.ok) throw new Error("Failed");
            const json = await res.json();
            setLogs(json.data || []);
            setPagination(json.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
        } catch (error) {
            console.error("Failed to fetch audit logs:", error);
            toast.error("Gagal memuat audit log");
        } finally {
            setIsLoading(false);
        }
    }, [filterModule, filterAction, filterStatus, searchQuery, dateFrom, dateTo, filterUnitType, filterUserRole]);

    React.useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const stats = React.useMemo(() => {
        const today = new Date().toDateString();
        const todayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === today);
        return {
            totalToday: todayLogs.length,
            totalAll: pagination.total,
            successCount: todayLogs.filter(l => l.status === "success").length,
            failedCount: todayLogs.filter(l => l.status === "failed").length,
            loginAttempts: todayLogs.filter(l => ["LOGIN", "LOGIN_FAILED"].includes(l.action)).length,
        };
    }, [logs, pagination.total]);

    const MODULES = ["Auth", "Anggota", "Simpanan", "Pinjaman", "Toko", "Jurnal", "Kas", "Aset", "Laporan", "Master", "User", "Pengumuman", "System", "Period", "Tabungan_Sejahtera", "Loan_Migrasi", "Unit_Layanan", "Payroll"];
    const ACTIONS = ["LOGIN", "LOGOUT", "LOGIN_FAILED", "CREATE", "UPDATE", "DELETE", "VIEW", "EXPORT", "APPROVE", "REJECT", "IMPORT", "PASSWORD_CHANGE"];
    const UNIT_TYPES = ["toko", "cuci_mobil", "barbershop", "play_station", "fitness", "coffe_latar", "resto_cafe", "resto", "laundry", "simpan_pinjam", "cafe_lsp", "fotocopy", "aset"];
    const USER_ROLES = ["operator", "admin", "admin_sp", "admin_unit", "kasir", "anggota"];

    const columns: ColumnDef<AuditLog>[] = [
        {
            accessorKey: "timestamp", header: "Waktu",
            cell: ({ row }) => {
                const d = new Date(row.getValue("timestamp"));
                return <div className="flex flex-col"><span className="text-sm font-medium">{d.toLocaleDateString("id-ID")}</span><span className="text-xs text-muted-foreground">{d.toLocaleTimeString("id-ID")}</span></div>;
            },
        },
        {
            accessorKey: "userName", header: "Pengguna",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="rounded-full bg-primary/10 p-1.5"><User className="h-3 w-3 text-primary" /></div>
                    <div>
                        <span className="font-medium text-sm">{row.getValue("userName")}</span>
                        <Badge variant="outline" className="ml-1 text-xs">{row.original.userRole}</Badge>
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "action", header: "Aksi",
            cell: ({ row }) => {
                const action = row.getValue("action") as string;
                const icon = actionIcons[action] || <Activity className="h-3 w-3" />;
                return <Badge className={`gap-1 ${actionColors[action] || "bg-slate-100 text-slate-700"}`}>{icon}{action}</Badge>;
            },
        },
        {
            accessorKey: "module", header: "Modul",
            cell: ({ row }) => <Badge variant="secondary">{row.getValue("module")}</Badge>,
        },
        {
            accessorKey: "unitType", header: "Unit",
            cell: ({ row }) => {
                const ut = row.getValue("unitType") as string | null;
                return ut ? <Badge variant="outline" className="text-xs">{ut.replace(/_/g, " ")}</Badge> : <span className="text-muted-foreground text-xs">-</span>;
            },
        },
        {
            accessorKey: "description", header: "Deskripsi",
            cell: ({ row }) => <span className="text-sm max-w-[250px] truncate block">{row.getValue("description")}</span>,
        },
        {
            accessorKey: "ipAddress", header: "IP Address",
            cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("ipAddress") || "-"}</span>,
        },
        {
            accessorKey: "status", header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                const icons: Record<string, React.ReactNode> = {
                    success: <CheckCircle className="h-3 w-3" />,
                    failed: <XCircle className="h-3 w-3" />,
                    warning: <AlertCircle className="h-3 w-3" />,
                };
                const colors: Record<string, string> = {
                    success: "bg-emerald-100 text-emerald-700",
                    failed: "bg-red-100 text-red-700",
                    warning: "bg-amber-100 text-amber-700",
                };
                return <Badge className={`gap-1 ${colors[status] || ""}`}>{icons[status]}{status}</Badge>;
            },
        },
        {
            id: "actions", header: "",
            cell: ({ row }) => (
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(row.original)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DetailDialog log={row.original} />
                </Dialog>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader title="Audit Log" description="Riwayat aktivitas sistem — Keamanan & Compliance"
                actions={
                    <Badge variant="outline" className="gap-1 text-sm">
                        <Shield className="h-4 w-4" /> {pagination.total.toLocaleString()} Total Records
                    </Badge>
                }
            />

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-primary/10 p-3"><Activity className="h-5 w-5 text-primary" /></div><div><p className="text-xs text-muted-foreground">Total Records</p><p className="text-2xl font-bold">{pagination.total.toLocaleString()}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30"><Clock className="h-5 w-5 text-blue-600" /></div><div><p className="text-xs text-muted-foreground">Hari Ini</p><p className="text-2xl font-bold">{stats.totalToday}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-emerald-100 p-3 dark:bg-emerald-900/30"><CheckCircle className="h-5 w-5 text-emerald-600" /></div><div><p className="text-xs text-muted-foreground">Sukses</p><p className="text-2xl font-bold text-emerald-600">{stats.successCount}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-red-100 p-3 dark:bg-red-900/30"><XCircle className="h-5 w-5 text-red-600" /></div><div><p className="text-xs text-muted-foreground">Gagal</p><p className="text-2xl font-bold text-red-600">{stats.failedCount}</p></div></CardContent></Card>
                <Card><CardContent className="flex items-center gap-4 p-4"><div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30"><LogIn className="h-5 w-5 text-amber-600" /></div><div><p className="text-xs text-muted-foreground">Login Attempts</p><p className="text-2xl font-bold text-amber-600">{stats.loginAttempts}</p></div></CardContent></Card>
            </div>

            <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" /> Filter & Pencarian</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-6">
                        <div className="space-y-1">
                            <Label className="text-xs">Cari</Label>
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Cari user, deskripsi, IP..." value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)} className="pl-8" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Modul</Label>
                            <Select value={filterModule} onValueChange={setFilterModule}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="all">Semua Modul</SelectItem>{MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Aksi</Label>
                            <Select value={filterAction} onValueChange={setFilterAction}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="all">Semua Aksi</SelectItem>{ACTIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Status</Label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua</SelectItem>
                                    <SelectItem value="success">Sukses</SelectItem>
                                    <SelectItem value="failed">Gagal</SelectItem>
                                    <SelectItem value="warning">Warning</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Unit</Label>
                            <Select value={filterUnitType} onValueChange={setFilterUnitType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Unit</SelectItem>
                                    {UNIT_TYPES.map(u => <SelectItem key={u} value={u}>{u.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Role</Label>
                            <Select value={filterUserRole} onValueChange={setFilterUserRole}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Role</SelectItem>
                                    {USER_ROLES.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 mt-4">
                        <div className="space-y-1">
                            <Label className="text-xs">Dari Tanggal</Label>
                            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Sampai Tanggal</Label>
                            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                        </div>
                        <div className="flex items-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                                setFilterModule("all"); setFilterAction("all"); setFilterStatus("all");
                                setSearchQuery(""); setDateFrom(""); setDateTo("");
                                setFilterUnitType("all"); setFilterUserRole("all");
                            }}>Reset Filter</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <Card><CardContent className="p-6 space-y-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
            ) : (
                <>
                    <DataTable columns={columns} data={logs} searchColumn="description" searchPlaceholder="Cari di deskripsi..." />
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Halaman {pagination.page} dari {pagination.totalPages} ({pagination.total.toLocaleString()} records)
                            </p>
                            <div className="flex gap-1">
                                <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                                    onClick={() => fetchLogs(1)}>Awal</Button>
                                <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                                    onClick={() => fetchLogs(pagination.page - 1)}>Sebelumnya</Button>
                                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                    const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4));
                                    const p = start + i;
                                    if (p > pagination.totalPages) return null;
                                    return (
                                        <Button key={p} variant={p === pagination.page ? "default" : "outline"} size="sm"
                                            onClick={() => fetchLogs(p)}>{p}</Button>
                                    );
                                })}
                                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => fetchLogs(pagination.page + 1)}>Selanjutnya</Button>
                                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => fetchLogs(pagination.totalPages)}>Akhir</Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
