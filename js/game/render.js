import { HERO_ACTION } from '../data/hero-anim.js';
// 캔버스 렌더링 — 아이소메트릭(마름모 타일) 2.5D 시점
//   월드 좌표 (x, y) → 화면 ((x − y)·32, (x + y)·16)
//   바닥은 terrain.js 의 청크 캐시, 벽 · 나무 · 집 · 캐릭터는 깊이(x + y) 순서로 그림
import { T } from './world.js';
import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { LOOKS, drawHumanoid, drawMonsterSprite, MONSTER_UNIT_PX } from './sprites.js';
import { TW, TH, HW, HH, ISO_RX, ISO_RY, Ground, objectSprite, propSprite, drawSprite } from './terrain.js';
import { img, fxSheet, FX, NPC_SPRITES } from './art.js';

// NPC 외형 (사람형 스프라이트 재사용)
const NPC_LOOKS = {
  merchant: { armor: 'cloth', gloves: '#e8c39c', skin: '#e8c39c', hair: '#5a3a22', hairStyle: 'short', helm: 'none', cape: null, torso: '#b07a3a', robe: '#8a5a2a', trim: '#e0c070', legs: '#5a4030', boots: '#3a2a1a', arms: '#b07a3a', weapon: 'none' },
  smith: { armor: 'leather', gloves: '#4a3a2e', skin: '#d8a880', hair: '#2a1a12', hairStyle: 'short', helm: 'none', cape: null, torso: '#5a4a40', tabard: '#3a2a22', trim: '#a08060', legs: '#4a3a30', boots: '#2a1e16', arms: '#d8a880', weapon: 'mace' },
  healer: { armor: 'cloth', gloves: '#f0d0b0', skin: '#f0d0b0', hair: '#c8a060', hairStyle: 'long', helm: 'circlet', helmColor: '#e8c860', cape: '#a8b8d8', torso: '#e8e8f8', robe: '#dcdcf0', trim: '#8aa8e0', legs: '#c8c8e0', boots: '#6a6a8a', arms: '#e8e8f8', weapon: 'none' },
  guide: { armor: 'leather', gloves: '#5a4030', skin: '#ecc8a4', hair: '#3a2a1a', hairStyle: 'short', helm: 'hood', helmColor: '#3a6a8a', cape: '#2a4a6a', torso: '#5aa0c8', trim: '#e0d090', legs: '#3a4a5a', boots: '#2a2a2a', arms: '#5aa0c8', weapon: 'staff' },
  teleporter: { armor: 'cloth', gloves: '#f0d4b8', skin: '#f0d4b8', hair: '#dcdcf0', hairStyle: 'long', helm: 'hood', helmColor: '#4a2a7a', cape: '#3a2068', torso: '#6a3aa8', robe: '#4a2a80', trim: '#e0c878', legs: '#3a2a5a', boots: '#2a1e36', arms: '#6a3aa8', weapon: 'staff' },
};

const FONT = '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
const TAU = Math.PI * 2;

// 월드 방향 → 화면 방향 (캐릭터가 바라보는 쪽 그림 고르기용)
const screenDir = (f) => ({ x: f.x - f.y, y: (f.x + f.y) * 0.5 });

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ox = 0; this.oy = 0;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
  }

  screenToWorld(sx, sy, cam) {
    const a = (sx - this.w / 2) / HW, b = (sy - this.h / 2) / HH;
    return { x: cam.x + (a + b) / 2, y: cam.y + (b - a) / 2 };
  }

  worldToScreen(x, y, cam) {
    return { x: this.w / 2 + (x - y - (cam.x - cam.y)) * HW, y: this.h / 2 + (x + y - cam.x - cam.y) * HH };
  }

  // 화면을 덮는 월드 범위의 반지름(타일) — 몬스터 구역 켜기/끄기 계산용
  viewHalfTiles() { return (this.w / TW + this.h / TH) / 2 + 1; }

  px(x, y) { return this.ox + (x - y) * HW; }
  py(x, y) { return this.oy + (x + y) * HH; }

  draw(game) {
    const { ctx } = this;
    const cam = game.camera;
    const world = game.world;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0c0d0a';
    ctx.fillRect(0, 0, this.w, this.h);
    if (this.world !== world) {
      this.world = world;
      this.ground = new Ground(world);
      this.objs = new Array(world.w * world.h);
      this.props = world.props.map((p) => ({ p, s: propSprite(p) }));
    }

    // 화면 흔들림 (보스 내려찍기 등)
    let shx = 0, shy = 0;
    for (const fx of game.effects) {
      if (fx.type !== 'shake' || fx.t < 0) continue;
      const p = fx.power * (1 - fx.t / fx.life);
      shx += (Math.random() - 0.5) * 2 * p; shy += (Math.random() - 0.5) * 2 * p;
    }
    this.ox = Math.round(this.w / 2 - (cam.x - cam.y) * HW + shx);
    this.oy = Math.round(this.h / 2 - (cam.x + cam.y) * HH + shy);

    // 화면에 걸치는 월드 타일 범위 (아래쪽은 키 큰 나무 · 벽 때문에 넉넉히)
    const c = [[0, 0], [this.w, 0], [0, this.h + 240], [this.w, this.h + 240]].map(([sx, sy]) => this.screenToWorld(sx, sy, cam));
    const tx0 = Math.max(0, Math.floor(Math.min(...c.map((p) => p.x))) - 1);
    const tx1 = Math.min(world.w - 1, Math.ceil(Math.max(...c.map((p) => p.x))) + 1);
    const ty0 = Math.max(0, Math.floor(Math.min(...c.map((p) => p.y))) - 1);
    const ty1 = Math.min(world.h - 1, Math.ceil(Math.max(...c.map((p) => p.y))) + 1);

    // 1) 바닥 청크
    const g = this.ground;
    for (let cy = Math.floor(ty0 / 16); cy <= Math.floor(ty1 / 16); cy++) {
      for (let cx = Math.floor(tx0 / 16); cx <= Math.floor(tx1 / 16); cx++) {
        const rc = g.chunkRect(cx, cy);
        const X = rc.X0 + this.ox, Y = rc.Y0 + this.oy;
        if (X > this.w || Y > this.h || X + rc.W < 0 || Y + rc.H < 0) continue;
        const ch = g.get(cx, cy, true);
        ctx.drawImage(ch.canvas, X, Y, rc.W, rc.H);
      }
    }

    // 2) 바닥 위 움직이는 것: 물결 · 용암 빛
    const t = game.time;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = world.idx(tx, ty), tile = world.tiles[i];
      if (tile !== T.WATER && tile !== T.LAVA) continue;
      const v = world.variant[i];
      const sx = this.px(tx + 0.5, ty + 0.5), sy = this.py(tx + 0.5, ty + 0.5);
      if (sx < -40 || sx > this.w + 40 || sy < -20 || sy > this.h + 20) continue;
      if (tile === T.WATER && v % 3 === 0) {
        const k = (t * 0.6 + v * 0.13) % 1;
        ctx.strokeStyle = `rgba(190,225,240,${0.28 * Math.sin(k * Math.PI)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(sx + (v % 9) - 4, sy + (v % 5) - 2, 8 + k * 10, (8 + k * 10) * 0.35, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      } else if (tile === T.LAVA && v % 2 === 0) {
        ctx.fillStyle = `rgba(255,190,80,${0.12 + 0.12 * Math.sin(t * 2.2 + v)})`;
        ctx.beginPath(); ctx.ellipse(sx, sy, 22, 11, 0, 0, TAU); ctx.fill();
      }
    }

    // 3) 바닥에 깔리는 것: 출구 · 계단 · 귀환 포탈, 이동 목표, 보스 공격 예고
    const portals = [...world.portals, ...game.tempPortals];
    for (const q of portals) if (q.kind !== 'cave') this.drawPortal(q, t);
    const p = game.player;
    if (p.moveTarget && !p.action) {
      const mx = this.px(p.moveTarget.x, p.moveTarget.y), my = this.py(p.moveTarget.x, p.moveTarget.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(mx, my, 10, 5, 0, 0, TAU); ctx.stroke();
    }
    this.drawGroundEffects(game);

    // 4) 솟은 것 + 캐릭터를 깊이 순서로
    const list = [];
    const objs = this.objs;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = world.idx(tx, ty);
      let s = objs[i];
      if (s === undefined) { s = objectSprite(world, world.tiles[i], world.variant[i], i); objs[i] = s; }
      if (!s) continue;
      const sx = this.px(tx + 0.5, ty + 0.5), sy = this.py(tx + 0.5, ty + 0.5);
      if (sx + s.w < 0 || sx - s.w > this.w || sy - s.ay > this.h || sy + (s.h - s.ay) < 0) continue;
      list.push({ d: tx + ty + 1, s, x: sx, y: sy });
    }
    for (const { p: pr, s } of this.props) {
      const cx = pr.x0 + pr.w / 2, cy = pr.y0 + pr.h / 2;
      const sx = this.px(cx, cy), sy = this.py(cx, cy);
      if (sx + s.w < 0 || sx - s.w > this.w || sy - s.ay > this.h || sy + (s.h - s.ay) < 0) continue;
      list.push({ d: cx + cy, s, x: sx, y: sy });
    }
    for (const q of portals) if (q.kind === 'cave') list.push({ d: q.cx + q.cy - 0.6, cave: q });
    for (const e of [...world.npcs, ...game.monsters, ...game.party.map((u) => u.ent), p]) {
      const sx = this.px(e.x, e.y), sy = this.py(e.x, e.y);
      if (sx < -120 || sy < -40 || sx > this.w + 120 || sy > this.h + 160) continue;
      list.push({ d: e.x + e.y, e, x: sx, y: sy });
    }
    list.sort((a, b) => a.d - b.d);

    const targetId = p.action?.targetId;
    const hoverId = game.hover?.id;
    // 내 캐릭터 몸통 영역: 뒤에 그려지는 벽 · 지붕 · 나무와 겹치면 반투명 윤곽을 다시 그림
    const pbx = this.px(p.x, p.y), pby = this.py(p.x, p.y);
    let drawnPlayer = false, covered = false;
    for (const it of list) {
      if (it.e === p) drawnPlayer = true;
      else if (drawnPlayer && !covered && it.s) {
        const x0 = it.x - it.s.ax, y0 = it.y - it.s.ay;
        covered = x0 < pbx + 10 && x0 + it.s.w > pbx - 10 && y0 < pby - 6 && y0 + it.s.h > pby - 58;
      }
      if (it.s) drawSprite(ctx, it.s, it.x, it.y);
      else if (it.cave) this.drawCave(it.cave, t);
      else if (it.e === p) this.drawPlayer(game, it.x, it.y);
      else if (it.e.isNpc) this.drawNpc(it.e, it.x, it.y, hoverId === it.e.id, t);
      else if (it.e.isMerc) this.drawMerc(game, it.e.unit, it.x, it.y);
      else this.drawMonster(it.e, it.x, it.y, targetId === it.e.id, hoverId === it.e.id, t);
    }

    // 벽 뒤에 가려진 내 캐릭터는 반투명으로 한 번 더
    if (covered) {
      ctx.globalAlpha = 0.4;
      this.drawPlayer(game, pbx, pby, true);
      ctx.globalAlpha = 1;
    }

    this.drawEffects(game);

    // 이름표는 맨 위에
    for (const q of portals) {
      const lx = this.px(q.cx, q.cy), ly = this.py(q.cx, q.cy);
      nameTag(ctx, lx, ly - (q.kind === 'cave' ? 58 : 26), q.label, q.kind === 'exit' ? '#9eeaff' : '#e0b8ff');
    }

    // 던전은 어둡게: 캐릭터 주변만 밝음
    if (world.dark) {
      const sx = this.px(p.x, p.y), sy = this.py(p.x, p.y) - 20;
      const gr = ctx.createRadialGradient(sx, sy, 150, sx, sy, Math.max(this.w, this.h) * 0.62);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, `rgba(0,0,0,${world.dark + 0.15})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, this.w, this.h);
    } else {
      // 필드 · 마을도 가장자리를 살짝 어둡게 (분위기)
      const gr = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.45, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  drawPortal(q, time) {
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    const r = q.rect;
    const corners = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]].map(([x, y]) => [this.px(x, y), this.py(x, y)]);
    const cx = this.px(q.cx, q.cy), cy = this.py(q.cx, q.cy);
    if (cx < -200 || cy < -200 || cx > this.w + 200 || cy > this.h + 200) return;
    const path = () => { ctx.beginPath(); corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
    ctx.save();
    if (q.kind === 'exit') {
      path();
      ctx.fillStyle = `rgba(110,224,255,${0.12 + pulse * 0.18})`; ctx.fill();
      ctx.strokeStyle = `rgba(160,236,255,${0.4 + pulse * 0.4})`; ctx.lineWidth = 2; ctx.stroke();
      // 빛기둥
      const gr = ctx.createLinearGradient(cx, cy - 70, cx, cy);
      gr.addColorStop(0, 'rgba(110,224,255,0)'); gr.addColorStop(1, `rgba(110,224,255,${0.18 + pulse * 0.12})`);
      ctx.fillStyle = gr; ctx.fillRect(cx - 26, cy - 70, 52, 70);
    } else if (q.kind === 'up' || q.kind === 'down') {
      // 계단: 아래로 꺼지는 구멍(down) / 위로 오르는 단(up)
      path();
      ctx.fillStyle = q.kind === 'down' ? '#141210' : '#5a544c'; ctx.fill();
      for (let i = 1; i <= 4; i++) {
        const k = i / 5;
        const sh = q.kind === 'down' ? i * 3 : -i * 4;
        ctx.beginPath();
        corners.forEach(([x, y], j) => {
          const px = cx + (x - cx) * (1 - k * 0.55), py = cy + (y - cy) * (1 - k * 0.55) + sh;
          if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        });
        ctx.closePath();
        const c = q.kind === 'down' ? 90 - i * 16 : 110 + i * 10;
        ctx.fillStyle = `rgb(${c},${c - 6},${c - 12})`; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      }
      path();
      ctx.strokeStyle = `rgba(200,122,255,${0.4 + pulse * 0.5})`; ctx.lineWidth = 2; ctx.stroke();
    } else {
      // 귀환 포탈
      ctx.strokeStyle = `rgba(255,220,120,${0.5 + pulse * 0.5})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, cy, 34, 17, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(255,220,120,${0.15 + pulse * 0.2})`; ctx.fill();
      const gr = ctx.createLinearGradient(cx, cy - 90, cx, cy);
      gr.addColorStop(0, 'rgba(255,220,120,0)'); gr.addColorStop(1, `rgba(255,220,120,${0.25 + pulse * 0.15})`);
      ctx.fillStyle = gr; ctx.fillRect(cx - 24, cy - 90, 48, 90);
    }
    ctx.restore();
  }

  // 던전 입구 동굴: 바위 언덕 + 어두운 입구
  drawCave(q, time) {
    const { ctx } = this;
    const cx = this.px(q.cx, q.cy), cy = this.py(q.cx, q.cy);
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    const gr = ctx.createLinearGradient(cx - 70, cy - 70, cx + 70, cy + 10);
    gr.addColorStop(0, '#8c8478'); gr.addColorStop(0.55, '#5e574e'); gr.addColorStop(1, '#2e2a26');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(cx - 78, cy + 8);
    ctx.quadraticCurveTo(cx - 84, cy - 40, cx - 40, cy - 62);
    ctx.quadraticCurveTo(cx, cy - 84, cx + 42, cy - 60);
    ctx.quadraticCurveTo(cx + 86, cy - 38, cx + 76, cy + 10);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(20,18,16,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#0c0a08';
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy + 8); ctx.quadraticCurveTo(cx - 28, cy - 34, cx, cy - 38); ctx.quadraticCurveTo(cx + 28, cy - 34, cx + 26, cy + 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(200,122,255,${0.35 + pulse * 0.45})`; ctx.lineWidth = 2; ctx.stroke();
  }

  drawShadow(sx, sy, r) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlayer(game, sx, sy, ghost = false) {
    const { ctx } = this;
    const p = game.player;
    const ch = game.char;
    const weapon = ITEMS[ch.equipment?.weapon];
    if (!ghost) this.drawShadow(sx, sy, 14);
    const hurtT = game.time - p.lastHurt;
    drawHumanoid(ctx, sx, sy, {
      look: LOOKS[ch.classId] || LOOKS.knight,
      sprite: game.heroKey,
      facing: screenDir(p.facing),
      walk: p.walkPhase,
      moving: p.moving, motion: p.walkWeight,
      attack: (p.attackAnim || 0) / HERO_ACTION.attack.dur,
      cast: (p.castAnim || 0) / HERO_ACTION.skill.dur,
      weaponColor: weapon?.icon?.color,
      armorId: ch.equipment?.armor,
      hurt: !p.dead && hurtT < 0.15 ? 1 - hurtT / 0.15 : 0,
      dead: p.dead,
      time: game.time,
    });
    if (!ghost) nameTag(ctx, sx, sy - 74, ch.name, '#ffffff');
  }

  // 용병: 도트 캐릭터 + 초록 이름표 + 작은 HP 바
  drawMerc(game, u, sx, sy) {
    const { ctx } = this;
    const e = u.ent, ch = u.char;
    this.drawShadow(sx, sy, 13);
    const hurtT = game.time - e.lastHurt;
    drawHumanoid(ctx, sx, sy, {
      look: LOOKS[ch.classId] || LOOKS.knight,
      sprite: game.spriteOf(u),
      facing: screenDir(e.facing), walk: e.walkPhase, moving: e.moving,
      attack: (e.attackAnim || 0) / HERO_ACTION.attack.dur, cast: (e.castAnim || 0) / HERO_ACTION.skill.dur,
      hurt: !e.dead && hurtT < 0.15 ? 1 - hurtT / 0.15 : 0, dead: e.dead, time: game.time,
    });
    if (e.dead) return;
    const top = sy - 74;
    nameTag(ctx, sx, top, ch.name, game.selectedId === u.id ? '#ffe680' : '#9effa0');
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(sx - 15, top + 3, 30, 4);
    ctx.fillStyle = '#4ad04a'; ctx.fillRect(sx - 14, top + 4, 28 * Math.max(0, ch.hp / ch.maxHp), 2);
  }

  drawNpc(n, sx, sy, hovered, time) {
    const { ctx } = this;
    this.drawShadow(sx, sy, 13);
    if (hovered) {
      ctx.strokeStyle = '#ffe680'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy + 2, 15, 7, 0, 0, Math.PI * 2); ctx.stroke();
    }
    drawHumanoid(ctx, sx, sy, {
      look: NPC_LOOKS[n.kind] || NPC_LOOKS.guide,
      sprite: NPC_SPRITES[n.kind],
      facing: { x: n.x > 30 ? -1 : 1, y: 1 }, walk: 0, moving: false, time,
    });
    const bounce = Math.sin(time * 3) * 2;
    ctx.fillStyle = '#ffd84a';
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText('!', sx, sy - 76 + bounce);
    ctx.fillText('!', sx, sy - 76 + bounce);
    nameTag(ctx, sx, sy - 88, n.name, '#ffe680');
  }

  drawMonster(m, sx, sy, targeted, hovered, time) {
    const { ctx } = this;
    const def = MONSTERS[m.type];
    // 그림 반폭(px): 시트 몬스터는 실제 몸 폭 기준, 도형 몬스터는 size 기준
    const r = def.art
      ? Math.max(8, (def.art.bodyWidth / def.art.bodyHeight) * MONSTER_UNIT_PX * def.size * 0.45)
      : def.size * 32;
    const fade = m.dead ? Math.max(0, 1 - (time - m.deathTime) / 0.7) : 1;
    ctx.globalAlpha = fade;
    if (m.isBoss && !m.dead) {
      // 보스 발밑의 붉은 기운
      const pulse = 0.35 + 0.15 * Math.sin(time * 4);
      const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, r * 2);
      g.addColorStop(0, `rgba(255,60,30,${pulse})`); g.addColorStop(1, 'rgba(255,60,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(sx, sy, r * 2, r, 0, 0, Math.PI * 2); ctx.fill();
    }
    this.drawShadow(sx, sy, r);
    if (targeted || hovered) {
      ctx.strokeStyle = targeted ? '#ff4a4a' : '#ffe680';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.ellipse(sx, sy + 2, r + 5, (r + 5) * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    const height = drawMonsterSprite(ctx, sx, sy, { ...m, facing: screenDir(m.facing) }, def, r, time);
    ctx.globalAlpha = 1;
    if (m.dead) return;

    const top = sy - height - 8;
    const showBar = targeted || hovered || m.hp < m.maxHp || m.isBoss;
    if (showBar) {
      const bw = m.isBoss ? 64 : 34;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(sx - bw / 2, top, bw, m.isBoss ? 6 : 5);
      ctx.fillStyle = m.isBoss ? '#ff7a2a' : '#e04040';
      ctx.fillRect(sx - bw / 2 + 1, top + 1, (bw - 2) * Math.max(0, m.hp / m.maxHp), m.isBoss ? 4 : 3);
    }
    if (targeted || hovered || m.isBoss) {
      const color = m.isBoss ? '#ffd24a' : def.aggressive ? '#ff9a9a' : '#e0e0e0';
      const tag = def.rank === 'guard' ? '[네임드] ' : m.isBoss ? '[보스] ' : '';
      nameTag(ctx, sx, top - 5, `${tag}Lv.${def.level} ${def.name}`, color);
    }
  }

  drawGroundEffects(game) {
    const { ctx } = this;
    for (const fx of game.effects) {
      if (fx.type !== 'telegraph') continue;
      const k = Math.min(1, fx.t / fx.life);
      const x = this.px(fx.x, fx.y), y = this.py(fx.x, fx.y);
      const RX = fx.r * ISO_RX, RY = fx.r * ISO_RY;
      ctx.fillStyle = 'rgba(255,40,20,0.18)';
      ctx.beginPath(); ctx.ellipse(x, y, RX, RY, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,80,30,${0.25 + k * 0.25})`;
      ctx.beginPath(); ctx.ellipse(x, y, RX * k, RY * k, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,60,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, RX, RY, 0, 0, TAU); ctx.stroke();
    }
  }

  drawEffects(game) {
    const { ctx } = this;
    for (const fx of game.effects) {
      const k = fx.t / fx.life;
      if (fx.type === 'text') {
        ctx.globalAlpha = 1 - k;
        ctx.font = `bold ${fx.size || 15}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        const x = this.px(fx.x, fx.y), y = this.py(fx.x, fx.y) - 76 - k * 28;
        ctx.strokeText(fx.text, x, y);
        ctx.fillStyle = fx.color;
        ctx.fillText(fx.text, x, y);
      } else if (fx.type === 'sheet') {
        // 스킬 이펙트 시트 (96px 칸 4×4 = 16프레임)
        if (fx.t < 0) continue;
        const im = img(fxSheet(fx.key));
        if (!im) continue;
        // 전체 16장 또는 한 부분(시전자 쪽 1~8장 / 대상 쪽 9~16장)
        const n = fx.frames || FX.frames;
        const f = (fx.from || 0) + Math.min(n - 1, Math.floor(k * n));
        const at = fx.follow || fx;
        const x = this.px(at.x, at.y), y = this.py(at.x, at.y) - fx.z;
        const size = FX.cell * fx.scale;
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(x, y);
        if (fx.flip) ctx.scale(-1, 1);
        ctx.drawImage(im, (f % FX.cols) * FX.cell, Math.floor(f / FX.cols) * FX.cell, FX.cell, FX.cell, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else if (fx.type === 'proj') {
        if (fx.t < 0) continue;
        const wx = fx.x0 + (fx.x1 - fx.x0) * k, wy = fx.y0 + (fx.y1 - fx.y0) * k;
        const x = this.px(wx, wy), y = this.py(wx, wy) - 34;
        ctx.globalAlpha = 1;
        const pim = fx.sheet && img(fxSheet(fx.sheet));
        if (pim) {
          // 날아가는 화살 · 마법탄 그림 (오른쪽을 보고 있음 → 날아가는 방향으로 회전)
          const dx = fx.x1 - fx.x0, dy = fx.y1 - fx.y0;
          const ang = Math.atan2((dx + dy) * HH, (dx - dy) * HW);
          const f = Math.floor(fx.t * 24) % FX.frames;
          const size = FX.cell * 0.8;
          ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
          ctx.drawImage(pim, (f % FX.cols) * FX.cell, Math.floor(f / FX.cols) * FX.cell, FX.cell, FX.cell, -size / 2, -size / 2, size, size);
          ctx.restore();
        } else if (fx.kind === 'arrow') {
          const dx = fx.x1 - fx.x0, dy = fx.y1 - fx.y0;
          const ang = Math.atan2((dx + dy) * HH, (dx - dy) * HW);
          ctx.strokeStyle = fx.color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang) * 12, y - Math.sin(ang) * 12); ctx.stroke();
        } else {
          // 빛나는 구체: 반투명 원을 겹쳐서 (shadowBlur 는 무거워서 쓰지 않음)
          ctx.fillStyle = fx.color;
          ctx.globalAlpha = 0.2;
          ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill();
          ctx.globalAlpha = 0.4;
          ctx.beginPath(); ctx.arc(x, y, 7.5, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 1.8, 0, TAU); ctx.fill();
        }
      } else if (fx.type === 'ring') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = fx.color; ctx.lineWidth = 3;
        const r = fx.r * (0.3 + 0.7 * k);
        ctx.beginPath(); ctx.ellipse(this.px(fx.x, fx.y), this.py(fx.x, fx.y), r * ISO_RX, r * ISO_RY, 0, 0, TAU); ctx.stroke();
      } else if (fx.type === 'slash') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = fx.color; ctx.lineWidth = 3;
        const x = this.px(fx.x, fx.y), y = this.py(fx.x, fx.y) - 20;
        ctx.beginPath(); ctx.arc(x, y, 14, -0.5 + k * 2, 1 + k * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}

function nameTag(ctx, x, y, text, color) {
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
