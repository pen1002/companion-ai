// app/components/usePushNotifications.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export default function usePushNotifications(userId: string): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 지원 여부 확인
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // 현재 구독 상태 확인
      checkSubscription();
    }
  }, []);

  // 현재 구독 상태 확인
  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('구독 상태 확인 실패:', err);
    }
  };

  // VAPID 공개키를 Uint8Array로 변환
  const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // 푸시 알림 구독
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('이 브라우저는 푸시 알림을 지원하지 않아요');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // 알림 권한 요청
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setError('알림 권한이 필요해요. 브라우저 설정에서 알림을 허용해 주세요.');
        return false;
      }

      // Service Worker 준비
      const registration = await navigator.serviceWorker.ready;

      // VAPID 공개키 가져오기
      const res = await fetch('/api/push');
      const { publicKey } = await res.json();

      if (!publicKey) {
        throw new Error('VAPID 공개키를 가져올 수 없어요');
      }

      // 푸시 구독
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 서버에 구독 정보 저장
      const saveRes = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userId,
        }),
      });

      const saveData = await saveRes.json();

      if (!saveData.success) {
        throw new Error('구독 저장에 실패했어요');
      }

      setIsSubscribed(true);
      return true;

    } catch (err: any) {
      console.error('푸시 구독 실패:', err);
      setError(err.message || '푸시 알림 등록에 실패했어요');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, userId]);

  // 푸시 알림 구독 해제
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // 서버에서 구독 제거
        await fetch(`/api/push?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
        });

        // 브라우저 구독 해제
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      return true;

    } catch (err: any) {
      console.error('푸시 구독 해제 실패:', err);
      setError(err.message || '푸시 알림 해제에 실패했어요');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    loading,
    error,
  };
}
