"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
    Bell,
    Menu,
    Search,
    User,
    Settings,
    LogOut,

    ChevronRight,
    Home,
} from "lucide-react";
import type { User as UserType } from "@/types";

interface TopbarProps {
    user?: UserType | null;
    onMenuClick?: () => void;
    onLogout?: () => void;
    pendingApprovals?: number;
    className?: string;
}

export function Topbar({
    user,
    onMenuClick,
    onLogout,
    pendingApprovals = 0,
    className,
}: TopbarProps) {
    const pathname = usePathname();
    const breadcrumbs = generateBreadcrumbs(pathname);

    return (
        <header
            className={cn(
                "sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6 print:hidden",
                className
            )}
        >
            {/* Mobile menu button */}
            <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={onMenuClick}
            >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
            </Button>

            {/* Breadcrumbs */}
            <nav className="hidden flex-1 items-center space-x-1 text-sm lg:flex">
                <Link
                    href="/dashboard"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Home className="h-4 w-4" />
                </Link>
                {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.href}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        {index === breadcrumbs.length - 1 ? (
                            <span className="font-medium text-foreground">{crumb.label}</span>
                        ) : (
                            <Link
                                href={crumb.href}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {crumb.label}
                            </Link>
                        )}
                    </React.Fragment>
                ))}
            </nav>

            {/* Mobile spacer to push items to the right */}
            <div className="flex-1 lg:hidden" />

            {/* Search */}
            <Button variant="ghost" size="icon" className="hidden sm:flex">
                <Search className="h-5 w-5" />
                <span className="sr-only">Search</span>
            </Button>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {pendingApprovals > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                        {pendingApprovals > 9 ? "9+" : pendingApprovals}
                    </span>
                )}
                <span className="sr-only">Notifications</span>
            </Button>

            {/* User Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src="" alt={user?.name || "User"} />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                                {getInitials(user?.name || "U")}
                            </AvatarFallback>
                        </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium">{user?.name || "User"}</p>
                            <p className="text-xs text-muted-foreground">
                                {user?.email || "user@email.com"}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                                {user?.role?.display_name || user?.role?.name || "User"}
                            </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link href="/profil">
                            <User className="mr-2 h-4 w-4" />
                            Profil Saya
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/settings">
                            <Settings className="mr-2 h-4 w-4" />
                            Pengaturan
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive cursor-pointer"
                        onClick={onLogout}
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Keluar
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}

// Helper function to get user initials
function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

// Helper function to generate breadcrumbs from pathname
function generateBreadcrumbs(pathname: string): { label: string; href: string }[] {
    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs: { label: string; href: string }[] = [];

    const labelMap: Record<string, string> = {
        dashboard: "Dashboard",
        anggota: "Anggota",
        simpanan: "Simpanan",
        pinjaman: "Pinjaman",
        "kas-bank": "Kas & Bank",
        "non-sp": "Non Simpan Pinjam",
        aset: "Aset",
        jurnal: "Jurnal",
        laporan: "Laporan",
        approval: "Approval",
        master: "Master Data",
        users: "User Management",
        settings: "Pengaturan",
        tambah: "Tambah",
        edit: "Edit",
        transaksi: "Transaksi",
        rekap: "Rekap",
        pengajuan: "Pengajuan",
        angsuran: "Angsuran",
        jadwal: "Jadwal",
        kas: "Kas",
        bank: "Bank",
        transfer: "Transfer",
        penerimaan: "Penerimaan",
        pengeluaran: "Pengeluaran",
        penyusutan: "Penyusutan",
        "buku-besar": "Buku Besar",
        umum: "Jurnal Umum",
        penyesuaian: "Penyesuaian",
        neraca: "Neraca",
        "laba-rugi": "Laba Rugi",
        shu: "SHU",

        "produk-simpanan": "Produk Simpanan",
        "produk-pinjaman": "Produk Pinjaman",
        coa: "Bagan Akun",
        "mapping-jurnal": "Mapping Jurnal",
        "parameter-shu": "Parameter SHU",
        "saldo-awal": "Saldo Awal",
        "profil-koperasi": "Profil Koperasi",
        "tutup-buku": "Tutup Buku",
        kartu: "Kartu Anggota",
        buku: "Buku Anggota",
    };

    let currentPath = "";
    for (const segment of segments) {
        currentPath += `/${segment}`;
        const label = labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
        breadcrumbs.push({ label, href: currentPath });
    }

    return breadcrumbs;
}
