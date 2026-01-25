import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Protected routes that require authentication
const protectedRoutes = [
    "/dashboard",
    "/anggota",
    "/simpanan",
    "/pinjaman",
    "/kas-bank",
    "/laporan",
    "/master",
    "/approval",
];

// Auth routes that should redirect to dashboard if logged in
const authRoutes = ["/login"];

// Get the secret - NextAuth v5 uses AUTH_SECRET, v4 uses NEXTAUTH_SECRET
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if route is protected
    const isProtectedRoute = protectedRoutes.some((route) =>
        pathname.startsWith(route)
    );
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

    // Log for debugging (remove in production later)
    console.log("[Middleware]", {
        pathname,
        isProtectedRoute,
        isAuthRoute,
        isLoggedIn,
        hasSecret: !!secret,
    });

    // Redirect unauthenticated users from protected routes to login
    if (isProtectedRoute && !isLoggedIn) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Redirect authenticated users from auth routes to dashboard
    if (isAuthRoute && isLoggedIn) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
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
