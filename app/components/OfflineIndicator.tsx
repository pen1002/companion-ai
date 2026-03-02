// app/components/OfflineIndicator.tsx
'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { tts, TTS_MESSAGES } from '@/lib/tts';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // 초기 상태 설정
    setIsOnline(navigator.onLine);

    // 온라인 이벤트 핸들러
    const handleOnline = async () => {
      setIsOnline(true);
      setShowReconnected(true);

      // TTS 알림
      if (tts) {
        await tts.speakForSenior(TTS_MESSAGES.ONLINE);
      }

      // 3초 후 재연결 알림 숨기기
      setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
    };

    // 오프라인 이벤트 핸들러
    const handleOffline = async () => {
      setIsOnline(false);

      // TTS 알림
      if (tts) {
        await tts.speakForSenior(TTS_MESSAGES.OFFLINE);
      }
    };

    // 커스텀 이벤트 리스너 (layout에서 발생)
    const handleAppOnline = () => handleOnline();
    const handleAppOffline = () => handleOffline();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('app:online', handleAppOnline);
    document.addEventListener('app:offline', handleAppOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('app:online', handleAppOnline);
      document.removeEventListener('app:offline', handleAppOffline);
    };
  }, []);

  // 온라인 상태이고 재연결 알림도 없으면 렌더링하지 않음
  if (isOnline && !showReconnected) return null;

  return (
    <>
      {/* 오프라인 배너 */}
      {!isOnline && (
        <div className="offline-banner flex items-center justify-center gap-3">
          <WifiOff className="w-6 h-6" />
          <span>
            비서가 잠시 연결을 확인 중이에요. 약 드실 시간은 기기가 기억하고 있으니 걱정 마세요!
          </span>
        </div>
      )}

      {/* 재연결 알림 */}
      {showReconnected && (
        <div className="fixed top-0 left-0 right-0 bg-green-500 text-white text-center 
                      py-3 px-6 text-senior-base font-medium z-50 
                      flex items-center justify-center gap-3 animate-fade-in">
          <Wifi className="w-6 h-6" />
          <span>연결이 다시 되었어요! 😊</span>
        </div>
      )}
    </>
  );
}
