// app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  MessageCircle, 
  Pill, 
  Settings, 
  Bell, 
  BellOff,
  Heart 
} from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import MedicationDashboard from './components/MedicationDashboard';
import MedicationAlarm from './components/MedicationAlarm';
import OfflineIndicator from './components/OfflineIndicator';
import usePushNotifications from './components/usePushNotifications';

type Tab = 'chat' | 'medications' | 'settings';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [refreshKey, setRefreshKey] = useState(0);
  
  const {
    isSupported: isPushSupported,
    isSubscribed: isPushSubscribed,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    loading: pushLoading,
  } = usePushNotifications(DEFAULT_USER_ID);

  // URL 파라미터로 탭 설정
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'medications' || tab === 'chat' || tab === 'settings') {
      setActiveTab(tab);
    }
  }, []);

  // 약 복용 완료 시 대시보드 새로고침
  const handleMedicationTaken = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // 푸시 알림 토글
  const togglePushNotifications = async () => {
    if (isPushSubscribed) {
      await unsubscribePush();
    } else {
      await subscribePush();
    }
  };

  return (
    <main className="flex flex-col h-screen bg-senior-bg">
      {/* 오프라인 인디케이터 */}
      <OfflineIndicator />
      
      {/* 약 복용 알람 */}
      <MedicationAlarm 
        userId={DEFAULT_USER_ID} 
        onMedicationTaken={handleMedicationTaken}
      />

      {/* 메인 컨텐츠 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <ChatInterface 
            userId={DEFAULT_USER_ID}
            onMedicationTaken={handleMedicationTaken}
          />
        )}
        
        {activeTab === 'medications' && (
          <div className="h-full overflow-y-auto p-4 pb-24">
            <MedicationDashboard 
              key={refreshKey}
              userId={DEFAULT_USER_ID}
              onMedicationTaken={handleMedicationTaken}
            />
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div className="h-full overflow-y-auto p-4 pb-24">
            <SettingsPanel 
              isPushSupported={isPushSupported}
              isPushSubscribed={isPushSubscribed}
              pushLoading={pushLoading}
              onTogglePush={togglePushNotifications}
            />
          </div>
        )}
      </div>

      {/* 하단 네비게이션 */}
      <nav className="bg-white border-t border-gray-200 px-4 py-2 safe-area-bottom">
        <div className="flex justify-around max-w-lg mx-auto">
          <NavButton 
            icon={<MessageCircle className="w-7 h-7" />}
            label="대화"
            isActive={activeTab === 'chat'}
            onClick={() => setActiveTab('chat')}
          />
          <NavButton 
            icon={<Pill className="w-7 h-7" />}
            label="약 복용"
            isActive={activeTab === 'medications'}
            onClick={() => setActiveTab('medications')}
          />
          <NavButton 
            icon={<Settings className="w-7 h-7" />}
            label="설정"
            isActive={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </div>
      </nav>
    </main>
  );
}

// 네비게이션 버튼 컴포넌트
interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function NavButton({ icon, label, isActive, onClick }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center py-2 px-6 rounded-xl transition-all ${
        isActive 
          ? 'text-primary-600 bg-primary-50' 
          : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {icon}
      <span className={`text-sm mt-1 font-medium ${isActive ? 'text-primary-600' : ''}`}>
        {label}
      </span>
    </button>
  );
}

// 설정 패널 컴포넌트
interface SettingsPanelProps {
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  pushLoading: boolean;
  onTogglePush: () => void;
}

function SettingsPanel({ 
  isPushSupported, 
  isPushSubscribed, 
  pushLoading,
  onTogglePush 
}: SettingsPanelProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-senior-2xl font-bold text-gray-800">설정</h1>

      {/* 알림 설정 */}
      <div className="card-senior">
        <h2 className="text-senior-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary-600" />
          알림 설정
        </h2>

        <div className="space-y-4">
          {/* 푸시 알림 */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-senior-base font-semibold text-gray-800">
                약 복용 알림
              </p>
              <p className="text-senior-sm text-gray-500">
                약 드실 시간에 알림을 받아요
              </p>
            </div>
            
            {isPushSupported ? (
              <button
                onClick={onTogglePush}
                disabled={pushLoading}
                className={`relative w-16 h-9 rounded-full transition-colors ${
                  isPushSubscribed ? 'bg-primary-600' : 'bg-gray-300'
                } ${pushLoading ? 'opacity-50' : ''}`}
              >
                <div className={`absolute top-1 w-7 h-7 bg-white rounded-full shadow transition-transform ${
                  isPushSubscribed ? 'translate-x-8' : 'translate-x-1'
                }`} />
              </button>
            ) : (
              <span className="text-senior-sm text-gray-400">
                지원되지 않음
              </span>
            )}
          </div>

          {/* 알림 상태 */}
          {isPushSupported && (
            <div className={`p-4 rounded-senior ${
              isPushSubscribed ? 'bg-green-50' : 'bg-amber-50'
            }`}>
              {isPushSubscribed ? (
                <p className="text-green-700 text-senior-sm flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  알림이 활성화되어 있어요. 약 드실 시간에 알려드릴게요!
                </p>
              ) : (
                <p className="text-amber-700 text-senior-sm flex items-center gap-2">
                  <BellOff className="w-5 h-5" />
                  알림을 켜면 약 드실 시간을 놓치지 않아요!
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 앱 정보 */}
      <div className="card-senior">
        <h2 className="text-senior-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Heart className="w-6 h-6 text-red-500" />
          마음벗 소개
        </h2>

        <div className="space-y-4 text-senior-base text-gray-600">
          <p>
            마음벗은 어르신과 1인 가구 분들을 위한 따뜻한 AI 동반자예요.
          </p>
          <p>
            약 복용 시간을 알려드리고, 건강 관리를 도와드리며, 
            언제든 편하게 대화할 수 있어요.
          </p>
          <p className="text-senior-sm text-gray-400">
            버전 1.0.0
          </p>
        </div>
      </div>

      {/* 문의하기 */}
      <div className="card-senior">
        <h2 className="text-senior-lg font-bold text-gray-800 mb-4">
          도움이 필요하신가요?
        </h2>
        <p className="text-senior-base text-gray-600 mb-4">
          사용 중 어려운 점이 있으시면 언제든 문의해 주세요.
        </p>
        <button className="btn-outline w-full">
          문의하기
        </button>
      </div>
    </div>
  );
}
