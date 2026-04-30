import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// PUT /api/notifications/[id]/read — Mark single as read
export async function PUT(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const notification = await prisma.notification.update({
      where: {
        id: Number(id),
        userId: Number(session.user.id),
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ data: notification });
  } catch (error) {
    console.error("[Notifications] MarkRead error:", error);
    return NextResponse.json({ message: "Notifikasi tidak ditemukan" }, { status: 404 });
  }
}

// DELETE /api/notifications/[id] — Delete notification
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await prisma.notification.delete({
      where: {
        id: Number(id),
        userId: Number(session.user.id),
      },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("[Notifications] Delete error:", error);
    return NextResponse.json({ message: "Notifikasi tidak ditemukan" }, { status: 404 });
  }
}
