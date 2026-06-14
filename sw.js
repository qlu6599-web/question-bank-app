const CACHE_NAME = "question-bank-mvp-v18";
const ASSETS = [
  "./",
  "./index.html?v=20260614-v18",
  "./refresh.html?v=20260614-v18",
  "./manifest.webmanifest?v=20260614-v18",
  "./styles/app.css?v=20260614-v18",
  "./app/config/app_config.js?v=20260614-v18",
  "./app/components/ui.js?v=20260614-v18",
  "./app/store/app_store.js?v=20260614-v18",
  "./app/services/ai_tutor.js?v=20260614-v18",
  "./app/services/cloud_sync.js?v=20260614-v18",
  "./app/services/user_service.js?v=20260614-v18",
  "./app/data/question_bank.json?v=20260614-v18",
  "./app/data/question_repository.js?v=20260614-v18",
  "./app/logic/quiz_engine.js?v=20260614-v18",
  "./app/logic/error_book.js?v=20260614-v18",
  "./app/logic/stats.js?v=20260614-v18",
  "./app/logic/mixed_practice.js?v=20260614-v18",
  "./app/logic/exam_engine.js?v=20260614-v18",
  "./app/logic/exam_scorer.js?v=20260614-v18",
  "./app/pages/home.js?v=20260614-v18",
  "./app/pages/subject.js?v=20260614-v18",
  "./app/pages/quiz.js?v=20260614-v18",
  "./app/pages/exam.js?v=20260614-v18",
  "./app/pages/wrongBook.js?v=20260614-v18",
  "./app/pages/stats.js?v=20260614-v18",
  "./app/pages/profile.js?v=20260614-v18",
  "./app/main.js?v=20260614-v18",
  "./assets/icon-192.svg",
  "./assets/icon-512.svg",
  "./assets/questions/ai/ai-25.png",
  "./assets/questions/ai/ai-58.png",
  "./assets/questions/ai/ai-69.png",
  "./assets/questions/ai/ai-125.png",
  "./assets/questions/ai/ai-138.png",
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
    url.pathname.includes("/app/") ||
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
