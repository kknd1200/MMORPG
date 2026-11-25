import { shieldBashPose } from '../data/skill-motions.js';
import {equipmentBody,visibleEquipment,drawHeldItem,drawHandForeground} from './equipment-art.js';
// 8방향 도트 캐릭터 그리기 (assets/chars, 데이터는 js/data/chars.js)
//
// - 대기: 바라보는 방향의 대기 그림 1장
// - 걷기: walk.webp 8방향 × 8프레임 (사용자 제공 player-motion 걷기 그림). 발걸음 위상에 맞춰 넘김
// - 일반공격 · 스킬: 8프레임을 팩에 적힌 프레임별 시간대로 재생 (몸 전체 동작)
// - 이펙트: 팩 규격대로 캐릭터 앞 고정 위치에서 같은 프레임 번호로 재생 (날아가지 않음)
// 도트 그림이라 배율 1, 부드럽게 하지 않음
import { img } from './art.js';
import { CHARS, CHAR_CELL, CHAR_ORIGIN, CHAR_FX_CELL, CHAR_ANGLES, dirIndex, frameAt } from '../data/chars.js';

export const CHAR_SCALE = 1;
export const CHAR_BODY_PX = 57; // 화면에서 몸 키 (이름표 위치 등)

export const hasChar = (key) => !!CHARS[key];
export const charFiles = (key) => (CHARS[key] ? ['idle', 'walk', 'normal', 'skill', 'fx-normal', 'fx-skill'].map((n) => `chars/${key}/${n}.webp`) : []);

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
  const walking = !act && !s.dead && s.moving;
  const name = act ? act.name : walking ? 'walk' : 'idle';
  const source=CHARS[key].actions[name]?.source || name;
  const sheet = img(`chars/${key}/${source}.webp`) || img(`chars/${key}/idle.webp`);
  if (!sheet) return false;
  const full = sheet.height > CHAR_CELL; // 8방향 × 8프레임 시트가 불러와졌는지 (아니면 대기 그림)
  const TAU = Math.PI * 2;
  const col = !full ? dir
    : act ? frameAt(key, act.name, act.t)
      : Math.floor(((((s.walk || 0) % TAU) + TAU) % TAU) / TAU * 8) % 8;
  const row = full ? dir : 0;
  const C = CHAR_CELL, [ox, oy] = CHAR_ORIGIN, sc = CHAR_SCALE * (s.scale || 1);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.imageSmoothingEnabled = false;
  if (act?.name==='shield_bash') {
    const pose=shieldBashPose(act.t),angle=CHAR_ANGLES[dir];
    ctx.translate(Math.cos(angle)*pose.lunge,Math.sin(angle)*pose.lunge*.45);
    ctx.rotate(-Math.cos(angle)*pose.lean);ctx.scale(1,pose.squash);
  }
  if (s.dead) {
    ctx.globalAlpha *= 0.7;
    ctx.translate(0, -6);
    ctx.rotate(-Math.PI / 2);
    ctx.translate(18, 0);
  }
  const rigCol=act?frameAt(key,act.name,act.t):walking?Math.floor(((((s.walk || 0)%TAU)+TAU)%TAU)/TAU*8)%8:0;
  const body=s.equipment?equipmentBody(sheet,key,name,dir,rigCol):null;
  // Never fall back to a body containing a different, baked-in weapon.
  if(s.equipment && !body){ctx.restore();return true;}
  const equipped=body?visibleEquipment(s):null,back=[3,4,5].includes(dir);
  const drawMain=()=>{if(equipped?.main)drawHeldItem(ctx,equipped.main,body.grip,body.angle,{scale:sc});};
  const drawOff=()=>{if(equipped?.off)drawHeldItem(ctx,equipped.off,body.off,-Math.PI/2,{scale:sc});};
  const draw = () => {
    if(body && body.mainBehind)drawMain();
    if(body && back)drawOff();
    if(body)ctx.drawImage(body.sheet,body.sx,body.sy,C,C,-ox*sc,-oy*sc,C*sc,C*sc);
    else ctx.drawImage(sheet,col*C,row*C,C,C,-ox*sc,-oy*sc,C*sc,C*sc);
    if(body && !body.mainBehind)drawMain();
    if(body && !back)drawOff();
    if(body)drawHandForeground(ctx,body,sc);
  };
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
