"use client";

import { AuthProvider, useAuth } from "@/lib/hooks";
import { AppShell } from "@/components/layout";
import { ErrorBoundary } from "@/components/patterns/error-boundary";

function ProtectedContent({ children }: { children: React.ReactNode }) {
    const { user, branches, currentBranchId, setCurrentBranch, logout, isLoading } = useAuth();

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
                branches={branches}
                currentBranchId={currentBranchId}
                onBranchChange={setCurrentBranch}
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
