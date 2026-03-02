# 마음벗 - 시니어 동반자 AI 비서

> 시니어 및 1인 가구를 위한 따뜻한 AI 동반자. 약 복용 알림, 건강 관리, 정서적 케어를 제공합니다.

![마음벗](https://via.placeholder.com/800x400/16a34a/ffffff?text=마음벗+AI+비서)

## ✨ 주요 기능

### 💊 약 복용 알람 시스템
- **정밀한 알람**: 설정된 시간에 정확하게 알림
- **백그라운드 알림**: Service Worker를 통한 브라우저 닫힌 상태에서도 알림
- **고대비 팝업**: 시니어 친화적 대형 팝업 UI
- **TTS 음성 안내**: "약 드실 시간입니다" 음성 출력
- **5분 재알림**: '약 먹었음' 버튼 누르기 전까지 재알림
- **복용 기록**: 일별 복용 현황 대시보드

### 🤖 AI 대화 비서
- Claude AI 기반 따뜻한 대화
- 음성 인식 입력 지원
- TTS 응답 출력
- 약 복용 확인 자동 감지 ("약 먹었어" → DB 업데이트)

### 📱 시니어 친화적 UI/UX
- 최소 20px 이상 텍스트
- 큰 버튼과 아이콘
- 고대비 색상
- 직관적인 인터페이스

### 🔔 오프라인 지원
- Service Worker 캐싱
- 오프라인 상태 안내
- 연결 복구 시 자동 동기화

## 🛠 기술 스택

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude API
- **Push**: Web Push API, Service Worker
- **TTS**: Web Speech API

## 📦 설치 및 실행

### 1. 저장소 클론

```bash
git clone https://github.com/your-username/companion-ai.git
cd companion-ai
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key

# Web Push (VAPID Keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your-email@example.com
```

### 4. VAPID 키 생성

```bash
npx web-push generate-vapid-keys
```

### 5. 데이터베이스 초기화

Supabase 대시보드에서 `supabase/init.sql` 파일의 내용을 실행하세요.

### 6. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 앱을 확인하세요.

## 🚀 배포 (Vercel)

### 1. Vercel CLI 설치

```bash
npm i -g vercel
```

### 2. 배포

```bash
vercel
```

### 3. 환경 변수 설정

Vercel 대시보드에서 환경 변수를 설정하세요.

## 📁 프로젝트 구조

```
companion-ai/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # Claude AI 채팅 API
│   │   ├── medications/route.ts    # 약 관리 API
│   │   └── push/route.ts          # 푸시 알림 API
│   ├── components/
│   │   ├── ChatInterface.tsx      # 채팅 인터페이스
│   │   ├── MedicationDashboard.tsx # 약 복용 대시보드
│   │   ├── MedicationAlarm.tsx    # 약 복용 알람 팝업
│   │   ├── OfflineIndicator.tsx   # 오프라인 표시
│   │   └── usePushNotifications.tsx # 푸시 알림 훅
│   ├── globals.css                # 전역 스타일
│   ├── layout.tsx                 # 루트 레이아웃
│   └── page.tsx                   # 메인 페이지
├── lib/
│   ├── supabase.ts                # Supabase 클라이언트
│   └── tts.ts                     # TTS 유틸리티
├── prisma/
│   └── schema.prisma              # Prisma 스키마
├── public/
│   ├── sw.js                      # Service Worker
│   ├── manifest.json              # PWA 매니페스트
│   └── offline.html               # 오프라인 페이지
└── supabase/
    └── init.sql                   # DB 초기화 SQL
```

## 🗄 데이터베이스 스키마

### medications 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 기본키 |
| user_id | UUID | 사용자 ID |
| medication_name | String | 약 이름 |
| dosage | String | 용량 (예: '1알') |
| alarm_times | JSONB | 복용 시간 리스트 |
| is_active | Boolean | 활성화 여부 |
| last_taken_at | Timestamp | 마지막 복용 시간 |

### medication_logs 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 기본키 |
| medication_id | UUID | 약 ID |
| scheduled_time | String | 예정 시간 |
| taken_at | Timestamp | 실제 복용 시간 |
| date | Date | 날짜 |

## 🎨 디자인 가이드

- **Primary Color**: #16a34a (Green)
- **Background**: #fefce8 (Warm Cream)
- **Text**: #1c1917 (Near Black)
- **Font Size**: 최소 18px, 권장 20px+
- **Button Height**: 최소 48px
- **Border Radius**: 16px (senior)

## 📱 PWA 지원

- 홈 화면에 추가 가능
- 오프라인 동작
- 푸시 알림
- 전체 화면 모드

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

MIT License - 자유롭게 사용하세요!

## 💬 문의

문의사항이 있으시면 Issues를 통해 연락해 주세요.

---

Made with ❤️ for Seniors
