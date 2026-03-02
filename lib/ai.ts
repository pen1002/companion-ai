// lib/ai.ts
// Claude API 클라이언트 및 환경 변수 안전 처리

// ============================================
// 환경 변수 안전 처리 (빌드 실패 방지)
// ============================================
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// 환경 변수 검증 함수
function validateAIEnvVars(): { isValid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!process.env.ANTHROPIC_API_KEY) {
    missing.push('ANTHROPIC_API_KEY');
  }
  
  return {
    isValid: missing.length === 0,
    missing,
  };
}

// 환경 변수 상태
const envStatus = validateAIEnvVars();

// 환경 변수 상태 확인 함수 (컴포넌트에서 사용)
export function isAIConfigured(): boolean {
  return envStatus.isValid;
}

export function getAIError(): string | null {
  if (!envStatus.isValid) {
    return `AI 설정이 필요합니다. 환경 변수를 확인해주세요: ${envStatus.missing.join(', ')}`;
  }
  return null;
}

// ============================================
// 시스템 프롬프트
// ============================================
export const SYSTEM_PROMPT = `당신은 '마음벗'이라는 이름의 따뜻하고 친절한 AI 동반자입니다.
주로 노인과 1인 가구를 대상으로 정서적 지원과 건강 관리를 도와드립니다.

핵심 역할:
1. 따뜻한 대화 상대 - 외로움을 달래고 일상을 함께 나눕니다
2. 건강 관리 도우미 - 약 복용을 챙기고 건강 습관을 응원합니다
3. 생활 정보 제공 - 날씨, 뉴스 등 필요한 정보를 알기 쉽게 전달합니다

대화 스타일:
- 존댓말을 사용하며, "어르신"이라는 호칭을 자연스럽게 사용합니다
- 문장은 짧고 명확하게, 어려운 용어는 쉽게 풀어서 설명합니다
- 항상 긍정적이고 격려하는 말투를 사용합니다
- 이모지는 😊, 💪, ❤️ 등 친근한 것만 적절히 사용합니다

약 복용 관련:
- 사용자가 "약 먹었어", "약 복용했어", "약 먹음" 등을 말하면:
  "잘하셨어요, 어르신! 건강이 제일입니다. 💪" 라고 칭찬하며 응답합니다
- 약 시간을 놓쳤다고 하면 걱정하지 말라고 위로하며, 다음엔 꼭 드시라고 부드럽게 권유합니다

주의사항:
- 의학적 조언은 하지 않으며, 병원 방문을 권유합니다
- 개인 정보나 금융 정보를 묻지 않습니다
- 부정적이거나 불안을 조장하는 말은 피합니다`;

// ============================================
// 약 복용 키워드 감지
// ============================================
const MEDICATION_TAKEN_KEYWORDS = [
  '약 먹었',
  '약 복용',
  '약 먹음',
  '약먹었',
  '약복용',
  '약먹음',
  '약 마셨',
  '약 삼켰',
  '복용 완료',
  '복용완료',
  '먹었어요',
  '먹었습니다',
];

export function detectMedicationTaken(message: string): boolean {
  const normalizedMessage = message.toLowerCase().replace(/\s+/g, ' ');
  return MEDICATION_TAKEN_KEYWORDS.some(keyword => 
    normalizedMessage.includes(keyword.toLowerCase())
  );
}

// ============================================
// AI 응답 생성 (서버 사이드 전용)
// ============================================
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateAIResponse(
  messages: ChatMessage[],
  userMessage: string
): Promise<{ response: string; medicationTaken: boolean }> {
  // 약 복용 감지
  const medicationTaken = detectMedicationTaken(userMessage);

  // 환경 변수 체크
  if (!envStatus.isValid) {
    console.error('AI API가 설정되지 않았습니다.');
    return {
      response: medicationTaken 
        ? '잘하셨어요, 어르신! 건강이 제일입니다. 💪 (현재 AI 연결이 제한되어 있어요)'
        : '안녕하세요, 어르신! 현재 AI 연결이 제한되어 있어 대화가 어려워요. 잠시 후 다시 시도해주세요. 😊',
      medicationTaken,
    };
  }

  try {
    // Anthropic API 호출
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [
          ...messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          {
            role: 'user',
            content: userMessage,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API 에러:', response.status, errorText);
      throw new Error(`API 에러: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.content?.[0]?.text || '죄송해요, 응답을 생성하지 못했어요.';

    return {
      response: aiResponse,
      medicationTaken,
    };
  } catch (error) {
    console.error('AI 응답 생성 중 오류:', error);
    
    // 약 복용 메시지인 경우 기본 응답 제공
    if (medicationTaken) {
      return {
        response: '잘하셨어요, 어르신! 건강이 제일입니다. 💪',
        medicationTaken: true,
      };
    }

    return {
      response: '죄송해요, 잠시 연결이 어려워요. 조금 후에 다시 말씀해주세요. 😊',
      medicationTaken: false,
    };
  }
}

// ============================================
// 환경 변수 검증 (서버 시작 시 로깅)
// ============================================
if (typeof window === 'undefined') {
  // 서버 사이드에서만 실행
  if (!envStatus.isValid) {
    console.warn(
      '\n⚠️  AI 환경 변수 누락 경고 ⚠️\n' +
      `누락된 변수: ${envStatus.missing.join(', ')}\n` +
      'AI 대화 기능이 제한됩니다.\n'
    );
  }
}
