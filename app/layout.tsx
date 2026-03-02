// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '마음벗 - 시니어 동반자 AI 비서',
  description: '시니어와 1인 가구를 위한 따뜻한 AI 동반자. 약 복용 알림, 건강 관리, 정서적 케어를 제공합니다.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '마음벗',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#fefce8',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* PWA 관련 메타 태그 */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
        
        {/* Service Worker 등록 스크립트 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('Service Worker 등록 성공:', registration.scope);
                    })
                    .catch(function(error) {
                      console.log('Service Worker 등록 실패:', error);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-senior-bg">
        {/* 오프라인 감지 스크립트 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('online', () => {
                document.dispatchEvent(new CustomEvent('app:online'));
              });
              window.addEventListener('offline', () => {
                document.dispatchEvent(new CustomEvent('app:offline'));
              });
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
