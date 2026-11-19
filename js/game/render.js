// 캔버스 렌더링 (모든 그래픽은 도형으로 그린 플레이스홀더 — 추후 스프라이트로 교체)
import { TILE_SIZE as TS, T, VILLAGE } from './world.js';
import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { LOOKS, drawHumanoid, drawMonsterSprite } from './sprites.js';

// NPC 외형 (사람형 스프라이트 재사용)
const NPC_LOOKS = {
  merchant: { skin: '#e8c39c', hair: '#5a3a22', hairStyle: 'short', helm: 'none', cape: null, torso: '#b07a3a', robe: '#8a5a2a', trim: '#e0c070', legs: '#5a4030', boots: '#3a2a1a', arms: '#b07a3a', weapon: 'none' },
  smith: { skin: '#d8a880', hair: '#2a1a12', hairStyle: 'short', helm: 'none', cape: null, torso: '#5a4a40', tabard: '#3a2a22', trim: '#a08060', legs: '#4a3a30', boots: '#2a1e16', arms: '#d8a880', weapon: 'mace' },
  healer: { skin: '#f0d0b0', hair: '#c8a060', hairStyle: 'long', helm: 'circlet', helmColor: '#e8c860', cape: '#a8b8d8', torso: '#e8e8f8', robe: '#dcdcf0', trim: '#8aa8e0', legs: '#c8c8e0', boots: '#6a6a8a', arms: '#e8e8f8', weapon: 'none' },
  guide: { skin: '#ecc8a4', hair: '#3a2a1a', hairStyle: 'short', helm: 'hood', helmColor: '#3a6a8a', cape: '#2a4a6a', torso: '#5aa0c8', trim: '#e0d090', legs: '#3a4a5a', boots: '#2a2a2a', arms: '#5aa0c8', weapon: 'staff' },
};

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

    // 화면 흔들림 (보스 내려찍기 등)
    let shx = 0, shy = 0;
    for (const fx of game.effects) {
      if (fx.type !== 'shake' || fx.t < 0) continue;
      const p = fx.power * (1 - fx.t / fx.life);
      shx += (Math.random() - 0.5) * 2 * p; shy += (Math.random() - 0.5) * 2 * p;
    }
    const ox = Math.round(this.w / 2 - cam.x * TS + shx);
    const oy = Math.round(this.h / 2 - cam.y * TS + shy);
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

    // 바닥에 깔리는 효과 (보스 공격 예고)는 캐릭터보다 먼저
    this.drawGroundEffects(game, ox, oy);

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
    const ch = game.char;
    const weapon = ITEMS[ch.equipment?.weapon];
    this.drawShadow(sx, sy, 12);
    const hurtT = game.time - p.lastHurt;
    drawHumanoid(ctx, sx, sy, {
      look: LOOKS[ch.classId] || LOOKS.knight,
      facing: p.facing,
      walk: p.walkPhase,
      moving: p.moving,
      attack: (p.attackAnim || 0) / 0.3,
      cast: (p.castAnim || 0) / 0.4,
      weaponColor: weapon?.icon?.color,
      armorId: ch.equipment?.armor,
      hurt: !p.dead && hurtT < 0.15 ? 1 - hurtT / 0.15 : 0,
      dead: p.dead,
      time: game.time,
    });
    nameTag(ctx, sx, sy - 52, ch.name, '#ffffff');
  }

  drawNpc(n, sx, sy, hovered, time) {
    const { ctx } = this;
    this.drawShadow(sx, sy, 11);
    if (hovered) {
      ctx.strokeStyle = '#ffe680'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx, sy + 2, 15, 7, 0, 0, Math.PI * 2); ctx.stroke();
    }
    drawHumanoid(ctx, sx, sy, {
      look: NPC_LOOKS[n.kind] || NPC_LOOKS.guide,
      facing: { x: 0, y: 1 }, walk: 0, moving: false, time,
    });
    const bounce = Math.sin(time * 3) * 2;
    ctx.fillStyle = '#ffd84a';
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText('!', sx, sy - 54 + bounce);
    ctx.fillText('!', sx, sy - 54 + bounce);
    nameTag(ctx, sx, sy - 66, n.name, '#ffe680');
  }

  drawMonster(m, sx, sy, targeted, hovered, time) {
    const { ctx } = this;
    const def = MONSTERS[m.type];
    const r = def.size * TS;
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
    const height = drawMonsterSprite(ctx, sx, sy, m, def, r, time);
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
      nameTag(ctx, sx, top - 5, `${m.isBoss ? '[보스] ' : ''}Lv.${def.level} ${def.name}`, color);
    }
  }

  drawGroundEffects(game, ox, oy) {
    const { ctx } = this;
    for (const fx of game.effects) {
      if (fx.type !== 'telegraph') continue;
      const k = Math.min(1, fx.t / fx.life);
      const x = ox + fx.x * TS, y = oy + fx.y * TS;
      const R = fx.r * TS;
      ctx.fillStyle = 'rgba(255,40,20,0.18)';
      ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,80,30,${0.25 + k * 0.25})`;
      ctx.beginPath(); ctx.ellipse(x, y, R * k, R * k * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,60,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
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
        const x = ox + fx.x * TS, y = oy + fx.y * TS - 50 - k * 28;
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
