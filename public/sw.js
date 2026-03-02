// public/sw.js
// 시니어 동반자 AI 비서 - Service Worker
// 약 복용 알람을 위한 백그라운드 푸시 알림 지원

const CACHE_NAME = 'companion-ai-v1';
const OFFLINE_URL = '/offline.html';

// 캐시할 파일 목록
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// 약 알림 상태 저장소
let medicationAlarms = [];
let snoozeTimers = {};

// Service Worker 설치
self.addEventListener('install', (event) => {
  console.log('[SW] 설치 중...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 정적 자원 캐싱');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Service Worker 활성화
self.addEventListener('activate', (event) => {
  console.log('[SW] 활성화됨');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// 네트워크 요청 가로채기 (오프라인 지원)
self.addEventListener('fetch', (event) => {
  // API 요청은 캐시하지 않음
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return new Response(
            JSON.stringify({ 
              error: true, 
              message: '오프라인 상태입니다' 
            }),
            { 
              headers: { 'Content-Type': 'application/json' },
              status: 503 
            }
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            // 유효한 응답만 캐시
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // HTML 요청 시 오프라인 페이지 제공
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// 푸시 알림 수신
self.addEventListener('push', (event) => {
  console.log('[SW] 푸시 알림 수신');
  
  let data = {
    title: '마음벗 알림',
    body: '새로운 알림이 있습니다.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'default',
    requireInteraction: true,
    data: {}
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag,
    requireInteraction: data.requireInteraction !== false,
    vibrate: [200, 100, 200, 100, 200], // 진동 패턴
    data: data.data,
    actions: data.actions || [
      { action: 'take', title: '💊 약 먹었어요', icon: '/icon-check.png' },
      { action: 'snooze', title: '⏰ 5분 후 알림', icon: '/icon-snooze.png' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 알림 클릭:', event.action);
  
  const notification = event.notification;
  const data = notification.data || {};
  
  notification.close();

  if (event.action === 'take') {
    // 약 복용 완료 처리
    event.waitUntil(
      handleMedicationTaken(data)
    );
  } else if (event.action === 'snooze') {
    // 5분 후 재알림
    event.waitUntil(
      scheduleSnooze(data)
    );
  } else {
    // 기본 클릭 - 앱 열기
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // 이미 열린 창이 있으면 포커스
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          // 없으면 새 창 열기
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

// 약 복용 완료 처리
async function handleMedicationTaken(data) {
  try {
    // 스누즈 타이머 취소
    if (data.medicationId && snoozeTimers[data.medicationId]) {
      clearTimeout(snoozeTimers[data.medicationId]);
      delete snoozeTimers[data.medicationId];
    }

    // 클라이언트에 메시지 전송
    const allClients = await clients.matchAll({ includeUncontrolled: true });
    allClients.forEach((client) => {
      client.postMessage({
        type: 'MEDICATION_TAKEN',
        data: data,
      });
    });

    // 서버에 복용 기록 전송 (온라인일 경우)
    if (navigator.onLine) {
      await fetch('/api/medications/taken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    }

    // 복용 완료 알림
    await self.registration.showNotification('마음벗', {
      body: '잘하셨어요, 어르신! 건강이 제일입니다. 💚',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'medication-complete',
      requireInteraction: false,
    });

  } catch (error) {
    console.error('[SW] 복용 기록 실패:', error);
  }
}

// 5분 후 재알림 스케줄
async function scheduleSnooze(data) {
  const SNOOZE_DELAY = 5 * 60 * 1000; // 5분
  
  if (data.medicationId) {
    // 기존 스누즈 취소
    if (snoozeTimers[data.medicationId]) {
      clearTimeout(snoozeTimers[data.medicationId]);
    }
    
    // 새 스누즈 설정
    snoozeTimers[data.medicationId] = setTimeout(async () => {
      await self.registration.showNotification('💊 약 드실 시간이에요', {
        body: `${data.medicationName || '약'}을(를) 아직 드시지 않으셨어요. 건강을 위해 꼭 드세요!`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `medication-${data.medicationId}`,
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300],
        data: data,
        actions: [
          { action: 'take', title: '💊 약 먹었어요' },
          { action: 'snooze', title: '⏰ 5분 후 알림' },
        ],
      });
      
      delete snoozeTimers[data.medicationId];
    }, SNOOZE_DELAY);
  }

  // 스누즈 확인 알림
  await self.registration.showNotification('마음벗', {
    body: '5분 후에 다시 알려드릴게요. ⏰',
    icon: '/icon-192.png',
    tag: 'snooze-confirm',
    requireInteraction: false,
  });
}

// 메인 앱에서 메시지 수신
self.addEventListener('message', (event) => {
  console.log('[SW] 메시지 수신:', event.data);
  
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SET_MEDICATION_ALARMS':
      medicationAlarms = payload || [];
      console.log('[SW] 약 알람 설정됨:', medicationAlarms.length);
      break;
      
    case 'TRIGGER_ALARM':
      showMedicationAlarm(payload);
      break;
      
    case 'CANCEL_SNOOZE':
      if (payload.medicationId && snoozeTimers[payload.medicationId]) {
        clearTimeout(snoozeTimers[payload.medicationId]);
        delete snoozeTimers[payload.medicationId];
      }
      break;
      
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

// 약 복용 알람 표시
async function showMedicationAlarm(data) {
  await self.registration.showNotification('💊 약 드실 시간이에요!', {
    body: `${data.medicationName} ${data.dosage} 드실 시간입니다.`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `medication-${data.medicationId}`,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    data: data,
    actions: [
      { action: 'take', title: '💊 약 먹었어요' },
      { action: 'snooze', title: '⏰ 5분 후 알림' },
    ],
  });
}

// 백그라운드 동기화 (추후 확장용)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-medication-logs') {
    event.waitUntil(syncMedicationLogs());
  }
});

// 오프라인 중 기록된 복용 기록 동기화
async function syncMedicationLogs() {
  // IndexedDB에서 동기화 대기 중인 기록 가져와서 서버 전송
  console.log('[SW] 복용 기록 동기화 중...');
}

console.log('[SW] Service Worker 로드됨');
