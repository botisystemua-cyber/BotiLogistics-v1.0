// BotiLogistics Service Worker — потрібен для PWA встановлення
// ВАЖЛИВО: бампай версію при кожному релізі щоб старий кеш видалявся автоматично.
var CACHE_NAME = 'botilogistics-crm-v3';

// Файли, які ЗАВЖДИ мусять братися з мережі свіжими (щоб не було
// розсинхрону між HTML/CSS/JS через HTTP-кеш браузера).
var NO_HTTP_CACHE = [
  'Passengers.html',
  'Passengers.js',
  'Passengers.css',
  'supabase-config.js',
  'supabase-api.js',
  'sw.js',
  'manifest.json'
];

// Install — просто активуємось
self.addEventListener('install', function(e) {
  self.skipWaiting();
});

// Message — клієнт може примусити SW активуватись (коли знайшли нову версію)
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate — очищаємо старі кеші
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', function(e) {
  // Пропускаємо не-http(s) запити та API запити
  if (!e.request.url.startsWith('http') ||
      e.request.url.includes('script.google.com') ||
      e.request.url.includes('googleapis.com') ||
      e.request.method !== 'GET') {
    return;
  }

  // Для «критичних» файлів (HTML/JS/CSS аплікухи) ОБХОДИМО HTTP-кеш браузера
  // через cache: 'no-store' — це єдиний спосіб гарантувати, що Passengers.js
  // та Passengers.html не розсинхронізуються. Для решти контенту (іконки,
  // картинки, шрифти) лишаємо звичайний fetch, щоб браузер міг кешувати.
  var url = e.request.url;
  var isCritical = NO_HTTP_CACHE.some(function(name) {
    return url.indexOf('/' + name) !== -1 || url.indexOf(name + '?') !== -1;
  });

  var fetchRequest = isCritical
    ? fetch(e.request, { cache: 'no-store' })
    : fetch(e.request);

  e.respondWith(
    fetchRequest.then(function(response) {
      // Кешуємо успішні відповіді
      if (response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
      }
      return response;
    }).catch(function() {
      // Якщо мережа недоступна — беремо з кешу
      return caches.match(e.request);
    })
  );
});
