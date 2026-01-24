"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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

// Mock data for development (replace with actual API calls)
const MOCK_USER: User = {
    id: 1,
    name: "Admin Pusat",
    email: "admin@koperasi.com",
    role: {
        id: 1,
        name: "super_admin",
        display_name: "Super Admin",
        permissions: ["manage_all", "view_all_branches"],
    },
    branch_id: null,
    branch: null,
    permissions: [
        "manage_all",
        "view_all_branches",
        "manage_anggota",
        "manage_simpanan",
        "manage_pinjaman",
        "approve_transactions",
        "master_data",
        "user_management",
        "tutup_buku",
        "alokasi_shu",
        "view_laporan",
    ],
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
};

const MOCK_BRANCHES: Branch[] = [
    { id: 1, code: "PST", name: "Kantor Pusat", is_head_office: true, is_active: true },
    { id: 2, code: "JKT", name: "Cabang Jakarta", is_head_office: false, is_active: true },
    { id: 3, code: "SBY", name: "Cabang Surabaya", is_head_office: false, is_active: true },
    { id: 4, code: "BDG", name: "Cabang Bandung", is_head_office: false, is_active: true },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = React.useState<User | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [branches, setBranches] = React.useState<Branch[]>([]);
    const [currentBranchId, setCurrentBranchId] = React.useState<number | null>(null);

    // Check authentication on mount
    const checkAuth = React.useCallback(async () => {
        try {
            setIsLoading(true);
            // In production, this would call authApi.me()
            // For now, we'll check if there's a mock session
            const hasSession = localStorage.getItem("koperasi_session");

            if (hasSession) {
                setUser(MOCK_USER);
                setBranches(MOCK_BRANCHES);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Auth check failed:", error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Login function
    const login = React.useCallback(async (email: string, password: string) => {
        setIsLoading(true);
        try {
            // In production, this would call authApi.login()
            // Simulate API delay
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Mock validation
            if (email === "admin@koperasi.com" && password === "password") {
                localStorage.setItem("koperasi_session", "mock_token");
                setUser(MOCK_USER);
                setBranches(MOCK_BRANCHES);
                router.push("/dashboard");
            } else {
                throw new Error("Email atau password salah");
            }
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    // Logout function
    const logout = React.useCallback(async () => {
        setIsLoading(true);
        try {
            // In production, this would call authApi.logout()
            localStorage.removeItem("koperasi_session");
            setUser(null);
            setBranches([]);
            setCurrentBranchId(null);
            router.push("/login");
        } finally {
            setIsLoading(false);
        }
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
