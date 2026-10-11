import { DICT, HTML_LANG } from "./i18n.js";
import { icon, mascotSvg, PIN_HTML } from "./icons.js";
import { SOS, PHRASES } from "./sos.js";

// ---------- 상태 ----------
const CITY_HALL = { lat: 35.1798, lng: 129.0750 }; // 부산시청
const LS = { lang: "busan-toilet-language", reviews: "busan-toilet-community-reviews", ratings: "busan-toilet-ratings" };
const PAGE = 10;

const store = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const state = {
  lang: (() => { const s = store.get(LS.lang, null); return DICT[s] ? s : "ko"; })(),
  view: "list",
  query: "",
  filter: "all",
  region: "all",
  toilets: [],
  meta: null,
  loadError: null,
  selectedId: null,
  user: { ...CITY_HALL },
  locStatus: "locating",
  shown: PAGE,
  reviews: store.get(LS.reviews, {}),
  ratings: store.get(LS.ratings, {}),
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function t(path) {
  const v = path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), DICT[state.lang]);
  if (typeof v === "string") return v;
  const ko = path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), DICT.ko);
  return typeof ko === "string" ? ko : path;
}

// ---------- 계산 ----------
function distanceKm(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(a.lat * r) * Math.cos(b.lat * r);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function travel(to) {
  const m = Math.max(10, Math.round(distanceKm(state.user, to) * 1000));
  const route = m * 1.18;
  const walk = Math.max(1, Math.ceil(route / 75));
  const drive = Math.max(1, Math.ceil(route / 430));
  const mode = route <= 1300 ? "walk" : "drive";
  const dist = m < 1000 ? `${Math.round(m / 10) * 10}${t("common.meters")}` : `${(m / 1000).toFixed(1)}${t("common.km")}`;
  return { dist, mode, walk: `${walk}${t("detail.minutes")} ${t("detail.walk")}`, drive: `${drive}${t("detail.minutes")} ${t("detail.drive")}` };
}
function seoulMinutes() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0);
}
const DAY_KO = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
function seoulWeekday() {
  const w = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short" }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(w);
}
function closedToday(x) {
  const d = seoulWeekday();
  if (x.weekdaysOnly && (d === 0 || d === 6)) return true;
  return Boolean(x.closedDays && x.closedDays.includes(DAY_KO[d]));
}
function isOpenNow(x) {
  if (x.status === "maintenance" || x.status === "closed") return false;
  if (closedToday(x)) return false;
  if (x.open24h) return true;
  const ms = [...String(x.hours || "").replace(/익일\s*/g, "").matchAll(/(\d{1,2})\s*[:시]?\s*(\d{2})?\s*분?\s*[~\-–]\s*(\d{1,2})\s*[:시]?\s*(\d{2})?/g)];
  if (!ms.length) return null;
  const now = seoulMinutes();
  return ms.some((m) => {
    const s = Number(m[1]) * 60 + Number(m[2] || 0), e = Number(m[3]) * 60 + Number(m[4] || 0);
    if (s > 24 * 60 || e > 24 * 60) return false;
    return e >= s ? now >= s && now <= e : now >= s || now <= e;
  });
}
function statusOf(x) {
  const open = isOpenNow(x);
  if (x.status === "maintenance") return { label: t("detail.maintenance"), cls: "b-closed", txt: "t-closed", open };
  if (closedToday(x)) return { label: t("detail.closedToday"), cls: "b-closed", txt: "t-closed", open };
  if (x.open24h) return { label: t("facilities.open24h"), cls: "b-open", txt: "t-open", open };
  if (open === true) return { label: t("detail.open"), cls: "b-open", txt: "t-open", open };
  if (open === false) return { label: t("detail.closed"), cls: "b-closed", txt: "t-closed", open };
  return { label: t("detail.limited"), cls: "b-limited", txt: "t-limited", open };
}
const flagCls = (v) => (v === true ? "yes" : v === false ? "no" : "unk");

function filtered() {
  const q = state.query.trim().toLowerCase();
  return state.toilets
    .filter((x) => {
      if (q && ![x.name, x.address, x.lotAddress, x.dong, x.type, x.category, x.org, x.trail || ""].some((v) => String(v || "").toLowerCase().includes(q))) return false;
      if (state.region !== "all" && x.provider !== state.region) return false;
      switch (state.filter) {
        case "openNow": return isOpenNow(x) === true;
        case "open24h": return x.open24h;
        case "wheelchair": return x.wheelchair === true;
        case "diaper": return x.diaper === true;
        case "emergency": return x.bell === true;
        case "trail": return Boolean(x.trail);
        default: return true;
      }
    })
    .map((x) => ({ x, d: distanceKm(state.user, x) }))
    .sort((a, b) => a.d - b.d)
    .map((o) => o.x);
}

const dirUrls = (x) => {
  const name = encodeURIComponent(x.name);
  return {
    kakao: `https://map.kakao.com/link/to/${name},${x.lat},${x.lng}`,
    naver: `https://map.naver.com/p/directions/-/${x.lng},${x.lat},${name},,PLACE_POI/-/walk`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${x.lat},${x.lng}&travelmode=walking`,
  };
};

// ---------- 길안내: 휴대폰에서는 지도 앱을 바로 열기 ----------
// 웹 링크를 새 창으로 열면 그 창이 앱으로 넘어간 뒤 하얀 빈 화면으로 남음.
// 그래서 휴대폰에서는 카카오맵·네이버지도 앱 주소(kakaomap://, nmap://)로 바로 열고,
// 앱이 없을 때만 1.6초 뒤 웹 지도로 이동 (같은 창이라 뒤로 가기로 돌아올 수 있음).
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function appUrl(kind, x) {
  const name = encodeURIComponent(x.name);
  const from = state.locStatus === "found" ? `sp=${state.user.lat},${state.user.lng}&` : "";
  if (kind === "kakao") return `kakaomap://route?${from}ep=${x.lat},${x.lng}&by=FOOT`;
  if (kind === "naver") return `nmap://route/walk?${state.locStatus === "found" ? `slat=${state.user.lat}&slng=${state.user.lng}&sname=${encodeURIComponent("내 위치")}&` : ""}dlat=${x.lat}&dlng=${x.lng}&dname=${name}&appname=${encodeURIComponent(location.hostname || "ddong.busan")}`;
  return null;
}
function openNav(kind, x, webUrl) {
  const app = appUrl(kind, x);
  if (!app) { location.href = webUrl; return; }
  let left = false;
  const onHide = () => { if (document.visibilityState === "hidden") left = true; };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onHide);
  location.href = app;
  setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onHide);
    if (!left && document.visibilityState === "visible") location.href = webUrl; // 앱이 없으면 웹 지도로
  }, 1600);
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-nav]");
  if (!a || !IS_MOBILE) return;
  const x = state.toilets.find((o) => o.id === a.dataset.id);
  if (!x) return;
  e.preventDefault();
  e.stopPropagation();
  openNav(a.dataset.nav, x, a.href);
}, true);

// ---------- 소리 (똥글이) ----------
// 직접 녹음한 "똥!" (ddong.mp3). 아이폰·안드로이드는 앱을 나갔다 오면 소리 장치를 멈추므로
// 1) 한 번 풀어 둔 소리(버퍼)는 버리지 않고 계속 쓰고, 2) 누를 때마다 소리 장치를 깨우고,
// 3) 그래도 0.25초 안에 안 깨어나면 미리 준비해 둔 <audio>로 바로 재생합니다.
const DDONG_URL = "ddong.mp3?v=3";
let actx = null, ddongBuf = null, ddongAB = null, ddongEl = null, ddongBlobUrl = null, decoding = null;
fetch(DDONG_URL).then((r) => r.arrayBuffer()).then((ab) => {
  ddongAB = ab;
  try { ddongBlobUrl = URL.createObjectURL(new Blob([ab], { type: "audio/mpeg" })); } catch {}
  prepareEl();
}).catch(() => {});
function prepareEl() {
  try {
    ddongEl = new Audio(ddongBlobUrl || DDONG_URL); // 파일을 메모리에 들고 있어서 인터넷이 없어도 바로 재생
    ddongEl.preload = "auto"; ddongEl.setAttribute("playsinline", "");
    ddongEl.load();
  } catch { ddongEl = null; }
}
function getCtx() {
  if (actx && actx.state !== "closed") return actx;
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { actx = null; }
  return actx;
}
function decodeBuf() {
  if (ddongBuf || decoding || !ddongAB || !actx) return;
  decoding = new Promise((ok) => actx.decodeAudioData(ddongAB.slice(0), (buf) => { ddongBuf = buf; ok(); }, () => ok()))
    .finally(() => { decoding = null; });
}
// 화면을 만질 때마다 소리 장치를 깨워 둠 (아이폰은 무음 소리를 한 번 내야 풀림)
function wakeAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state !== "running") {
    c.resume().catch(() => {});
    try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch {}
  }
  decodeBuf();
}
function startBuf() { const s = actx.createBufferSource(); s.buffer = ddongBuf; s.connect(actx.destination); s.start(0); }
function playEl() {
  if (!ddongEl) prepareEl();
  try {
    ddongEl.pause(); ddongEl.currentTime = 0;
    const p = ddongEl.play();
    if (p && p.catch) p.catch(() => prepareEl()); // 다음 번엔 새로 준비한 것으로
  } catch { prepareEl(); }
}
function playDdong() {
  wakeAudio();
  const c = actx;
  if (c && ddongBuf) {
    if (c.state === "running") { try { startBuf(); return; } catch {} }
    let done = false;
    c.resume().then(() => { if (!done && c.state === "running") { done = true; try { startBuf(); } catch { playEl(); } } }).catch(() => {});
    setTimeout(() => {
      if (done) return;
      done = true;
      try { c.close(); } catch {}
      if (actx === c) actx = null; // 다음 터치 때 새 소리 장치 (풀어 둔 소리는 그대로 씀)
      playEl();
    }, 250);
    return;
  }
  playEl();
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") { try { actx && actx.suspend(); } catch {} }
  else if (ddongEl) { try { ddongEl.load(); } catch {} }
});
window.addEventListener("pageshow", (e) => { if (e.persisted) { try { actx && actx.close(); } catch {} actx = null; prepareEl(); } });

function playMascot(el) {
  playDdong();
  $("#live").textContent = t("mascot.sound");
  document.querySelectorAll(".mascot-btn, .mascot-round").forEach((b) => b.classList.add("speaking"));
  document.querySelectorAll(".bubble strong").forEach((s) => (s.textContent = t("mascot.sound")));
  setTimeout(() => {
    document.querySelectorAll(".speaking").forEach((b) => b.classList.remove("speaking"));
    document.querySelectorAll(".bubble strong").forEach((s) => (s.textContent = t("mascot.name")));
    $("#live").textContent = "";
  }, 560);
}

// ---------- 토스트 ----------
let toastTimer;
function toast(msg, err = false) {
  const el = $("#toast");
  el.textContent = msg; el.className = `toast${err ? " err" : ""}`; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

// ---------- 위치 ----------
function locate(onDone) {
  if (!navigator.geolocation) { state.locStatus = "fallback"; render(); onDone?.(false); return; }
  state.locStatus = "locating"; renderList();
  navigator.geolocation.getCurrentPosition(
    (p) => { state.user = { lat: p.coords.latitude, lng: p.coords.longitude }; state.locStatus = "found"; state.shown = PAGE; render(); onDone?.(true); },
    () => { state.locStatus = "fallback"; render(); onDone?.(false); },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
  );
}

// ---------- 정적 UI ----------
function applyStaticText() {
  document.documentElement.lang = HTML_LANG[state.lang];
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $("#search").placeholder = t("search.placeholder");
  $("#search").setAttribute("aria-label", t("search.label"));
  $("#search-clear").setAttribute("aria-label", t("search.clear"));
  $("#filters").setAttribute("aria-label", t("filters.label"));
  $("#map-locate").setAttribute("aria-label", t("map.locate"));
  $("#view-map").setAttribute("aria-label", t("map.label"));
  $("#bottom-nav").setAttribute("aria-label", t("app.title"));
}
function fillIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => { el.outerHTML = icon(el.dataset.icon); });
}

const REGIONS = [["부산", "busan"]];
const FILTERS = [["openNow", "clock"], ["open24h", "clock"], ["wheelchair", "wheelchair"], ["diaper", "baby"], ["emergency", "bell"], ["trail", "feet"]];
function renderFilters() {
  const allOn = state.filter === "all" && state.region === "all";
  const regions = REGIONS.filter(([v]) => state.toilets.some((x) => x.provider === v));
  $("#filters").innerHTML = `<div class="chip-row no-scrollbar"><button type="button" class="chip" data-filter="all" aria-pressed="${allOn}">${icon("sparkles")}${esc(t("filters.all"))}</button>`
    + (regions.length > 1 ? regions : []).map(([v, k]) => `<button type="button" class="chip chip-region" data-region="${v}" aria-pressed="${state.region === v}">${icon("pin")}${esc(t(`filters.${k}`))}</button>`).join("")
    + `</div><div class="chip-row no-scrollbar">`
    + FILTERS.map(([k, ic]) => `<button type="button" class="chip chip-sm" data-filter="${k}" aria-pressed="${state.filter === k}">${icon(ic)}${esc(t(`filters.${k}`))}</button>`).join("")
    + `</div>`;
}
function renderNav() {
  const items = [["list", "house"], ["map", "map"], ["sos", "siren"], ["guide", "info"]];
  $("#bottom-nav").innerHTML = `<div class="nav-grid">${items.map(([k, ic]) => `<button type="button" class="nav-btn" data-view="${k}" ${state.view === k ? 'aria-current="page"' : ""}>${icon(ic)}${esc(k === "sos" ? "SOS" : t(`nav.${k}`))}</button>`).join("")}</div>`;
}

// ---------- 목록 ----------
function nearestCard(x) {
  if (!x) return "";
  const tr = travel(x), st = statusOf(x), u = dirUrls(x);
  const locLabel = state.locStatus === "found" ? t("list.locationReady") : state.locStatus === "locating" ? t("list.locating") : t("list.locationFallback");
  const statusLabel = x.open24h ? t("facilities.open24h") : st.open === true ? t("detail.open") : st.open === false ? t("detail.closed") : t("detail.unknownStatus");
  return `<section class="nearest" aria-labelledby="nearest-title">
    <div class="glow1"></div><div class="glow2"></div>
    <div class="n-top">
      <div class="pills"><button type="button" class="pill pill-loc press" data-act="locate" aria-label="${esc(t("list.refreshLocation"))}">${icon("refresh")}${esc(t("list.currentLocation"))}</button><span class="pill loc-st ${state.locStatus}"><span class="dot ${state.locStatus}"></span>${esc(state.locStatus === "found" ? t("list.locOk") : state.locStatus === "locating" ? t("list.locWait") : t("list.locFail"))}</span><span class="pill pill-orange">${esc(t("list.firstChoice"))}</span></div>
    </div>
    <p class="eyebrow">${esc(t("list.nearestEyebrow"))}</p>
    <h2 id="nearest-title">${esc(t("list.nearestNow"))}</h2>
    <button type="button" class="n-card press" data-open="${esc(x.id)}">
      <div class="n-head"><div class="n-ico">${icon("route")}</div><div><h3>${esc(x.name)}</h3><p>${esc(x.address)}</p></div></div>
      <div class="n-route">
        <div class="n-rail" aria-hidden="true"><span class="a"></span><span class="l"></span><span class="b"></span></div>
        <p class="n-from">${esc(t("list.fromMyLocation"))}</p>
        <p class="n-time">${esc(tr.mode === "walk" ? tr.walk : tr.drive)} <span>· ${esc(tr.dist)}</span></p>
        <p class="n-meta"><span>${icon("clock")}${esc(statusLabel)}</span>${x.wheelchair ? `<span>${icon("wheelchair")}${esc(t("filters.wheelchair"))}</span>` : ""}</p>
      </div>
    </button>
    <div class="n-actions">
      <a class="n-go press" href="${u.kakao}" target="_blank" rel="noreferrer" data-nav="kakao" data-id="${esc(x.id)}">${icon("nav")}${esc(t("list.startNavigation"))}</a>
      <button type="button" class="n-map press" data-showmap="${esc(x.id)}" aria-label="${esc(t("list.viewOnMap"))}" title="${esc(t("list.viewOnMap"))}">${icon("map")}</button>
    </div>
  </section>`;
}

function avgFor(id) {
  const rs = state.reviews[id] || [];
  return rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : null;
}

function cardHtml(x, i) {
  const tr = travel(x), st = statusOf(x), avg = avgFor(x.id);
  const timeLabel = x.open24h ? "24H" : st.open === true ? t("detail.open") : st.open === false ? t("detail.closed") : t("detail.unknownStatus");
  const fac = [["wheelchair", x.wheelchair, "facilities.wheelchair"], ["baby", x.diaper, "facilities.diaper"], ["bell", x.bell, "facilities.emergency"]]
    .filter(([, v]) => v === true).map(([ic, , k]) => `<span class="fi-s" title="${esc(t(k))}">${icon(ic)}</span>`).join("");
  return `<button type="button" class="card" data-open="${esc(x.id)}" aria-label="${esc(x.name)} — ${esc(t("list.openDetails"))}">
    <span class="rank ${i === 0 ? "first" : ""}">${i + 1}</span>
    <span class="c-body">
      <span class="c-name">${esc(x.name)}</span>
      <span class="c-meta">
        <span class="t-green">${esc(tr.mode === "walk" ? tr.walk : tr.drive)} · ${esc(tr.dist)}</span>
        <span class="${st.txt}">${esc(timeLabel)}</span>
        ${avg ? `<span class="t-star">★${avg.toFixed(1)}</span>` : ""}
      </span>
    </span>
    <span class="c-fac">${fac}</span>
    ${icon("chevron", "ic c-chev")}
  </button>`;
}

function renderList() {
  const el = $("#view-list");
  if (state.loadError) {
    el.innerHTML = `<div class="wrap status-msg">${icon("database", "ic")}<div>${esc(t("data.error"))}</div><p>${esc(state.loadError)}</p></div>`;
    return;
  }
  if (!state.toilets.length) { el.innerHTML = `<div class="wrap status-msg">${esc(t("data.loading"))}</div>`; return; }
  const list = filtered();
  const nearest = list.find((x) => isOpenNow(x) === true) ?? list[0] ?? null;
  const shown = list.slice(0, state.shown);
  el.innerHTML = `<div class="wrap">
    ${nearestCard(nearest)}
    <div class="list-head">
      <h2 id="list-title">${esc(t("list.title"))}</h2>
      <span class="count-pill">${list.length.toLocaleString()} ${esc(t("search.results"))}</span>
    </div>
    ${list.length === 0 ? `<div class="empty">${icon("pin")}<p>${esc(t("search.noResults"))}</p></div>`
      : `<div class="cards">${shown.map(cardHtml).join("")}</div>${list.length > shown.length ? `<button type="button" class="more-btn press" data-act="more">${esc(t("common.more"))} (${(list.length - shown.length).toLocaleString()})</button>` : ""}`}
  </div>`;
}

// ---------- 지도 ----------
let map = null, cluster = null, userMarker = null, markerById = new Map(), tileErrors = 0, tilesOk = false;
const hasLeaflet = () => typeof window.L !== "undefined" && typeof window.L.markerClusterGroup === "function";

function initMap() {
  if (map || !hasLeaflet()) return;
  map = L.map("map", { zoomControl: true, attributionControl: true, preferCanvas: false }).setView([35.17, 129.07], 11);
  const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, subdomains: "abc", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  tiles.on("tileload", () => { tilesOk = true; $("#map-fallback").hidden = true; });
  tiles.on("tileerror", () => { if (!tilesOk && ++tileErrors > 6) renderFallback(); });
  cluster = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 48, spiderfyOnMaxZoom: true,
    iconCreateFunction: (c) => {
      const n = c.getChildCount(), s = n < 10 ? 40 : n < 50 ? 46 : 54;
      return L.divIcon({ html: `<div class="cluster" style="width:${s}px;height:${s}px">${n}</div>`, className: "marker-cluster", iconSize: [s, s] });
    },
  });
  map.addLayer(cluster);
  setTimeout(() => { if (!tilesOk) renderFallback(); }, 9000);
}

function pinIcon(sel) {
  return L.divIcon({ html: PIN_HTML, className: `pin-icon${sel ? " sel" : ""}`, iconSize: [42, 46], iconAnchor: [14, 44] });
}

// 지도에는 가까운 곳만 (전부 찍으면 너무 빽빽함). 검색 중일 때는 검색 결과 전체.
const MAP_NEAR = 10;
function mapList() {
  const list = filtered();
  const near = state.query.trim() ? list : list.slice(0, MAP_NEAR);
  const pin = state.selectedId || state.focusId;
  const sel = pin && !near.some((x) => x.id === pin) ? state.toilets.find((x) => x.id === pin) : null;
  return sel ? [...near, sel] : near;
}
function renderMap() {
  const list = mapList();
  $("#map-count").textContent = state.query.trim() ? `${list.length.toLocaleString()} ${t("map.officialCount")}` : t("map.nearCount").replace("{n}", list.length);
  if (!hasLeaflet()) { renderFallback(); return; }
  initMap();
  map.invalidateSize();
  cluster.clearLayers(); markerById.clear();
  const markers = list.map((x) => {
    const m = L.marker([x.lat, x.lng], { icon: pinIcon(x.id === state.selectedId || x.id === state.focusId), title: x.name, alt: `${x.name} — ${t("map.toiletMarker")}`, keyboard: true });
    m.on("click", () => select(x.id, false));
    markerById.set(x.id, m);
    return m;
  });
  cluster.addLayers(markers);
  if (list.length && !state.selectedId && !state.focusId) {
    const b = L.latLngBounds(list.slice(0, 8).map((x) => [x.lat, x.lng])).extend([state.user.lat, state.user.lng]);
    map.fitBounds(b, { padding: [40, 40], maxZoom: 17 });
  }
  if (userMarker) userMarker.remove();
  userMarker = L.marker([state.user.lat, state.user.lng], { icon: L.divIcon({ html: '<div class="user-dot"></div>', className: "", iconSize: [21, 21], iconAnchor: [10, 10] }), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map);
  if (!$("#map-fallback").hidden) renderFallback();
}

function focusOnMap(x) {
  if (!map) return;
  const m = markerById.get(x.id);
  if (m && cluster) cluster.zoomToShowLayer(m, () => map.panTo([x.lat, x.lng]));
  else map.setView([x.lat, x.lng], Math.max(map.getZoom(), 16));
}

// 부산 간단 지도 (지도 타일을 못 불러올 때)
const FB = { minLng: 126.65, maxLng: 127.25, minLat: 37.18, maxLat: 37.75 };
const fbPos = (lat, lng) => ({
  left: 6 + ((lng - FB.minLng) / (FB.maxLng - FB.minLng)) * 88,
  top: 18 + ((FB.maxLat - lat) / (FB.maxLat - FB.minLat)) * 66,
});
const HAN_RIVER = []; // 부산판은 강 표시 없음
function renderFallback() {
  const fb = $("#map-fallback");
  const list = mapList();
  // 가까운 곳만 보이도록 내 위치와 화장실들을 감싸는 범위로 확대
  const pts = [...list.map((x) => [x.lat, x.lng]), [state.user.lat, state.user.lng]];
  let minLat = Math.min(...pts.map((p) => p[0])), maxLat = Math.max(...pts.map((p) => p[0]));
  let minLng = Math.min(...pts.map((p) => p[1])), maxLng = Math.max(...pts.map((p) => p[1]));
  const span = Math.max(maxLat - minLat, (maxLng - minLng) * 0.8, 0.006);
  const cLat = (minLat + maxLat) / 2, cLng = (minLng + maxLng) / 2;
  minLat = cLat - span * 0.6; maxLat = cLat + span * 0.6; minLng = cLng - span * 0.75; maxLng = cLng + span * 0.75;
  const pos = (lat, lng) => ({ left: 8 + ((lng - minLng) / (maxLng - minLng)) * 84, top: 20 + ((maxLat - lat) / (maxLat - minLat)) * 62 });
  const pinSvg = PIN_HTML.match(/<svg[\s\S]*?<\/svg>/)[0];
  const river = HAN_RIVER.map(([la, ln], i) => { const p = pos(la, ln); return `${i ? "L" : "M"}${p.left.toFixed(2)} ${p.top.toFixed(2)}`; }).join(" ");
  const u = pos(state.user.lat, state.user.lng);
  const km = (span * 111 * 1.2).toFixed(1);
  fb.innerHTML = `<div class="local-ground"></div>
    <svg class="fb-river" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${river}"/></svg>
    <span class="fb-user" style="left:${u.left}%;top:${u.top}%"></span>
    ${list.map((x, i) => {
      const p = pos(x.lat, x.lng);
      return `<button type="button" class="fb-pin press${x.id === state.selectedId || x.id === state.focusId ? " sel" : ""}${i === 0 ? " first" : ""}" data-open="${esc(x.id)}" style="left:${p.left}%;top:${p.top}%" aria-label="${esc(x.name)} — ${esc(t("map.toiletMarker"))}">${pinSvg}</button>`;
    }).join("")}
    <div class="fb-note">${esc(t("map.offline"))} · ${km}km</div>`;
  fb.hidden = false;
}

let mapToastTimer;
function mapToast(msg) {
  const el = $("#map-toast");
  el.innerHTML = `${icon("nav")}${esc(msg)}`; el.hidden = false;
  clearTimeout(mapToastTimer); mapToastTimer = setTimeout(() => (el.hidden = true), 3500);
}

// ---------- 상세 ----------
function flag(ic, label, v) {
  const st = v === true ? t("common.available") : v === false ? t("common.unavailable") : t("common.unknown");
  return `<div class="flag ${flagCls(v)}">${icon(ic)}<span class="n">${esc(label)}</span><span class="st">${esc(st)}</span></div>`;
}

function renderDrawer() {
  const el = $("#drawer");
  const x = state.toilets.find((o) => o.id === state.selectedId);
  if (!x) { el.hidden = true; el.innerHTML = ""; return; }
  const tr = travel(x), st = statusOf(x), u = dirUrls(x);
  const reviews = state.reviews[x.id] || [];
  const avg = avgFor(x.id);
  const myRating = state.ratings[x.id] || 0;
  const tip = (x.tip && (x.tip[state.lang] || x.tip.ko)) || t("detail.tipTemplate").replace("{type}", x.category || x.type || (state.lang === "ko" ? "공공" : "public"));
  const separated = x.unisex === null || x.unisex === undefined ? null : !x.unisex;
  el.innerHTML = `
    <div class="grabber" aria-hidden="true"></div>
    <div class="d-top">
      <div>
        <div class="d-badges">
          <span class="badge-s ${st.cls}"><span class="dot"></span>${esc(st.label)}</span>
          <span class="badge-s b-official">${esc(t(state.meta?.sample ? "common.sample" : "common.official"))}</span>
          ${x.trail ? `<span class="badge-s b-olle">${esc(x.trail)}</span>` : ""}
        </div>
        <h2 id="drawer-title">${esc(x.name)}</h2>
        <p class="d-addr">${esc(x.address)}${x.lotAddress ? `<br><small>${esc(x.lotAddress)}</small>` : ""}</p>
      </div>
      <button type="button" class="d-close press" data-act="close" aria-label="${esc(t("common.close"))}">${icon("x")}</button>
    </div>
    <div class="d-grid2">
      <div class="d-box box-green">${icon("pin")}<p class="lb">${esc(t("detail.distance"))}</p><p class="v">${esc(tr.mode === "walk" ? tr.walk : tr.drive)} · ${esc(tr.dist)}</p><p class="s">${esc(tr.mode === "walk" ? tr.drive : tr.walk)} ${esc(t("detail.estimate"))}</p></div>
      <div class="d-box box-warm">${icon("clock")}<p class="lb">${esc(t("detail.hours"))}</p><p class="v">${esc(x.hours || t("common.unknown"))}</p>${x.closedDays || x.weekdaysOnly ? `<p class="s">${esc(t("detail.closedDays"))}: ${esc(x.closedDays || (state.lang === "ko" ? "토요일, 일요일" : "Sat, Sun"))}</p>` : ""}</div>
    </div>
    ${photoSection(x)}
    <div class="tip">${icon("info")}<div><b>${esc(t("detail.microTip"))}</b><p>${esc(tip)}</p></div></div>
    <div class="sec"><h3>${icon("wheelchair")}${esc(t("detail.facilities"))}</h3><div class="flags">
      ${flag("wheelchair", t("facilities.wheelchair"), x.wheelchair)}
      ${flag("users", t("facilities.genderSeparated"), separated)}
      ${flag("baby", t("facilities.diaper"), x.diaper)}
      ${flag("baby", t("facilities.toddlerSeat"), x.child)}
      ${flag("sparkles", t("facilities.toiletPaper"), x.paper ?? null)}
      ${flag("sparkles", t("facilities.bidet"), x.bidet ?? null)}
    </div></div>
    <div class="sec"><h3>${icon("shield")}${esc(t("detail.safety"))}</h3><div class="flags">
      ${flag("bell", t("facilities.emergency"), x.bell)}
      ${flag("camera", t("facilities.cctv"), x.cctv)}
      ${flag("shieldCheck", t("facilities.emergencyLinked"), x.bellLinked ?? null)}
      ${flag("shieldCheck", t("facilities.illegalCamera"), x.spycamChecked ?? null)}
      ${flag("shield", t("facilities.safetyMirror"), x.mirror ?? null)}
    </div>
    <div class="sos"><a href="tel:112">${icon("phone")}112</a><a href="tel:119">${icon("phone")}119</a></div></div>
    <div class="sec"><h3>${icon("feet")}${esc(t("detail.tourism"))}</h3><div class="flags">
      <div class="flag ${x.trail ? "olle" : "unk"}">${icon("feet")}<span class="n">${esc(t("facilities.trail"))}</span><span class="st">${x.trail ? esc(x.trail) : esc(t("common.unknown"))}</span></div>
      ${flag("parking", t("facilities.parking"), x.parking ?? null)}
      ${flag("zap", t("facilities.ev"), x.ev ?? null)}
    </div></div>
    <div class="rating">
      <div class="r-row">
        <div><p class="lb">${esc(t("detail.cleanliness"))}</p>
          ${avg ? `<p class="r-avg">${icon("star", "ic star-fill")}${avg.toFixed(1)} <small>(${reviews.length} ${esc(t("detail.reviews"))})</small></p>` : `<p class="r-none">${esc(t("detail.noReviews"))}</p>`}
        </div>
        <div style="text-align:right"><p class="lb" style="margin-bottom:4px">${esc(t("detail.yourRating"))}</p>
          <div class="stars" role="group" aria-label="${esc(t("detail.yourRating"))}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-rate="${n}" class="${n <= myRating ? "on" : ""}" aria-label="${n} ${esc(t("detail.rate"))}">${icon("star")}</button>`).join("")}</div>
        </div>
      </div>
      <form class="r-form" id="review-form"><input id="review-text" maxlength="90" placeholder="${esc(t("detail.reviewPlaceholder"))}" aria-label="${esc(t("detail.cleanliness"))}" /><button type="submit" class="press" aria-label="${esc(t("detail.submitReview"))}">${icon("send")}</button></form>
      <p class="r-note">${esc(t("detail.reviewLocal"))}</p>
      ${reviews.length ? `<div class="r-list">${reviews.slice(0, 3).map((r) => `<div>${icon("message")}<p><b>★ ${r.rating}</b>${esc(r.text)}</p></div>`).join("")}</div>` : ""}
    </div>
    <div class="sec"><h3>${icon("nav")}${esc(t("detail.directions"))}</h3><div class="dirs">
      <a class="dir-kakao press" href="${u.kakao}" target="_blank" rel="noreferrer" data-nav="kakao" data-id="${esc(x.id)}">${esc(t("detail.kakao"))}${icon("external")}</a>
      <a class="dir-naver press" href="${u.naver}" target="_blank" rel="noreferrer" data-nav="naver" data-id="${esc(x.id)}">${esc(t("detail.naver"))}${icon("external")}</a>
      <a class="dir-google press" href="${u.google}" target="_blank" rel="noreferrer">${esc(t("detail.google"))}${icon("external")}</a>
    </div></div>
    <div class="mgmt">${icon("building")}<span>${esc(x.org || t("common.unknown"))}</span>${x.tel ? `<a href="tel:${esc(x.tel.replace(/[^\d+]/g, ""))}">${esc(x.tel)}</a>` : ""}</div>
    ${x.geocoded ? `<p class="geo-note">${icon("info")}${esc(t("detail.geocoded"))}</p>` : ""}
    <div class="d-foot"><span>${icon("calendar")}${esc(t("detail.updated"))} ${esc(x.ref || state.meta?.referenceDate || "-")}</span><button type="button" data-act="report">${esc(t("detail.report"))}</button></div>`;
  el.hidden = false;
  el.scrollTop = 0;
  loadPhotos(x);
}

function select(id, scrollMap = true) {
  state.selectedId = id;
  renderDrawer();
  if (state.view === "map" && map) {
    markerById.forEach((m, mid) => m.setIcon(pinIcon(mid === id)));
    const x = state.toilets.find((o) => o.id === id);
    if (x && scrollMap) focusOnMap(x);
    else if (x) map.panTo([x.lat, x.lng]);
  }
}

// ---------- 문의하기 (문의·광고·정보 수정) ----------
// 연락처는 여기 한 곳만 바꾸면 됩니다. 비워 둔 항목은 화면에 나오지 않습니다.
const CONTACT = {
  email: "linkdole@naver.com",
  kakao: "https://open.kakao.com/o/sQvbNPRi", // 카카오톡 오픈채팅 (Ddong 공중화장실 앱 문의방)
  phone: "",      // 예: "010-0000-0000"
};
const hasContact = () => Boolean(CONTACT.email || CONTACT.kakao || CONTACT.phone);
function contactCard(subject = "") {
  if (!hasContact()) return "";
  const subj = encodeURIComponent(`[Ddong] ${subject || t("guide.contactTitle")}`);
  return `<article class="g-card g-contact" id="contact"><div class="top"><div class="g-ico c-e">${icon("message")}</div><span class="g-num">05</span></div>
    <h3>${esc(t("guide.contactTitle"))}</h3><p>${esc(t("guide.contactBody"))}</p>
    <div class="contact-list">
      ${CONTACT.kakao ? `<a class="contact-btn kakao press" href="${esc(CONTACT.kakao)}" target="_blank" rel="noreferrer">${icon("message")}${esc(t("guide.contactKakao"))}</a>` : ""}
      ${CONTACT.email ? `<a class="contact-btn press" href="mailto:${esc(CONTACT.email)}?subject=${subj}">${icon("send")}${esc(t("guide.contactEmail"))}</a>` : ""}
      ${CONTACT.phone ? `<a class="contact-btn press" href="tel:${esc(CONTACT.phone.replace(/[^\d+]/g, ""))}">${icon("phone")}${esc(CONTACT.phone)}</a>` : ""}
    </div></article>`;
}

// ---------- 화장실 사진 (누구나 올리기 → 관리자 확인 → 모두에게 공개) ----------
// Supabase: 공개용(publishable) 키만 사용. 승인된 사진만 보이고, 새 사진은 '확인 대기'로만 저장됩니다.
const PHOTO = { url: "https://hitnkcmcrztkeqohnuso.supabase.co", key: "sb_publishable_yV6XGpNN-PIyO9WrSxfLJw_nxC5H8Mh", app: "busan", bucket: "toilet-photos" };
const PHOTO_KINDS = ["building", "entrance", "route"];
const photoCache = new Map();
const supaHeaders = (extra = {}) => ({ apikey: PHOTO.key, ...(PHOTO.key.startsWith("sb_") ? {} : { Authorization: `Bearer ${PHOTO.key}` }), ...extra });
const photoUrl = (path) => `${PHOTO.url}/storage/v1/object/public/${PHOTO.bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;

async function fetchPhotos(id, force = false) {
  if (!force && photoCache.has(id)) return photoCache.get(id);
  const q = `select=id,kind,path,created_at&app=eq.${PHOTO.app}&toilet_id=eq.${encodeURIComponent(id)}&status=eq.approved&order=created_at.desc&limit=30`;
  try {
    const r = await fetch(`${PHOTO.url}/rest/v1/photos?${q}`, { headers: supaHeaders() });
    const rows = r.ok ? await r.json() : [];
    // 종류마다 가장 최근 사진 한 장 (새 사진이 승인되면 그 사진으로 바뀜)
    const latest = PHOTO_KINDS.map((k) => rows.find((x) => x.kind === k)).filter(Boolean);
    photoCache.set(id, latest);
    return latest;
  } catch { return []; }
}
function photoSection(x) {
  return `<div class="sec photos" id="photo-box" data-id="${esc(x.id)}"><h3>${icon("camera")}${esc(t("photo.title"))}</h3>
    <div class="ph-grid" id="ph-grid"><p class="ph-empty">${esc(t("photo.loading"))}</p></div>
    <button type="button" class="ph-add press" data-ph="add">${icon("camera")}${esc(t("photo.add"))}</button></div>`;
}
async function loadPhotos(x, force = false) {
  const list = await fetchPhotos(x.id, force);
  const grid = document.getElementById("ph-grid");
  if (!grid || document.getElementById("photo-box")?.dataset.id !== x.id) return;
  grid.innerHTML = list.length
    ? list.map((ph) => `<button type="button" class="ph-item press" data-ph="view" data-pid="${esc(ph.id)}" data-src="${esc(photoUrl(ph.path))}" data-kind="${esc(ph.kind)}"><img src="${esc(photoUrl(ph.path))}" alt="${esc(t(`photo.kind_${ph.kind}`))}" loading="lazy"><span>${esc(t(`photo.kind_${ph.kind}`))}</span></button>`).join("")
    : `<p class="ph-empty">${esc(t("photo.none"))}</p>`;
}

// 사진 줄이기: 긴 쪽 1280px, JPEG — 다시 그리면서 위치정보(GPS) 등 사진 정보가 모두 지워짐
async function shrinkPhoto(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch {
    bmp = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = URL.createObjectURL(file); });
  }
  const w0 = bmp.width, h0 = bmp.height, k = Math.min(1, 1280 / Math.max(w0, h0));
  const c = document.createElement("canvas"); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.82));
}

let phKind = "entrance", phFile = null;
function openPhotoForm() {
  const m = $("#phrase-modal");
  phFile = null;
  m.innerHTML = `<div class="pm-card ph-form" role="dialog" aria-modal="true">
    <h3>${esc(t("photo.add"))}</h3>
    <div class="ph-kinds">${PHOTO_KINDS.map((k) => `<button type="button" class="chip chip-sm" data-ph="kind" data-kind="${k}" aria-pressed="${k === phKind}">${esc(t(`photo.kind_${k}`))}</button>`).join("")}</div>
    <div class="ph-rules">${icon("shieldCheck")}<p>${esc(t("photo.rules"))}</p></div>
    <label class="ph-pick press">${icon("camera")}<span id="ph-pick-label">${esc(t("photo.pick"))}</span><input id="ph-file" type="file" accept="image/*" hidden></label>
    <img id="ph-preview" class="ph-preview" alt="" hidden>
    <label class="ph-agree"><input id="ph-agree" type="checkbox"> <span>${esc(t("photo.agree"))}</span></label>
    <div class="pm-actions"><button type="button" class="press ph-send" data-ph="send" disabled>${esc(t("photo.send"))}</button><button type="button" class="press" data-ph="close">${esc(t("common.close"))}</button></div>
  </div>`;
  m.hidden = false;
  const update = () => { const btn = m.querySelector(".ph-send"); if (btn) btn.disabled = !(phFile && $("#ph-agree").checked); };
  $("#ph-file").addEventListener("change", (e) => {
    phFile = e.target.files?.[0] || null;
    const pv = $("#ph-preview");
    if (phFile) { pv.src = URL.createObjectURL(phFile); pv.hidden = false; $("#ph-pick-label").textContent = t("photo.repick"); }
    update();
  });
  $("#ph-agree").addEventListener("change", update);
}
async function sendPhoto() {
  const id = state.selectedId;
  if (!phFile || !id) return;
  const btn = document.querySelector(".ph-send");
  btn.disabled = true; btn.textContent = t("photo.sending");
  try {
    const blob = await shrinkPhoto(phFile);
    const rand = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const path = `${PHOTO.app}/${id.replace(/[^\w.-]/g, "_")}/${phKind}-${rand}.jpg`;
    const up = await fetch(`${PHOTO.url}/storage/v1/object/${PHOTO.bucket}/${path}`, { method: "POST", headers: supaHeaders({ "Content-Type": "image/jpeg", "x-upsert": "false" }), body: blob });
    if (!up.ok) throw new Error(`사진 ${up.status} ${(await up.text()).slice(0, 80)}`);
    const ins = await fetch(`${PHOTO.url}/rest/v1/photos`, { method: "POST", headers: supaHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify({ app: PHOTO.app, toilet_id: id, kind: phKind, path }) });
    if (!ins.ok) throw new Error(`저장 ${ins.status} ${(await ins.text()).slice(0, 80)}`);
    $("#phrase-modal").hidden = true;
    toast(t("photo.thanks"));
  } catch (e) {
    btn.disabled = false; btn.textContent = t("photo.send");
    toast(`${t("photo.fail")} (${String(e.message || e).replace(/\s+/g, " ")})`, true);
  }
}
function viewPhoto(b) {
  const m = $("#phrase-modal");
  m.innerHTML = `<div class="pm-card ph-view"><img src="${esc(b.dataset.src)}" alt="${esc(t(`photo.kind_${b.dataset.kind}`))}"><p class="ph-cap">${esc(t(`photo.kind_${b.dataset.kind}`))}</p>
    <div class="pm-actions"><button type="button" class="press" data-ph="report" data-pid="${esc(b.dataset.pid)}">${icon("shield")}${esc(t("photo.report"))}</button><button type="button" class="press" data-ph="close">${esc(t("common.close"))}</button></div></div>`;
  m.hidden = false;
}
async function reportPhoto(pid) {
  try {
    await fetch(`${PHOTO.url}/rest/v1/rpc/report_photo`, { method: "POST", headers: supaHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ photo_id: pid }) });
    toast(t("photo.reported"));
  } catch { toast(t("photo.fail"), true); }
  $("#phrase-modal").hidden = true;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ph]");
  if (!b) return;
  const a = b.dataset.ph;
  if (a === "add") openPhotoForm();
  else if (a === "kind") { phKind = b.dataset.kind; document.querySelectorAll('[data-ph="kind"]').forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.kind === phKind))); }
  else if (a === "send") sendPhoto();
  else if (a === "view") viewPhoto(b);
  else if (a === "report") reportPhoto(b.dataset.pid);
  else if (a === "close") $("#phrase-modal").hidden = true;
});

// ---------- 안내 ----------
function renderGuide() {
  const m = state.meta;
  const cards = [
    ["accessibility", "wheelchair", "01", "c-a"],
    ["hours", "clock", "02", "c-b"],
    ["emergency", "phone", "03", "c-c"],
    ["data", "database", "04", "c-d"],
  ];
  $("#view-guide").innerHTML = `<div class="wrap" style="max-width:896px">
    <div class="g-hero"><div class="c1"></div><div class="c2"></div>
      <p class="k">BUSAN</p><h2 id="guide-title">${esc(t("guide.title"))}</h2><p>${esc(t("guide.intro"))}</p>${mascotSvg()}</div>
    <div class="g-cards">
      ${cards.map(([k, ic, n, c]) => `<article class="g-card"><div class="top"><div class="g-ico ${c}">${icon(ic)}</div><span class="g-num">${n}</span></div>
        <h3>${esc(t(`guide.${k}Title`))}</h3><p>${esc(t(`guide.${k}Body`))}</p>
        ${k === "emergency" ? `<div class="sos" style="margin-top:16px"><a href="tel:112">${icon("phone")}Police 112</a><a href="tel:119">${icon("phone")}Emergency 119</a></div>` : ""}
        ${k === "data" && m ? `<p class="meta">${m.count.toLocaleString()} · ${esc(t("detail.updated"))} ${esc(m.referenceDate || "-")}<br><a href="${esc(m.sourcePages?.[0] || "https://www.data.go.kr")}" target="_blank" rel="noreferrer">data.go.kr</a></p>` : ""}
      </article>`).join("")}
      ${contactCard()}
    </div></div>`;
}

// ---------- SOS ----------
const S = (k) => (SOS[state.lang] || SOS.ko)[k];
function nearestAny() {
  let best = null, bd = Infinity;
  for (const x of state.toilets) { const d = distanceKm(state.user, x); if (d < bd) { bd = d; best = x; } }
  return best;
}
function locationText() {
  if (state.locStatus !== "found") return null;
  const n = nearestAny();
  const coord = `${state.user.lat.toFixed(5)}, ${state.user.lng.toFixed(5)}`;
  const map = `https://map.kakao.com/link/map/${state.user.lat},${state.user.lng}`;
  return { coord, near: n ? `${n.name} (${n.address})` : "", map };
}
function smsHref() {
  const loc = locationText();
  const body = `${S("textMsg")}${loc ? `\n위치/Location: ${loc.coord}${loc.near ? `\n근처/Near: ${loc.near}` : ""}\n${loc.map}` : ""}`;
  const sep = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? "&" : "?";
  return `sms:112${sep}body=${encodeURIComponent(body)}`;
}
function phraseKo(p) { return (p.koByLang && p.koByLang[state.lang]) || p.ko; }
function phraseRom(p) { return (p.romByLang && p.romByLang[state.lang]) || p.rom; }
function renderSos() {
  const loc = locationText();
  const sec = (title, list, cls) => `<section class="sos-card"><h3>${esc(title)}</h3><div class="sit">${list.map(([h, b]) => `<div class="sit-row ${cls}"><b>${esc(h)}</b><p>${esc(b)}</p></div>`).join("")}</div></section>`;
  $("#view-sos").innerHTML = `<div class="wrap" style="max-width:720px">
    <div class="sos-hero">
      <p class="k">SOS · EMERGENCY</p><h2>${esc(S("title"))}</h2><p>${esc(S("intro"))}</p>
      <div class="sos-calls">
        <a class="call c112 press" href="tel:112"><span class="num">112</span><span class="lb">${esc(S("police"))}</span><span class="sub">${esc(S("policeSub"))}</span></a>
        <a class="call c119 press" href="tel:119"><span class="num">119</span><span class="lb">${esc(S("fire"))}</span><span class="sub">${esc(S("fireSub"))}</span></a>
        <a class="call c1330 press" href="tel:1330"><span class="num">1330</span><span class="lb">${esc(S("travel"))}</span><span class="sub">${esc(S("travelSub"))}</span></a>
      </div>
      <p class="lang-note">${icon("languages")}${esc(S("langNote"))}</p>
    </div>
    <section class="sos-card">
      <h3>${icon("message")}${esc(S("textTitle"))}</h3><p class="d">${esc(S("textBody"))}</p>
      <a class="sms-btn press" href="${esc(smsHref())}">${icon("send")}${esc(S("textBtn"))}</a>
    </section>
    <section class="sos-card">
      <h3>${icon("pin")}${esc(S("locTitle"))}</h3><p class="d">${esc(S("locBody"))}</p>
      ${loc ? `<div class="loc-box"><div class="coord">${esc(loc.coord)}</div>${loc.near ? `<div class="near"><span>${esc(S("locNear"))}</span>${esc(loc.near)}</div>` : ""}</div>
        <div class="loc-actions"><button type="button" class="press" data-act="copyloc">${icon("download")}${esc(S("locCopy"))}</button><button type="button" class="press" data-act="locate">${icon("refresh")}${esc(t("list.currentLocation"))}</button></div>`
        : `<p class="loc-none">${esc(S("locUnknown"))}</p><div class="loc-actions"><button type="button" class="press" data-act="locate">${icon("refresh")}${esc(t("list.currentLocation"))}</button></div>`}
    </section>
    ${sec(S("toiletTitle"), S("toilet"), "t")}
    ${sec(S("streetTitle"), S("street"), "s")}
    <section class="sos-card">
      <h3>${icon("languages")}${esc(S("phrasesTitle"))}</h3><p class="d">${esc(S("phrasesBody"))}</p>
      <div class="phrases">${PHRASES.map((p, i) => `<button type="button" class="phrase press" data-phrase="${i}"><span class="pk">${esc(phraseKo(p))}</span><span class="pr">${esc(phraseRom(p))}</span>${state.lang !== "ko" ? `<span class="pt">${esc(p[state.lang])}</span>` : ""}</button>`).join("")}</div>
    </section>
    <section class="sos-card">
      <h3>${icon("phone")}${esc(S("otherTitle"))}</h3>
      <div class="others">${S("other").map(([n, d]) => `<a class="other press" href="tel:${n.replace(/-/g, "")}"><b>${esc(n)}</b><span>${esc(d)}</span></a>`).join("")}</div>
      <p class="note">${esc(S("note"))}</p>
    </section>
  </div>`;
}
function speakKo(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = "ko-KR"; u.rate = 0.9;
  const v = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("ko")); if (v) u.voice = v;
  speechSynthesis.speak(u);
}
function openPhrase(i) {
  const p = PHRASES[i], m = $("#phrase-modal");
  m.innerHTML = `<div class="pm-card"><p class="pm-ko">${esc(phraseKo(p))}</p><p class="pm-rom">${esc(phraseRom(p))}</p>${state.lang !== "ko" ? `<p class="pm-tr">${esc(p[state.lang])}</p>` : ""}
    <div class="pm-actions"><button type="button" class="press" data-act="speakphrase" data-i="${i}">${icon("volume")}${esc(S("speak"))}</button><button type="button" class="press" data-act="closephrase">${esc(t("common.close"))}</button></div></div>`;
  m.hidden = false;
}

// ---------- 화면 전환 ----------
function renderMascotFloat() {
  const el = $("#mascot-float");
  el.hidden = false; // 모든 화면에서 오른쪽 가운데에 항상 표시
  const homeBtn = state.view !== "list"
    ? `<button type="button" class="home-fab press" data-view="list" aria-label="${esc(t("nav.list"))}">${icon("house")}<span>${esc(t("nav.list"))}</span></button>` : "";
  el.innerHTML = `<button type="button" class="bubble" data-act="mascot" aria-label="${esc(t("mascot.aria"))}"><strong>${esc(t("mascot.name"))}</strong><span>${esc(t("mascot.prompt"))}</span></button>
    <div class="fab-col"><button type="button" class="mascot-round press" data-act="mascot" aria-label="${esc(t("mascot.aria"))}">${mascotSvg()}<span class="badge">${icon("volume")}</span></button>${homeBtn}</div>`;
}

function render() {
  $("#view-list").hidden = state.view !== "list";
  $("#view-map").hidden = state.view !== "map";
  $("#view-guide").hidden = state.view !== "guide";
  $("#view-sos").hidden = state.view !== "sos";
  $("#search-bar").hidden = state.view === "guide" || state.view === "sos";
  renderNav();
  renderFilters();
  renderMascotFloat();
  if (state.view === "list") renderList();
  if (state.view === "map") renderMap();
  if (state.view === "guide") renderGuide();
  if (state.view === "sos") renderSos();
  renderDrawer();
}

function setView(v, keepSelection = false) {
  state.view = v;
  if (!keepSelection) state.focusId = null;
  if (!keepSelection) state.selectedId = null;
  render();
}

// ---------- 이벤트 ----------
["touchstart", "touchend", "pointerdown", "click"].forEach((ev) => document.addEventListener(ev, wakeAudio, { passive: true }));
document.addEventListener("click", (e) => {
  if (e.target.id === "phrase-modal") { e.target.hidden = true; return; }
  const b = e.target.closest("[data-open],[data-showmap],[data-act],[data-filter],[data-region],[data-view],[data-rate],[data-phrase]");
  if (!b) return;
  if (b.dataset.phrase) { openPhrase(+b.dataset.phrase); return; }
  if (b.dataset.open) { select(b.dataset.open); return; }
  if (b.dataset.showmap) {
    const id = b.dataset.showmap; state.view = "map"; state.selectedId = null; state.focusId = id; render();
    const x = state.toilets.find((o) => o.id === id);
    if (x && map) setTimeout(() => focusOnMap(x), 60);
    return;
  }
  if (b.dataset.region) { state.region = state.region === b.dataset.region ? "all" : b.dataset.region; state.shown = PAGE; if (state.selectedId && !filtered().some((x) => x.id === state.selectedId)) state.selectedId = null; render(); return; }
  if (b.dataset.filter) { if (b.dataset.filter === "all") state.region = "all"; state.filter = (b.dataset.filter !== "all" && state.filter === b.dataset.filter) ? "all" : b.dataset.filter; state.shown = PAGE; if (state.selectedId && !filtered().some((x) => x.id === state.selectedId)) state.selectedId = null; render(); return; }
  if (b.dataset.view) { setView(b.dataset.view); return; }
  if (b.dataset.rate) {
    state.ratings[state.selectedId] = Number(b.dataset.rate); store.set(LS.ratings, state.ratings);
    const keep = $("#review-text")?.value || "";
    renderDrawer(); if ($("#review-text")) $("#review-text").value = keep;
    toast(t("detail.ratingSaved")); return;
  }
  switch (b.dataset.act) {
    case "mascot": playMascot(b); break;
    case "locate": locate(); break;
    case "more": state.shown += 20; renderList(); break;
    case "close": state.selectedId = null; renderDrawer(); if (map) markerById.forEach((m) => m.setIcon(pinIcon(false))); break;
    case "report": if (hasContact()) { setView("guide"); setTimeout(() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80); } else toast(t("detail.reportMessage")); break;
    case "copyloc": { const l = locationText(); if (l) { const txt = `${l.coord}${l.near ? ` / ${l.near}` : ""}\n${l.map}`; (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => toast(S("locCopied"))).catch(() => toast(txt)); } break; }
    case "speakphrase": speakKo(phraseKo(PHRASES[+b.dataset.i])); break;
    case "closephrase": $("#phrase-modal").hidden = true; break;
  }
});

document.addEventListener("submit", (e) => {
  if (e.target.id !== "review-form") return;
  e.preventDefault();
  const id = state.selectedId, text = $("#review-text").value.trim().slice(0, 90), rating = state.ratings[id] || 0;
  if (!rating || !text) { toast(t("detail.reviewRequired"), true); return; }
  const r = { id: crypto.randomUUID?.() || String(Date.now()), rating, text, createdAt: new Date().toISOString(), language: state.lang };
  state.reviews[id] = [r, ...(state.reviews[id] || [])].slice(0, 5);
  store.set(LS.reviews, state.reviews);
  renderDrawer(); toast(t("detail.reviewSaved"));
  if (state.view === "list") renderList();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.selectedId) { state.selectedId = null; renderDrawer(); }
});

let searchTimer;
$("#search").addEventListener("input", (e) => {
  state.query = e.target.value;
  $("#search-clear").hidden = !state.query;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.shown = PAGE; if (state.view === "list") renderList(); else if (state.view === "map") renderMap(); }, 140);
});
$("#search-clear").addEventListener("click", () => {
  state.query = ""; $("#search").value = ""; $("#search-clear").hidden = true; $("#search").focus();
  state.shown = PAGE; render();
});
$("#map-locate").addEventListener("click", () => {
  locate((ok) => {
    mapToast(ok ? t("map.locationFound") : t("map.locationFallback"));
    if (ok && map) map.setView([state.user.lat, state.user.lng], 15);
  });
});
$("#map-toast").addEventListener("click", (e) => (e.currentTarget.hidden = true));


// ---------- 국기 언어 선택 (윈도우에서도 국기가 보이도록 SVG 사용) ----------
const FLAG_SVG = {
  ko: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><g transform="translate(15 10)"><circle r="5" fill="#CD2E3A"/><path d="M-5 0a2.5 2.5 0 0 0 5 0a2.5 2.5 0 0 1 5 0a5 5 0 0 1-10 0" fill="#0047A0"/></g><g fill="#000"><rect x="3.2" y="3.4" width="5" height=".9" transform="rotate(-34 5.7 3.85)"/><rect x="3.8" y="4.7" width="5" height=".9" transform="rotate(-34 6.3 5.15)"/><rect x="21.8" y="3.4" width="5" height=".9" transform="rotate(34 24.3 3.85)"/><rect x="21.2" y="4.7" width="5" height=".9" transform="rotate(34 23.7 5.15)"/><rect x="3.2" y="15.6" width="5" height=".9" transform="rotate(34 5.7 16.05)"/><rect x="3.8" y="14.3" width="5" height=".9" transform="rotate(34 6.3 14.75)"/><rect x="21.8" y="15.6" width="5" height=".9" transform="rotate(-34 24.3 16.05)"/><rect x="21.2" y="14.3" width="5" height=".9" transform="rotate(-34 23.7 14.75)"/></g></svg>',
  en: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><g fill="#B22234">' + [0, 2, 4, 6, 8, 10, 12].map((i) => `<rect y="${i * 20 / 13}" width="30" height="${20 / 13}"/>`).join("") + '</g><rect width="13" height="10.8" fill="#3C3B6E"/><g fill="#fff">' + [[2, 2], [5, 2], [8, 2], [11, 2], [3.5, 4.5], [6.5, 4.5], [9.5, 4.5], [2, 7], [5, 7], [8, 7], [11, 7], [3.5, 9.3], [6.5, 9.3], [9.5, 9.3]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".55"/>`).join("") + '</g></svg>',
  zh: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#DE2910"/><path d="M5 2.2l1 3.1h3.3l-2.7 1.9 1 3.1L5 8.4 2.4 10.3l1-3.1L.7 5.3H4z" fill="#FFDE00"/><g fill="#FFDE00"><circle cx="10.5" cy="2.2" r=".8"/><circle cx="12.3" cy="4.2" r=".8"/><circle cx="12.3" cy="7" r=".8"/><circle cx="10.5" cy="9" r=".8"/></g></svg>',
  ja: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/></svg>',
};
const LANG_NAME = { ko: "한국어", en: "English", zh: "中文", ja: "日本語" };
const langFlag = (k) => `<span class="flag-ico" aria-hidden="true">${FLAG_SVG[k]}</span>`;
let langOpen = false;
function renderLangPick() {
  const el = $("#lang-pick");
  el.innerHTML = `<button type="button" class="lang-btn press" data-act="lang" aria-haspopup="listbox" aria-expanded="${langOpen}" aria-label="${esc(t("header.language"))}">${langFlag(state.lang)}<span>${esc(LANG_NAME[state.lang])}</span><b aria-hidden="true">▼</b></button>
    ${langOpen ? `<ul class="lang-menu" role="listbox">${Object.keys(LANG_NAME).map((k) => `<li><button type="button" role="option" aria-selected="${k === state.lang}" data-lang="${k}">${langFlag(k)}<span>${esc(LANG_NAME[k])}</span>${k === state.lang ? icon("chevron", "ic ok") : ""}</button></li>`).join("")}</ul>` : ""}`;
}
renderLangPick();
document.addEventListener("click", (e) => {
  const b = e.target.closest("#lang-pick [data-act='lang'], #lang-pick [data-lang]");
  if (!b) { if (langOpen && !e.target.closest("#lang-pick")) { langOpen = false; renderLangPick(); } return; }
  if (b.dataset.lang) { state.lang = b.dataset.lang; store.set(LS.lang, state.lang); langOpen = false; renderLangPick(); applyStaticText(); render(); return; }
  langOpen = !langOpen; renderLangPick();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && langOpen) { langOpen = false; renderLangPick(); } });

// ---------- 화면 전체 확대 방지 (iOS는 user-scalable=no를 무시하므로 직접 막음) ----------
["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.addEventListener(ev, (e) => { if (!e.target.closest || !e.target.closest("#map")) e.preventDefault(); }, { passive: false }));
// 두 번 탭 확대는 CSS touch-action: manipulation 으로 막음 (버튼 연속 탭은 그대로 동작)

// ---------- 시작 ----------
fillIcons();
applyStaticText();
render();

fetch("data/toilets.json", { cache: "no-cache" })
  .then((r) => { if (!r.ok) throw new Error(t("data.missing")); return r.json(); })
  .then((d) => { state.toilets = d.toilets || []; state.meta = d.meta || null; if (!state.toilets.length) throw new Error(t("data.missing")); render(); })
  .catch((err) => { state.loadError = err.message || String(err); render(); });

locate();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
