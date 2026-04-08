/**
 * Expo Push Notification Utility
 * Mengirim push notification via Expo Push API ke device yang terdaftar.
 * Dokumentasi: https://docs.expo.dev/push-notifications/sending-notifications/
 */

interface PushMessage {
  to: string;         // Expo Push Token (ExponentPushToken[...])
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
}

interface PushResult {
  success: boolean;
  ticketId?: string;
  error?: string;
}

/**
 * Kirim single push notification ke satu recipient.
 */
export async function sendPushNotification(message: PushMessage): Promise<PushResult> {
  if (!message.to || !message.to.startsWith('ExponentPushToken')) {
    return { success: false, error: 'Invalid or missing Expo Push Token' };
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: message.to,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
        sound: message.sound ?? 'default',
        badge: message.badge ?? 1,
        priority: 'high',
        channelId: 'default',
      }),
    });

    const result = await response.json();

    if (result?.data?.status === 'ok') {
      return { success: true, ticketId: result.data.id };
    } else {
      const errMsg = result?.data?.message || result?.errors?.[0]?.message || 'Unknown Expo Push error';
      console.error('[ExpoPush] Send failed:', errMsg);
      return { success: false, error: errMsg };
    }
  } catch (error) {
    console.error('[ExpoPush] Network error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

/**
 * Kirim push notification ke beberapa recipient sekaligus (batch).
 */
export async function sendBatchPushNotifications(messages: PushMessage[]): Promise<void> {
  const valid = messages.filter(m => m.to?.startsWith('ExponentPushToken'));
  if (valid.length === 0) return;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(valid.map(m => ({
        to: m.to,
        title: m.title,
        body: m.body,
        data: m.data ?? {},
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }))),
    });

    const result = await response.json();
    console.log('[ExpoPush] Batch send result:', result?.data?.length, 'messages');
  } catch (error) {
    console.error('[ExpoPush] Batch send error:', error);
  }
}
