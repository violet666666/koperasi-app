"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import type { User, Branch } from "@/types";

// Auth context type
interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    branches: Branch[];
    currentBranchId: number | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    setCurrentBranch: (branchId: number | null) => void;
    hasPermission: (permission: string) => boolean;
    checkAuth: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

// MOCK BRANCHES for now, until we have a real branch API hook
const MOCK_BRANCHES: Branch[] = [
    { id: 1, code: "HO", name: "Kantor Pusat", is_head_office: true, is_active: true },
    { id: 2, code: "JKT", name: "Cabang Jakarta Selatan", is_head_office: false, is_active: true },
    { id: 3, code: "SBY", name: "Cabang Surabaya", is_head_office: false, is_active: true },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [branches, setBranches] = React.useState<Branch[]>(MOCK_BRANCHES);
    const [currentBranchId, setCurrentBranchId] = React.useState<number | null>(null);

    // Map NextAuth session to our User type
    const user: User | null = React.useMemo(() => {
        if (!session?.user) return null;

        return {
            id: Number(session.user.id),
            name: session.user.name || "",
            email: session.user.email || "",
            role: {
                id: 0, // Not available in session directly, would need API call or session augmentation
                name: session.user.role || "user",
                display_name: session.user.roleDisplayName || "User",
                permissions: session.user.permissions || [],
            },
            branch_id: session.user.branchId || null,
            branch: session.user.branchName
                ? {
                    id: session.user.branchId as number,
                    name: session.user.branchName,
                    code: "",
                    is_head_office: false,
                    is_active: true
                }
                : null,
            permissions: session.user.permissions || [],
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    }, [session]);

    const isLoading = status === "loading";
    const isAuthenticated = status === "authenticated";

    // Set initial branch based on user
    React.useEffect(() => {
        if (user?.branch_id && currentBranchId === null) {
            setCurrentBranchId(user.branch_id);
        }
    }, [user, currentBranchId]);

    // Check authentication on mount - passed directly from useSession
    const checkAuth = React.useCallback(async () => {
        // No-op as useSession handles this
    }, []);

    // Login function
    const login = React.useCallback(async (email: string, password: string) => {
        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (result?.error) {
            throw new Error("Email atau password salah");
        }

        router.push("/dashboard");
    }, [router]);

    // Logout function
    const logout = React.useCallback(async () => {
        await signOut({ redirect: false });
        router.push("/login");
    }, [router]);

    // Set current branch
    const setCurrentBranch = React.useCallback((branchId: number | null) => {
        setCurrentBranchId(branchId);
    }, []);

    // Check if user has permission
    const hasPermission = React.useCallback(
        (permission: string) => {
            if (!user) return false;
            // Super admin has all permissions
            if (user.permissions.includes("manage_all")) return true;
            return user.permissions.includes(permission);
        },
        [user]
    );

    const value = React.useMemo(
        () => ({
            user,
            isLoading,
            isAuthenticated: !!user,
            branches,
            currentBranchId,
            login,
            logout,
            setCurrentBranch,
            hasPermission,
            checkAuth,
        }),
        [user, isLoading, branches, currentBranchId, login, logout, setCurrentBranch, hasPermission, checkAuth]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
    const context = React.useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

// Hook to require authentication
export function useRequireAuth(redirectTo = "/login") {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    React.useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push(redirectTo);
        }
    }, [isAuthenticated, isLoading, router, redirectTo]);

    return { isAuthenticated, isLoading };
}

// Hook to check permission
export function usePermission(permission: string) {
    const { hasPermission, isAuthenticated } = useAuth();
    return isAuthenticated && hasPermission(permission);
}
