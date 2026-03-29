"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/hooks";
import { AppShell } from "@/components/layout";
import { ErrorBoundary } from "@/components/patterns/error-boundary";
import { toast } from "sonner";

// Map unit types to their allowed route prefixes
const UNIT_ROUTES: Record<string, string[]> = {
    simpan_pinjam: ["/simpanan", "/pinjaman", "/anggota", "/dashboard"],
    toko: ["/toko", "/dashboard"],
    fitness: ["/transaksi-unit", "/dashboard"],
    cuci_mobil: ["/transaksi-unit", "/dashboard"],
    fotocopy: ["/transaksi-unit", "/dashboard"],
    laundry: ["/transaksi-unit", "/dashboard"],
    resto_cafe: ["/transaksi-unit", "/dashboard"],
    playstation: ["/transaksi-unit", "/dashboard"],
    barbershop: ["/transaksi-unit", "/dashboard"],
    aset: ["/transaksi-unit", "/dashboard"],
};

// Routes always accessible to any logged-in user
const COMMON_ROUTES = ["/dashboard", "/profil", "/settings", "/pengumuman"];

function ProtectedContent({ children }: { children: React.ReactNode }) {
    const { user, logout, isLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    // Unit-based route guard for Admin/Kasir
    useEffect(() => {
        if (isLoading || !user) return;

        // Operator (manage_all) can access everything
        if (user.permissions.includes("manage_all")) return;

        // Anggota doesn't use protected routes (they use /portal)
        if (user.role.name === "anggota") return;

        // Admin/Kasir: check if route is allowed for their unit
        const unitType = (user as any).unitType;
        if (unitType && UNIT_ROUTES[unitType]) {
            const allowedPrefixes = [...UNIT_ROUTES[unitType], ...COMMON_ROUTES];
            const isAllowed = allowedPrefixes.some(prefix => pathname.startsWith(prefix));

            if (!isAllowed) {
                toast.error("Anda tidak memiliki akses ke halaman ini");
                router.replace("/dashboard");
            }
        }
    }, [pathname, user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <AppShell
                user={user}
                onLogout={logout}
            >
                {children}
            </AppShell>
        </ErrorBoundary>
    );
}

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <ProtectedContent>{children}</ProtectedContent>
        </AuthProvider>
    );
}
