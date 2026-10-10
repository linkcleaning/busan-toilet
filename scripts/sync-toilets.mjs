#!/usr/bin/env node
// 전국공중화장실표준데이터 CSV → 부산(또는 다른 지역)만 골라 data/toilets.json
//
// 사용법 (Node 20 이상, 외부 패키지 없음)
//   KAKAO_REST_API_KEY=키 node scripts/sync-toilets.mjs data-source/busan-toilets.csv
//
// 이 CSV에는 위도·경도가 없어서 주소로 좌표를 찾습니다 (카카오 키가 있으면 카카오, 없으면 OpenStreetMap).
// 한 번 찾은 좌표는 data/geocode-cache.json 에 저장해 다음부터는 바로 씁니다.
// 다른 지역 앱을 만들 때는 아래 REGION 설정만 바꾸면 됩니다.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REGION = {
  prefix: "부산",                 // 주소가 이 글자로 시작하는 화장실만
  provider: "부산",
  dataset: "전국공중화장실표준데이터 (공공데이터포털) — 부산광역시",
  bbox: { minLat: 34.85, maxLat: 35.45, minLng: 128.7, maxLng: 129.35 },
  trail: /갈맷길|둘레길|해파랑길/,
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "data/toilets.json");
const CACHE_FILE = path.join(ROOT, "data/geocode-cache.json");
const KAKAO = process.env.KAKAO_REST_API_KEY?.trim();

const text = (v) => (v == null ? "" : String(v).trim());
const nk = (k) => text(k).replace(/^﻿/, "").replace(/[\s_\-()（）]/g, "").toLowerCase();
const num = (v) => { const n = Number(text(v).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const DELAY = process.env.GEO_SLEEP ? +process.env.GEO_SLEEP : 60; // 카카오 호출 사이 쉬는 시간(ms)
function yesNo(v) {
  const s = text(v).toUpperCase();
  if (["Y", "YES", "1", "TRUE", "있음", "유", "O", "설치"].includes(s)) return true;
  if (["N", "NO", "0", "FALSE", "없음", "무", "X", "미설치"].includes(s)) return false;
  return null;
}
function decode(bytes) {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder("utf-8").decode(bytes);
  const utf = new TextDecoder("utf-8").decode(bytes);
  return utf.includes("�") ? new TextDecoder("euc-kr").decode(bytes) : utf;
}
function parseCsv(src) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); if (row.some((x) => x.trim() !== "")) rows.push(row); }
  const [header, ...body] = rows;
  const keys = header.map(nk);
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}
const pick = (r, ...keys) => { for (const k of keys) { const v = r[nk(k)]; if (text(v)) return text(v); } return ""; };
const cleanAddress = (a) => text(a).replace(/\s+/g, " ").replace(/\s*\([^)]*\)?\s*$/, "").trim();
const inBox = (lat, lng) => lat >= REGION.bbox.minLat && lat <= REGION.bbox.maxLat && lng >= REGION.bbox.minLng && lng <= REGION.bbox.maxLng;

// 개방시간: "상시" → 24시간, "정시" + 상세시간, "미개방" → 이용 불가
function hoursOf(kind, detail) {
  const d = text(detail).replace(/\s+/g, " ").replace(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g, "$1~$2");
  const k = text(kind);
  const open24h = /상시|24시간|연중무휴/.test(k + d) || /00:00~24:00|00:00~23:59/.test(d);
  // "주말 미개방"처럼 일부만 닫는 경우는 휴무일로, 완전히 닫힌 경우만 이용 불가로
  const weekdaysOnly = /평일|주말\S*\s*(미개방|휴무|휴관)|토\S*일\S*\s*(미개방|휴무)/.test(d);
  const closed = /^미개방$/.test(k) || /^(미개방|폐쇄|운영중지|사용불가)$/.test(d) || (/폐쇄|운영중지|사용불가/.test(d) && !/\d{1,2}:\d{2}/.test(d));
  const hours = open24h ? "24시간" : d && !/^[:~\s-]*$/.test(d) ? d : k === "정시" ? "" : k === "불규칙" ? "불규칙 운영" : "";
  return { hours, open24h: open24h && !closed, status: closed ? "closed" : open24h ? "open24h" : hours ? "limited" : "unknown", ...(weekdaysOnly ? { weekdaysOnly } : {}) };
}

// 좌표 찾기: 카카오 키가 있으면 카카오(정확·빠름), 없으면 OpenStreetMap(무료, 1초에 1번, 못 찾는 곳이 더 많음)
async function geocode(rows, cache) {
  const how = KAKAO ? "kakao" : "osm";
  const todo = rows.filter((r) => !cache[r.key]?.lat && cache[r.key]?.tried !== how && cache[r.key]?.tried !== "kakao");
  if (!todo.length) return;
  console.log(`좌표 찾기: ${todo.length}곳 (${KAKAO ? "카카오" : "OpenStreetMap — 시간이 꽤 걸려요"})`);
  let found = 0, err = null, n = 0;
  for (const r of todo) {
    let hit = null;
    for (const q of [r.road, r.lot].filter(Boolean)) {
      try {
        if (KAKAO) {
          const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(q)}`, { headers: { Authorization: `KakaoAK ${KAKAO}` } });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) { err = `카카오 ${res.status}: ${body.message || body.msg || ""}`; break; }
          const d = body.documents?.[0];
          if (d && (d.road_address || d.address?.main_address_no)) hit = { lat: +d.y, lng: +d.x, src: "kakao" };
          await sleep(DELAY);
        } else {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=kr&limit=1&q=${encodeURIComponent(q)}`, { headers: { "User-Agent": "busan-toilet-finder/1.0 (github.com/linkcleaning/busan-toilet)", "Accept-Language": "ko" } });
          const d = res.ok ? (await res.json())[0] : null;
          if (d && Number(d.place_rank) >= 28) hit = { lat: +d.lat, lng: +d.lon, src: "osm" }; // 건물·번지 단위만
          await sleep(process.env.GEO_SLEEP ? +process.env.GEO_SLEEP : 1100);
        }
      } catch {}
      if (hit && !inBox(hit.lat, hit.lng)) hit = null;
      if (hit) break;
    }
    if (err) break;
    if (!hit && KAKAO && r.name) { // 주소로 못 찾으면 장소 이름으로 (지역 범위 안에서만)
      const b = REGION.bbox;
      try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(`${REGION.prefix} ${r.name}`)}&rect=${b.minLng},${b.minLat},${b.maxLng},${b.maxLat}`, { headers: { Authorization: `KakaoAK ${KAKAO}` } });
        const d = (await res.json().catch(() => ({}))).documents?.[0];
        if (d) hit = { lat: +d.y, lng: +d.x, src: "kakao-place" };
      } catch {}
    }
    cache[r.key] = hit ? { lat: Math.round(hit.lat * 1e6) / 1e6, lng: Math.round(hit.lng * 1e6) / 1e6, src: hit.src } : { tried: how };
    if (hit) found++;
    if (++n % 200 === 0) { console.log(`  ${n}/${todo.length} (찾음 ${found})`); await writeFile(CACHE_FILE, JSON.stringify(cache)); }
  }
  console.log(`좌표 찾음: ${found}/${todo.length}`);
  if (err) throw new Error(err);
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("CSV 파일 경로를 넣어 주세요."); process.exit(1); }
  await mkdir(path.join(ROOT, "data"), { recursive: true });
  let cache = {};
  try { cache = JSON.parse(await readFile(CACHE_FILE, "utf8")); } catch {}

  const rows = [];
  for (const f of files) {
    for (const r of parseCsv(decode(new Uint8Array(await readFile(f))))) {
      const road = cleanAddress(pick(r, "소재지도로명주소")), lot = cleanAddress(pick(r, "소재지지번주소"));
      if (!(road || lot).startsWith(REGION.prefix)) continue;
      rows.push({ r, road, lot, name: pick(r, "화장실명"), key: road || lot });
    }
  }
  console.log(`${REGION.provider} 화장실: ${rows.length}행`);

  let geoErr = null;
  try { await geocode(rows, cache); } catch (e) { geoErr = e.message; console.error("좌표 찾기 중단:", geoErr); }
  await writeFile(CACHE_FILE, JSON.stringify(cache));

  const toilets = [], seen = new Set();
  let noXY = 0, ref = "";
  for (const { r, road, lot, name, key } of rows) {
    const lat = Number(pick(r, "위도", "WGS84위도")) || cache[key]?.lat;
    const lng = Number(pick(r, "경도", "WGS84경도")) || cache[key]?.lng;
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || !inBox(lat, lng)) { noXY++; continue; }
    const id = `bs-${pick(r, "관리번호") || `${lat.toFixed(5)},${lng.toFixed(5)}`}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const dis = num(pick(r, "남성용-장애인용대변기수")) + num(pick(r, "남성용-장애인용소변기수")) + num(pick(r, "여성용-장애인용대변기수"));
    const kid = num(pick(r, "남성용-어린이용대변기수")) + num(pick(r, "남성용-어린이용소변기수")) + num(pick(r, "여성용-어린이용대변기수"));
    const d = pick(r, "데이터기준일자"); if (d > ref) ref = d;
    const gu = ((road || lot).match(/^부산\S*\s+(\S+[구군])/) || [])[1] || "";
    toilets.push({
      id, name,
      address: road || lot,
      lotAddress: road && lot && road !== lot ? lot : "",
      lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6,
      ...hoursOf(pick(r, "개방시간"), pick(r, "개방시간상세")),
      wheelchair: dis > 0,
      unisex: (() => { const v = pick(r, "남녀공용화장실여부"); return v ? yesNo(v) : null; })(),
      diaper: yesNo(pick(r, "기저귀교환대유무")),
      child: kid > 0,
      bell: yesNo(pick(r, "비상벨설치여부")),
      cctv: yesNo(pick(r, "화장실입구CCTV설치유무")),
      trail: ((name + " " + (road || lot)).match(REGION.trail) || [null])[0],
      dong: gu,
      type: pick(r, "구분명"),
      category: pick(r, "화장실소유구분명"),
      org: pick(r, "관리기관명"),
      tel: pick(r, "전화번호") || null,
      ref: d,
      provider: REGION.provider,
      ...(cache[key]?.src ? { geocoded: cache[key].src } : {}),
    });
  }
  const KEEP_FALSE = new Set(["wheelchair", "diaper", "bell", "cctv", "unisex", "child", "open24h"]);
  const slim = toilets.map((x) => Object.fromEntries(Object.entries(x).filter(([k, v]) => v !== null && v !== "" && (v !== false || KEEP_FALSE.has(k)))));
  const meta = {
    dataset: REGION.dataset,
    sourcePages: ["https://www.data.go.kr"],
    count: slim.length,
    referenceDate: ref || new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    ...(geoErr ? { geocodeError: geoErr } : {}),
  };
  await writeFile(OUTPUT, JSON.stringify({ meta, toilets: slim }));
  console.log(`완료: ${slim.length}곳 저장 (좌표 못 찾음 ${noXY}곳 제외) → data/toilets.json`);
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::notice title=부산 데이터::${slim.length}곳 저장, 좌표 못 찾음 ${noXY}곳${geoErr ? ` / ${geoErr}` : ""}`);
    if (geoErr && !slim.length) process.exit(1);
  }
}
main().catch((e) => { console.error("실패:", e.message); if (process.env.GITHUB_ACTIONS) console.log(`::error title=부산 데이터 실패::${e.message}`); process.exit(1); });
