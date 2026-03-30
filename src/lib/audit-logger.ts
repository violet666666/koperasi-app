import prisma from "@/lib/prisma";

// =================================================================
// ENTERPRISE AUDIT LOGGER — Primkoppol (Instansi Polisi)
// =================================================================
// Append-only audit log. NO UPDATE/DELETE operations allowed.
// All activities are permanently recorded for security compliance.
// =================================================================

export type AuditAction =
    | "LOGIN"
    | "LOGOUT"
    | "LOGIN_FAILED"
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "VIEW"
    | "EXPORT"
    | "APPROVE"
    | "REJECT"
    | "IMPORT"
    | "PASSWORD_CHANGE"
    | "PERMISSION_CHANGE";

export type AuditModule =
    | "Auth"
    | "Anggota"
    | "Simpanan"
    | "Pinjaman"
    | "Toko"
    | "Jurnal"
    | "Kas"
    | "Aset"
    | "Laporan"
    | "Master"
    | "User"
    | "Pengumuman"
    | "System"
    | "Period"
    | "Tabungan_Sejahtera"
    | "Loan_Migrasi";

export interface AuditLogParams {
    // User info
    userId?: number | null;
    userName: string;
    userEmail?: string | null;
    userRole?: string;
    sessionId?: string | null;

    // What happened
    action: AuditAction;
    module: AuditModule;
    description: string;

    // What was affected
    targetId?: string | number | null;
    targetType?: string | null;

    // Data changes (for UPDATE actions)
    oldData?: any;
    newData?: any;

    // Request info (extracted from Next.js request)
    ipAddress?: string | null;
    userAgent?: string | null;
    requestMethod?: string | null;
    requestUrl?: string | null;

    // Result
    status?: "success" | "failed" | "warning";
    errorMessage?: string | null;

    // Additional metadata
    duration?: number | null;
    metadata?: Record<string, any> | null;
}

/**
 * Extract client IP and User-Agent from a Next.js Request object.
 * Supports x-forwarded-for, x-real-ip, and cf-connecting-ip headers.
 */
export function extractRequestInfo(request: Request): {
    ipAddress: string;
    userAgent: string;
    requestMethod: string;
    requestUrl: string;
} {
    const headers = new Headers(request.headers);

    // Try multiple headers for IP (works behind proxies/load balancers)
    const ipAddress =
        headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headers.get("x-real-ip") ||
        headers.get("cf-connecting-ip") ||
        headers.get("x-client-ip") ||
        "unknown";

    const userAgent = headers.get("user-agent") || "unknown";
    const requestMethod = request.method;
    const requestUrl = request.url;

    return { ipAddress, userAgent, requestMethod, requestUrl };
}

/**
 * Extract user info from NextAuth session token.
 */
export function extractUserFromSession(session: any): {
    userId: number | null;
    userName: string;
    userEmail: string | null;
    userRole: string;
} {
    if (!session?.user) {
        return { userId: null, userName: "Anonymous", userEmail: null, userRole: "unknown" };
    }
    return {
        userId: session.user.id ? Number(session.user.id) : null,
        userName: session.user.name || "Unknown",
        userEmail: session.user.email || null,
        userRole: session.user.role || "unknown",
    };
}

/**
 * Log an audit event to the database.
 * This is fire-and-forget (async, non-blocking).
 * NEVER throws — errors are silently logged to console.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId: params.userId || null,
                userName: params.userName,
                userEmail: params.userEmail || null,
                userRole: params.userRole || "unknown",
                sessionId: params.sessionId || null,

                action: params.action,
                module: params.module,
                description: params.description,

                targetId: params.targetId != null ? String(params.targetId) : null,
                targetType: params.targetType || null,

                oldData: params.oldData ? JSON.stringify(params.oldData) : null,
                newData: params.newData ? JSON.stringify(params.newData) : null,

                ipAddress: params.ipAddress || null,
                userAgent: params.userAgent || null,
                requestMethod: params.requestMethod || null,
                requestUrl: params.requestUrl || null,

                status: params.status || "success",
                errorMessage: params.errorMessage || null,

                duration: params.duration || null,
                metadata: params.metadata ? JSON.stringify(params.metadata) : null,
            },
        });
    } catch (error) {
        // NEVER throw from audit logger — it must not break the main operation
        console.error("[AuditLog] Failed to write audit log:", error);
    }
}

/**
 * Convenience: Log audit with request + session extraction.
 * Use this in API route handlers.
 */
export async function logAuditFromRequest(
    request: Request,
    session: any,
    params: Omit<AuditLogParams, "userId" | "userName" | "userEmail" | "userRole" | "ipAddress" | "userAgent" | "requestMethod" | "requestUrl">
): Promise<void> {
    const reqInfo = extractRequestInfo(request);
    const userInfo = extractUserFromSession(session);

    await logAudit({
        ...userInfo,
        ...reqInfo,
        ...params,
    });
}

/**
 * Safely compute diff between old and new data for sensitive audit trails.
 * Redacts sensitive fields like passwords.
 */
export function sanitizeForAudit(data: any): any {
    if (!data) return null;

    const sensitiveFields = ["password", "passwordHash", "token", "secret", "creditCard"];
    const sanitized = { ...data };

    for (const field of sensitiveFields) {
        if (field in sanitized) {
            sanitized[field] = "[REDACTED]";
        }
    }

    return sanitized;
}
