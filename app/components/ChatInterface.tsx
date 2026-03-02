// app/components/ChatInterface.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { tts, getTimeBasedGreeting } from '@/lib/tts';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  userId?: string;
  onMedicationTaken?: () => void;
}

export default function ChatInterface({ 
  userId = '00000000-0000-0000-0000-000000000001',
  onMedicationTaken 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // 스크롤 하단으로
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 음성 인식 초기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || 
                                 (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        setSpeechSupported(true);
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.lang = 'ko-KR';
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(transcript);
          setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('음성 인식 오류:', event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  // 시작 인사말
  useEffect(() => {
    const greeting = getTimeBasedGreeting();
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: `안녕하세요! 저는 마음벗이에요. 😊\n\n${greeting}\n\n무엇이든 편하게 말씀해 주세요. 약 드실 시간도 제가 꼭 알려드릴게요!`,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);

    // TTS 재생
    if (isTTSEnabled && tts) {
      tts.speakForSenior(greeting);
    }
  }, []);

  // 메시지 전송
  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    // 사용자 메시지 추가
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // 대화 히스토리 구성 (최근 10개)
      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: history,
          userId,
        }),
      });

      const data = await res.json();

      // AI 응답 추가
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // TTS 재생
      if (isTTSEnabled && tts) {
        await tts.speakForSenior(data.message);
      }

      // 약 복용 감지 시 콜백 호출
      if (data.isMedicationTaken) {
        onMedicationTaken?.();
      }

    } catch (error) {
      console.error('메시지 전송 실패:', error);
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '죄송해요, 잠시 연결이 불안정해요. 조금 뒤에 다시 말씀해 주시겠어요? 💚',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Enter 키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 음성 입력 토글
  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // TTS 토글
  const toggleTTS = () => {
    if (tts?.isSpeaking()) {
      tts.stop();
    }
    setIsTTSEnabled(!isTTSEnabled);
  };

  // 빠른 응답 버튼들
  const quickResponses = [
    { text: '약 먹었어', emoji: '💊' },
    { text: '오늘 기분이 좋아', emoji: '😊' },
    { text: '조금 외로워', emoji: '🥺' },
    { text: '건강 상담', emoji: '🏥' },
  ];

  return (
    <div className="flex flex-col h-full bg-senior-bg">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full 
                        flex items-center justify-center shadow-md">
            <span className="text-2xl">🤗</span>
          </div>
          <div>
            <h1 className="text-senior-lg font-bold text-gray-800">마음벗</h1>
            <p className="text-senior-sm text-green-600">온라인</p>
          </div>
        </div>
        
        {/* TTS 토글 */}
        <button
          onClick={toggleTTS}
          className={`p-3 rounded-full transition-colors ${
            isTTSEnabled ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {isTTSEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
        </button>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {/* AI 아바타 */}
            {message.role === 'assistant' && (
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 
                            rounded-full flex items-center justify-center mr-3 flex-shrink-0 shadow-md">
                <span className="text-lg">🤗</span>
              </div>
            )}
            
            {/* 메시지 버블 */}
            <div
              className={`chat-bubble ${
                message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-2 ${
                message.role === 'user' ? 'text-primary-200' : 'text-gray-400'
              }`}>
                {message.timestamp.toLocaleTimeString('ko-KR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>
        ))}

        {/* 로딩 표시 */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 
                          rounded-full flex items-center justify-center mr-3 flex-shrink-0">
              <span className="text-lg">🤗</span>
            </div>
            <div className="chat-bubble chat-bubble-assistant">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-primary-500" />
                <span className="text-gray-500">생각 중...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 빠른 응답 버튼 */}
      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {quickResponses.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(item.text);
                inputRef.current?.focus();
              }}
              className="flex-shrink-0 px-4 py-2 bg-white border-2 border-gray-200 
                       rounded-full text-senior-sm font-medium text-gray-700
                       hover:border-primary-400 hover:bg-primary-50 transition-colors
                       flex items-center gap-2"
            >
              <span>{item.emoji}</span>
              {item.text}
            </button>
          ))}
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="bg-white border-t border-gray-100 p-4">
        <div className="flex items-end gap-3">
          {/* 음성 입력 버튼 */}
          {speechSupported && (
            <button
              onClick={toggleListening}
              className={`p-4 rounded-full transition-all flex-shrink-0 ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
          )}

          {/* 텍스트 입력 */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="메시지를 입력하세요..."
              rows={1}
              className="w-full px-5 py-4 text-senior-base border-2 border-gray-200 
                       rounded-senior resize-none focus:border-primary-500 
                       focus:ring-4 focus:ring-primary-100 outline-none transition-all"
              style={{ minHeight: '56px', maxHeight: '120px' }}
            />
          </div>

          {/* 전송 버튼 */}
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || isLoading}
            className={`p-4 rounded-full transition-all flex-shrink-0 ${
              inputText.trim() && !isLoading
                ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-md'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <Send className="w-6 h-6" />
          </button>
        </div>

        {/* 음성 입력 중 표시 */}
        {isListening && (
          <p className="text-center text-senior-sm text-red-500 mt-2 animate-pulse">
            🎤 듣고 있어요... 말씀해 주세요
          </p>
        )}
      </div>
    </div>
  );
}
