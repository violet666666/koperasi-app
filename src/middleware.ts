import NextAuth from "next-auth";
import { auth } from "@/lib/auth";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard") ||
        req.nextUrl.pathname.startsWith("/laporan") ||
        req.nextUrl.pathname.startsWith("/master") ||
        req.nextUrl.pathname.startsWith("/transaksi");

    const isAuthPage = req.nextUrl.pathname.startsWith("/login");

    if (isOnDashboard) {
        if (isLoggedIn) return; // Allow access
        return Response.redirect(new URL("/login", req.nextUrl));
    }

    if (isAuthPage) {
        if (isLoggedIn) {
            return Response.redirect(new URL("/dashboard", req.nextUrl));
        }
        return; // Allow access to login page
    }
});

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
