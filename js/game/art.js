// 「환생 루프」 그림 파일 불러오기 (캐릭터 · 초상화 · 스킬 이펙트 · 아이콘)
//
// assets/heroes/<이름>/attack-1~6.webp, skill-1~6.webp : 캐릭터 (256px, 오른쪽을 봄, 발 위치 y=236)
// assets/portraits/<이름>.webp                          : 초상화 (96px)
// assets/skills/<직업>_<a1~a8|basic>.webp               : 스킬 이펙트 (384px = 96px 칸 4×4, 16프레임)
// assets/skills/<직업>_<..>-icon.webp                   : 스킬 아이콘 (128px)
// assets/skills/flight_<arrow|bolt>_<속성>.webp         : 날아가는 화살 · 마법탄 (96px 칸 4×4, 오른쪽을 봄)
// assets/ui/<이름>.webp                                 : 상태 아이콘 (64px)

import { CHARS } from '../data/chars.js';

const BASE = new URL('../../assets/', import.meta.url);
const cache = new Map();

/** 불러온 그림 (아직이면 null, 이때 불러오기 시작) */
export function img(path) {
  let e = cache.get(path);
  if (!e) {
    const im = new Image();
    e = { im, ok: false, failed: false };
    im.onload = () => { e.ok = true; };
    im.onerror = () => { e.failed = true; };
    im.src = new URL(path, BASE).href;
    cache.set(path, e);
  }
  return e.ok ? e.im : null;
}

export function url(path) { return new URL(path, BASE).href; }

export function preload(paths) { for (const p of paths) img(p); }

// ---------------------------------------------------------------- 캐릭터
export const HERO = { size: 256, footX: 128, footY: 236, height: 152, frames: 6 };

export function heroFrames(key) {
  const out = [];
  for (let i = 1; i <= HERO.frames; i++) out.push(`heroes/${key}/attack-${i}.webp`, `heroes/${key}/skill-${i}.webp`);
  return out;
}

// 초상화: 8방향 도트 캐릭터가 있으면 그 그림에서 만든 초상화
export const portrait = (key) => (CHARS[key] ? `chars/${key}/portrait.webp` : `portraits/${key}.webp`);

// NPC 그림 (플레이어 직업이 아닌 「환생 루프」 캐릭터)
export const NPC_SPRITES = { merchant: 'priest', smith: 'warrior', healer: 'priest_female', guide: 'archer_male', teleporter: 'mage_male', mercenary: 'knight' };

// ---------------------------------------------------------------- 스킬 이펙트
export const FX = { cell: 96, cols: 4, frames: 16 };
export const fxSheet = (key) => `skills/${key}.webp`;
export const fxIcon = (key) => `skills/${key}-icon.webp`;
export const statusIcon = (key) => `ui/${key}.webp`;
