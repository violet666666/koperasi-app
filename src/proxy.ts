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
        });
    } catch (error) {
        console.error("[Middleware] Error getting token:", error);
    }

    const isLoggedIn = !!token;
    const userRole = token?.role as string | undefined;

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
