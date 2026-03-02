// lib/tts.ts
// 시니어 친화적 음성 출력 (TTS) 유틸리티

// 음성 설정 타입
interface TTSOptions {
  rate?: number;      // 말하기 속도 (0.1 ~ 10, 기본 0.85 - 시니어용 느린 속도)
  pitch?: number;     // 음높이 (0 ~ 2, 기본 1)
  volume?: number;    // 볼륨 (0 ~ 1, 기본 1)
  lang?: string;      // 언어 (기본 'ko-KR')
}

class TTSManager {
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private koreanVoice: SpeechSynthesisVoice | null = null;
  private isInitialized: boolean = false;
  private defaultOptions: TTSOptions = {
    rate: 0.85,      // 시니어를 위해 조금 느리게
    pitch: 1,
    volume: 1,
    lang: 'ko-KR',
  };

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      this.init();
    }
  }

  private init() {
    if (!this.synthesis) return;

    // 음성 목록 로드
    const loadVoices = () => {
      const voices = this.synthesis!.getVoices();
      
      // 한국어 음성 우선 선택
      this.koreanVoice = voices.find(v => v.lang === 'ko-KR') ||
                         voices.find(v => v.lang.startsWith('ko')) ||
                         voices[0] || null;
      
      this.isInitialized = true;
    };

    // 음성 목록이 이미 로드되었을 수 있음
    if (this.synthesis.getVoices().length > 0) {
      loadVoices();
    }

    // 음성 목록 변경 시 다시 로드
    this.synthesis.onvoiceschanged = loadVoices;
  }

  // 텍스트 음성 출력
  speak(text: string, options?: TTSOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        console.warn('음성 합성이 지원되지 않는 브라우저입니다.');
        resolve();
        return;
      }

      // 현재 재생 중인 음성 중지
      this.stop();

      const opts = { ...this.defaultOptions, ...options };
      const utterance = new SpeechSynthesisUtterance(text);

      utterance.rate = opts.rate!;
      utterance.pitch = opts.pitch!;
      utterance.volume = opts.volume!;
      utterance.lang = opts.lang!;

      if (this.koreanVoice) {
        utterance.voice = this.koreanVoice;
      }

      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        // 'interrupted' 에러는 정상적인 중지로 처리
        if (event.error === 'interrupted') {
          resolve();
        } else {
          reject(event);
        }
      };

      this.currentUtterance = utterance;
      this.synthesis.speak(utterance);
    });
  }

  // 음성 출력 중지
  stop() {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.currentUtterance = null;
    }
  }

  // 음성 일시 정지
  pause() {
    if (this.synthesis) {
      this.synthesis.pause();
    }
  }

  // 음성 재개
  resume() {
    if (this.synthesis) {
      this.synthesis.resume();
    }
  }

  // 현재 재생 중인지 확인
  isSpeaking(): boolean {
    return this.synthesis?.speaking || false;
  }

  // TTS 지원 여부 확인
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  // 음성 목록 가져오기
  getVoices(): SpeechSynthesisVoice[] {
    return this.synthesis?.getVoices() || [];
  }

  // 시니어 친화적 메시지 음성 출력
  async speakForSenior(text: string) {
    return this.speak(text, {
      rate: 0.8,    // 더 느리게
      pitch: 1.05,  // 약간 높은 음
      volume: 1,
    });
  }

  // 알람 음성 출력 (더 크고 명확하게)
  async speakAlarm(text: string) {
    // 알람 전 잠시 대기 (주의 환기)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return this.speak(text, {
      rate: 0.75,   // 매우 느리게
      pitch: 1.1,   // 높은 음
      volume: 1,    // 최대 볼륨
    });
  }
}

// 싱글톤 인스턴스
export const tts = typeof window !== 'undefined' ? new TTSManager() : null;

// 미리 정의된 메시지들
export const TTS_MESSAGES = {
  // 약 복용 관련
  MEDICATION_ALARM: '약 드실 시간이에요. 건강을 위해 약을 꼭 챙겨 드세요.',
  MEDICATION_TAKEN: '잘하셨어요! 건강이 최고입니다.',
  MEDICATION_REMINDER: '아직 약을 드시지 않으셨어요. 건강을 위해 약을 드세요.',
  
  // 인사 관련
  GREETING_MORNING: '좋은 아침이에요! 오늘도 건강한 하루 되세요.',
  GREETING_AFTERNOON: '안녕하세요! 점심은 맛있게 드셨나요?',
  GREETING_EVENING: '편안한 저녁이에요. 오늘 하루도 수고하셨어요.',
  
  // 시스템 관련
  OFFLINE: '비서가 잠시 연결을 확인 중이에요. 걱정 마세요, 약 알림은 기기가 기억하고 있어요.',
  ONLINE: '연결이 다시 되었어요. 무엇을 도와드릴까요?',
  
  // 응원 메시지
  ENCOURAGEMENT: '오늘도 건강하게 지내고 계시군요. 정말 잘하고 계세요!',
};

// 현재 시간대에 맞는 인사말 가져오기
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return TTS_MESSAGES.GREETING_MORNING;
  } else if (hour >= 12 && hour < 18) {
    return TTS_MESSAGES.GREETING_AFTERNOON;
  } else {
    return TTS_MESSAGES.GREETING_EVENING;
  }
}

export default tts;
