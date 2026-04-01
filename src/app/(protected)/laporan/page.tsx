import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/patterns/page-header";
import {
    FileSpreadsheet,
    TrendingUp,
    PieChart,
    Users,
    CreditCard,
    Wallet,
    Building,
    Download,
} from "lucide-react";

const reportItems = [
    {
        title: "Neraca",
        description: "Laporan posisi keuangan PRIMKOPPOL",
        href: "/laporan/neraca",
        icon: FileSpreadsheet,
        color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    },
    {
        title: "Laba Rugi",
        description: "Laporan pendapatan dan beban",
        href: "/laporan/laba-rugi",
        icon: TrendingUp,
        color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    {
        title: "Sisa Hasil Usaha (SHU)",
        description: "Perhitungan dan alokasi SHU anggota",
        href: "/laporan/shu",
        icon: PieChart,
        color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    },
    {
        title: "Rekap Anggota",
        description: "Ringkasan data anggota per cabang",
        href: "/laporan/rekap-anggota",
        icon: Users,
        color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    },
    {
        title: "Rekap Simpanan",
        description: "Ringkasan simpanan per produk dan cabang",
        href: "/laporan/rekap-simpanan",
        icon: Wallet,
        color: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
    },
    {
        title: "Rekap Pinjaman",
        description: "Ringkasan pinjaman aktif dan outstanding",
        href: "/laporan/rekap-pinjaman",
        icon: CreditCard,
        color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
    },
    {
        title: "Kolektibilitas",
        description: "Analisis kualitas pinjaman (NPL)",
        href: "/laporan/kolektibilitas",
        icon: Building,
        color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    },
    {
        title: "Unduh Laporan",
        description: "Export laporan ke Excel/PDF",
        href: "/laporan/unduh",
        icon: Download,
        color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    },
];

export default function LaporanPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Laporan"
                description="Akses berbagai laporan keuangan dan operasional PRIMKOPPOL"
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {reportItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link key={item.href} href={item.href}>
                            <Card className="transition-all hover:shadow-md hover:border-primary/50 cursor-pointer h-full">
                                <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                                    <div className={`rounded-lg p-3 ${item.color}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <CardTitle className="text-base">{item.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">{item.description}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
