const CACHE_NAME = 'sacalog-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './players_data.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// インストールイベントでアセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// アクティベーションイベントで古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// フェッチイベントでキャッシュファースト（またはネットワークフォールバック）を適用
self.addEventListener('fetch', (event) => {
  // GETリクエストのみを対象とし、chrome-extensionなどの特殊スキームを除外
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // キャッシュがあればそれを返す
      }

      return fetch(event.request).then((networkResponse) => {
        // レスポンスが正常な場合のみキャッシュに保存
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Cloudflare等の環境下で、リダイレクトされたレスポンスはセキュリティ制約上キャッシュできないため除外
        if (networkResponse.redirected) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch((err) => {
        console.error('[Service Worker] Fetch failed:', err);
        // 画面遷移（ナビゲーション）のリクエストが失敗した場合は、キャッシュから index.html を返す
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});
