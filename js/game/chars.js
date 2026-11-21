// 8방향 도트 캐릭터 그리기 (assets/chars, 데이터는 js/data/chars.js)
//
// - 대기: 바라보는 방향의 대기 그림 1장
// - 걷기: 걷기 그림이 따로 없어서 대기 그림을 발걸음에 맞춰 살짝 들썩이고 좌우로 흔듦
// - 일반공격 · 스킬: 8프레임을 팩에 적힌 프레임별 시간대로 재생 (몸 전체 동작)
// - 이펙트: 팩 규격대로 캐릭터 앞 고정 위치에서 같은 프레임 번호로 재생 (날아가지 않음)
// 도트 그림이라 배율 1, 부드럽게 하지 않음
import { img } from './art.js';
import { CHARS, CHAR_CELL, CHAR_ORIGIN, CHAR_FX_CELL, CHAR_ANGLES, dirIndex, frameAt } from '../data/chars.js';

export const CHAR_SCALE = 1;
export const CHAR_BODY_PX = 57; // 화면에서 몸 키 (이름표 위치 등)

export const hasChar = (key) => !!CHARS[key];
export const charFiles = (key) => (CHARS[key] ? ['idle', 'normal', 'skill', 'fx-normal', 'fx-skill'].map((n) => `chars/${key}/${n}.webp`) : []);

/**
 * s: { sprite, facing(화면 방향), act: { name: 'normal'|'skill', t: 경과초 } | null,
 *      moving, walk(걸음 위상), hurt(0~1), dead, alpha }
 * 그림을 아직 불러오지 못했으면 false
 */
export function drawChar(ctx, x, y, s) {
  const key = s.sprite;
  if (!CHARS[key]) return false;
  const dir = dirIndex(s.facing);
  const act = s.act && !s.dead ? s.act : null;
  const sheet = img(`chars/${key}/${act ? act.name : 'idle'}.webp`) || img(`chars/${key}/idle.webp`);
  if (!sheet) return false;
  const usingAct = act && sheet.width > CHAR_CELL * 8 - 1 && sheet.height > CHAR_CELL;
  const col = usingAct ? frameAt(key, act.name, act.t) : dir;
  const row = usingAct ? dir : 0;
  const C = CHAR_CELL, [ox, oy] = CHAR_ORIGIN, sc = CHAR_SCALE;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.imageSmoothingEnabled = false;
  if (s.dead) {
    ctx.globalAlpha *= 0.7;
    ctx.translate(0, -6);
    ctx.rotate(-Math.PI / 2);
    ctx.translate(18, 0);
  } else if (s.moving && !act) {
    // 걸음: 디딜 때 내려가고 발을 모을 때 올라감 + 몸이 좌우로 1px 정도 흔들림
    const w = s.walk || 0;
    ctx.translate(Math.round(Math.sin(w) * 1.2), -Math.round(Math.abs(Math.sin(w)) * 2));
  }
  const draw = () => ctx.drawImage(sheet, col * C, row * C, C, C, -ox * sc, -oy * sc, C * sc, C * sc);
  draw();
  if (s.hurt > 0) {
    // 맞았을 때 밝게 번쩍 (filter 를 쓰지 않아 가벼움)
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, s.hurt) * 0.7;
    draw();
  }
  ctx.restore();
  return true;
}

/** 캐릭터 앞에 고정되는 공격 · 스킬 이펙트 (fx: { key, action, dir, t }) */
export function drawCharFx(ctx, x, y, fx) {
  const c = CHARS[fx.key];
  if (!c) return;
  const sheet = img(`chars/${fx.key}/fx-${fx.action}.webp`);
  if (!sheet) return;
  const f = frameAt(fx.key, fx.action, fx.t);
  const th = CHAR_ANGLES[fx.dir];
  const [dx, by, dy] = c.anchor[fx.action];
  const cx = x + dx * Math.cos(th) * CHAR_SCALE, cy = y + (by + dy * Math.sin(th)) * CHAR_SCALE;
  const F = CHAR_FX_CELL;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, (f % 4) * F, fx.dir * F * 2 + Math.floor(f / 4) * F, F, F,
    Math.round(cx - (F / 2) * CHAR_SCALE), Math.round(cy - (F / 2) * CHAR_SCALE), F * CHAR_SCALE, F * CHAR_SCALE);
  ctx.restore();
}
