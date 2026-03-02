// app/components/MedicationDashboard.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Pill, 
  Check, 
  Clock, 
  Plus, 
  X, 
  Bell,
  Calendar,
  ChevronRight 
} from 'lucide-react';
import { tts, TTS_MESSAGES } from '@/lib/tts';

interface MedicationSchedule {
  medication_id: string;
  medication_name: string;
  dosage: string;
  scheduled_time: string;
  is_taken: boolean;
}

interface MedicationDashboardProps {
  userId?: string;
  onMedicationTaken?: (medicationId: string, scheduledTime: string) => void;
}

export default function MedicationDashboard({ 
  userId = '00000000-0000-0000-0000-000000000001',
  onMedicationTaken 
}: MedicationDashboardProps) {
  const [schedule, setSchedule] = useState<MedicationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // 오늘 날짜 포맷
  const today = new Date();
  const dateString = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  // 약 목록 로드
  const loadMedications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/medications?userId=${userId}`);
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setSchedule(data.todaySchedule || []);
      setError(null);
    } catch (err) {
      console.error('약 목록 로드 실패:', err);
      setError('약 목록을 불러오는 데 문제가 있어요');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadMedications();
  }, [loadMedications]);

  // 약 복용 완료 처리
  const handleTakeMedication = async (medicationId: string, scheduledTime: string) => {
    try {
      const res = await fetch('/api/medications/taken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicationId, scheduledTime }),
      });

      const data = await res.json();
      
      if (data.success) {
        // 상태 업데이트
        setSchedule(prev => 
          prev.map(item => 
            item.medication_id === medicationId && item.scheduled_time === scheduledTime
              ? { ...item, is_taken: true }
              : item
          )
        );

        // TTS 재생
        if (tts) {
          await tts.speakForSenior(TTS_MESSAGES.MEDICATION_TAKEN);
        }

        // 콜백 호출
        onMedicationTaken?.(medicationId, scheduledTime);
      }
    } catch (err) {
      console.error('복용 기록 실패:', err);
    }
  };

  // 복용 완료율 계산
  const totalDoses = schedule.length;
  const takenDoses = schedule.filter(s => s.is_taken).length;
  const completionRate = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

  // 현재 시간 기준 다음 약 찾기
  const now = new Date().toTimeString().slice(0, 5);
  const nextMedication = schedule.find(s => !s.is_taken && s.scheduled_time >= now);

  // 시간대별 그룹핑
  const groupByTime = () => {
    const groups: { [key: string]: MedicationSchedule[] } = {};
    schedule.forEach(item => {
      const hour = parseInt(item.scheduled_time.split(':')[0]);
      let period = '';
      if (hour < 12) period = '아침';
      else if (hour < 17) period = '점심';
      else period = '저녁';
      
      if (!groups[period]) groups[period] = [];
      groups[period].push(item);
    });
    return groups;
  };

  const timeGroups = groupByTime();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="card-senior">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-8 h-8 text-primary-600" />
          <div>
            <h2 className="text-senior-xl font-bold text-gray-800">
              오늘의 약 복용
            </h2>
            <p className="text-senior-sm text-gray-500">{dateString}</p>
          </div>
        </div>

        {/* 진행률 */}
        <div className="bg-gray-100 rounded-full h-6 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500 flex items-center justify-end pr-3"
            style={{ width: `${Math.max(completionRate, 10)}%` }}
          >
            {completionRate > 20 && (
              <span className="text-white text-sm font-bold">
                {completionRate}%
              </span>
            )}
          </div>
        </div>
        
        <p className="text-center text-senior-base text-gray-600 mt-3">
          {takenDoses === totalDoses && totalDoses > 0 ? (
            <span className="text-green-600 font-bold">
              🎉 오늘 약을 모두 드셨어요! 잘하셨습니다!
            </span>
          ) : (
            <>오늘 <span className="font-bold text-primary-600">{totalDoses}번</span> 중 <span className="font-bold text-green-600">{takenDoses}번</span> 복용 완료</>
          )}
        </p>
      </div>

      {/* 다음 약 알림 */}
      {nextMedication && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-senior-lg p-5 flex items-center gap-4">
          <div className="bg-amber-400 rounded-full p-3">
            <Bell className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-senior-sm text-amber-700">다음 복용 예정</p>
            <p className="text-senior-lg font-bold text-amber-900">
              {nextMedication.scheduled_time} - {nextMedication.medication_name}
            </p>
          </div>
          <ChevronRight className="w-6 h-6 text-amber-400" />
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-senior p-4 text-center">
          <p className="text-senior-base text-red-700">{error}</p>
          <button 
            onClick={loadMedications}
            className="mt-3 text-red-600 underline text-senior-sm"
          >
            다시 시도하기
          </button>
        </div>
      )}

      {/* 약 목록 */}
      {schedule.length === 0 ? (
        <div className="card-senior text-center py-12">
          <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-senior-lg text-gray-500 mb-6">
            등록된 약이 없어요
          </p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-primary inline-flex"
          >
            <Plus className="w-6 h-6" />
            약 등록하기
          </button>
        </div>
      ) : (
        Object.entries(timeGroups).map(([period, items]) => (
          <div key={period} className="space-y-3">
            <h3 className="text-senior-lg font-bold text-gray-700 flex items-center gap-2">
              <Clock className="w-6 h-6 text-gray-400" />
              {period}
            </h3>
            
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div 
                  key={`${item.medication_id}-${item.scheduled_time}-${idx}`}
                  className={`card-senior flex items-center gap-4 transition-all duration-300 ${
                    item.is_taken 
                      ? 'bg-green-50 border-green-200' 
                      : 'hover:shadow-senior-lg'
                  }`}
                >
                  {/* 체크 아이콘 */}
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.is_taken 
                      ? 'bg-green-500 check-animation' 
                      : 'bg-gray-100'
                  }`}>
                    {item.is_taken ? (
                      <Check className="w-8 h-8 text-white" />
                    ) : (
                      <Pill className="w-8 h-8 text-gray-400" />
                    )}
                  </div>

                  {/* 약 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-senior-lg font-bold truncate ${
                      item.is_taken ? 'text-green-700' : 'text-gray-800'
                    }`}>
                      {item.medication_name}
                    </p>
                    <p className={`text-senior-sm ${
                      item.is_taken ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {item.scheduled_time} · {item.dosage}
                    </p>
                  </div>

                  {/* 복용 버튼 */}
                  {!item.is_taken && (
                    <button
                      onClick={() => handleTakeMedication(item.medication_id, item.scheduled_time)}
                      className="bg-green-500 hover:bg-green-600 text-white px-6 py-4 rounded-senior 
                                 text-senior-base font-bold transition-all active:scale-95
                                 shadow-md hover:shadow-lg flex-shrink-0"
                    >
                      <span className="flex items-center gap-2">
                        <Check className="w-5 h-5" />
                        먹었어요
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* 약 추가 버튼 (플로팅) */}
      {schedule.length > 0 && (
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-24 right-6 bg-primary-600 hover:bg-primary-700 
                     text-white p-5 rounded-full shadow-lg hover:shadow-xl
                     transition-all active:scale-95 z-40"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}

      {/* 약 추가 모달 */}
      {showAddModal && (
        <AddMedicationModal 
          userId={userId}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            loadMedications();
          }}
        />
      )}
    </div>
  );
}

// 약 추가 모달 컴포넌트
interface AddMedicationModalProps {
  userId: string;
  onClose: () => void;
  onAdded: () => void;
}

function AddMedicationModal({ userId, onClose, onAdded }: AddMedicationModalProps) {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('1알');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [saving, setSaving] = useState(false);

  const addTime = () => {
    setTimes([...times, '12:00']);
  };

  const removeTime = (index: number) => {
    setTimes(times.filter((_, i) => i !== index));
  };

  const updateTime = (index: number, value: string) => {
    const newTimes = [...times];
    newTimes[index] = value;
    setTimes(newTimes);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('약 이름을 입력해주세요');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          medicationName: name,
          dosage,
          alarmTimes: times.sort(),
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        onAdded();
      } else {
        alert('약 등록에 실패했습니다');
      }
    } catch (err) {
      alert('오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slide-up">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-center justify-between">
          <h2 className="text-senior-xl font-bold">약 등록하기</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-7 h-7 text-gray-500" />
          </button>
        </div>

        {/* 폼 */}
        <div className="p-5 space-y-6">
          {/* 약 이름 */}
          <div>
            <label className="block text-senior-base font-semibold text-gray-700 mb-2">
              약 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 혈압약, 당뇨약"
              className="input-senior"
            />
          </div>

          {/* 용량 */}
          <div>
            <label className="block text-senior-base font-semibold text-gray-700 mb-2">
              1회 복용량
            </label>
            <input
              type="text"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="예: 1알, 2정"
              className="input-senior"
            />
          </div>

          {/* 복용 시간 */}
          <div>
            <label className="block text-senior-base font-semibold text-gray-700 mb-2">
              복용 시간
            </label>
            <div className="space-y-3">
              {times.map((time, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => updateTime(idx, e.target.value)}
                    className="input-senior flex-1"
                  />
                  {times.length > 1 && (
                    <button
                      onClick={() => removeTime(idx)}
                      className="p-3 bg-red-100 hover:bg-red-200 rounded-senior text-red-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addTime}
              className="mt-3 w-full py-3 border-2 border-dashed border-gray-300 
                         rounded-senior text-gray-500 hover:border-primary-400 
                         hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              시간 추가
            </button>
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-5">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-success w-full"
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
