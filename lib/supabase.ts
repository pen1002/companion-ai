// lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// 환경 변수 안전 처리 (빌드 실패 방지)
// ============================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 환경 변수 검증 함수
function validateEnvVars(): { isValid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  
  return {
    isValid: missing.length === 0,
    missing,
  };
}

// 환경 변수 상태
const envStatus = validateEnvVars();

// 클라이언트용 Supabase 인스턴스 (환경 변수 누락 시 더미 클라이언트)
let supabase: SupabaseClient;

if (envStatus.isValid) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // 빌드 시에는 더미 클라이언트 생성 (런타임에서 에러 처리)
  console.warn(
    `⚠️ Supabase 환경 변수 누락: ${envStatus.missing.join(', ')}\n` +
    '런타임에서 데이터베이스 기능이 제한됩니다.'
  );
  // 더미 URL로 클라이언트 생성 (실제 호출 시 에러 발생)
  supabase = createClient(
    'https://placeholder.supabase.co',
    'placeholder-key'
  );
}

export { supabase };

// 환경 변수 상태 확인 함수 (컴포넌트에서 사용)
export function isSupabaseConfigured(): boolean {
  return envStatus.isValid;
}

export function getSupabaseError(): string | null {
  if (!envStatus.isValid) {
    return `Supabase 설정이 필요합니다. 환경 변수를 확인해주세요: ${envStatus.missing.join(', ')}`;
  }
  return null;
}

// ============================================
// 타입 정의
// ============================================
export interface User {
  id: string;
  name: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Medication {
  id: string;
  user_id: string;
  medication_name: string;
  dosage: string;
  alarm_times: string[];
  is_active: boolean;
  last_taken_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MedicationLog {
  id: string;
  medication_id: string;
  scheduled_time: string;
  taken_at: string;
  date: string;
}

export interface TodayMedication {
  medication_id: string;
  medication_name: string;
  dosage: string;
  scheduled_time: string;
  is_taken: boolean;
}

export interface Conversation {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  created_at: string;
}

// ============================================
// 안전한 데이터베이스 함수들 (에러 핸들링 포함)
// ============================================

// 오늘 복용해야 할 약 목록 조회
export async function getTodayMedications(userId: string): Promise<TodayMedication[]> {
  if (!envStatus.isValid) {
    console.error('Supabase가 설정되지 않았습니다.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .rpc('get_today_medications', { p_user_id: userId });
    
    if (error) {
      console.error('오늘 약 목록 조회 실패:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('오늘 약 목록 조회 중 예외 발생:', err);
    return [];
  }
}

// 약 복용 완료 기록
export async function markMedicationTaken(
  medicationId: string, 
  scheduledTime: string
): Promise<boolean> {
  if (!envStatus.isValid) {
    console.error('Supabase가 설정되지 않았습니다.');
    return false;
  }

  try {
    const { data, error } = await supabase
      .rpc('mark_medication_taken', {
        p_medication_id: medicationId,
        p_scheduled_time: scheduledTime
      });
    
    if (error) {
      console.error('복용 기록 실패:', error);
      return false;
    }
    
    return data;
  } catch (err) {
    console.error('복용 기록 중 예외 발생:', err);
    return false;
  }
}

// 약 정보 저장
export async function saveMedication(
  userId: string,
  medication: Partial<Medication>
): Promise<Medication | null> {
  if (!envStatus.isValid) {
    console.error('Supabase가 설정되지 않았습니다.');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('medications')
      .upsert({
        user_id: userId,
        ...medication,
      })
      .select()
      .single();
    
    if (error) {
      console.error('약 저장 실패:', error);
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('약 저장 중 예외 발생:', err);
    return null;
  }
}

// 사용자의 모든 약 목록 조회
export async function getMedications(userId: string): Promise<Medication[]> {
  if (!envStatus.isValid) {
    console.error('Supabase가 설정되지 않았습니다.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('medication_name');
    
    if (error) {
      console.error('약 목록 조회 실패:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('약 목록 조회 중 예외 발생:', err);
    return [];
  }
}

// 대화 기록 저장
export async function saveConversation(
  userId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  if (!envStatus.isValid) {
    console.error('Supabase가 설정되지 않았습니다.');
    return;
  }

  try {
    const { error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, role, content });
    
    if (error) {
      console.error('대화 저장 실패:', error);
    }
  } catch (err) {
    console.error('대화 저장 중 예외 발생:', err);
  }
}

// 최근 대화 불러오기
export async function getRecentConversations(
  userId: string,
  limit: number = 10
): Promise<Conversation[]> {
  if (!envStatus.isValid) {
    console.error('Supabase가 설정되지 않았습니다.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('대화 조회 실패:', error);
      return [];
    }
    
    return (data || []).reverse();
  } catch (err) {
    console.error('대화 조회 중 예외 발생:', err);
    return [];
  }
}

// 푸시 구독 저장
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionJSON
): Promise<boolean> {
  if (!envStatus.isValid) {
    console.error('Supabase가 설정되지 않았습니다.');
    return false;
  }

  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      });
    
    if (error) {
      console.error('푸시 구독 저장 실패:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('푸시 구독 저장 중 예외 발생:', err);
    return false;
  }
}

// 사용자의 푸시 구독 조회
export async function getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
  if (!envStatus.isValid) {
    console.error('Supabase가 설정되지 않았습니다.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      console.error('푸시 구독 조회 실패:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('푸시 구독 조회 중 예외 발생:', err);
    return [];
  }
}
