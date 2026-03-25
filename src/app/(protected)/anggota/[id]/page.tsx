"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Pencil,
    Wallet,
    CreditCard,
    FileText,
    Phone,
    Mail,
    MapPin,
    Calendar,
    Building,
    User,
    Banknote,
    Award,
} from "lucide-react";
import type { Member } from "@/types";

// Defining MemberSummary here since it seems to be missing from @types
interface MemberSummary {
    member_id: number;
    member_no: string;
    name: string;
    savings: {
        total: number;
        by_type: any[];
    };
    loans: {
        active_count: number;
        total_outstanding: number;
        total_principal_outstanding: number;
        total_interest_outstanding: number;
        next_installment?: any;
        overdue_amount: number;
        overdue_days: number;
    };
    net_position: number;
    estimasi_shu: number;
}
import { formatCurrency, MEMBER_STATUS } from "@/lib/constants";
import { membersApi } from "@/lib/api/services";

// Mock data
const MOCK_MEMBER: Member = {
    id: 1,
    member_no: "A-001",
    branch_id: 1,
    branch: { id: 1, code: "PST", name: "Kantor Pusat", is_head_office: true, is_active: true },
    name: "Budi Santoso",
    nik: "3201234567890001",
    gender: "male",
    birth_date: "1985-05-15",
    birth_place: "Jakarta",
    marital_status: "married",
    phone: "08123456789",
    email: "budi@email.com",
    address: "Jl. Mawar No. 10, RT 001/RW 002, Kelurahan Menteng",
    city: "Jakarta Pusat",
    province: "DKI Jakarta",
    join_date: "2024-01-15",
    status: "active",
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-06-20T14:30:00Z",
};

const MOCK_SUMMARY: MemberSummary = {
    member_id: 1,
    member_no: "A-001",
    name: "Budi Santoso",
    savings: {
        total: 5000000,
        by_type: [
            { type: "pokok", name: "Simpanan Pokok", balance: 100000 },
            { type: "wajib", name: "Simpanan Wajib", balance: 1200000 },
            { type: "sukarela", name: "Simpanan Sukarela", balance: 3700000 },
        ],
    },
    loans: {
        active_count: 1,
        total_outstanding: 8500000,
        total_principal_outstanding: 7500000,
        total_interest_outstanding: 1000000,
        next_installment: {
            loan_id: 1,
            due_date: "2025-02-01",
            amount: 950000,
        },
        overdue_amount: 0,
        overdue_days: 0,
    },
    net_position: -3500000,
    estimasi_shu: 1500000,
};

// Info item component
function InfoItem({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ElementType;
    label: string;
    value: string | React.ReactNode;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-0.5">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-medium">{value}</p>
            </div>
        </div>
    );
}

// Summary card component
function SummaryCard({
    title,
    value,
    subtitle,
    icon: Icon,
    color = "primary",
}: {
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ElementType;
    color?: "primary" | "success" | "danger" | "warning";
}) {
    const colorClasses = {
        primary: "bg-primary/10 text-primary",
        success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
        danger: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
        warning: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    };

    return (
        <Card>
            <CardContent className="flex items-center gap-4 p-4">
                <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="text-xl font-bold tabular-nums">{value}</p>
                    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

export default function AnggotaDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(true);
    const [member, setMember] = React.useState<Member | null>(null);
    const [summary, setSummary] = React.useState<MemberSummary | null>(null);

    // Data loading
    React.useEffect(() => {
        if (!params.id) return;

        async function fetchData() {
            setIsLoading(true);
            try {
                // Fetch member detail
                const response = await membersApi.get(Number(params.id));
                const apiData = (response.data as any).data || response.data;

                // Map API camelCase to frontend snake_case
                const memberData: Member = {
                    id: apiData.id,
                    member_no: apiData.memberNo || apiData.member_no,
                    branch_id: apiData.branchId || apiData.branch_id,
                    branch: apiData.branch,
                    name: apiData.name,
                    nik: apiData.nik,
                    gender: apiData.gender,
                    birth_date: apiData.birthDate || apiData.birth_date,
                    birth_place: apiData.birthPlace || apiData.birth_place,
                    marital_status: apiData.maritalStatus || apiData.marital_status,
                    phone: apiData.phone,
                    email: apiData.email,
                    address: apiData.address,
                    city: apiData.city,
                    province: apiData.province,
                    join_date: apiData.joinDate || apiData.join_date,
                    status: apiData.status,
                    created_at: apiData.createdAt || apiData.created_at,
                    updated_at: apiData.updatedAt || apiData.updated_at,
                    salary: apiData.salary ? Number(apiData.salary) : undefined,
                    tunles_kinerja: apiData.tunlesKinerja ? Number(apiData.tunlesKinerja) : undefined,
                };
                setMember(memberData);

                // Construct summary object (placeholder until summary endpoint exists)
                setSummary({
                    member_id: memberData.id,
                    member_no: memberData.member_no,
                    name: memberData.name,
                    savings: {
                        total: 0,
                        by_type: []
                    },
                    loans: {
                        active_count: 0,
                        total_outstanding: 0,
                        total_principal_outstanding: 0,
                        total_interest_outstanding: 0,
                        overdue_amount: 0,
                        overdue_days: 0
                    },
                    net_position: 0,
                    estimasi_shu: 1500000,
                });

            } catch (error) {
                console.error("Failed to fetch member:", error);
                setMember(null);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [params.id]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-48" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        );
    }

    if (!member || !summary) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Anggota tidak ditemukan</p>
                <Button variant="link" asChild>
                    <Link href="/anggota">Kembali ke daftar anggota</Link>
                </Button>
            </div>
        );
    }

    const statusConfig = MEMBER_STATUS[member.status];

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title={member.name}
                description={`NRP: ${member.member_no}`}
                backHref="/anggota"
                actions={
                    <Button asChild>
                        <Link href={`/anggota/${member.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </Link>
                    </Button>
                }
            />

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                    title="Total Simpanan"
                    value={formatCurrency(summary.savings.total)}
                    icon={Wallet}
                    color="success"
                />
                <SummaryCard
                    title="Pinjaman Aktif"
                    value={formatCurrency(summary.loans.total_outstanding)}
                    subtitle={`${summary.loans.active_count} pinjaman`}
                    icon={CreditCard}
                    color="primary"
                />
                <SummaryCard
                    title="Angsuran Berikutnya"
                    value={summary.loans.next_installment ? formatCurrency(summary.loans.next_installment.amount) : "-"}
                    subtitle={summary.loans.next_installment ? new Date(summary.loans.next_installment.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : undefined}
                    icon={Calendar}
                    color="warning"
                />
                <SummaryCard
                    title="Tunggakan"
                    value={formatCurrency(summary.loans.overdue_amount)}
                    subtitle={summary.loans.overdue_days > 0 ? `${summary.loans.overdue_days} hari` : "Tidak ada"}
                    icon={FileText}
                    color={summary.loans.overdue_amount > 0 ? "danger" : "success"}
                />
                <SummaryCard
                    title="Estimasi SHU"
                    value={formatCurrency(summary.estimasi_shu)}
                    subtitle="Tahun Berjalan"
                    icon={Wallet}
                    color="primary"
                />
            </div>

            {/* Tabs */}
            <Tabs defaultValue="profil" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="profil">Profil</TabsTrigger>
                    <TabsTrigger value="simpanan">Simpanan</TabsTrigger>
                    <TabsTrigger value="pinjaman">Pinjaman</TabsTrigger>
                    <TabsTrigger value="transaksi">Transaksi</TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profil" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Informasi Pribadi</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-6 md:flex-row">
                                {/* Avatar */}
                                <div className="flex flex-col items-center gap-3">
                                    <Avatar className="h-32 w-32">
                                        <AvatarImage src={member.photo_url} alt={member.name} />
                                        <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                                            {member.name
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")
                                                .slice(0, 2)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <Badge variant={statusConfig.color === "success" ? "default" : "secondary"}>
                                        {statusConfig.label}
                                    </Badge>
                                </div>

                                {/* Info Grid */}
                                <div className="flex-1 grid gap-4 sm:grid-cols-2">
                                    <InfoItem icon={User} label="NIK" value={member.nik || "-"} />
                                    <InfoItem
                                        icon={Calendar}
                                        label="Tanggal Lahir"
                                        value={
                                            member.birth_date
                                                ? `${member.birth_place}, ${new Date(member.birth_date).toLocaleDateString("id-ID")}`
                                                : "-"
                                        }
                                    />
                                    <InfoItem
                                        icon={User}
                                        label="Jenis Kelamin"
                                        value={member.gender === "male" ? "Laki-laki" : "Perempuan"}
                                    />
                                    <InfoItem
                                        icon={User}
                                        label="Status Pernikahan"
                                        value={
                                            member.marital_status === "married"
                                                ? "Menikah"
                                                : member.marital_status === "single"
                                                    ? "Belum Menikah"
                                                    : member.marital_status || "-"
                                        }
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Kontak & Alamat</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <InfoItem icon={Phone} label="No. Telepon" value={member.phone || "-"} />
                            <InfoItem icon={Mail} label="Email" value={member.email || "-"} />
                            <div className="sm:col-span-2">
                                <InfoItem icon={MapPin} label="Alamat" value={member.address || "-"} />
                            </div>
                            <InfoItem icon={MapPin} label="Kota" value={member.city || "-"} />
                            <InfoItem icon={MapPin} label="Provinsi" value={member.province || "-"} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Keanggotaan</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <InfoItem icon={Building} label="Cabang" value={member.branch?.name || "-"} />
                            <InfoItem
                                icon={Calendar}
                                label="Tanggal Bergabung"
                                value={new Date(member.join_date).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                })}
                            />
                            <InfoItem
                                icon={Banknote}
                                label="Gaji Bersih"
                                value={member.salary ? formatCurrency(member.salary) : "-"}
                            />
                            <InfoItem
                                icon={Award}
                                label="Tunjangan Kinerja (Tunkin)"
                                value={member.tunles_kinerja ? formatCurrency(member.tunles_kinerja) : "-"}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Savings Tab */}
                <TabsContent value="simpanan" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Rincian Simpanan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {summary.savings.by_type.map((saving) => (
                                    <div
                                        key={saving.type}
                                        className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                                    >
                                        <div>
                                            <p className="font-medium">{saving.name}</p>
                                            <p className="text-sm text-muted-foreground capitalize">{saving.type}</p>
                                        </div>
                                        <p className="text-lg font-bold tabular-nums">
                                            {formatCurrency(saving.balance)}
                                        </p>
                                    </div>
                                ))}
                                <Separator />
                                <div className="flex items-center justify-between pt-2">
                                    <p className="font-semibold">Total Simpanan</p>
                                    <p className="text-xl font-bold text-emerald-600 tabular-nums">
                                        {formatCurrency(summary.savings.total)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" asChild>
                            <Link href={`/simpanan/transaksi/tambah?member_id=${member.id}`}>
                                Setor Simpanan
                            </Link>
                        </Button>
                    </div>
                </TabsContent>

                {/* Loans Tab */}
                <TabsContent value="pinjaman" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Pinjaman Aktif</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {summary.loans.active_count > 0 ? (
                                <div className="space-y-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Sisa Pokok</p>
                                            <p className="text-lg font-bold tabular-nums">
                                                {formatCurrency(summary.loans.total_principal_outstanding)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">Sisa Bunga</p>
                                            <p className="text-lg font-bold tabular-nums">
                                                {formatCurrency(summary.loans.total_interest_outstanding)}
                                            </p>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div className="flex items-center justify-between">
                                        <p className="font-semibold">Total Kewajiban</p>
                                        <p className="text-xl font-bold text-primary tabular-nums">
                                            {formatCurrency(summary.loans.total_outstanding)}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    Tidak ada pinjaman aktif
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" asChild>
                            <Link href={`/pinjaman/pengajuan/tambah?member_id=${member.id}`}>
                                Ajukan Pinjaman
                            </Link>
                        </Button>
                        {summary.loans.active_count > 0 && (
                            <Button asChild>
                                <Link href={`/pinjaman/angsuran/bayar?member_id=${member.id}`}>
                                    Bayar Angsuran
                                </Link>
                            </Button>
                        )}
                    </div>
                </TabsContent>

                {/* Transactions Tab */}
                <TabsContent value="transaksi">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Riwayat Transaksi</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-center text-muted-foreground py-8">
                                Lihat riwayat transaksi lengkap di{" "}
                                <Link href={`/anggota/buku/${member.id}`} className="text-primary hover:underline">
                                    Buku Anggota
                                </Link>
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
