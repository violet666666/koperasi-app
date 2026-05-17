import { prisma } from "@/lib/prisma";
import { sendBatchPushNotifications } from "@/lib/expo-push";
import type { Prisma } from "@prisma/client";

/**
 * Get notification recipients filtered by unitType.
 * - operator & super_admin always receive all notifications
 * - admin only receives notifications matching their unitType
 */
export async function getNotificationRecipients(unitType: string): Promise<number[]> {
    const admins = await prisma.user.findMany({
        where: {
            role: { name: { in: ["admin", "operator"] } },
            isActive: true,
            OR: [
                { unitType },
                { unitType: null },
                { role: { name: { in: ["operator"] } } },
            ],
        },
        select: { id: true },
    });
    return admins.map((a) => a.id);
}

interface CreateNotificationParams {
  userId: number | number[];
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  push?: boolean;
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  data,
  push = true,
}: CreateNotificationParams) {
  const userIds = Array.isArray(userId) ? userId : [userId];

  // 1. Insert notifications to DB (batch create)
  const notifications = await prisma.notification.createManyAndReturn({
    data: userIds.map((uid) => ({
      userId: uid,
      type,
      title,
      message,
      data: data as Prisma.InputJsonValue ?? undefined,
    })),
  });

  // 2. Send push notifications if enabled
  if (push && notifications.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        fcmToken: { not: null },
      },
      select: { id: true, fcmToken: true },
    });

    const pushMessages = users
      .filter((u) => u.fcmToken?.startsWith("ExponentPushToken"))
      .map((u) => ({
        to: u.fcmToken!,
        title,
        body: message,
        data: { type, ...data },
      }));

    if (pushMessages.length > 0) {
      // Fire-and-forget — don't block on push delivery
      sendBatchPushNotifications(pushMessages).catch((err) =>
        console.error("[Notifications] Push send failed:", err)
      );
    }
  }

  return notifications;
}
