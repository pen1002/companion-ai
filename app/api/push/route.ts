// app/api/push/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// VAPID 키 설정
webPush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@companion-ai.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// 푸시 구독 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, userId } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: '유효한 구독 정보가 필요합니다' },
        { status: 400 }
      );
    }

    // 구독 정보 저장
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId || '00000000-0000-0000-0000-000000000001',
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }, {
        onConflict: 'endpoint',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: '푸시 알림이 등록되었습니다',
      subscriptionId: data.id,
    });

  } catch (error) {
    console.error('푸시 구독 등록 오류:', error);
    return NextResponse.json(
      { error: '푸시 알림 등록에 실패했습니다' },
      { status: 500 }
    );
  }
}

// 푸시 알림 전송 (특정 사용자에게)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, title, message, data: notificationData } = body;

    // 사용자의 푸시 구독 조회
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId || '00000000-0000-0000-0000-000000000001');

    if (subError) {
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        message: '등록된 푸시 구독이 없습니다',
      });
    }

    // 각 구독에 푸시 전송
    const payload = JSON.stringify({
      title: title || '마음벗 알림',
      body: message || '새로운 알림이 있습니다',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: notificationData?.tag || 'default',
      data: notificationData || {},
      requireInteraction: true,
      actions: [
        { action: 'take', title: '💊 약 먹었어요' },
        { action: 'snooze', title: '⏰ 5분 후 알림' },
      ],
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            payload
          );
          return { success: true, endpoint: sub.endpoint };
        } catch (error: any) {
          // 만료된 구독은 삭제
          if (error.statusCode === 410 || error.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
          }
          return { success: false, endpoint: sub.endpoint, error: error.message };
        }
      })
    );

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as any).success
    ).length;

    return NextResponse.json({
      success: successCount > 0,
      sent: successCount,
      total: subscriptions.length,
      results,
    });

  } catch (error) {
    console.error('푸시 전송 오류:', error);
    return NextResponse.json(
      { error: '푸시 알림 전송에 실패했습니다' },
      { status: 500 }
    );
  }
}

// VAPID 공개키 조회 (클라이언트용)
export async function GET() {
  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
}

// 구독 해제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json(
        { error: '엔드포인트가 필요합니다' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', decodeURIComponent(endpoint));

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: '푸시 구독이 해제되었습니다',
    });

  } catch (error) {
    console.error('푸시 구독 해제 오류:', error);
    return NextResponse.json(
      { error: '푸시 구독 해제에 실패했습니다' },
      { status: 500 }
    );
  }
}
