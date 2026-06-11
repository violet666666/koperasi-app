"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/hooks";
import { AppShell } from "@/components/layout";
import { ErrorBoundary } from "@/components/patterns/error-boundary";
import { toast } from "sonner";

// ============================================================
// ROUTE GUARD CONFIG
// Routes accessible by each role+unitType combination.
// COMMON_ROUTES are always accessible to any authenticated user.
// ============================================================

const COMMON_ROUTES = ["/dashboard", "/profil", "/settings", "/pengumuman"];

// Kasir: HANYA kasir pos + riwayat transaksi unit mereka
const KASIR_ALLOWED_ROUTES: Record<string, string[]> = {
    toko:        ["/unit", "/transaksi-unit", "/toko/kasir", "/toko/shift", "/toko/produk"],
    cuci_mobil:  ["/unit", "/transaksi-unit", "/cuci-mobil"],
    resto_cafe:  ["/unit", "/transaksi-unit", "/resto", "/toko/shift"],
    resto:       ["/unit", "/transaksi-unit", "/resto", "/toko/shift"],
    cafe_lsp:    ["/unit", "/transaksi-unit", "/cafe-lsp"],
    fitness:     ["/unit", "/transaksi-unit", "/fitness"],
    playstation: ["/unit", "/transaksi-unit", "/play-station"],
    barbershop:  ["/unit", "/transaksi-unit", "/barbershop"],
    fotocopy:    ["/unit", "/transaksi-unit", "/fotocopy"],
    laundry:     ["/unit", "/transaksi-unit", "/laundry"],
    simpan_pinjam: ["/unit", "/transaksi-unit"],
};

// Admin unit: bisa lihat lebih banyak tapi masih terbatas per unit
const ADMIN_ALLOWED_ROUTES: Record<string, string[]> = {
    simpan_pinjam: [
        "/simpanan", "/pinjaman", "/anggota",
        "/kas-bank", "/non-sp",
        "/unit", "/transaksi-unit",
        "/kwitansi", "/jurnal", "/laporan",
        "/approval",
    ],
    toko: [
        "/toko", "/unit", "/transaksi-unit",
        "/kwitansi", "/approval", "/unit-insight",
    ],
    cuci_mobil:  ["/unit", "/transaksi-unit", "/cuci-mobil", "/approval"],
    resto_cafe:  ["/unit", "/transaksi-unit", "/toko", "/resto", "/approval", "/unit-insight"],
    resto:       ["/unit", "/transaksi-unit", "/toko", "/resto", "/approval", "/unit-insight"],
    cafe_lsp:    ["/unit", "/transaksi-unit", "/toko", "/cafe-lsp", "/approval", "/unit-insight"],
    fitness:     ["/unit", "/transaksi-unit", "/toko/produk", "/fitness", "/approval"],
    playstation: ["/unit", "/transaksi-unit", "/toko/produk", "/play-station", "/approval"],
    barbershop:  ["/unit", "/transaksi-unit", "/toko/produk", "/barbershop", "/approval"],
    fotocopy:    ["/unit", "/transaksi-unit", "/toko/produk", "/fotocopy", "/approval"],
    laundry:     ["/unit", "/transaksi-unit", "/toko/produk", "/laundry", "/approval"],
    aset:        ["/aset", "/unit", "/transaksi-unit", "/approval"],
    haji_umrah:  ["/haji-umrah", "/unit", "/transaksi-unit", "/kwitansi", "/approval"],
};

function isPathAllowed(pathname: string, allowedPrefixes: string[]): boolean {
    return allowedPrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix + "/"));
}

const ADMIN_SP_ALLOWED_ROUTES = [
    "/dashboard", "/profil", "/settings", "/pengumuman",
    "/simpanan", "/pinjaman", "/anggota",
    "/unit", "/transaksi-unit",
    "/kwitansi", "/jurnal", "/laporan",
    "/approval",
];

function ProtectedContent({ children }: { children: React.ReactNode }) {
    const { user, logout, isLoading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (isLoading || !user) return;

        const roleName = typeof user?.role === "string" ? user.role : (user?.role as any)?.name || "";
        const unitType = (user as any)?.unitType as string | null | undefined;

        // 1. Operator (manage_all) → akses penuh, tidak ada batasan
        if (user.permissions.includes("manage_all")) return;

        // 2. Anggota → harus pakai /portal, bukan /dashboard
        if (roleName === "anggota") {
            if (!pathname.startsWith("/portal")) {
                router.replace("/portal/dashboard");
            }
            return;
        }

        // 3. KASIR — akses sangat terbatas
        if (roleName === "kasir") {
            const allowed = [
                ...COMMON_ROUTES,
                ...(unitType && KASIR_ALLOWED_ROUTES[unitType] ? KASIR_ALLOWED_ROUTES[unitType] : []),
            ];
            if (!isPathAllowed(pathname, allowed)) {
                toast.error("Akses tidak diizinkan untuk role Kasir");
                router.replace("/dashboard");
            }
            return;
        }

        // 4. ADMIN unit — akses terbatas berdasarkan unitType
        if (roleName === "admin") {
            const allowed = [
                ...COMMON_ROUTES,
                ...(unitType && ADMIN_ALLOWED_ROUTES[unitType] ? ADMIN_ALLOWED_ROUTES[unitType] : []),
            ];
            if (!isPathAllowed(pathname, allowed)) {
                toast.error("Halaman ini tidak tersedia untuk unit Anda");
                router.replace("/dashboard");
            }
            return;
        }

        // 5. Admin Simpan Pinjam — akses simpan pinjam + keuangan
        if (roleName === "admin_sp") {
            if (!isPathAllowed(pathname, ADMIN_SP_ALLOWED_ROUTES)) {
                toast.error("Halaman ini tidak tersedia untuk role Admin Simpan Pinjam");
                router.replace("/dashboard");
            }
            return;
        }

        // 6. Fallback — role tidak dikenal, boleh akses common routes saja
        if (!isPathAllowed(pathname, COMMON_ROUTES)) {
            router.replace("/dashboard");
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
            <AppShell user={user} onLogout={logout}>
                {children}
            </AppShell>
        </ErrorBoundary>
    );
}

import { AutoLogout } from "@/components/layout/auto-logout";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <AutoLogout />
            <ProtectedContent>{children}</ProtectedContent>
        </AuthProvider>
    );
}
