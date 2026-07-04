import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Protected routes that require authentication (admin routes)
const adminRoutes = [
    "/dashboard",
    "/anggota",
    "/simpanan",
    "/pinjaman",
    "/kas-bank",
    "/laporan",
    "/master",
    "/approval",
    "/transaksi-unit",
    "/toko",
    "/cuci-mobil",
    "/barbershop",
    "/resto",
    "/play-station",
    "/unit-layanan",
    "/jurnal",
    "/kwitansi",
    "/non-sp",
    "/aset",
    "/audit-log",
    "/pengumuman",
    "/periode",
    "/profil",
    "/profil-koperasi",
    "/settings",
];

// Member portal routes
const portalRoutes = ["/portal"];

// All protected routes
const protectedRoutes = [...adminRoutes, ...portalRoutes];

// Auth routes that should redirect if logged in
const authRoutes = ["/login"];

// Get the secret
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Canonical redirect: www → bare (308 permanent, cached by browsers).
    // Ensures a single canonical domain → single session cookie → no cross-subdomain auth issues.
    const host = request.headers.get("host");
    if (host?.startsWith("www.")) {
        const bareUrl = new URL(request.url);
        bareUrl.host = host.slice(4); // strip "www."
        return NextResponse.redirect(bareUrl, 308);
    }

    // Check route types
    const isAdminRoute = adminRoutes.some((route) =>
        pathname.startsWith(route)
    );
    const isPortalRoute = portalRoutes.some((route) =>
        pathname.startsWith(route)
    );
    const isProtectedRoute = isAdminRoute || isPortalRoute;
    const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

    // Skip if not a protected or auth route
    if (!isProtectedRoute && !isAuthRoute) {
        return NextResponse.next();
    }

    // Get JWT token (lightweight, no Prisma)
    let token = null;
    try {
        token = await getToken({
            req: request,
            secret: secret,
            secureCookie: process.env.NODE_ENV === "production",
        });
    } catch (error) {
        console.error("[Proxy] Error getting token:", error);
    }

    const isLoggedIn = !!token;
    const userRole = token?.role as string | undefined;
    const userUnitType = token?.unitType as string | undefined;

    // Redirect unauthenticated users from protected routes to login
    if (isProtectedRoute && !isLoggedIn) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Redirect authenticated users from auth routes
    if (isAuthRoute && isLoggedIn) {
        // Anggota role goes to portal, others go to dashboard
        if (userRole === "anggota") {
            return NextResponse.redirect(new URL("/portal/dashboard", request.url));
        }
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Role-based route protection
    if (isLoggedIn) {
        // Anggota trying to access admin routes → redirect to portal
        if (isAdminRoute && userRole === "anggota") {
            return NextResponse.redirect(new URL("/portal/dashboard", request.url));
        }

        // Admin/non-anggota trying to access portal routes → redirect to dashboard
        if (isPortalRoute && userRole !== "anggota") {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }

        // ============================================================
        // UNIT-LEVEL ROLE ISOLATION
        // Kasir dan Admin unit TIDAK BOLEH mengakses modul keuangan inti
        // atau halaman unit lain. Hanya Operator (manage_all) yang bebas.
        // ============================================================
        const financialOnlyRoutes = ["/simpanan", "/pinjaman", "/kas-bank", "/laporan", "/master", "/jurnal", "/kwitansi", "/anggota", "/non-sp", "/aset", "/periode"];
        const unitPosRoutes: Record<string, string[]> = {
            cuci_mobil: ["/unit/cuci-mobil"],
            barbershop: ["/unit/barbershop"],
            resto: ["/unit/resto"],
            play_station: ["/unit/play-station"],
            playstation: ["/unit/play-station"],
            toko: ["/toko"],
            coffe_latar: ["/unit/coffe-latar"],
            fitness: ["/unit/fitness"],
            properti: ["/unit/properti"],
            investasi_modal_jp: ["/unit/investasi-modal"],
            simpan_pinjam: ["/simpanan", "/pinjaman"],
        };

        // Blokade berlaku untuk SEMUA user yang punya unitType (kasir DAN admin unit)
        // Pengecualian hanya untuk operator (punya manage_all permission via JWT)
        // dan admin_sp (perlu akses modul keuangan inti)
        const isFullOperator = userRole === "operator";
        const isAdminSp = userRole === "admin_sp";

        if (userUnitType && !isFullOperator && !isAdminSp) {
            // Blokir akses ke modul keuangan inti
            const isAccessingFinancial = financialOnlyRoutes.some(r => pathname.startsWith(r));
            if (isAccessingFinancial) {
                // Pengecualian: Admin unit BOLEH akses /approval (untuk approve void kasir)
                if (pathname.startsWith("/approval")) {
                    return NextResponse.next();
                }
                return NextResponse.redirect(new URL("/dashboard", request.url));
            }

            // Blokir akses ke /settings kecuali halaman QRIS (admin/kasir hanya boleh QRIS)
            if (pathname.startsWith("/settings") && pathname !== "/settings") {
                return NextResponse.redirect(new URL("/dashboard", request.url));
            }

            // Blokir akses ke Unit POS milik unit lain
            const allowedPaths = unitPosRoutes[userUnitType] || [];
            const allUnitPaths = Object.values(unitPosRoutes).flat();
            const isAccessingUnitPage = allUnitPaths.some(r => pathname.startsWith(r));
            if (isAccessingUnitPage) {
                const isAllowed = allowedPaths.some(r => pathname.startsWith(r));
                if (!isAllowed) {
                    return NextResponse.redirect(new URL("/dashboard", request.url));
                }
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
    ],
};
