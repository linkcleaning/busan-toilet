// 가벼운 선 아이콘 모음 (lucide 스타일, stroke 기반)
const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  map: '<path d="M14.1 5.1 9.9 3a2 2 0 0 0-1.8 0L3.6 5.3A1 1 0 0 0 3 6.2v13.2a1 1 0 0 0 1.4.9l3.7-1.8a2 2 0 0 1 1.8 0l4.2 2.1a2 2 0 0 0 1.8 0l4.5-2.3a1 1 0 0 0 .6-.9V4.6a1 1 0 0 0-1.4-.9l-3.7 1.8a2 2 0 0 1-1.8-.4Z"/><path d="M15 5.8v15M9 3.2v15"/>',
  house: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  languages: '<path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/>',
  locate: '<path d="M2 12h3M19 12h3M12 2v3M12 19v3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  nav: '<path d="m3 11 19-9-9 19-2-8-8-2Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wheelchair: '<circle cx="16" cy="4" r="1.5"/><path d="m18 19 1-7-6 1M5 8l3-3 5.5 3-2.4 3.5"/><path d="M4.2 14.5a5 5 0 0 0 6.9 5.3M13.8 17.5a5 5 0 0 0-5.4-6.4"/>',
  baby: '<path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>',
  bell: '<path d="M10.3 21a1.9 1.9 0 0 0 3.4 0M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3"/><path d="M4 2C2.8 3.7 2 5.7 2 8M22 8c0-2.3-.8-4.3-2-6"/>',
  feet: '<path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0ZM20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0ZM16 17h4M4 13h4"/>',
  sparkles: '<path d="M9.9 15.5A2 2 0 0 0 8.5 14l-6.1-1.6a.5.5 0 0 1 0-1L8.5 9.9A2 2 0 0 0 9.9 8.5l1.6-6.1a.5.5 0 0 1 1 0L14 8.5a2 2 0 0 0 1.5 1.4l6.1 1.6a.5.5 0 0 1 0 1L15.5 14a2 2 0 0 0-1.5 1.5l-1.6 6.1a.5.5 0 0 1-1 0Z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
  send: '<path d="M14.5 21.7a.5.5 0 0 0 .9 0L22 2.6a.5.5 0 0 0-.6-.6L2.3 8.5a.5.5 0 0 0 0 .9l8 3.2a2 2 0 0 1 1.1 1.1ZM21.9 2.1 10.9 13.1"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"/>',
  shieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  parking: '<circle cx="12" cy="12" r="9"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.8-1.6l9.9-10.2a.5.5 0 0 1 .9.5l-1.9 6A1 1 0 0 0 13 10h7a1 1 0 0 1 .8 1.6l-9.9 10.2a.5.5 0 0 1-.9-.5l1.9-6A1 1 0 0 0 11 14Z"/>',
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
  volume: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5Z"/><path d="M16 9a5 5 0 0 1 0 6M19.4 18.4a9 9 0 0 0 0-12.8"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.8 9.8 0 0 1 6.7 2.7L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.8 9.8 0 0 1-6.7-2.7L3 16"/><path d="M8 16H3v5"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  siren: '<path d="M7 18v-6a5 5 0 0 1 10 0v6"/><path d="M5 21a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z"/><path d="M21 12h1M18.5 4.5 18 5M2 12h1M12 2v1M4.9 4.9l.7.7M12 12v6"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>',
  download: '<path d="M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5"/>',
};

export function icon(name, cls = "ic", extra = "") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[name] || ""}</svg>`;
}

// 귤랑이: 한라봉 모양 오리지널 마스코트 (SVG)
let mascotSeq = 0;
// 똥글이: 세 단 소용돌이 똥 모양 오리지널 마스코트
export const mascotSvg = () => { const k = `m${++mascotSeq}`; return `<svg viewBox="0 0 120 120" aria-hidden="true" class="mascot-svg">
  <defs>
    <linearGradient id="${k}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A86B3C"/><stop offset="1" stop-color="#7A4A26"/></linearGradient>
    <linearGradient id="${k}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B97A47"/><stop offset="1" stop-color="#8B5630"/></linearGradient>
    <linearGradient id="${k}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C98B55"/><stop offset="1" stop-color="#9A6238"/></linearGradient>
  </defs>
  <ellipse cx="60" cy="112" rx="40" ry="5" fill="#172A3A" opacity=".12"/>
  <path d="M14 96c0-14 12-22 24-22h44c12 0 24 8 24 22 0 9-7 14-16 14H30c-9 0-16-5-16-14Z" fill="url(#${k}a)"/>
  <path d="M26 72c0-11 9-18 19-18h30c10 0 19 7 19 18 0 7-5 11-12 11H38c-7 0-12-4-12-11Z" fill="url(#${k}b)"/>
  <path d="M38 52c0-9 7-15 15-15h6c4-1 6-6 4-12 9 2 15 9 15 17 0 7 0 10-1 12-1 5-5 8-10 8H48c-6 0-10-4-10-10Z" fill="url(#${k}c)"/>
  <path d="M63 25c3-5 2-10-1-14" stroke="#9A6238" stroke-width="4" stroke-linecap="round" fill="none"/>
  <path d="M48 44c3-3 7-4 11-3M36 63c4-3 9-4 14-3M24 87c5-4 12-5 18-4" stroke="#fff" stroke-opacity=".28" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <ellipse cx="46" cy="86" rx="5.2" ry="6.6" fill="#fff"/><ellipse cx="74" cy="86" rx="5.2" ry="6.6" fill="#fff"/>
  <ellipse cx="47" cy="87.5" rx="3.4" ry="4.4" fill="#2A1A10"/><ellipse cx="75" cy="87.5" rx="3.4" ry="4.4" fill="#2A1A10"/>
  <circle cx="48.3" cy="85.6" r="1.3" fill="#fff"/><circle cx="76.3" cy="85.6" r="1.3" fill="#fff"/>
  <ellipse cx="35" cy="97" rx="6" ry="3.4" fill="#FF7A7A" opacity=".55"/><ellipse cx="85" cy="97" rx="6" ry="3.4" fill="#FF7A7A" opacity=".55"/>
  <path d="M53 97c4 5 10 5 14 0" stroke="#2A1A10" stroke-width="3.2" stroke-linecap="round" fill="none"/>
</svg>`; };

export const PIN_HTML = `<div class="pin"><div class="pin-body"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18.2c0-2.6 2.2-4 4.4-4h7.2c2.2 0 4.4 1.4 4.4 4 0 1.6-1.3 2.6-3 2.6H7c-1.7 0-3-1-3-2.6Z" fill="#8B5630"/><path d="M6.3 13.8c0-2 1.6-3.2 3.4-3.2h4.6c1.8 0 3.4 1.2 3.4 3.2 0 1.3-.9 2-2.2 2H8.5c-1.3 0-2.2-.7-2.2-2Z" fill="#A86B3C"/><path d="M8.6 10c0-1.6 1.3-2.7 2.7-2.7h.8c.8-.2 1.1-1.1.7-2.1 1.6.4 2.6 1.6 2.6 3 0 1.2-.4 2.4-1.9 2.4h-3c-1.1 0-1.9-.4-1.9-.6Z" fill="#C98B55"/><circle cx="9.8" cy="17.2" r=".95" fill="#2A1A10"/><circle cx="14.2" cy="17.2" r=".95" fill="#2A1A10"/><path d="M10.9 19.1c.6.6 1.6.6 2.2 0" stroke="#2A1A10" stroke-width=".8" fill="none" stroke-linecap="round"/></svg></div><span class="pin-tag">WC</span></div>`;
