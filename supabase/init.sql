-- supabase/init.sql
-- 시니어 동반자 AI 비서 데이터베이스 초기화

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) DEFAULT '어르신',
  phone VARCHAR(20) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 약 복용 정보 테이블 (핵심)
CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100) DEFAULT '1알',
  alarm_times JSONB NOT NULL DEFAULT '["08:00", "12:00", "18:00"]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_taken_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 약 복용 기록 테이블
CREATE TABLE IF NOT EXISTS medication_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_time VARCHAR(10) NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL,
  date DATE NOT NULL,
  UNIQUE(medication_id, date, scheduled_time)
);

-- 대화 기록 테이블
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 푸시 알림 구독 테이블
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_is_active ON medications(is_active);
CREATE INDEX IF NOT EXISTS idx_medication_logs_medication_id ON medication_logs(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_date ON medication_logs(date);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_medications_updated_at ON medications;
CREATE TRIGGER update_medications_updated_at
  BEFORE UPDATE ON medications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 정책
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 기본 사용자 생성 (테스트용)
INSERT INTO users (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', '테스트 어르신')
ON CONFLICT DO NOTHING;

-- 샘플 약 데이터 생성
INSERT INTO medications (user_id, medication_name, dosage, alarm_times) 
VALUES 
  ('00000000-0000-0000-0000-000000000001', '혈압약', '1알', '["08:00", "20:00"]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', '당뇨약', '1알', '["07:30", "12:30", "18:30"]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', '비타민D', '1알', '["09:00"]'::jsonb)
ON CONFLICT DO NOTHING;

-- 헬퍼 함수: 오늘 복용해야 할 약 목록 조회
CREATE OR REPLACE FUNCTION get_today_medications(p_user_id UUID)
RETURNS TABLE (
  medication_id UUID,
  medication_name VARCHAR,
  dosage VARCHAR,
  scheduled_time TEXT,
  is_taken BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as medication_id,
    m.medication_name,
    m.dosage,
    t.time as scheduled_time,
    EXISTS(
      SELECT 1 FROM medication_logs ml 
      WHERE ml.medication_id = m.id 
      AND ml.date = CURRENT_DATE 
      AND ml.scheduled_time = t.time
    ) as is_taken
  FROM medications m
  CROSS JOIN LATERAL jsonb_array_elements_text(m.alarm_times) AS t(time)
  WHERE m.user_id = p_user_id AND m.is_active = true
  ORDER BY t.time;
END;
$$ LANGUAGE plpgsql;

-- 헬퍼 함수: 약 복용 완료 기록
CREATE OR REPLACE FUNCTION mark_medication_taken(
  p_medication_id UUID,
  p_scheduled_time VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
  -- 복용 기록 추가
  INSERT INTO medication_logs (medication_id, scheduled_time, taken_at, date)
  VALUES (p_medication_id, p_scheduled_time, NOW(), CURRENT_DATE)
  ON CONFLICT (medication_id, date, scheduled_time) DO NOTHING;
  
  -- 마지막 복용 시간 업데이트
  UPDATE medications SET last_taken_at = NOW() WHERE id = p_medication_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;
