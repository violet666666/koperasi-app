"use client";

import { AuthProvider, useAuth } from "@/lib/hooks";
import { AppShell } from "@/components/layout";

function ProtectedContent({ children }: { children: React.ReactNode }) {
    const { user, branches, currentBranchId, setCurrentBranch, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <AppShell
            user={user}
            branches={branches}
            currentBranchId={currentBranchId}
            onBranchChange={setCurrentBranch}
        >
            {children}
        </AppShell>
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
