// app/components/MedicationAlarm.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Pill, Volume2, VolumeX, X } from 'lucide-react';
import { tts, TTS_MESSAGES } from '@/lib/tts';

interface AlarmData {
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
}

interface MedicationAlarmProps {
  userId?: string;
  onMedicationTaken?: (medicationId: string, scheduledTime: string) => void;
}

export default function MedicationAlarm({ 
  userId = '00000000-0000-0000-0000-000000000001',
  onMedicationTaken 
}: MedicationAlarmProps) {
  const [activeAlarm, setActiveAlarm] = useState<AlarmData | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [snoozeCount, setSnoozeCount] = useState(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const snoozeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 알람 체크 (매 분마다)
  const checkAlarms = useCallback(async () => {
    // 이미 활성화된 알람이 있으면 스킵
    if (activeAlarm) return;

    try {
      const res = await fetch(`/api/medications?userId=${userId}`);
      const data = await res.json();
      
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      
      // 현재 시간에 맞는 미복용 약 찾기
      const dueAlarm = data.todaySchedule?.find((med: any) => 
        !med.is_taken && med.scheduled_time === currentTime
      );

      if (dueAlarm) {
        triggerAlarm({
          medicationId: dueAlarm.medication_id,
          medicationName: dueAlarm.medication_name,
          dosage: dueAlarm.dosage,
          scheduledTime: dueAlarm.scheduled_time,
        });
      }
    } catch (err) {
      console.error('알람 체크 실패:', err);
    }
  }, [userId, activeAlarm]);

  // 알람 트리거
  const triggerAlarm = async (alarm: AlarmData) => {
    setActiveAlarm(alarm);
    setSnoozeCount(0);

    // TTS 재생
    if (!isMuted && tts) {
      await tts.speakAlarm(TTS_MESSAGES.MEDICATION_ALARM);
    }

    // 진동 (지원되는 경우)
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }

    // Service Worker에 알람 알림
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'TRIGGER_ALARM',
        payload: alarm,
      });
    }
  };

  // 약 복용 완료
  const handleTaken = async () => {
    if (!activeAlarm) return;

    try {
      const res = await fetch('/api/medications/taken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicationId: activeAlarm.medicationId,
          scheduledTime: activeAlarm.scheduledTime,
        }),
      });

      if (res.ok) {
        // TTS 재생
        if (!isMuted && tts) {
          await tts.speakForSenior('잘하셨어요, 어르신! 건강이 제일입니다.');
        }

        // 스누즈 타이머 취소
        if (snoozeTimeoutRef.current) {
          clearTimeout(snoozeTimeoutRef.current);
          snoozeTimeoutRef.current = null;
        }

        // 콜백 호출
        onMedicationTaken?.(activeAlarm.medicationId, activeAlarm.scheduledTime);

        // 알람 닫기
        setActiveAlarm(null);
      }
    } catch (err) {
      console.error('복용 기록 실패:', err);
    }
  };

  // 5분 후 다시 알림 (스누즈)
  const handleSnooze = async () => {
    if (!activeAlarm) return;

    // TTS 알림
    if (!isMuted && tts) {
      await tts.speakForSenior('5분 후에 다시 알려드릴게요.');
    }

    // 알람 닫기
    setActiveAlarm(null);
    setSnoozeCount(prev => prev + 1);

    // 5분 후 재알림
    snoozeTimeoutRef.current = setTimeout(() => {
      triggerAlarm(activeAlarm);
    }, 5 * 60 * 1000); // 5분
  };

  // 알람 닫기 (무시)
  const handleDismiss = () => {
    if (snoozeTimeoutRef.current) {
      clearTimeout(snoozeTimeoutRef.current);
      snoozeTimeoutRef.current = null;
    }
    setActiveAlarm(null);
  };

  // 알람 체크 인터벌 설정
  useEffect(() => {
    // 즉시 한 번 체크
    checkAlarms();

    // 매 분마다 체크
    checkIntervalRef.current = setInterval(checkAlarms, 60 * 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (snoozeTimeoutRef.current) {
        clearTimeout(snoozeTimeoutRef.current);
      }
    };
  }, [checkAlarms]);

  // 푸시 알림 권한 요청
  useEffect(() => {
    const requestNotificationPermission = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    };
    requestNotificationPermission();
  }, []);

  // 알람이 없으면 렌더링하지 않음
  if (!activeAlarm) return null;

  return (
    <>
      {/* 오버레이 */}
      <div className="alarm-overlay" onClick={handleDismiss}>
        {/* 알람 팝업 */}
        <div 
          className="alarm-popup"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 닫기 & 음소거 버튼 */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-6 h-6 text-gray-500" />
              ) : (
                <Volume2 className="w-6 h-6 text-gray-700" />
              )}
            </button>
            <button
              onClick={handleDismiss}
              className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* 아이콘 */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-orange-500 rounded-full 
                          flex items-center justify-center shadow-lg animate-bounce-gentle">
              <Pill className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* 제목 */}
          <h2 className="text-senior-2xl font-bold text-center text-gray-800 mb-2">
            💊 약 드실 시간이에요!
          </h2>

          {/* 약 정보 */}
          <div className="bg-white rounded-senior p-5 mb-6 text-center shadow-sm">
            <p className="text-senior-xl font-bold text-primary-700">
              {activeAlarm.medicationName}
            </p>
            <p className="text-senior-lg text-gray-600 mt-1">
              {activeAlarm.scheduledTime} · {activeAlarm.dosage}
            </p>
          </div>

          {/* 스누즈 횟수 알림 */}
          {snoozeCount > 0 && (
            <p className="text-center text-amber-600 text-senior-sm mb-4">
              ⚠️ {snoozeCount}번 미루셨어요. 건강을 위해 꼭 드세요!
            </p>
          )}

          {/* 버튼들 */}
          <div className="space-y-4">
            {/* 약 먹었음 버튼 (가로 전체) */}
            <button
              onClick={handleTaken}
              className="w-full py-6 bg-green-500 hover:bg-green-600 active:bg-green-700
                       text-white rounded-senior text-senior-xl font-bold
                       shadow-lg hover:shadow-xl transition-all
                       flex items-center justify-center gap-3"
            >
              <span className="text-3xl">✓</span>
              약 먹었어요
            </button>

            {/* 5분 후 다시 알림 */}
            <button
              onClick={handleSnooze}
              className="w-full py-4 bg-amber-100 hover:bg-amber-200 
                       text-amber-800 rounded-senior text-senior-lg font-semibold
                       transition-all flex items-center justify-center gap-2"
            >
              <span className="text-xl">⏰</span>
              5분 후에 다시 알림
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
