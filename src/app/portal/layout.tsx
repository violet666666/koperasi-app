"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    WalletCards,
    PiggyBank,
    CreditCard,
    UserCircle,
    LogOut,
    Menu,
    Send,
    Receipt,
    FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { AuthProvider, useAuth, useRequireAuth } from "@/lib/hooks/use-auth";
import { Loader2 } from "lucide-react";

const portalNavLinks = [
    { title: "Beranda", href: "/portal/dashboard", icon: LayoutDashboard },
    { title: "Transaksi", href: "/portal/transaksi", icon: WalletCards },
    { title: "Simpanan", href: "/portal/simpanan", icon: PiggyBank },
    { title: "Pinjaman", href: "/portal/pinjaman", icon: CreditCard },
    { title: "Gaji", href: "/portal/gaji", icon: Receipt },
    { title: "Faktur", href: "/portal/faktur", icon: FileText },
    { title: "Pengajuan", href: "/portal/pengajuan-pinjaman", icon: Send },
    { title: "Profil", href: "/portal/profil", icon: UserCircle },
];

function PortalContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const { isAuthenticated, isLoading } = useRequireAuth("/login");

    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground font-medium">Memuat portal anggota...</p>
                </div>
            </div>
        );
    }

    return (
        <AuthProvider>
            <div className="flex min-h-[100dvh] flex-col bg-slate-50/50">
                {/* Top Navigation Bar */}
                <header className="sticky top-0 z-40 w-full border-b bg-primary shadow-sm text-primary-foreground">
                    <div className="container flex h-16 items-center justify-between px-4 sm:px-6">
                        {/* Logo & Mobile Menu */}
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="md:hidden text-white hover:bg-white/20"
                                onClick={() => setMobileMenuOpen(true)}
                            >
                                <Menu className="h-6 w-6" />
                            </Button>
                            <Link href="/portal/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tight">
                                <div className="flex h-12 w-12 items-center justify-center bg-white/10 p-1 rounded-lg shrink-0">
                                    <img src="/LogoPrimkoppol.png" alt="Logo" className="h-full w-full object-contain drop-shadow-sm" />
                                </div>
                                <span className="hidden sm:inline-block">PRIMKOPPOL<span className="text-white/70">.</span>Digital</span>
                            </Link>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center space-x-1">
                            {portalNavLinks.map((link) => {
                                const Icon = link.icon;
                                const isActive = pathname.startsWith(link.href);
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-white text-primary"
                                                : "text-white/80 hover:bg-white/10 hover:text-white"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {link.title}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* User Menu */}
                        <div className="flex items-center">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="flex items-center gap-2 px-2 text-white hover:bg-white/20 hover:text-white rounded-full">
                                        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center font-semibold border border-white/30">
                                            {user?.name?.charAt(0) || "U"}
                                        </div>
                                        <span className="hidden sm:inline-block font-medium">
                                            Hai, {user?.name?.split(' ')[0] || "Anggota"}
                                        </span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <div className="flex flex-col space-y-1 p-2">
                                        <p className="text-sm font-medium leading-none">{user?.name}</p>
                                        <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                                    </div>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => logout()}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Keluar
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </header>

                {/* Mobile Navigation Sheet */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
                        <VisuallyHidden>
                            <SheetTitle>Menu Navigasi Mobile</SheetTitle>
                        </VisuallyHidden>
                        <div className="flex flex-col h-full bg-slate-950 text-white">
                            <div className="p-6 border-b border-white/10 flex items-center gap-3">
                                <div className="flex h-14 w-14 items-center justify-center bg-white/10 p-1 rounded-xl shrink-0">
                                    <img src="/LogoPrimkoppol.png" alt="Logo" className="h-full w-full object-contain drop-shadow-sm" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">PRIMKOPPOL<span className="text-primary">.</span>Digital</h2>
                                    <p className="text-white/60 text-xs mt-0.5">Portal Anggota</p>
                                </div>
                            </div>
                            <nav className="flex-1 overflow-y-auto py-4">
                                <ul className="space-y-1 px-3">
                                    {portalNavLinks.map((link) => {
                                        const Icon = link.icon;
                                        const isActive = pathname.startsWith(link.href);
                                        return (
                                            <li key={link.href}>
                                                <Link
                                                    href={link.href}
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className={cn(
                                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                                                        isActive
                                                            ? "bg-primary text-primary-foreground font-semibold"
                                                            : "text-white/70 hover:bg-white/5 hover:text-white"
                                                    )}
                                                >
                                                    <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-white/50")} />
                                                    {link.title}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </nav>
                            <div className="p-4 border-t border-white/10">
                                <Button variant="ghost" className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={() => logout()}>
                                    <LogOut className="mr-3 h-5 w-5" />
                                    Keluar
                                </Button>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>

                {/* Main Content */}
                <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
                    {children}
                </main>
            </div>
        </AuthProvider>
    );
}

export default function PortalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <PortalContent>{children}</PortalContent>
        </AuthProvider>
    );
}
