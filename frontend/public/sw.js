const STATIC_CACHE = 'fangdu-static-v1';
const IMAGE_CACHE = 'fangdu-images-v1';
const PRECACHE_URLS = ['/', '/index.html', '/version.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

const cacheFirst = async (request) => {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  
  // 如果有缓存，先返回缓存
  if (cached) {
    // 后台尝试更新缓存
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.status === 200) {
          cache.put(request, response.clone()).catch(() => {
            // 缓存失败时静默处理
          });
        }
      })
      .catch(() => {
        // 网络请求失败时静默处理，继续使用缓存
      });
    return cached;
  }
  
  // 没有缓存时，从网络获取
  try {
    const response = await fetch(request);
    // 只缓存成功的响应
    if (response && response.ok && response.status === 200) {
      cache.put(request, response.clone()).catch(() => {
        // 缓存失败时静默处理，不影响正常加载
      });
    }
    // 无论成功与否，都返回响应（让浏览器处理非 200 响应）
    return response;
  } catch (error) {
    // 如果网络请求失败（例如 CORS 错误），直接抛出错误
    // 这会被 fetch 事件处理器中的 .catch() 捕获
    throw error;
  }
};

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // 如果有缓存，先返回缓存，然后在后台更新
  if (cached) {
    // 后台更新，不阻塞响应
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.status === 200) {
          cache.put(request, response.clone()).catch(() => {
            // 缓存失败时静默处理
          });
        }
      })
      .catch(() => {
        // 网络请求失败时静默处理，继续使用缓存
      });
    return cached;
  }
  
  // 没有缓存时，直接请求网络
  try {
    const response = await fetch(request);
    if (response && response.ok && response.status === 200) {
      cache.put(request, response.clone()).catch(() => {
        // 缓存失败时静默处理
      });
    }
    return response;
  } catch (error) {
    // 网络请求失败时，抛出错误让浏览器处理
    throw error;
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // 只缓存同源的图片请求，跨域图片直接让浏览器处理（避免 CORS 问题）
  if (request.destination === 'image' || url.pathname.includes('/images/')) {
    if (isSameOrigin) {
      // 同源图片，使用缓存策略
      event.respondWith(
        cacheFirst(request).catch((error) => {
          // 如果缓存策略失败，尝试直接请求网络
          // 如果网络请求也失败，让浏览器处理错误（不要返回错误响应对象）
          return fetch(request).catch(() => {
            // 如果网络请求也失败，返回一个透明的错误响应
            // 这样可以避免 "network error response" 错误
            return new Response(null, { status: 503, statusText: 'Service Unavailable' });
          });
        })
      );
    }
    // 跨域图片，不拦截，让浏览器正常加载
    return;
  }

  // 版本文件使用 stale-while-revalidate 策略
  if (isSameOrigin && url.pathname.endsWith('/version.json')) {
    event.respondWith(
      staleWhileRevalidate(request, STATIC_CACHE).catch((error) => {
        // 如果策略失败，尝试直接请求网络
        console.warn('Service Worker stale-while-revalidate failed, falling back to network:', error);
        return fetch(request).catch(() => {
          // 如果网络请求也失败，返回一个默认响应，避免 "network error response" 错误
          return new Response(JSON.stringify({ version: '1.0.0' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });
      })
    );
    return;
  }
});


