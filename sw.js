// 서비스워커: 네트워크 우선(항상 최신), 오프라인일 때만 캐시 사용
const CACHE = "busan-toilet-v2";
const SHELL = ["./", "index.html", "css/app.css", "fonts/ddong-logo.woff", "js/app.js", "js/i18n.js", "js/icons.js", "js/sos.js", "data/toilets.json", "ddong.mp3"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const same = url.origin === location.origin;
  const cdn = /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (!same && !cdn) return;
  // 아이콘·매니페스트·파비콘은 서비스워커를 거치지 않음 (아이폰 홈 화면 아이콘이 글자로 바뀌는 문제 방지)
  if (same && (/\/icons\//.test(url.pathname) || /\.webmanifest$/.test(url.pathname) || /favicon\.ico$/.test(url.pathname))) return;
  if (cdn) { // 외부 라이브러리·폰트는 캐시 우선
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; })));
    return;
  }
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
