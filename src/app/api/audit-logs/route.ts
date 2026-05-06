import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/audit-logs - Query audit logs with filters (admin-only)
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // Only Operator (Super Admin) and admin_sp can view audit logs
        const userRole = session.user.role;
        if (userRole !== "operator" && userRole !== "admin_sp") {
            return NextResponse.json({ message: "Forbidden: Hanya Operator yang dapat melihat audit log" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
        const module = searchParams.get("module") || undefined;
        const action = searchParams.get("action") || undefined;
        const userId = searchParams.get("userId") ? parseInt(searchParams.get("userId")!) : undefined;
        const search = searchParams.get("search") || undefined;
        const status = searchParams.get("status") || undefined;
        const dateFrom = searchParams.get("dateFrom") || undefined;
        const dateTo = searchParams.get("dateTo") || undefined;
        const unitType = searchParams.get("unitType") || undefined;
        const filterUserRole = searchParams.get("userRole") || undefined;

        const where: any = {};

        if (module) where.module = module;
        if (action) where.action = action;
        if (userId) where.userId = userId;
        if (status) where.status = status;
        if (unitType) where.unitType = unitType;
        if (filterUserRole) where.userRole = filterUserRole;

        if (search) {
            where.OR = [
                { description: { contains: search, mode: "insensitive" } },
                { userName: { contains: search, mode: "insensitive" } },
                { ipAddress: { contains: search, mode: "insensitive" } },
                { targetType: { contains: search, mode: "insensitive" } },
                { unitType: { contains: search, mode: "insensitive" } },
            ];
        }

        if (dateFrom || dateTo) {
            where.timestamp = {};
            if (dateFrom) where.timestamp.gte = new Date(dateFrom);
            if (dateTo) where.timestamp.lte = new Date(dateTo + "T23:59:59.999Z");
        }

        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                orderBy: { timestamp: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);

        return NextResponse.json({
            data: logs.map((log) => ({
                id: log.id,
                timestamp: log.timestamp.toISOString(),
                userId: log.userId,
                userName: log.userName,
                userEmail: log.userEmail,
                userRole: log.userRole,
                sessionId: log.sessionId,
                action: log.action,
                module: log.module,
                description: log.description,
                targetId: log.targetId,
                targetType: log.targetType,
                oldData: log.oldData,
                newData: log.newData,
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                requestMethod: log.requestMethod,
                requestUrl: log.requestUrl,
                status: log.status,
                errorMessage: log.errorMessage,
                duration: log.duration,
                metadata: log.metadata,
                unitType: log.unitType,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("GET /api/audit-logs error:", error);
        return NextResponse.json({ message: "Failed to fetch audit logs" }, { status: 500 });
    }
}
