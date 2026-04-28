import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMobileUser, unauthorizedResponse } from '../middleware';

export async function POST(request: Request) {
  try {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const { token, deviceOs } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Perbarui fcmToken untuk user yang valid
    // Gunakan user.id (yang berupa string pada JWT Payload tapi di db INT)
    const userId = parseInt(user.id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid User ID' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { fcmToken: token },
    });

    console.log(`[Push Notification] Registered FCM Token for User ID ${userId} (OS: ${deviceOs})`);

    return NextResponse.json({
      message: 'Push token successfully registered',
      success: true
    });
    
  } catch (error) {
    console.error('Error in /api/mobile/push-token:', error);
    return NextResponse.json(
      { message: 'Gagal mendaftarkan push token' },
      { status: 500 }
    );
  }
}
