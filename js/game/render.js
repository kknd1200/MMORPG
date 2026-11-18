// 캔버스 렌더링 (모든 그래픽은 도형으로 그린 플레이스홀더 — 추후 스프라이트로 교체)
import { TILE_SIZE as TS, T, VILLAGE } from './world.js';
import { CLASSES } from '../data/classes.js';
import { MONSTERS } from '../data/monsters.js';

const GRASS = ['#4c8a3a', '#4f8f3d', '#4a8538', '#53923f'];
const FONT = '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
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
    return { x: (sx - this.w / 2) / TS + cam.x, y: (sy - this.h / 2) / TS + cam.y };
  }

  draw(game) {
    const { ctx } = this;
    const cam = game.camera;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#10140e';
    ctx.fillRect(0, 0, this.w, this.h);

    const ox = Math.round(this.w / 2 - cam.x * TS);
    const oy = Math.round(this.h / 2 - cam.y * TS);
    const tx0 = Math.floor(cam.x - this.w / 2 / TS) - 1;
    const ty0 = Math.floor(cam.y - this.h / 2 / TS) - 1;
    const tx1 = Math.ceil(cam.x + this.w / 2 / TS) + 1;
    const ty1 = Math.ceil(cam.y + this.h / 2 / TS) + 1;

    const world = game.world;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) continue;
        const i = world.idx(tx, ty);
        drawTile(ctx, world.tiles[i], world.variant[i], ox + tx * TS, oy + ty * TS, game.time);
      }
    }

    // 마을 표지
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,240,200,0.9)';
    ctx.fillText(`${VILLAGE.name} (초보자의 마을)`, ox + 60.5 * TS, oy + (VILLAGE.y0 - 0.4) * TS);

    // 이동 목표 표시
    const p = game.player;
    if (p.moveTarget && !p.action) {
      const mx = ox + p.moveTarget.x * TS, my = oy + p.moveTarget.y * TS;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(mx, my, 8, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const targetId = p.action?.targetId;
    const hoverId = game.hover?.id;
    const ents = [...world.npcs, ...game.monsters, p].sort((a, b) => a.y - b.y);
    for (const e of ents) {
      const sx = ox + e.x * TS, sy = oy + e.y * TS;
      if (sx < -60 || sy < -60 || sx > this.w + 60 || sy > this.h + 60) continue;
      if (e === p) this.drawPlayer(game, sx, sy);
      else if (e.isNpc) this.drawNpc(e, sx, sy, hoverId === e.id, game.time);
      else this.drawMonster(e, sx, sy, targetId === e.id, hoverId === e.id, game.time);
    }

    this.drawEffects(game, ox, oy);
  }

  drawShadow(sx, sy, r) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 2, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlayer(game, sx, sy) {
    const { ctx } = this;
    const p = game.player;
    const cls = CLASSES[game.char.classId];
    if (p.dead) ctx.globalAlpha = 0.4;
    const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
    this.drawShadow(sx, sy, 12);

    const fx = p.facing.x, fy = p.facing.y;
    // 무기 (몸 뒤쪽이면 먼저 그림)
    const drawWeapon = () => {
      ctx.lineCap = 'round';
      const hx = sx + fx * 8, hy = sy - 12 + bob + fy * 4;
      if (cls.id === 'knight') {
        ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + fx * 14, hy + fy * 14 - 6); ctx.stroke();
      } else if (cls.id === 'elf') {
        ctx.strokeStyle = '#a0763e'; ctx.lineWidth = 2.5;
        const ang = Math.atan2(fy, fx);
        ctx.beginPath(); ctx.arc(hx, hy, 9, ang - 1.2, ang + 1.2); ctx.stroke();
      } else if (cls.id === 'mage') {
        ctx.strokeStyle = '#7a5a36'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(hx, hy + 8); ctx.lineTo(hx, hy - 14); ctx.stroke();
        ctx.fillStyle = '#7ad0ff'; ctx.beginPath(); ctx.arc(hx, hy - 15, 3.5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(hx, hy + 4); ctx.lineTo(hx + fx * 8, hy - 10); ctx.stroke();
        ctx.fillStyle = '#d8d0b8'; ctx.beginPath(); ctx.arc(hx + fx * 8, hy - 11, 4, 0, Math.PI * 2); ctx.fill();
      }
    };
    if (fy < 0) drawWeapon();
    // 몸
    ctx.fillStyle = cls.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, sx - 9, sy - 20 + bob, 18, 18, 6);
    ctx.fill(); ctx.stroke();
    // 머리
    ctx.fillStyle = '#f1d2b0';
    ctx.beginPath(); ctx.arc(sx, sy - 26 + bob, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (fy >= 0) {
      ctx.fillStyle = '#222';
      ctx.fillRect(sx - 3.5 + fx * 2, sy - 27 + bob, 2, 2);
      ctx.fillRect(sx + 1.5 + fx * 2, sy - 27 + bob, 2, 2);
    }
    if (fy >= 0) drawWeapon();
    ctx.globalAlpha = 1;

    nameTag(ctx, sx, sy - 40, game.char.name, '#ffffff');
  }

  drawNpc(n, sx, sy, hovered, time) {
    const { ctx } = this;
    this.drawShadow(sx, sy, 11);
    ctx.fillStyle = n.color;
    ctx.strokeStyle = hovered ? '#ffe680' : 'rgba(0,0,0,0.6)';
    ctx.lineWidth = hovered ? 2.5 : 1.5;
    roundRect(ctx, sx - 9, sy - 20, 18, 19, 5);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ecc9a4';
    ctx.beginPath(); ctx.arc(sx, sy - 26, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const bounce = Math.sin(time * 3) * 2;
    ctx.fillStyle = '#ffd84a';
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('!', sx, sy - 40 + bounce);
    nameTag(ctx, sx, sy - 52, n.name, '#ffe680');
  }

  drawMonster(m, sx, sy, targeted, hovered, time) {
    const { ctx } = this;
    const def = MONSTERS[m.type];
    const r = def.size * TS;
    if (m.dead) ctx.globalAlpha = Math.max(0, 1 - (time - m.deathTime) / 0.6);
    this.drawShadow(sx, sy, r);
    if (targeted || hovered) {
      ctx.strokeStyle = targeted ? '#ff4a4a' : '#ffe680';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.ellipse(sx, sy + 2, r + 5, (r + 5) * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    const color = m.hurtFlash > 0 ? '#ffffff' : def.color;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    const fx = m.facing.x;
    switch (def.shape) {
      case 'slime': {
        const squish = Math.sin(time * 4 + m.id) * 0.1;
        ctx.beginPath();
        ctx.ellipse(sx, sy - r * 0.6, r * (1 + squish), r * (0.75 - squish), 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#123';
        ctx.fillRect(sx - r * 0.35, sy - r * 0.8, 3, 3);
        ctx.fillRect(sx + r * 0.2, sy - r * 0.8, 3, 3);
        break;
      }
      case 'rat': {
        ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.6, r * 1.2, r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(sx + fx * r * 1.1, sy - r * 0.8, r * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#d9a3a3'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx - fx * r * 1.1, sy - r * 0.5); ctx.quadraticCurveTo(sx - fx * r * 2, sy - r * 1.4, sx - fx * r * 2.2, sy - r * 0.3); ctx.stroke();
        break;
      }
      case 'wolf': {
        ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.7, r * 1.3, r * 0.65, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(sx + fx * r * 1.2, sy - r * 1.1, r * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffdd55';
        ctx.fillRect(sx + fx * r * 1.4 - 1, sy - r * 1.25, 3, 3);
        break;
      }
      case 'skeleton':
      case 'humanoid':
      default: {
        roundRect(ctx, sx - r * 0.75, sy - r * 1.6, r * 1.5, r * 1.5, 4); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(sx, sy - r * 2.1, r * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = def.shape === 'skeleton' ? '#200' : '#ff3';
        ctx.fillRect(sx - r * 0.3, sy - r * 2.2, 3, 3);
        ctx.fillRect(sx + r * 0.1, sy - r * 2.2, 3, 3);
        ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx + fx * r, sy - r); ctx.lineTo(sx + fx * r * 1.6, sy - r * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (m.dead) return;

    const top = sy - r * 2.8 - 6;
    if (targeted || hovered || m.hp < m.maxHp) {
      const bw = 34;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(sx - bw / 2, top, bw, 5);
      ctx.fillStyle = '#e04040';
      ctx.fillRect(sx - bw / 2 + 1, top + 1, (bw - 2) * Math.max(0, m.hp / m.maxHp), 3);
    }
    if (targeted || hovered) {
      nameTag(ctx, sx, top - 5, `Lv.${def.level} ${def.name}`, def.aggressive ? '#ff9a9a' : '#e0e0e0');
    }
  }

  drawEffects(game, ox, oy) {
    const { ctx } = this;
    for (const fx of game.effects) {
      const k = fx.t / fx.life;
      if (fx.type === 'text') {
        ctx.globalAlpha = 1 - k;
        ctx.font = `bold ${fx.size || 15}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        const x = ox + fx.x * TS, y = oy + fx.y * TS - 40 - k * 28;
        ctx.strokeText(fx.text, x, y);
        ctx.fillStyle = fx.color;
        ctx.fillText(fx.text, x, y);
      } else if (fx.type === 'proj') {
        const x = ox + (fx.x0 + (fx.x1 - fx.x0) * k) * TS;
        const y = oy + (fx.y0 + (fx.y1 - fx.y0) * k) * TS - 14;
        ctx.globalAlpha = 1;
        if (fx.kind === 'arrow') {
          const ang = Math.atan2(fx.y1 - fx.y0, fx.x1 - fx.x0);
          ctx.strokeStyle = fx.color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang) * 12, y - Math.sin(ang) * 12); ctx.stroke();
        } else {
          ctx.fillStyle = fx.color;
          ctx.shadowColor = fx.color; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else if (fx.type === 'ring') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = fx.color; ctx.lineWidth = 3;
        const r = fx.r * TS * (0.3 + 0.7 * k);
        ctx.beginPath(); ctx.ellipse(ox + fx.x * TS, oy + fx.y * TS, r, r * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (fx.type === 'slash') {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = fx.color; ctx.lineWidth = 3;
        const x = ox + fx.x * TS, y = oy + fx.y * TS - 14;
        ctx.beginPath(); ctx.arc(x, y, 12, -0.5 + k * 2, 1 + k * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}

function drawTile(ctx, t, v, x, y, time) {
  switch (t) {
    case T.GRASS:
      ctx.fillStyle = GRASS[v & 3]; ctx.fillRect(x, y, TS, TS);
      if (v % 7 === 0) { ctx.fillStyle = '#3f7a30'; ctx.fillRect(x + (v % 20), y + ((v >> 3) % 20), 3, 5); }
      break;
    case T.FLOWER: {
      ctx.fillStyle = GRASS[v & 3]; ctx.fillRect(x, y, TS, TS);
      const cols = ['#f4e04d', '#f08ab0', '#ffffff', '#b28cf0'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = cols[(v + i) & 3];
        ctx.fillRect(x + ((v * (i + 3)) % 26) + 2, y + ((v * (i + 7)) % 26) + 2, 3, 3);
      }
      break;
    }
    case T.DIRT:
      ctx.fillStyle = (v & 1) ? '#977a52' : '#9c7f56'; ctx.fillRect(x, y, TS, TS);
      if (v % 5 === 0) { ctx.fillStyle = '#7f6544'; ctx.fillRect(x + (v % 24), y + ((v >> 2) % 24), 4, 3); }
      break;
    case T.SAND:
      ctx.fillStyle = (v & 1) ? '#d6c28c' : '#dac792'; ctx.fillRect(x, y, TS, TS);
      break;
    case T.WATER: {
      ctx.fillStyle = '#2e6aa3'; ctx.fillRect(x, y, TS, TS);
      const a = 0.15 + 0.12 * Math.sin(time * 2 + v);
      ctx.fillStyle = `rgba(200,230,255,${a})`;
      ctx.fillRect(x + 4 + (v % 12), y + 8 + (v % 14), 10, 2);
      break;
    }
    case T.FLOOR:
      ctx.fillStyle = (v & 1) ? '#b49c74' : '#ac946c'; ctx.fillRect(x, y, TS, TS);
      ctx.strokeStyle = 'rgba(80,60,40,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, TS - 1, TS - 1);
      break;
    case T.STONE:
      ctx.fillStyle = ['#77756f', '#7c7a73', '#73716b', '#807d76'][v & 3]; ctx.fillRect(x, y, TS, TS);
      if (v % 9 === 0) { ctx.strokeStyle = '#5d5b56'; ctx.beginPath(); ctx.moveTo(x + 6, y + 8); ctx.lineTo(x + 16, y + 18); ctx.lineTo(x + 24, y + 14); ctx.stroke(); }
      break;
    case T.ROCK:
      ctx.fillStyle = '#77756f'; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#9a978f'; roundRect(ctx, x + 3, y + 2, TS - 6, TS - 5, 5); ctx.fill();
      ctx.fillStyle = '#b4b1a9'; ctx.fillRect(x + 6, y + 5, TS - 14, 4);
      break;
    case T.WALL:
      ctx.fillStyle = '#5f544b'; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#7d7064'; ctx.fillRect(x, y, TS, 8);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(x + 0.5, y + 0.5, TS - 1, TS - 1);
      break;
    case T.TREE:
      ctx.fillStyle = GRASS[v & 3]; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(x + TS / 2, y + TS - 4, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a3d22'; ctx.fillRect(x + TS / 2 - 3, y + TS / 2, 6, TS / 2 - 3);
      ctx.fillStyle = (v & 1) ? '#2e5f2a' : '#336a2e';
      ctx.beginPath(); ctx.arc(x + TS / 2, y + TS / 2 - 3, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f7d37';
      ctx.beginPath(); ctx.arc(x + TS / 2 - 4, y + TS / 2 - 7, 7, 0, Math.PI * 2); ctx.fill();
      break;
    default:
      ctx.fillStyle = '#f0f'; ctx.fillRect(x, y, TS, TS);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
