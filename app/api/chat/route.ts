// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

// ============================================
// 환경 변수 안전 처리 (빌드 실패 방지)
// ============================================
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

function isAPIConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// 시니어 친화적 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 '마음벗'이라는 이름의 시니어 및 1인 가구를 위한 따뜻한 AI 동반자입니다.

## 핵심 역할
- 어르신들의 정서적 케어와 건강 관리를 돕습니다
- 따뜻하고 친근한 말투로 대화합니다
- 약 복용 확인 및 건강 관리를 지원합니다

## 대화 스타일
- 존댓말을 사용하되, 딱딱하지 않고 다정하게 말합니다
- "어르신", "OO님" 등 친근한 호칭을 사용합니다
- 짧고 이해하기 쉬운 문장을 사용합니다
- 격려와 응원의 말을 자주 합니다

## 약 복용 관련 대화
사용자가 "약 먹었어", "약 복용했어" 등의 말을 하면:
1. "잘하셨어요, 어르신! 건강이 제일입니다. 💚" 와 같이 칭찬합니다
2. 응답에 [MEDICATION_TAKEN] 태그를 포함시켜 시스템이 DB를 업데이트하도록 합니다

## 건강 관련 조언
- 의학적 진단이나 처방은 하지 않습니다
- 증상이 심각해 보이면 병원 방문을 권유합니다
- 일반적인 건강 상식과 생활 습관 조언을 제공합니다

## 정서적 지원
- 외로움을 느낄 때 공감하고 따뜻하게 대화합니다
- 일상의 소소한 이야기에도 관심을 보입니다
- 걱정이나 불안에 대해 안심시키는 말을 합니다

항상 밝고 긍정적인 에너지로 대화해주세요!`;

// 약 복용 관련 키워드 감지
const MEDICATION_KEYWORDS = [
  '약 먹었', '약 복용', '약을 먹었', '약을 복용',
  '약 챙겨', '약 먹음', '복용했', '약먹었',
  '약 마셨', '약 삼켰', '복용 완료', '복용완료',
];

function detectMedicationTaken(message: string): boolean {
  const normalizedMessage = message.toLowerCase().replace(/\s+/g, ' ');
  return MEDICATION_KEYWORDS.some(keyword => 
    normalizedMessage.includes(keyword.toLowerCase())
  );
}

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: '메시지가 필요합니다' },
        { status: 400 }
      );
    }

    // 약 복용 키워드 감지
    const medicationDetected = detectMedicationTaken(message);

    // 환경 변수 체크 - 설정 안 되어 있으면 기본 응답
    if (!isAPIConfigured()) {
      console.warn('ANTHROPIC_API_KEY가 설정되지 않았습니다. 기본 응답을 반환합니다.');
      
      const fallbackMessage = medicationDetected
        ? '잘하셨어요, 어르신! 건강이 제일입니다. 약 꼬박꼬박 드시는 모습이 정말 멋져요! 💚'
        : '안녕하세요, 어르신! 현재 AI 연결이 제한되어 있지만, 곧 다시 대화할 수 있을 거예요. 오늘도 건강하게 보내세요! 😊';

      return NextResponse.json({
        message: fallbackMessage,
        isMedicationTaken: medicationDetected,
        timestamp: new Date().toISOString(),
        fallback: true,
      });
    }

    // 대화 히스토리 구성
    const messages = [
      ...conversationHistory.slice(-10), // 최근 10개 메시지만 유지
      { role: 'user' as const, content: message }
    ];

    // Anthropic API 직접 호출 (SDK 대신 fetch 사용)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API 에러:', response.status, errorText);
      throw new Error(`API 에러: ${response.status}`);
    }

    const data = await response.json();

    // 응답 텍스트 추출
    const assistantMessage = data.content?.[0]?.text || '';

    // 약 복용 감지 (사용자 메시지 또는 AI 응답에서)
    const isMedicationTaken = medicationDetected || 
      assistantMessage.includes('[MEDICATION_TAKEN]');

    // [MEDICATION_TAKEN] 태그 제거
    const cleanMessage = assistantMessage.replace('[MEDICATION_TAKEN]', '').trim();

    return NextResponse.json({
      message: cleanMessage || '죄송해요, 응답을 생성하지 못했어요. 다시 말씀해 주시겠어요?',
      isMedicationTaken,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Chat API 오류:', error);
    
    // 오프라인 또는 API 오류 시 기본 응답
    return NextResponse.json({
      message: '죄송해요, 잠시 연결이 불안정해요. 조금 뒤에 다시 말씀해 주시겠어요? 약 알림은 정상적으로 작동하고 있으니 걱정 마세요! 💚',
      error: true,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
