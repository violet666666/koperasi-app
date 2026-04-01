import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/patterns/page-header";
import {
    Building,
    Wallet,
    CreditCard,
    BookOpen,
    Settings,
    Users,
} from "lucide-react";

const masterItems = [
    {
        title: "Produk Simpanan",
        description: "Kelola produk simpanan anggota",
        href: "/master/produk-simpanan",
        icon: Wallet,
        color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    {
        title: "Produk Pinjaman",
        description: "Kelola produk pinjaman anggota",
        href: "/master/produk-pinjaman",
        icon: CreditCard,
        color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    },
    {
        title: "Bagan Akun",
        description: "Kelola bagan akun akuntansi",
        href: "/master/coa",
        icon: BookOpen,
        color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    },
    {
        title: "Pengaturan Umum",
        description: "Konfigurasi sistem PRIMKOPPOL",
        href: "/master/pengaturan",
        icon: Settings,
        color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    },
    {
        title: "Manajemen User",
        description: "Kelola pengguna dan hak akses",
        href: "/master/users",
        icon: Users,
        color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    },
];

export default function MasterDataPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Master Data"
                description="Kelola data dasar sistem PRIMKOPPOL"
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {masterItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link key={item.href} href={item.href}>
                            <Card className="transition-all hover:shadow-md hover:border-primary/50 cursor-pointer h-full">
                                <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                                    <div className={`rounded-lg p-3 ${item.color}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <CardTitle className="text-lg">{item.title}</CardTitle>
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
