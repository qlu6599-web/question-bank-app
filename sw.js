const CACHE_NAME = "question-bank-mvp-v6";
const ASSETS = [
  "./",
  "./index.html?v=20260613-v6",
  "./refresh.html?v=20260613-v6",
  "./manifest.webmanifest?v=20260613-v6",
  "./styles/app.css?v=20260613-v6",
  "./src/app.js?v=20260613-v6",
  "./src/data/questions.js?v=20260613-v6",
  "./src/services/aiTutor.js?v=20260613-v6",
  "./src/services/analytics.js?v=20260613-v6",
  "./src/services/cloudSync.js?v=20260613-v6",
  "./src/services/userService.js?v=20260613-v6",
  "./src/store/appStore.js?v=20260613-v6",
  "./src/utils/dom.js?v=20260613-v6",
  "./assets/icon-192.svg",
  "./assets/icon-512.svg",
  "./assets/answers/software/image18.png",
  "./assets/answers/software/image19.png",
  "./assets/answers/software/image20.png",
  "./assets/answers/software/image21.png",
  "./assets/answers/software/image22.png",
  "./assets/answers/software/image23.png",
  "./assets/answers/software/image24.png",
  "./assets/answers/software/image25.png",
  "./assets/answers/software/image26.png",
  "./assets/answers/software/image27.png",
  "./assets/answers/software/image28.png",
  "./assets/answers/software/image29.png",
  "./assets/answers/software/image30.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isFreshAsset =
    event.request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.includes("/src/") ||
    url.pathname.includes("/styles/");

  if (isFreshAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
