import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// PUT /api/notifications/read — Mark all as read
export async function PUT() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: Number(session.user.id),
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ data: { updated: result.count } });
  } catch (error) {
    console.error("[Notifications] MarkAllRead error:", error);
    return NextResponse.json({ message: "Gagal menandai notifikasi" }, { status: 500 });
  }
}
