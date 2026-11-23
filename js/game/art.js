// 그림 파일 캐시 (캐릭터 · 스킬 이펙트 · 아이콘)
//
// assets/skills/<직업>_<a1~a8|basic>.webp               : 스킬 이펙트 (384px = 96px 칸 4×4, 16프레임)
// assets/skills/<직업>_<..>-icon.webp                   : 스킬 아이콘 (128px)
// assets/skills/flight_<arrow|bolt>_<속성>.webp         : 날아가는 화살 · 마법탄 (96px 칸 4×4, 오른쪽을 봄)
// assets/ui/<이름>.webp                                 : 상태 아이콘 (64px)

const BASE = new URL('../../assets/', import.meta.url);
const cache = new Map();

/** 불러온 그림 (아직이면 null, 이때 불러오기 시작) */
function entry(path) {
  let e = cache.get(path);
  if (!e) {
    const im = new Image();
    e = { im, ok: false, failed: false };
    e.ready = new Promise(resolve => {
      im.onload = () => { e.ok = true; resolve(true); };
      im.onerror = () => { e.failed = true; resolve(false); console.error(`Image failed: ${path}`); };
    });
    cache.set(path, e);
    im.src = new URL(path, BASE).href;
  }
  return e;
}
export function img(path) {
  const e = entry(path);
  return e.ok ? e.im : null;
}
export function loadImages(paths) {
  return Promise.all([...new Set(paths)].map(path => entry(path).ready));
}

export function url(path) { return new URL(path, BASE).href; }

export function preload(paths) { for (const p of paths) img(p); }

// ---------------------------------------------------------------- 스킬 이펙트
export const FX = { cell: 96, cols: 4, frames: 16 };
export const fxSheet = (key) => `skills/${key}.webp`;
export const fxIcon = (key) => `skills/${key}-icon.webp`;
export const statusIcon = (key) => `ui/${key}.webp`;
