"use client";

import * as React from "react";
import { useAuth } from "@/lib/hooks";
import { CashierLockScreen } from "@/components/patterns/cashier-lock-screen";
import { Loader2 } from "lucide-react";

interface CashierIdentity {
    id: number;
    username: string;
    displayName: string;
}

export default function TokoLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const [identityStatus, setIdentityStatus] = React.useState<
        "loading" | "locked" | "unlocked"
    >("loading");
    const [identities, setIdentities] = React.useState<CashierIdentity[]>([]);
    const [activeIdentity, setActiveIdentity] = React.useState<CashierIdentity | null>(null);

    const roleName = typeof user?.role === "string" ? user.role : (user?.role as any)?.name || "";
    const isKasir = roleName === "kasir";

    React.useEffect(() => {
        if (isLoading || !user) return;

        // Non-kasir roles bypass lock screen entirely
        if (!isKasir) {
            setIdentityStatus("unlocked");
            return;
        }

        // Kasir: check if session already active
        async function checkSession() {
            try {
                const res = await fetch("/api/toko/cashier-session");
                if (!res.ok) throw new Error("Session check failed");
                const json = await res.json();

                if (json.data) {
                    setActiveIdentity(json.data);
                    setIdentityStatus("unlocked");
                    return;
                }

                // No active session — fetch identities for lock screen
                const identitiesRes = await fetch("/api/toko/cashier-identities");
                if (!identitiesRes.ok) throw new Error("Identities fetch failed");
                const identitiesJson = await identitiesRes.json();
                setIdentities(identitiesJson.data || []);
                setIdentityStatus("locked");
            } catch (error) {
                console.error("Cashier identity check error:", error);
                // On error, try to fetch identities anyway
                try {
                    const identitiesRes = await fetch("/api/toko/cashier-identities");
                    const identitiesJson = await identitiesRes.json();
                    setIdentities(identitiesJson.data || []);
                } catch {
                    // Silent — will show lock screen with empty state
                }
                setIdentityStatus("locked");
            }
        }

        checkSession();
    }, [isLoading, user, isKasir]);

    // Loading state
    if (isLoading || identityStatus === "loading") {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Kasir without active identity — show lock screen
    if (isKasir && identityStatus === "locked") {
        return (
            <CashierLockScreen
                identities={identities}
                onVerified={(identity) => {
                    setActiveIdentity(identity);
                    setIdentityStatus("unlocked");
                }}
            />
        );
    }

    // Admin/operator or kasir with verified identity — show normal content
    return <>{children}</>;
}
