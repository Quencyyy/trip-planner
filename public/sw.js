// 離線也能看行程：
// - 程式檔（assets/ 有雜湊檔名）與字型：先用快取
// - 頁面、行程資料、清單、圖示：先上網拿最新的，失敗才用快取
// - GitHub API 與匯率不經過這裡（記帳一定要連網）
const CACHE = 'trip-planner-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(req, fallbackUrl) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(fallbackUrl ?? req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(fallbackUrl ?? req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  if (req.mode === 'navigate') {
    // 所有頁面都是同一個 index.html（路由在 # 後面）
    event.respondWith(networkFirst(req, scope.href));
  } else if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});
