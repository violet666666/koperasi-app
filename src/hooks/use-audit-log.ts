/**
 * Audit Log Hook
 * Provides logging functionality for tracking user actions
 * Role-based filtering is applied on the server side
 */

import * as React from "react";

export interface AuditLogEntry {
    action: AuditAction;
    module: AuditModule;
    description: string;
    resourceId?: string | number;
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
    status?: "success" | "failed" | "warning";
}

export type AuditAction =
    | "create"
    | "update"
    | "delete"
    | "view"
    | "login"
    | "logout"
    | "approve"
    | "reject"
    | "export"
    | "print";

export type AuditModule =
    | "Auth"
    | "Anggota"
    | "Simpanan"
    | "Pinjaman"
    | "Angsuran"
    | "Kas"
    | "Bank"
    | "Jurnal"
    | "Aset"
    | "SHU"
    | "Toko"
    | "Master"
    | "User"
    | "Settings"
    | "Report";

/**
 * Log an audit entry to the server
 * In production, this would call an API endpoint
 */
async function logAuditEntry(entry: AuditLogEntry): Promise<void> {
    try {
        // In production, call the audit log API
        // await api.post("/api/audit-log", entry);

        // For now, log to console in development
        if (process.env.NODE_ENV === "development") {
            console.log("[AUDIT]", {
                timestamp: new Date().toISOString(),
                ...entry,
            });
        }
    } catch (error) {
        // Silently fail - audit logging should not break the app
        console.error("Failed to log audit entry:", error);
    }
}

/**
 * Hook for audit logging
 * Provides a simple interface for logging user actions
 */
export function useAuditLog() {
    const log = React.useCallback(async (entry: AuditLogEntry) => {
        await logAuditEntry(entry);
    }, []);

    // Convenience methods for common actions
    const logCreate = React.useCallback(
        (module: AuditModule, description: string, resourceId?: string | number) => {
            return log({ action: "create", module, description, resourceId, status: "success" });
        },
        [log]
    );

    const logUpdate = React.useCallback(
        (
            module: AuditModule,
            description: string,
            resourceId: string | number,
            oldValue?: Record<string, any>,
            newValue?: Record<string, any>
        ) => {
            return log({ action: "update", module, description, resourceId, oldValue, newValue, status: "success" });
        },
        [log]
    );

    const logDelete = React.useCallback(
        (module: AuditModule, description: string, resourceId: string | number) => {
            return log({ action: "delete", module, description, resourceId, status: "warning" });
        },
        [log]
    );

    const logView = React.useCallback(
        (module: AuditModule, description: string, resourceId?: string | number) => {
            return log({ action: "view", module, description, resourceId, status: "success" });
        },
        [log]
    );

    const logApprove = React.useCallback(
        (module: AuditModule, description: string, resourceId: string | number) => {
            return log({ action: "approve", module, description, resourceId, status: "success" });
        },
        [log]
    );

    const logReject = React.useCallback(
        (module: AuditModule, description: string, resourceId: string | number) => {
            return log({ action: "reject", module, description, resourceId, status: "warning" });
        },
        [log]
    );

    const logExport = React.useCallback(
        (module: AuditModule, description: string) => {
            return log({ action: "export", module, description, status: "success" });
        },
        [log]
    );

    return {
        log,
        logCreate,
        logUpdate,
        logDelete,
        logView,
        logApprove,
        logReject,
        logExport,
    };
}

/**
 * Wrapper function for automatic audit logging on API calls
 */
export function withAuditLog<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    getEntry: (args: Parameters<T>, result: Awaited<ReturnType<T>>) => AuditLogEntry
): T {
    return (async (...args: Parameters<T>) => {
        const result = await fn(...args);
        const entry = getEntry(args, result);
        await logAuditEntry(entry);
        return result;
    }) as T;
}
