import { heroSprite } from './hero-sheets.js';
import { actionDur, hitTimes } from '../data/chars.js';
import { advanceGait, monsterStride } from './locomotion.js';
import { QUADRUPED_ATTACK_SECONDS, QUADRUPED_SKILL_SECONDS, QUADRUPED_IMPACT } from './quadruped-motion.js';
// 인게임 루프: 이동 / 전투 / 스킬 / 아이템 / 입력
import { CLASSES } from '../data/classes.js';
import { SKILLS, BASIC_FX, STATUS_FX, LEVELUP_FX, STATUS_ICON } from '../data/skills.js';
import { preload, fxSheet, fxIcon, statusIcon } from './art.js';
import { MAX_MERCS, mercOffers, createMerc, fillSlots, learnedSkills, condOk, shareExp } from '../systems/party.js';
import { ITEMS, INVENTORY_SIZE, SHOPS, sellPrice, canEquip } from '../data/items.js';
import { MONSTERS } from '../data/monsters.js';
import { MAPS, START_MAP, bossWindow, formatClock, mapTitle, teleportDestinations } from '../data/maps.js';
import * as S from '../systems/stats.js';
import { World, WORLD_VERSION } from './world.js';
import { loadSheet, releaseSheet, sheetCellPx } from './sprites.js';
import { STREAM, planZones, planArt, viewRect, pointInRect } from './zones.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';

// 몬스터 스킬 상태이상 (플레이어에게 걸림). buffs 목록에 함께 들어가 HUD 에 표시됨
const STATUS = {
  slow: { id: 'st_slow', name: '둔화', speed: -0.3, duration: 3 },
  expose: { id: 'st_expose', name: '방어 약화', expose: 0.12, duration: 4 },
  bleed: { id: 'st_bleed', name: '출혈', dot: true, duration: 3 },
  burn: { id: 'st_burn', name: '화상', dot: true, duration: 3 },
  poison: { id: 'st_poison', name: '중독', dot: true, duration: 4 },
};
const EFFECT_COLOR = { slow: '#8ad0ff', expose: '#ffb38c', bleed: '#ff5a5a', burn: '#ff9a3a', poison: '#8ae05a' };
// 몬스터 패시브 값 (없으면 0)
const passive = (def, kind) => def.passive?.find((p) => p.kind === kind)?.value || 0;

export const HOTBAR_KEYS = ['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
const FIELD_BOSS_ZONE = 'fieldboss';
const TARGETED = new Set(['damage', 'aoe_target', 'chain']);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class Game {
  constructor({ canvas, hudRoot, character, onSave, onExit }) {
    this.canvas = canvas;
    this.char = character;
    this.cls = CLASSES[character.classId];
    this.onSave = onSave;
    this.onExit = onExit;
    this.renderer = new Renderer(canvas);
    this.worlds = new Map(); // 한 번 만든 맵은 다시 쓰기 (지형만, 몬스터는 들어갈 때마다 새로)

    // 맵 구조가 바뀐 뒤 처음 접속하면 예전 위치 대신 시작 마을에서
    const valid = character.worldVersion === WORLD_VERSION && MAPS[character.mapId];
    const mapId = valid ? character.mapId : START_MAP;
    let start = valid ? character.pos : null;
    character.worldVersion = WORLD_VERSION;
    character.fieldBossKills ??= {};
    this.world = this.getWorld(mapId);
    if (!start || this.world.blocked(start.x, start.y)) start = { ...this.world.spawn };
    this.player = {
      id: 'player', x: start.x, y: start.y, radius: 0.3, facing: { x: 0, y: 1 },
      moveTarget: null, action: null, attackTimer: 0, lastHurt: -99,
      dead: false, respawnAt: 0, walkPhase: 0, moving: false,
    };
    if (character.hp <= 0) character.hp = character.maxHp;
    character.hp = Math.min(character.hp, character.maxHp);
    character.mp = Math.min(character.mp, character.maxMp);
    if (!Array.isArray(character.hotbar) || character.hotbar.length !== 8) {
      character.hotbar = Array.from({ length: 8 }, (_, i) => character.hotbar?.[i] ?? null);
    }

    // 파티: 리더(내 캐릭터) + 용병. 전투 · 스킬 · 버프는 모두 '파티원(unit)' 단위로 처리
    this.leader = { id: 'player', isLeader: true, char: character, ent: this.player, buffs: [], cooldowns: {}, gcd: 0 };
    this.player.unit = this.leader;
    fillSlots(character);
    character.party ??= [];
    this.party = character.party.map((c, i) => this.makeMercUnit(c, start, i));
    this.autoMode = character.autoMode || 'manual'; // manual | normal | skill
    this.focusId = null;
    this.selectedId = 'player';
    this.itemReadyAt = 0;
    this.effects = [];
    this.monsters = [];
    this.nextId = 1;
    this.time = 0;
    this.selectedSlot = 0;
    this.mouse = { sx: 0, sy: 0, wx: 0, wy: 0, left: false, mode: null };
    this.hover = null;
    this.camera = { x: start.x, y: start.y };
    this.openNpc = null;
    this.timers = { spawn: 0, regen: 0, save: 0, hud: 0, zone: 0 };
    this.bossRespawnAt = {};
    // 심리스 구역 스트리밍: 화면 근처 사냥터만 몬스터 배치 (zones.js)
    this.activeZones = new Set();
    this.artZones = new Set();
    this.tempPortals = [];
    this.pending = []; // 늦게 적용할 피해 (화살 · 마법 도착)
    this.portalReadyAt = 0;
    this.clockOffset = 0; // 필드 보스 시간 확인용 (테스트에서 시계를 앞당길 때)

    // 그림 미리 불러오기: 직업 스킬 이펙트 · 아이콘 (캐릭터는 코드로 그림)
    for (const u of this.units()) this.preloadUnit(u);
    preload([
      ...Object.values(STATUS_FX).map((f) => fxSheet(f.sheet)), fxSheet(LEVELUP_FX.sheet),
      ...['bleed', 'burn', 'frost', 'poison', 'shock', 'guard', 'roar', 'instinct', 'seed', 'scroll', 'potion'].map(statusIcon),
    ]);

    this.hud = new Hud(hudRoot, this);
    this.enterMap(this.world, start, true);
    this.bindInput();
    this.log(`${this.char.name}님, ${this.world.def.name}에 오신 것을 환영합니다!`, 'system');
    this.log('좌클릭(누른 채 유지)으로 이동, 몬스터 좌클릭으로 공격합니다. 안내원에게 말을 걸어보세요.', 'system');
  }

  // 리더의 버프 · 재사용 시간 (예전 코드와 호환)
  get buffs() { return this.leader.buffs; }
  set buffs(v) { this.leader.buffs = v; }
  get cooldowns() { return this.leader.cooldowns; }
  set cooldowns(v) { this.leader.cooldowns = v; }

  // ------------------------------------------------------------ 파티
  units() { return [this.leader, ...this.party]; }
  aliveUnits() { return this.units().filter((u) => !u.ent.dead); }
  unitById(id) { return this.units().find((u) => u.ent.id === id || u.id === id) || null; }
  selUnit() { return this.unitById(this.selectedId) || this.leader; }
  clsOf(u) { return CLASSES[u.char.classId]; }

  makeMercUnit(char, near, i = 0) {
    fillSlots(char);
    const off = [[-1.2, 0.8], [0.8, 1.3], [-0.6, 2]][i % 3];
    const ent = {
      id: `merc:${char.id}`, isMerc: true, x: near.x + off[0], y: near.y + off[1], radius: 0.3, facing: { x: 0, y: 1 },
      action: null, attackTimer: Math.random() * 0.5, lastHurt: -99, dead: char.hp <= 0, respawnAt: 0, walkPhase: 0, moving: false,
    };
    const u = { id: ent.id, char, ent, buffs: [], cooldowns: {}, gcd: 0, target: null };
    ent.unit = u;
    if (ent.dead) ent.respawnAt = 30;
    return u;
  }

  preloadUnit(u) {
    const cls = this.clsOf(u);
    const fx = [...cls.skills.map((id) => SKILLS[id]), BASIC_FX[u.char.classId]].flatMap((x) => [x?.fx?.sheet || x?.sheet, x?.proj]).filter(Boolean);
    preload([...fx.map(fxSheet), ...cls.skills.map((id) => fxIcon(SKILLS[id].fx.sheet))]);
  }

  // 용병단장: 이 마을의 용병 목록 (1시간마다 바뀜)
  mercOffers() {
    const def = this.world.def;
    const hour = Math.floor(this.now() / 3600000);
    return mercOffers(def.id, Math.max(1, Math.min(def.level[0], this.char.level)), hour, 4, this.units().map((u) => u.char.name))
      .filter((o) => !(this.char.hiredOffers || []).includes(o.offerId));
  }

  hireMerc(offerId) {
    const o = this.mercOffers().find((x) => x.offerId === offerId);
    if (!o || this.openNpc?.kind !== 'mercenary') return;
    if (this.party.length >= MAX_MERCS) { this.log(`용병은 최대 ${MAX_MERCS}명까지 고용할 수 있습니다.`, 'warn'); return; }
    if (this.char.gold < o.price) { this.log(`골드가 부족합니다. (${o.price} 골드 필요)`, 'warn'); return; }
    this.char.gold -= o.price;
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const mc = createMerc(o, id);
    this.char.party.push(mc);
    (this.char.hiredOffers ??= []).push(o.offerId);
    const u = this.makeMercUnit(mc, this.player, this.party.length);
    this.party.push(u);
    this.preloadUnit(u);
    this.fx({ sheet: 'priest_a5', scale: 1.2, z: 6 }, u.ent);
    this.log(`${CLASSES[mc.classId].name} ${mc.name}(Lv.${mc.level})을(를) ${o.price} 골드에 고용했습니다.`, 'system');
    this.hud.markDirty('npc', 'party', 'inv');
    this.save();
  }

  dismissMerc(id) {
    const u = this.party.find((x) => x.id === id);
    if (!u) return;
    // 장비는 인벤토리로 돌려받음
    for (const slot of ['weapon', 'armor']) {
      const it = u.char.equipment[slot];
      if (it && !it.startsWith('training_') && it !== 'cloth_armor') this.addItem(it);
    }
    this.party = this.party.filter((x) => x !== u);
    this.char.party = this.char.party.filter((c) => c !== u.char);
    if (this.selectedId === u.id) this.selectedId = 'player';
    this.log(`${u.char.name}을(를) 파티에서 내보냈습니다.`, 'system');
    this.hud.markDirty('party', 'inv', 'char');
    this.save();
  }

  setAutoMode(mode) {
    this.autoMode = mode;
    this.char.autoMode = mode;
    const label = { manual: '자동사냥 끔 (이동은 직접, 근처 적은 파티가 자동 전투)', normal: '자동사냥: 일반공격만', skill: '자동사냥: 스킬까지 사용' }[mode];
    this.log(label, 'system');
    this.hud.markDirty('auto');
  }

  cycleAutoMode() {
    const order = ['manual', 'normal', 'skill'];
    this.setAutoMode(order[(order.indexOf(this.autoMode) + 1) % order.length]);
  }

  setSkillSlot(unitId, i, entry) {
    const u = this.unitById(unitId);
    if (!u) return;
    fillSlots(u.char);
    const slots = u.char.skillSlots;
    if (entry && !learnedSkills(u.char).includes(entry.id)) { this.log('아직 배우지 않은 스킬입니다.', 'warn'); return; }
    if (entry) {
      const dup = slots.findIndex((x) => x && x.id === entry.id);
      if (dup >= 0 && dup !== i) slots[dup] = slots[i];
    }
    slots[i] = entry ? { id: entry.id, cond: entry.cond || slots[i]?.cond || 'always' } : null;
    this.hud.markDirty('party');
  }

  swapSkillSlot(unitId, a, b) {
    const u = this.unitById(unitId);
    if (!u) return;
    const s2 = u.char.skillSlots;
    [s2[a], s2[b]] = [s2[b], s2[a]];
    this.hud.markDirty('party');
  }

  setSlotCond(unitId, i, cond) {
    const u = this.unitById(unitId);
    if (u?.char.skillSlots[i]) { u.char.skillSlots[i].cond = cond; this.hud.markDirty('party'); }
  }

  // ------------------------------------------------------------ 파티 자동 전투
  engageRadius() { return this.autoMode === 'manual' ? 6 : 11; }
  useSkills() { return this.autoMode !== 'normal'; }
  userMoving() { const p = this.player; return !!p.moveTarget || (this.mouse.left && this.mouse.mode === 'move'); }

  // 싸울 대상: 집중 대상(내가 클릭한 적) → 지금 대상 → 리더 근처에서 가장 가까운 적
  pickTarget(u, keep) {
    const f = this.focusId && this.monsters.find((m) => m.id === this.focusId && !m.dead);
    if (f) return f;
    const p = this.player, R = this.engageRadius();
    if (keep && !keep.dead && this.monsters.includes(keep) && dist(keep, p) < R + 4) return keep;
    let best = null, bd = Infinity;
    for (const m of this.monsters) {
      if (m.dead || m.state === 'return') continue;
      const dl = dist(m, p);
      if (dl > R) continue;
      // 자동사냥이 꺼져 있으면: 우리에게 덤비는 적이나 아주 가까운 적만
      if (this.autoMode === 'manual' && m.state !== 'chase' && dl > 3.5) continue;
      const d = dist(m, u.ent) - (m.state === 'chase' ? 2 : 0);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // 자동사냥: 근처에 적이 없으면 불러온 구역에서 가장 가까운 적을 찾아감
  roamTarget() {
    let best = null, bd = 40;
    for (const m of this.monsters) {
      if (m.dead || m.state === 'return') continue;
      const d = dist(m, this.player);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  /** 스킬 칸을 앞에서부터 보고, 쓸 수 있는 첫 스킬을 씀. 썼으면 true */
  autoSkill(u, target) {
    const slots = u.char.skillSlots || [];
    const alive = this.aliveUnits();
    const enemiesNear = target ? this.monsters.filter((m) => !m.dead && dist(m, target) < 3).length : 0;
    for (const sl of slots) {
      if (!sl) continue;
      const sk = SKILLS[sl.id];
      if (!sk || !this.canCast(sk, true, u)) continue;
      if (!condOk(sl.cond, u, { units: alive, enemiesNear, target })) continue;
      if (sk.kind === 'buff') {
        if (!target) continue;
        const who = sk.party ? alive : [u];
        if (who.every((t) => t.buffs.some((b) => b.id === sk.buff.id))) continue;
      }
      if (sk.kind === 'heal' && !alive.some((t) => t.char.hp < t.char.maxHp * 0.8)) continue;
      if (sk.kind === 'restore' && u.char.mp > u.char.maxMp * 0.5) continue;
      if (sk.kind === 'aoe' && !this.monsters.some((m) => !m.dead && dist(m, u.ent) <= sk.radius + m.radius && this.hasAttackLine(u.ent, m))) continue;
      if (TARGETED.has(sk.kind)) {
        if (!target || dist(u.ent, target) > this.skillRange(sk, u) + target.radius || !this.hasAttackLine(u.ent, target)) continue;
        this.castTargetSkill(sk, target, u);
      } else {
        this.castSelfSkill(sk, u);
      }
      return true;
    }
    return false;
  }

  updateParty(dt) {
    this.leaderAI(dt);
    this.party.forEach((u, i) => this.mercAI(u, i, dt));
  }

  // 리더: 내가 움직이지 않을 때는 근처 적을 자동으로 공격, 자동사냥이면 적을 찾아다님
  leaderAI(dt) {
    const p = this.player, L = this.leader;
    L.gcd -= dt;
    if (p.dead || this.userMoving() || p.action?.type === 'talk' || p.action?.type === 'skill') return;
    if (!p.action) {
      let t = this.pickTarget(L, null);
      if (!t && this.autoMode !== 'manual') t = this.roamTarget();
      if (t) p.action = { type: 'attack', targetId: t.id, auto: true };
    }
    if (this.useSkills() && p.action?.type === 'attack' && L.gcd <= 0) {
      const t = this.findEntity(p.action.targetId);
      L.gcd = t && !t.isNpc && this.autoSkill(L, t) ? 0.7 : 0.25;
    } else if (this.useSkills() && !p.action && L.gcd <= 0) {
      L.gcd = this.autoSkill(L, null) ? 0.7 : 0.4; // 싸우지 않을 때도 치유 · 명상
    }
  }

  // 용병: 리더 뒤를 따라다니다가 적이 있으면 싸우고, 스킬 칸 순서대로 스킬 사용
  mercAI(u, i, dt) {
    const e = u.ent, p = this.player;
    e.attackTimer -= dt;
    e.attackAnim = Math.max(0, (e.attackAnim || 0) - dt);
    e.castAnim = Math.max(0, (e.castAnim || 0) - dt);
    e.moving = false;
    u.gcd -= dt;
    if (e.dead) return;
    const cls = this.clsOf(u);
    const dl = dist(e, p);
    if (dl > 25 || (dl > 10 && e.stuck > 2)) {
      // 너무 멀어지면 리더 곁으로 순간 이동
      e.x = p.x; e.y = p.y; this.clearPath(e); e.stuck = 0;
    }
    const speed = this.derived(u).speed * (dl > 4 ? 1.3 : 1);
    if (dl > 12 || p.dead) u.target = null;
    else if (!this.userMoving() || dl < 5) u.target = this.pickTarget(u, u.target);
    else u.target = null;
    const t = u.target;
    if (t) {
      if (this.useSkills() && u.gcd <= 0) {
        if (this.autoSkill(u, t)) { u.gcd = 0.8; return; }
        u.gcd = 0.3;
      }
      const range = cls.attackRange + t.radius;
      if (dist(e, t) > range || !this.hasAttackLine(e, t)) {
        const r = this.navigate(e, t, speed, dt);
        e.moving = r === 'moving';
      } else {
        this.clearPath(e);
        this.face(e, t);
        this.tryBasicAttack(u, t);
      }
    } else {
      if (this.useSkills() && u.gcd <= 0) u.gcd = this.autoSkill(u, null) ? 0.8 : 0.5;
      // 리더 뒤쪽 대형
      const f = p.facing, bx = -f.x, by = -f.y, qx = -by, qy = bx;
      const slot = [[1.4, 1], [1.4, -1], [2.5, 0]][i % 3];
      const goal = { x: p.x + bx * slot[0] + qx * slot[1], y: p.y + by * slot[0] + qy * slot[1] };
      if (dist(e, goal) > 0.7) {
        const r = this.navigate(e, goal, speed, dt);
        e.moving = r === 'moving';
        e.stuck = r === 'stuck' ? (e.stuck || 0) + dt : 0;
      } else if (!p.moving && dl < 4) {
        this.face(e, { x: e.x + p.facing.x, y: e.y + p.facing.y });
      }
    }
  }

  // 겹치지 않게: 파티원끼리 · 몬스터끼리 · 몬스터와 파티원 사이를 조금씩 밀어냄
  //   리더(내가 조종)는 밀리지 않고 다른 쪽이 비켜남. 벽 · 나무 안으로는 밀지 않음
  separate(dt) {
    const p = this.player;
    const list = [];
    for (const u of this.units()) if (!u.ent.dead) list.push({ e: u.ent, r: 0.4, w: u.isLeader ? 0 : 0.35, mon: false });
    for (const m of this.monsters) {
      if (!m.dead && Math.abs(m.x - p.x) < 20 && Math.abs(m.y - p.y) < 20) list.push({ e: m, r: Math.max(0.32, Math.min(0.6, m.radius)), w: m.slamTarget ? 0.1 : 1, mon: true });
    }
    const k = Math.min(1, dt * 22);
    // 화면 기준으로 잰다: 아이소 화면에서 위아래(x+y 방향)는 절반 길이로 보이므로
    //   a = 화면 가로(x−y), b = 화면 세로((x+y)/2). 이 거리로 재야 그림끼리 안 겹침
    for (let i = 0; i < list.length; i++) {
      const A = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const B = list[j];
        const min = (A.r + B.r) * 1.414;
        const dx = B.e.x - A.e.x, dy = B.e.y - A.e.y;
        let a = dx - dy, b = (dx + dy) / 2;
        if (Math.abs(a) >= min || Math.abs(b) >= min) continue;
        let d = Math.hypot(a, b);
        if (d >= min) continue;
        const wsum = A.w + B.w;
        if (wsum <= 0) continue;
        if (d < 1e-4) { const ang = (i * 7 + j * 13) % 6.283; a = Math.cos(ang); b = Math.sin(ang); d = 0; } else { a /= d; b /= d; }
        const push = (min - d) * k;
        // 화면 방향 (a, b) → 월드 이동: x = (a + 2b)/2, y = (2b − a)/2
        const mx = (a + 2 * b) / 2 * push, my = (2 * b - a) / 2 * push;
        this.nudge(A, -mx * (A.w / wsum), -my * (A.w / wsum));
        this.nudge(B, mx * (B.w / wsum), my * (B.w / wsum));
      }
    }
  }

  // 걸음: 프레임 시간이 아니라 실제로 움직인 거리만큼 발을 내딛음 (locomotion.js)
  //   느리게 걸으면 발도 느리게, 멈추고 출발할 때는 짧게 섞임
  gait(dt) {
    const step = (e, stride) => {
      const d = e.gx == null ? 0 : Math.hypot(e.x - e.gx, e.y - e.gy);
      e.gx = e.x; e.gy = e.y;
      advanceGait(e, e.moving ? d : 0, dt, stride);
    };
    for (const u of this.units()) step(u.ent, 2.4);
    const p = this.player;
    for (const m of this.monsters) {
      if (m.dead || (m.state === 'idle' && !m.moving && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > 40)) continue;
      const def = MONSTERS[m.type];
      step(m, monsterStride(def?.family, def?.size));
    }
  }

  nudge(o, mx, my) {
    if (!mx && !my) return;
    const e = o.e;
    if (!this.world.blocked(e.x + mx, e.y, e.radius || 0.3, o.mon)) e.x += mx;
    if (!this.world.blocked(e.x, e.y + my, e.radius || 0.3, o.mon)) e.y += my;
  }

  // ------------------------------------------------------------ loop
  start() {
    this.running = true;
    this.lastFrame = performance.now();
    const frame = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.update(dt);
      this.renderer.draw(this);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbindInput();
    this.hud.destroy();
  }

  exit(to) {
    this.save();
    this.stop();
    this.onExit?.(to);
  }

  save() {
    const p = this.player;
    if (p.dead) {
      const home = this.getWorld(this.world.def.home);
      this.char.mapId = home.id;
      this.char.pos = { ...home.spawn };
    } else {
      this.char.mapId = this.world.id;
      this.char.pos = { x: p.x, y: p.y };
    }
    this.onSave?.(this.char);
  }

  update(dt) {
    if (this.pendingTravel) { this.hud.update(); return; }
    this.time += dt;
    for (const u of this.units()) {
      const before = u.buffs.length;
      u.buffs = u.buffs.filter((b) => b.until > this.time);
      if (u.buffs.length !== before) this.hud.markDirty('char');
    }

    const w = this.renderer.screenToWorld(this.mouse.sx, this.mouse.sy, this.camera);
    this.mouse.wx = w.x; this.mouse.wy = w.y;
    this.hover = this.pick();

    this.updatePlayer(dt);
    this.updateParty(dt);
    this.checkPortal();
    if (this.pendingTravel) return;
    if (this.pending.length) {
      const due = this.pending.filter((h) => h.at <= this.time);
      if (due.length) { this.pending = this.pending.filter((h) => h.at > this.time); for (const h of due) h.fn(); }
    }
    this.tickStatus();
    this.updateMonsters(dt);
    this.separate(dt);
    this.gait(dt);
    this.updateEffects(dt);

    this.timers.zone += dt;
    if (this.timers.zone >= STREAM.interval) { this.timers.zone = 0; this.streamZones(); }
    this.timers.spawn += dt;
    if (this.timers.spawn >= 1) { this.timers.spawn = 0; this.respawnTick(); }
    this.timers.regen += dt;
    if (this.timers.regen >= 2) { this.timers.regen = 0; this.regenTick(); }
    this.timers.save += dt;
    if (this.timers.save >= 15) { this.timers.save = 0; this.save(); }
    this.timers.hud += dt;
    if (this.timers.hud >= 0.1) { this.timers.hud = 0; this.hud.update(); }

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;

    if (this.openNpc && dist(this.player, this.openNpc) > 3) this.hud.closePanel('npc');
  }

  // ------------------------------------------------------------ player
  derived(u = this.leader) { return S.derivedStats(u.char, u.buffs); }

  moveEntity(e, tx, ty, speed, dt, forMonster) {
    const dx = tx - e.x, dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.02) return 'arrived';
    const step = Math.min(d, speed * dt);
    const nx = e.x + (dx / d) * step, ny = e.y + (dy / d) * step;
    const oldX = e.x, oldY = e.y;
    if (!this.world.blocked(nx, e.y, e.radius, forMonster)) e.x = nx;
    if (!this.world.blocked(e.x, ny, e.radius, forMonster)) e.y = ny;
    const mx = e.x - oldX, my = e.y - oldY, actual = Math.hypot(mx, my);
    const moved = actual > 0.00001;
    if (moved) e.facing = { x: mx / actual, y: my / actual };
    return moved ? 'moving' : 'stuck';
  }

  // 길찾기를 따라 목표로 이동 (목표 타일이 바뀌면 최대 0.25초 간격으로 경로 재계산)
  navigate(e, goal, speed, dt) {
    const gk = `${Math.floor(goal.x)},${Math.floor(goal.y)}`;
    if (e.pathKey !== gk && this.time >= (e.pathAt || 0)) {
      e.path = this.world.findPath(e.x, e.y, goal.x, goal.y);
      e.pathKey = gk;
      e.pathAt = this.time + 0.25;
    }
    let wp = goal;
    if (e.path && e.path.length) {
      if (dist(e, e.path[0]) < 0.15) e.path.shift();
      if (e.path.length) wp = e.path[0];
    }
    return this.moveEntity(e, wp.x, wp.y, speed, dt, false);
  }

  clearPath(e) { e.path = null; e.pathKey = null; e.pathAt = 0; }

  face(e, t) {
    const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.facing = { x: dx / d, y: dy / d };
  }

  hasAttackLine(from, to) {
    return this.world.hasLineOfSight(from.x, from.y, to.x, to.y);
  }

  actionRange(action) {
    if (action.type === 'talk') return 1.8;
    if (action.type === 'skill') return this.skillRange(SKILLS[action.skillId]);
    return this.cls.attackRange;
  }

  skillRange(sk, u = this.leader) { return sk.range ?? this.clsOf(u).attackRange; }

  findEntity(id) {
    return this.monsters.find((m) => m.id === id && !m.dead) || this.world.npcs.find((n) => n.id === id) || null;
  }

  updatePlayer(dt) {
    const p = this.player;
    p.attackTimer -= dt;
    p.attackAnim = Math.max(0, (p.attackAnim || 0) - dt);
    p.castAnim = Math.max(0, (p.castAnim || 0) - dt);
    p.moving = false;

    if (p.dead) {
      if (this.time >= p.respawnAt) this.respawn();
      return;
    }

    if (this.mouse.left && this.mouse.mode === 'move') {
      p.moveTarget = { x: this.mouse.wx, y: this.mouse.wy };
      p.action = null;
    }

    const speed = this.derived().speed;
    if (p.action) {
      const target = this.findEntity(p.action.targetId);
      if (!target) { p.action = null; return; }
      const range = this.actionRange(p.action) + (target.radius || 0.3);
      if (dist(p, target) > range || p.action.type !== 'talk' && !this.hasAttackLine(p, target)) {
        const r = this.navigate(p, target, speed, dt);
        p.moving = r === 'moving';
      } else {
        this.clearPath(p);
        this.face(p, target);
        this.performAction(p.action, target);
      }
    } else if (p.moveTarget) {
      const r = this.navigate(p, p.moveTarget, speed, dt);
      p.moving = r === 'moving';
      if (r !== 'moving' && !this.mouse.left) { p.moveTarget = null; this.clearPath(p); }
    }

  }

  performAction(action, target) {
    const p = this.player;
    if (action.type === 'attack') {
      this.playerAttack(target);
    } else if (action.type === 'talk') {
      p.action = null;
      this.openNpc = target;
      this.hud.openNpc(target);
    } else if (action.type === 'skill') {
      const sk = SKILLS[action.skillId];
      p.action = action.resume ? { type: 'attack', targetId: action.resume } : null;
      if (this.canCast(sk, true)) this.castTargetSkill(sk, target);
    }
  }

  playerAttack(m) { return this.tryBasicAttack(this.leader, m); }

  // 일반공격은 자동사냥 모드·대상 변경과 관계없이 같은 시계로 제한한다.
  tryBasicAttack(u, target) {
    const e = u.ent;
    if (e.dead || target.dead || e.attackTimer > 0 || this.time < (e.nextBasicAttackAt || 0)) return false;
    if (e.castAnim > 0 || this.time < (e.skillMotionUntil || 0)) return false;
    if (!this.hasAttackLine(e, target)) return false;
    const interval = this.clsOf(u).attackInterval;
    e.attackTimer = interval;
    e.nextBasicAttackAt = this.time + interval;
    this.unitAttack(u, target);
    return true;
  }

  // 일반공격 (리더 · 용병 공통)
  unitAttack(u, m) {
    if (!this.hasAttackLine(u.ent, m)) return;
    const ch = u.char, e = u.ent;
    const stat = ch.stats[this.clsOf(u).primaryStat];
    const hit = Math.random() < S.physicalHitChance(stat, ch.level, m);
    e.attackAnim = 0.3;
    this.face(e, m);
    const bfx = BASIC_FX[ch.classId] || BASIC_FX.knight;
    const delay = bfx.proj ? this.addProjectile(e, m, 'sheet', '#f5e6c8', bfx.proj) : 0.08;
    if (!hit) { this.floatText(m, 'MISS', '#bbbbbb', 15, delay); this.aggro(m, u); return; }
    const origin = { x:e.x, y:e.y };
    this.fx(bfx, m, delay, this.leftOf(e, m), origin);
    this.damageMonster(m, S.normalDamage(this.derived(u).attack, m.armor), u.isLeader ? '#ffffff' : '#d8e8ff', delay, u, origin);
  }

  // ------------------------------------------------------------ skills
  canCast(sk, quiet = false, u = this.leader) {
    const ch = u.char;
    const fail = (msg) => { if (!quiet) this.log(msg, 'warn'); return false; };
    if (!sk) return false;
    if (u.ent.dead) return false;
    if (sk.classId !== ch.classId) return fail('이 직업은 사용할 수 없는 스킬입니다.');
    if (ch.level < sk.level) return fail(`${sk.name}: 레벨 ${sk.level}부터 사용할 수 있습니다.`);
    if (this.time < (u.cooldowns[sk.id] || 0)) return fail(`${sk.name}: 재사용 대기 중입니다.`);
    if (u.ent.attackAnim > 0) return fail('일반공격 동작이 끝난 뒤 사용할 수 있습니다.');
    if (this.time < (u.ent.skillMotionUntil || 0)) return fail('스킬 동작이 끝난 뒤 사용할 수 있습니다.');
    if (ch.mp < sk.mp) return fail('마나가 부족합니다.');
    return true;
  }

  useSkill(id) {
    const sk = SKILLS[id];
    if (!this.canCast(sk)) return;
    const p = this.player;
    if (TARGETED.has(sk.kind)) {
      const target = this.skillTarget(sk);
      if (!target) { this.log('대상이 없습니다. 몬스터에 마우스를 올리고 사용하세요.', 'warn'); return; }
      const resume = p.action?.type === 'attack' ? p.action.targetId : null;
      if (dist(p, target) > this.skillRange(sk) + target.radius || !this.hasAttackLine(p, target)) {
        p.action = { type: 'skill', skillId: id, targetId: target.id, resume };
        p.moveTarget = null;
        return;
      }
      this.face(p, target);
      this.castTargetSkill(sk, target);
    } else {
      this.castSelfSkill(sk);
    }
  }

  // 스킬 대상: 지금 공격 중인 적 → 마우스 아래 적 → 가장 가까운 적
  skillTarget(sk) {
    const cur = this.player.action?.targetId && this.findEntity(this.player.action.targetId);
    if (cur && !cur.isNpc && !cur.dead) return cur;
    if (this.hover && !this.hover.isNpc && !this.hover.dead) return this.hover;
    let best = null, bd = this.skillRange(sk) + 3;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = dist(this.player, m);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  spend(sk, u = this.leader) {
    u.char.mp -= sk.mp;
    u.cooldowns[sk.id] = this.time + sk.cooldown;
    // 성공한 시전만 동작 시간을 차지한다. 시전 중 일반공격이 끼어들지 않게 한다.
    u.ent.castAnimDuration = 0.4;
    u.ent.castAnim = 0.4;
    u.ent.attackAnim = 0;
    u.ent.skillMotionUntil = this.time + 0.4;
  }

  // 대상을 정하는 스킬: 단일 · 대상 주변 범위 · 연쇄
  castTargetSkill(sk, m, u = this.leader) {
    if (!this.hasAttackLine(u.ent, m)) return;
    const ch = u.char, p = u.ent;
    this.spend(sk, u);
    this.face(p, m);
    const stat = ch.stats[sk.stat];
    const atk = this.derived(u).attack;
    p.attackAnim = 0;
    const shieldBash = sk.id === 'shield_bash';
    const sprite = heroSprite(ch);
    p.castAnimDuration = shieldBash ? actionDur(sprite, 'skill') || 0.695 : 0.4;
    p.castAnim = p.castAnimDuration;
    if (shieldBash) {
      // 방패 강타의 준비·충돌·회수 프레임이 일반공격에 덮이지 않게 한다.
      p.attackAnim = 0;
      p.attackTimer = Math.max(p.attackTimer || 0, p.castAnimDuration);
      p.skillMotionUntil = this.time + p.castAnimDuration;
    }
    this.floatText(p, sk.name, sk.color, 13);
    if (sk.dash) {
      // 돌진: 대상 바로 앞까지 순식간에 이동
      const d = dist(p, m) || 1;
      const tx = m.x - ((m.x - p.x) / d) * 1, ty = m.y - ((m.y - p.y) / d) * 1;
      if (!this.world.blocked(tx, ty, p.radius)) {
        this.fx({ sheet: 'knight_a7', scale: 1, z: 20 }, p, 0, this.leftOf(p, m));
        p.x = tx; p.y = ty; this.clearPath(p);
      }
    }
    let delay = sk.proj ? this.addProjectile(p, m, 'sheet', sk.color, sk.proj) : shieldBash ? hitTimes(sprite, 'skill').at(-1) ?? 0.335 : 0.06;
    // 이펙트의 준비 입자 다음에 나오는 방패 충돌 프레임을 몸의 타격 시점과 맞춘다.
    const effectDelay = shieldBash ? Math.max(0, delay - (sk.fx.impactFrame / 16) * (sk.fx.life || 0.6)) : delay;
    let targets = [m];
    if (sk.kind === 'aoe_target') {
      targets = this.monsters.filter((o) => !o.dead && dist(o, m) <= sk.radius + o.radius && this.hasAttackLine(m, o));
    } else if (sk.kind === 'chain') {
      // 가장 가까운 다음 적으로 튕김
      let cur = m;
      while (targets.length < sk.chain) {
        let next = null, bd = sk.chainRange;
        for (const o of this.monsters) {
          if (o.dead || targets.includes(o)) continue;
          const d2 = dist(o, cur);
          if (d2 < bd && this.hasAttackLine(cur, o)) { bd = d2; next = o; }
        }
        if (!next) break;
        targets.push(next);
        cur = next;
      }
    }
    const flip = this.leftOf(p, m);
    if (sk.kind === 'aoe_target') this.fx(sk.fx, m, delay, flip, {x:p.x,y:p.y});
    targets.forEach((t, k) => {
      const from = sk.kind === 'chain' && k > 0 ? targets[k-1] : sk.kind === 'aoe_target' ? m : p;
      const origin = {x:from.x,y:from.y};
      let dl = delay;
      if (sk.kind === 'chain' && k > 0) {
        dl = delay + k * 0.12;
        this.addProjectile(targets[k - 1], t, 'sheet', sk.color, sk.proj, dl - 0.12);
      }
      if (sk.kind !== 'aoe_target') this.fx(sk.fx, t, shieldBash ? effectDelay : dl, k > 0 ? this.leftOf(targets[k - 1], t) : flip, origin);
      for (let i = 0; i < (sk.hits || 1) && !t.dead; i++) {
        if (sk.hits > 1 && i > 0 && sk.proj) this.addProjectile(p, t, 'sheet', sk.color, sk.proj, i * 0.12);
        this.skillHit(sk, t, stat, atk, i, dl, u, origin);
      }
    });
  }

  // 이펙트 시트 재생 (at = 몬스터/플레이어/좌표)
  // flip: 이펙트 그림은 오른쪽을 향해 그려져 있음 → 화면 왼쪽을 향하면 좌우 반전
  fx(spec, at, delay = 0, flip = false, attackOrigin = null) {
    if (!spec?.sheet) return;
    this.effects.push({ type: 'sheet', key: spec.sheet, x: at.x, y: at.y, z: spec.z ?? 24, scale: spec.scale || 1, t: -delay, life: spec.life || 0.6, follow: at, flip, attackOrigin });
  }

  // a 에서 b 가 화면 왼쪽인지 (아이소메트릭: 화면 x = 월드 x − y)
  leftOf(a, b) { return (b.x - b.y) - (a.x - a.y) < -0.05; }
  facingLeft(e) { return e.facing.x - e.facing.y < -0.05; }

  mSpeed(m, def) { return def.speed * (m.slowUntil > this.time ? 0.6 : 1); }

  skillHit(sk, m, stat, atk, i = 0, delay = 0, u = this.leader, origin = u.ent) {
    if (!this.hasAttackLine(origin, m)) return;
    const ch = u.char;
    const magic = sk.element === 'magic';
    const chance = magic ? S.magicHitChance(stat, ch.level, m) : S.physicalHitChance(stat, ch.level, m);
    if (Math.random() >= chance) { this.floatText(m, 'MISS', '#bbbbbb', 15, delay + i * 0.12); this.aggro(m, u); return; }
    const raw = S.skillDamage(stat, atk, sk.coef);
    const dmg = magic ? S.magicMitigate(raw, m.mr) : S.physicalMitigate(raw, m.armor);
    if (sk.slow) m.slowUntil = this.time + sk.slow;
    if (sk.dot) m.dot = { dmg: Math.max(1, Math.round(stat * atk * sk.dot)), until: this.time + sk.dotTime, next: this.time + 1, color: sk.color };
    this.damageMonster(m, dmg, sk.color, delay + i * 0.12, u, {x:origin.x,y:origin.y});
  }

  castSelfSkill(sk, u = this.leader) {
    const ch = u.char;
    const p = u.ent;
    p.castAnimDuration = 0.4;
    p.castAnim = p.castAnimDuration;
    if (sk.kind === 'aoe') {
      this.spend(sk, u);
      this.floatText(p, sk.name, sk.color, 13);
      this.fx(sk.fx, p, 0, this.facingLeft(p));
      const atk = this.derived(u).attack;
      const stat = ch.stats[sk.stat];
      for (const m of this.monsters) {
        if (!m.dead && dist(p, m) <= sk.radius + m.radius && this.hasAttackLine(p, m)) this.skillHit(sk, m, stat, atk, 0, 0.12, u);
      }
    } else if (sk.kind === 'buff') {
      this.spend(sk, u);
      this.floatText(p, sk.name, sk.color, 13);
      this.fx(sk.fx, p, 0, this.facingLeft(p));
      // 파티 버프는 살아 있는 파티원 모두에게
      const targets = sk.party ? this.aliveUnits() : [u];
      for (const t of targets) {
        this.addBuff(sk.buff, sk.color, true, t);
        if (t !== u) this.fx({ ...sk.fx, scale: sk.fx.scale * 0.6 }, t.ent, 0.1);
      }
    } else if (sk.kind === 'heal') {
      // HP 비율이 가장 낮은 파티원 치유
      const t = this.aliveUnits().sort((a, b) => a.char.hp / a.char.maxHp - b.char.hp / b.char.maxHp)[0];
      if (!t || t.char.hp >= t.char.maxHp) { if (u.isLeader) this.log('이미 HP가 가득 찼습니다.', 'warn'); return; }
      this.spend(sk, u);
      this.floatText(p, sk.name, sk.color, 13);
      const amount = Math.round(ch.stats.int * sk.healIntCoef + ch.level * sk.healPerLevel);
      t.char.hp = Math.min(t.char.maxHp, t.char.hp + amount);
      this.floatText(t.ent, `+${amount}`, '#7dff9a');
      this.fx(sk.fx, t.ent);
    } else if (sk.kind === 'restore') {
      if (ch.mp >= ch.maxMp) { if (u.isLeader) this.log('이미 MP가 가득 찼습니다.', 'warn'); return; }
      this.spend(sk, u);
      this.floatText(p, sk.name, sk.color, 13);
      const amount = Math.round(ch.maxMp * sk.mpPercent);
      ch.mp = Math.min(ch.maxMp, ch.mp + amount);
      this.floatText(p, `MP +${amount}`, '#7ab8ff');
      this.fx(sk.fx, p);
    }
  }

  addBuff(buff, color = '#ffe680', fromSkill = false, u = this.leader) {
    u.buffs = u.buffs.filter((b) => b.id !== buff.id);
    u.buffs.push({ ...buff, icon: buff.icon || STATUS_ICON[buff.id], color, until: this.time + buff.duration });
    if (!fromSkill) {
      this.floatText(u.ent, buff.name, color, 13);
      this.effects.push({ type: 'ring', x: u.ent.x, y: u.ent.y, r: 1, t: 0, life: 0.5, color });
    }
    if (u.isLeader) this.log(`${buff.name} 효과가 적용되었습니다. (${buff.duration}초)`, 'info');
    this.hud.markDirty('char');
  }

  // ------------------------------------------------------------ monsters
  spawnMonster(zone, initial = false, forcedType = null, rect = zone.rect) {
    let type = forcedType;
    if (!type) {
      let roll = Math.random();
      type = zone.monsters[0][0];
      for (const [t, wgt] of zone.monsters) { if ((roll -= wgt) <= 0) { type = t; break; } }
    }
    let pos = null;
    for (let i = 0; i < 10 && !pos; i++) {
      const c = this.world.findOpenTileIn(rect);
      // 리젠은 화면 밖에서 (눈앞에서 갑자기 생기지 않도록)
      if (c && (initial || (!this.onScreen(c, 2) && dist(c, this.player) > 10))) pos = c;
    }
    if (!pos) return null;
    const def = MONSTERS[type];
    const m = {
      id: this.nextId++, type, zone: zone.id, x: pos.x, y: pos.y, home: { ...pos },
      radius: Math.min(0.42, def.size), hp: def.hp, maxHp: def.hp,
      level: def.level, armor: def.armor, mr: def.mr, eva: def.eva,
      state: 'idle', attackTimer: 0, wanderTimer: Math.random() * 3, wanderTarget: null,
      facing: { x: 1, y: 0 }, hurtFlash: 0, dead: false, stuckTime: 0,
      isBoss: def.rank === 'boss' || def.rank === 'guard' || !!def.boss, walkPhase: Math.random() * 6, moving: false, attackAnim: 0,
      slamAt: 0, slamTarget: null, animKind: 'attack', animDur: 0.3,
      nextSkill: 0,
    };
    this.monsters.push(m);
    return m;
  }

  // ------------------------------------------------------------ 구역 스트리밍
  // 아이소메트릭 화면이 덮는 월드 범위 (마름모 → 넉넉한 정사각형)
  viewHalf() {
    const r = this.renderer.viewHalfTiles();
    return { hw: r, hh: r };
  }

  onScreen(pt, margin = 0) {
    const s = this.renderer.worldToScreen(pt.x, pt.y, this.camera);
    const m = margin * 32;
    return s.x > -m - 40 && s.x < this.renderer.w + m + 40 && s.y > -m - 80 && s.y < this.renderer.h + m + 40;
  }

  streamZones() {
    const { hw, hh } = this.viewHalf();
    const view = this.player;
    const z = planZones(this.world.zones, this.activeZones, view, hw, hh);
    for (const zone of z.deactivate) this.deactivateZone(zone);
    const a = planArt(this.world.zones, this.artZones, view, hw, hh);
    for (const zone of a.unload) {
      this.artZones.delete(zone.id);
      for (const name of this.zoneSheets(zone).keys()) releaseSheet(name);
    }
    for (const zone of a.load) this.loadZoneArt(zone);
    for (const zone of z.activate) this.activateZone(zone);
  }

  // 사냥터 몬스터 그림 이름 → 화면에 그려질 최대 칸 크기(px)
  zoneSheets(zone) {
    const out = new Map();
    const types = zone.monsters.map(([t]) => t);
    if (zone.boss) types.push(zone.boss.type);
    const dpr = this.renderer.dpr || 1;
    for (const t of types) {
      const def = MONSTERS[t];
      if (!def?.art?.sheet) continue;
      const px = sheetCellPx(def) * dpr * 1.1;
      out.set(def.art.sheet, Math.max(out.get(def.art.sheet) || 0, px));
    }
    return out;
  }

  loadZoneArt(zone) {
    if (this.artZones.has(zone.id)) return;
    this.artZones.add(zone.id);
    for (const [name, px] of this.zoneSheets(zone)) loadSheet(name, px);
  }

  activateZone(zone) {
    this.activeZones.add(zone.id);
    this.loadZoneArt(zone);
    const alive = this.monsters.filter((m) => m.zone === zone.id && !m.dead && !m.isBoss).length;
    for (let i = alive; i < zone.max; i++) this.spawnMonster(zone, true);
    if (zone.boss) this.bossTick(zone);
  }

  deactivateZone(zone) {
    this.activeZones.delete(zone.id);
    this.monsters = this.monsters.filter((m) => m.zone !== zone.id || !this.despawnable(m));
  }

  // 꺼진 사냥터의 몬스터 중 정리해도 되는 것 (쫓아오는 중이거나 화면에 보이면 유지)
  despawnable(m) {
    if (m.dead) return true;
    if (m.state === 'chase' || this.onScreen(m, 2)) return false;
    // 살아 있던 보스/네임드는 다시 들어오면 바로 등장
    if (m.isBoss) this.bossRespawnAt[this.bossKey(m.zone)] = 0;
    return true;
  }

  respawnTick() {
    this.monsters = this.monsters.filter((m) => {
      if (m.dead) return this.time - m.deathTime < 0.8;
      return this.activeZones.has(m.zone) || m.zone === FIELD_BOSS_ZONE || !this.despawnable(m);
    });
    const alive = new Map();
    for (const m of this.monsters) {
      if (!m.dead && !m.isBoss) alive.set(m.zone, (alive.get(m.zone) || 0) + 1);
    }
    for (const id of this.activeZones) {
      const zone = this.zoneById.get(id);
      if ((alive.get(id) || 0) < zone.max && Math.random() < 0.5) this.spawnMonster(zone);
      if (zone.boss) this.bossTick(zone);
    }
    if (this.world.def.fieldBoss) this.fieldBossTick();
  }

  bossKey(zoneId) { return `${this.world.id}:${zoneId}`; }

  bossTick(zone) {
    const b = zone.boss;
    const alive = this.monsters.some((m) => m.type === b.type && m.zone === zone.id && !m.dead);
    if (alive) return;
    const key = this.bossKey(zone.id);
    const at = this.bossRespawnAt[key] ?? 0; // 첫 등장은 즉시
    if (this.time < at) return;
    if (this.spawnMonster(zone, true, b.type, b.rect)) {
      this.bossRespawnAt[key] = Infinity;
      // 네임드는 조용히, 보스는 처치 후 다시 나타날 때만 알림 (구역에 들어갈 때마다 알리지 않음)
      if (at > 0 && MONSTERS[b.type].rank !== 'guard') this.log(`보스 ${MONSTERS[b.type].name}이(가) ${zone.theme || zone.name.split(' (')[0]}에 나타났습니다!`, 'rare');
    }
  }

  aggro(m, u = null) {
    if (m.dead || m.state === 'return') return;
    const was = m.state;
    m.state = 'chase';
    // 때린 파티원을 노림 (이미 노리는 대상이 있으면 가끔만 바꿈)
    if (u && (!m.targetId || Math.random() < 0.2)) m.targetId = u.ent.id;
    // 무리 생활: 처음 싸움에 휘말리면 주변의 같은 종류가 함께 덤빔
    if (was !== 'chase' && MONSTERS[m.type].social) {
      for (const o of this.monsters) {
        if (o !== m && !o.dead && o.type === m.type && o.state === 'idle' && dist(o, m) < 6) o.state = 'chase';
      }
    }
  }

  // 몬스터가 노리는 파티원 (없거나 쓰러졌으면 가장 가까운 파티원)
  monsterTarget(m, maxD = 14) {
    let u = m.targetId && this.unitById(m.targetId);
    if (u && !u.ent.dead) return u;
    let best = null, bd = maxD;
    for (const o of this.aliveUnits()) {
      const d = dist(o.ent, m);
      if (d < bd) { bd = d; best = o; }
    }
    m.targetId = best?.ent.id || null;
    return best;
  }

  updateMonsters(dt) {
    const p = this.player;
    const playerSafe = this.world.inVillage(p.x, p.y) || this.aliveUnits().length === 0;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const def = MONSTERS[m.type];
      m.attackTimer -= dt;
      m.hurtFlash = Math.max(0, m.hurtFlash - dt);
      m.attackAnim = Math.max(0, m.attackAnim - dt);
      // 화면에서 멀리 떨어진 대기 중 몬스터는 계산 생략 (몬스터 수백 마리)
      if (m.state === 'idle' && dist(m, p) > 36) { m.moving = false; continue; }
      const mend = passive(def, 'mend');
      if (mend && m.hp < m.maxHp * 0.5) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * mend * dt);
      const ox = m.x, oy = m.y;
      const tu = this.monsterTarget(m, m.state === 'idle' ? (m.isBoss ? 7 : 5) : 14);
      const te = tu?.ent || p;
      this.monsterBrain(m, def, te, tu ? dist(m, te) : 999, playerSafe || !tu, dt, tu);
      m.moving = Math.hypot(m.x - ox, m.y - oy) > 1e-4;
      // 독 같은 지속 피해
      if (m.dot && this.time >= m.dot.next) {
        if (this.time > m.dot.until) m.dot = null;
        else { m.dot.next += 1; this.damageMonster(m, m.dot.dmg, m.dot.color); }
      }
    }
  }

  monsterBrain(m, def, p, pd, playerSafe, dt, tu) {
    // Finish a planted quadruped strike before chasing or starting another one.
    if (def.family === 'quadruped' && m.attackAnim > 0) return;
    {
      // 보스 내려찍기: 예고가 끝나면 그 자리에 범위 피해
      if (m.slamTarget && this.time >= m.slamAt) this.resolveSlam(m, def);
      if (m.slamTarget) return; // 기를 모으는 동안은 멈춰 있음

      if (m.state === 'idle') {
        if (def.aggressive && !playerSafe && pd < (m.isBoss ? 7 : 5)) { this.aggro(m); return; }
        m.wanderTimer -= dt;
        if (m.wanderTimer <= 0) {
          m.wanderTimer = 2 + Math.random() * 4;
          if (Math.random() < 0.6) {
            m.wanderTarget = { x: m.home.x + (Math.random() - 0.5) * 6, y: m.home.y + (Math.random() - 0.5) * 6 };
          }
        }
        if (m.wanderTarget) {
          const r = this.moveEntity(m, m.wanderTarget.x, m.wanderTarget.y, this.mSpeed(m, def) * 0.45, dt, true);
          if (r !== 'moving') m.wanderTarget = null;
        }
      } else if (m.state === 'chase') {
        if (playerSafe || dist(m, m.home) > (m.isBoss ? 18 : 14)) { m.state = 'return'; m.targetId = null; return; }
        const slam = def.boss?.slam;
        if (slam && this.time >= (m.nextSlam ?? (m.nextSlam = this.time + 3)) && pd < slam.radius + 2) {
          this.startSlam(m, slam, p);
          return;
        }
        if (pd <= def.attackRange + p.radius && this.hasAttackLine(m, p)) {
          this.face(m, p);
          if (m.attackTimer <= 0) {
            m.attackTimer = def.attackInterval * (1 - passive(def, 'haste'));
            if (def.active?.length && m.nextSkill > 0 && this.time >= m.nextSkill) this.monsterSkill(m, def, tu);
            else this.monsterAttack(m, def, tu);
            if (!m.nextSkill) m.nextSkill = this.time + 2 + Math.random() * 3;
          }
        } else {
          const r = this.moveEntity(m, p.x, p.y, this.mSpeed(m, def), dt, true);
          m.stuckTime = r === 'stuck' ? m.stuckTime + dt : 0;
          if (m.stuckTime > 3) { m.state = 'return'; m.stuckTime = 0; }
        }
      } else if (m.state === 'return') {
        m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.3 * dt);
        const r = this.moveEntity(m, m.home.x, m.home.y, this.mSpeed(m, def) * 1.2, dt, true);
        if (r !== 'moving') { m.state = 'idle'; m.hp = m.maxHp; m.nextSlam = undefined; }
      }
    }
  }

  startSlam(m, slam, p = this.player) {
    m.slamTarget = { x: p.x, y: p.y };
    m.slamAt = this.time + slam.windup;
    m.nextSlam = this.time + slam.interval;
    this.face(m, p);
    this.effects.push({ type: 'telegraph', x: p.x, y: p.y, r: slam.radius, t: 0, life: slam.windup });
    this.floatText(m, '내려찍기!', '#ff9a4a', 15);
  }

  resolveSlam(m, def) {
    const slam = def.boss.slam;
    const at = m.slamTarget;
    m.slamTarget = null;
    m.animKind = 'skill'; m.animDur = 0.5; m.attackAnim = 0.5;
    this.effects.push({ type: 'ring', x: at.x, y: at.y, r: slam.radius, t: 0, life: 0.45, color: '#ff8a3a' });
    this.effects.push({ type: 'shake', t: 0, life: 0.3, power: 6 });
    if (m.dead) return;
    // 예고 범위 안의 파티원 모두 피해
    for (const u of this.aliveUnits()) {
      if (dist(u.ent, at) > slam.radius + u.ent.radius) continue;
      this.hurtUnit(u, S.monsterDamage(def.atk * slam.mult, this.derived(u).defense), def);
    }
  }

  monsterAttack(m, def, u = this.leader) {
    if (!this.hasAttackLine(m, u.ent)) return;
    m.animKind = 'attack'; m.animDur = def.family === 'quadruped' ? QUADRUPED_ATTACK_SECONDS : 0.4; m.attackAnim = m.animDur;
    if (def.family === 'quadruped') {
      this.pending.push({ at: this.time + m.animDur * QUADRUPED_IMPACT, fn: () => {
        if (m.dead || u.ent.dead || !this.monsters.includes(m) || !this.hasAttackLine(m, u.ent)) return;
        this.monsterAttackImpact(m, def, u);
      } });
    } else this.monsterAttackImpact(m, def, u);
  }

  monsterAttackImpact(m, def, u) {
    const e = u.ent;
    if (def.projectile) {
      this.addProjectile(m, e, def.projectile, def.projectile === 'bolt' ? def.color : '#d8c8a0');
    } else {
      this.effects.push({ type: 'slash', x: e.x, y: e.y, t: 0, life: 0.2, color: '#ff6060' });
    }
    this.monsterHit(m, def, 1, 0, u);
  }

  // 몬스터 한 번의 타격: 명중 판정 → 피해. 맞으면 true
  monsterHit(m, def, mult, delay = 0, u = this.leader) {
    if (!this.hasAttackLine(m, u.ent)) return false;
    const ch = u.char;
    const d = this.derived(u);
    // 마법 공격은 방어력을 절반만 적용
    const pdef = def.magic ? d.defense / 2 : d.defense;
    const hit = S.monsterHitChance(def.level, ch.level, pdef) + passive(def, 'focus');
    if (Math.random() >= hit) { this.floatText(u.ent, 'MISS', '#bbbbbb', 15, delay); return false; }
    let atk = def.atk * mult;
    const fury = passive(def, 'fury');
    if (fury && m.hp < m.maxHp * 0.5) atk *= 1 + fury;
    let dmg = S.monsterDamage(atk, pdef);
    const expose = u.buffs.reduce((a, b) => a + (b.expose || 0), 0);
    if (expose) dmg = Math.round(dmg * (1 + expose));
    this.hurtUnit(u, dmg, def, delay);
    return true;
  }

  // 몬스터 스킬 (원본 「환생 루프」 액티브): 배율 피해 × 타수 + 상태이상
  monsterSkill(m, def, u = this.leader) {
    if (!this.hasAttackLine(m, u.ent)) return;
    const sk = def.active[Math.floor(Math.random() * def.active.length)];
    m.nextSkill = this.time + def.skillCooldown * (0.8 + Math.random() * 0.4);
    m.animKind = 'skill'; m.animDur = def.family === 'quadruped' ? QUADRUPED_SKILL_SECONDS : 0.6; m.attackAnim = m.animDur;
    const p = u.ent;
    const color = EFFECT_COLOR[sk.effect] || def.color;
    this.floatText(m, sk.name, color, 13);
    const impact = () => {
      if (m.dead || p.dead || !this.hasAttackLine(m, p)) return;
      if (def.projectile) this.addProjectile(m, p, def.projectile, color);
      this.fx(STATUS_FX[sk.effect] || { sheet: 'warrior_a1', scale: 0.8, z: 24 }, p, def.projectile ? 0.25 : 0.12);
      let landed = false;
      for (let i = 0; i < (sk.pulses || 1); i++) {
        if (p.dead) break;
        if (this.monsterHit(m, def, sk.mult, i * 0.15, u)) landed = true;
      }
      if (landed && Math.random() < 0.6) this.applyStatus(sk.effect, def, u);
    };
    if (def.family === 'quadruped') this.pending.push({ at: this.time + m.animDur * QUADRUPED_IMPACT, fn: () => {
      if (this.monsters.includes(m)) impact();
    } });
    else impact();
  }

  applyStatus(effect, def, u = this.leader) {
    const st = STATUS[effect];
    if (!st || u.ent.dead) return;
    const tick = Math.max(1, Math.round(def.atk * 0.12));
    u.buffs = u.buffs.filter((b) => b.id !== st.id);
    u.buffs.push({ ...st, icon: STATUS_ICON[st.id], color: EFFECT_COLOR[effect], until: this.time + st.duration, debuff: true,
      dot: st.dot ? tick : 0, nextTick: this.time + 1, src: def.name });
    this.floatText(u.ent, st.name, EFFECT_COLOR[effect], 13, 0.2);
    this.hud.markDirty('char');
  }

  // 지속 피해(출혈·화상·중독) 처리
  tickStatus() {
    for (const u of this.units()) {
      for (const b of u.buffs) {
        if (!b.dot || this.time < b.nextTick || u.ent.dead) continue;
        b.nextTick += 1;
        this.hurtUnit(u, b.dot, { name: `${b.name}(${b.src})` }, 0, b.color);
      }
    }
  }

  hurtPlayer(dmg, def, delay = 0) { this.hurtUnit(this.leader, dmg, def, delay); }

  hurtUnit(u, dmg, def, delay = 0, color = '#ff5050') {
    const ch = u.char, e = u.ent;
    if (e.dead) return;
    ch.hp -= dmg;
    e.lastHurt = this.time;
    this.floatText(e, `-${dmg}`, u.isLeader ? color : '#ff9a7a', u.isLeader ? 15 : 13, delay);
    if (ch.hp > 0) return;
    if (u.isLeader) this.playerDie(def);
    else this.mercDie(u, def);
  }

  mercDie(u, def) {
    u.char.hp = 0;
    u.ent.dead = true;
    u.ent.respawnAt = this.time + 30;
    u.ent.action = null;
    u.target = null;
    this.log(`[파티] ${u.char.name}이(가) ${def.name}에게 쓰러졌습니다. (30초 뒤 회복, 마을에서는 바로)`, 'warn');
    for (const m of this.monsters) if (m.targetId === u.ent.id) m.targetId = null;
    this.hud.markDirty('party');
  }

  reviveMerc(u, full = false) {
    u.ent.dead = false;
    u.char.hp = full ? u.char.maxHp : Math.ceil(u.char.maxHp * 0.3);
    u.char.mp = full ? u.char.maxMp : Math.max(u.char.mp, Math.ceil(u.char.maxMp * 0.3));
    const p = this.player;
    u.ent.x = p.x + (Math.random() - 0.5); u.ent.y = p.y + 0.8;
    if (this.world.blocked(u.ent.x, u.ent.y, u.ent.radius)) { u.ent.x = p.x; u.ent.y = p.y; }
    this.fx({ sheet: 'priest_a5', scale: 1, z: 6 }, u.ent);
    this.hud.markDirty('party');
  }

  damageMonster(m, dmg, color, delay = 0, u = null, origin = null) {
    if (origin && !this.hasAttackLine(origin, m)) return;
    // 화살 · 마법이 날아가는 동안은 피해를 미뤘다가 맞는 순간에 적용
    if (delay > 0.03) {
      this.aggro(m, u);
      this.pending.push({ at: this.time + delay, fn: () => { if (!m.dead && this.monsters.includes(m)) this.damageMonster(m, dmg, color, 0, u, origin); } });
      return;
    }
    const hide = passive(MONSTERS[m.type], 'hide');
    if (hide) dmg = Math.max(1, Math.round(dmg * (1 - hide)));
    m.hp -= dmg;
    m.hurtFlash = 0.12;
    this.floatText(m, `${dmg}`, color, 16, delay);
    this.aggro(m, u);
    if (m.hp <= 0) this.killMonster(m);
  }

  killMonster(m) {
    const ch = this.char;
    const def = MONSTERS[m.type];
    m.dead = true;
    m.deathTime = this.time;
    m.slamTarget = null;
    if (m.isBoss) {
      const wd = this.world.def;
      if (m.zone === FIELD_BOSS_ZONE) {
        this.char.fieldBossKills[wd.id] = bossWindow(wd.fieldBoss.offset, this.now()).start;
        this.log(`[필드 보스] ${def.name}을(를) 쓰러뜨렸습니다! 다음 출현: ${formatClock(bossWindow(wd.fieldBoss.offset, this.now()).next)}`, 'level');
      } else {
        const zone = this.world.zones.find((z) => z.id === m.zone);
        this.bossRespawnAt[this.bossKey(m.zone)] = this.time + (zone?.boss?.respawn ?? 120);
        this.log(`${def.rank === 'guard' ? '네임드' : '보스'} ${def.name}을(를) 쓰러뜨렸습니다!`, 'level');
        if (zone?.boss?.final) this.openReturnPortal(m);
      }
      this.effects.push({ type: 'ring', x: m.x, y: m.y, r: 2.5, t: 0, life: 1, color: '#ffd24a' });
    }
    const gold = S.randInt(def.gold[0], def.gold[1]);
    ch.gold += gold;
    // 경험치는 근처(20칸)에 살아 있는 파티원끼리 나눔
    const sharers = this.aliveUnits().filter((u) => dist(u.ent, m) < 20);
    if (!sharers.includes(this.leader) && !this.player.dead) sharers.push(this.leader);
    const each = shareExp(def.exp, sharers.length);
    let ups = [];
    for (const u of sharers) {
      const r = S.gainExp(u.char, each);
      if (u.isLeader) ups = r;
      else for (const lv of r) this.onMercLevelUp(u, lv);
    }
    this.log(`${def.name}을(를) 처치했습니다. 경험치 +${each}${sharers.length > 1 ? ` (${sharers.length}명)` : ''}, 골드 +${gold}`, 'loot');
    if (this.focusId === m.id) this.focusId = null;
    for (const u of this.party) if (u.target === m) u.target = null;
    for (const drop of def.drops || []) {
      if (Math.random() < drop.chance && this.addItem(drop.item)) {
        this.log(`[획득] ${ITEMS[drop.item].name}`, 'rare');
      }
    }
    if (this.player.action?.targetId === m.id) this.player.action = null;
    for (const r of ups) this.onLevelUp(r);
    this.hud.markDirty('inv', 'char');
  }

  onLevelUp(r) {
    const p = this.player;
    this.fx(LEVELUP_FX, p);
    this.floatText(p, `LEVEL UP!`, '#ffe066', 20);
    const con = r.conBonus ? ` + 체력보너스 ${r.conBonus}` : '';
    this.log(`레벨 업! Lv.${r.level} — HP +${r.hpGain} (주사위 ${r.hpRoll}${con}), MP +${r.mpGain}`, 'level');
    if (r.bonus) this.log(`보너스 포인트 +${r.bonus}! 캐릭터 창(C)에서 스탯을 올리세요.`, 'level');
    for (const sk of this.cls.skills.map((id) => SKILLS[id])) {
      if (sk.level === r.level) this.log(`새 스킬 습득: ${sk.name} — 스킬 창(K)에서 단축칸에 등록하세요.`, 'level');
    }
    this.hud.showLevelUp(r);
    this.save();
  }

  onMercLevelUp(u, r) {
    this.fx(LEVELUP_FX, u.ent);
    this.floatText(u.ent, 'LEVEL UP!', '#ffe066', 16);
    this.log(`[파티] ${u.char.name} 레벨 업! Lv.${r.level} — HP +${r.hpGain}, MP +${r.mpGain}`, 'level');
    // 용병 보너스 포인트는 주스탯에 자동으로
    while (u.char.bonusPoints > 0 && S.allocatePoint(u.char, this.clsOf(u).primaryStat));
    fillSlots(u.char);
    this.hud.markDirty('party');
  }

  playerDie(def) {
    const p = this.player;
    this.char.hp = 0;
    p.dead = true;
    p.respawnAt = this.time + 3;
    p.action = null;
    p.moveTarget = null;
    const lost = S.deathPenalty(this.char);
    this.log(`${def.name}에게 쓰러졌습니다... 경험치 ${lost}를 잃었습니다.`, 'warn');
    for (const m of this.monsters) if (m.state === 'chase') m.state = 'return';
  }

  respawn() {
    const p = this.player;
    p.dead = false;
    this.char.hp = this.char.maxHp;
    this.char.mp = Math.max(this.char.mp, Math.floor(this.char.maxMp / 2));
    this.changeMap(this.world.def.home, 'center', true);
    for (const u of this.party) if (u.ent.dead) this.reviveMerc(u, true);
    this.log(`${this.world.def.name}에서 부활했습니다.`, 'system');
    this.save();
  }

  regenTick() {
    const inTown = this.world.inVillage(this.player.x, this.player.y);
    for (const u of this.units()) {
      const ch = u.char, e = u.ent;
      if (e.dead) {
        // 쓰러진 용병: 마을에서는 바로, 밖에서는 30초 뒤 회복
        if (!u.isLeader && (inTown || this.time >= e.respawnAt)) this.reviveMerc(u, inTown);
        continue;
      }
      if (!inTown && this.time - e.lastHurt < 6) continue;
      const r = S.regenAmounts(ch);
      const mult = inTown ? 3 : 1;
      ch.hp = Math.min(ch.maxHp, ch.hp + r.hp * mult);
      ch.mp = Math.min(ch.maxMp, ch.mp + r.mp * mult);
    }
  }

  // ------------------------------------------------------------ items
  addItem(id, qty = 1) {
    const inv = this.char.inventory;
    const it = ITEMS[id];
    if (it.type === 'consumable') {
      const e = inv.find((x) => x.id === id);
      if (e) { e.qty += qty; this.hud.markDirty('inv'); return true; }
    }
    if (inv.length >= INVENTORY_SIZE) { this.log('인벤토리가 가득 찼습니다.', 'warn'); return false; }
    if (it.type === 'consumable') inv.push({ id, qty });
    else for (let i = 0; i < qty; i++) inv.push({ id, qty: 1 });
    this.hud.markDirty('inv');
    return true;
  }

  removeItemAt(idx, qty = 1) {
    const inv = this.char.inventory;
    const e = inv[idx];
    if (!e) return;
    e.qty -= qty;
    if (e.qty <= 0) inv.splice(idx, 1);
    this.hud.markDirty('inv');
  }

  countItem(id) {
    return this.char.inventory.filter((e) => e.id === id).reduce((s, e) => s + e.qty, 0);
  }

  useItem(id) {
    const ch = this.char;
    const idx = ch.inventory.findIndex((e) => e.id === id);
    const it = ITEMS[id];
    if (idx < 0 || !it) { this.log('아이템이 없습니다.', 'warn'); return; }
    if (this.player.dead) return;
    if (it.type === 'weapon' || it.type === 'armor') { this.equip(idx); return; }
    if (this.time < this.itemReadyAt) return;
    const eff = it.effect;
    if (eff.hp && ch.hp >= ch.maxHp) { this.log('이미 HP가 가득 찼습니다.', 'warn'); return; }
    if (eff.mp && ch.mp >= ch.maxMp) { this.log('이미 MP가 가득 찼습니다.', 'warn'); return; }
    // 물약: 고정량 + 최대치 비율 (고레벨에서도 쓸모 있게)
    if (eff.hp) {
      const amt = eff.hp + Math.floor(ch.maxHp * (eff.hpPct || 0));
      ch.hp = Math.min(ch.maxHp, ch.hp + amt); this.floatText(this.player, `+${amt}`, '#7dff9a');
    }
    if (eff.mp) {
      const amt = eff.mp + Math.floor(ch.maxMp * (eff.mpPct || 0));
      ch.mp = Math.min(ch.maxMp, ch.mp + amt); this.floatText(this.player, `MP +${amt}`, '#7ab8ff');
    }
    if (eff.buff) this.addBuff(eff.buff, it.icon.color);
    if (eff.teleport) {
      // 가장 가까운 마을로 귀환
      this.changeMap(this.world.def.home, 'center', true);
      const p = this.player;
      this.effects.push({ type: 'ring', x: p.x, y: p.y, r: 1.5, t: 0, life: 0.7, color: '#c9b37a' });
      this.log(`${this.world.def.name}(으)로 귀환했습니다.`, 'system');
    }
    this.removeItemAt(idx, 1);
    this.itemReadyAt = this.time + 0.4;
  }

  // 장비는 내 인벤토리에서, 지금 고른 파티원에게 장착
  equip(idx, u = this.selUnit()) {
    const inv = this.char.inventory;
    const ch = u.char;
    const entry = inv[idx];
    if (!entry) return;
    const it = ITEMS[entry.id];
    if (!canEquip(entry.id, ch.classId)) { this.log(`${it.name}은(는) ${CLASSES[ch.classId].name}이(가) 장착할 수 없습니다.`, 'warn'); return; }
    const slot = it.type;
    const old = ch.equipment[slot];
    inv.splice(idx, 1);
    ch.equipment[slot] = entry.id;
    if (old) inv.push({ id: old, qty: 1 });
    this.log(`${u.isLeader ? '' : `[${ch.name}] `}${it.name}을(를) 장착했습니다.`, 'info');
    this.hud.markDirty('party');
    this.hud.markDirty('inv', 'char');
  }

  unequip(slot, u = this.selUnit()) {
    const ch = u.char;
    const id = ch.equipment[slot];
    if (!id) return;
    if (this.char.inventory.length >= INVENTORY_SIZE) { this.log('인벤토리가 가득 찼습니다.', 'warn'); return; }
    ch.equipment[slot] = null;
    this.char.inventory.push({ id, qty: 1 });
    this.log(`${ITEMS[id].name}을(를) 해제했습니다.`, 'info');
    this.hud.markDirty('inv', 'char');
  }

  buy(id, qty = 1) {
    const it = ITEMS[id];
    const npcKind = this.openNpc?.kind;
    if (!it || !npcKind || !SHOPS[npcKind]?.includes(id)) return;
    const cost = it.price * qty;
    if (this.char.gold < cost) { this.log('골드가 부족합니다.', 'warn'); return; }
    if (!this.addItem(id, qty)) return;
    this.char.gold -= cost;
    this.log(`${it.name} ${qty}개를 ${cost} 골드에 구입했습니다.`, 'info');
    this.hud.markDirty('inv', 'npc');
  }

  sell(idx) {
    const e = this.char.inventory[idx];
    if (!e || !this.openNpc || !SHOPS[this.openNpc.kind]) return;
    const price = sellPrice(e.id);
    if (price <= 0) { this.log('판매할 수 없는 아이템입니다.', 'warn'); return; }
    this.char.gold += price;
    this.log(`${ITEMS[e.id].name}을(를) ${price} 골드에 판매했습니다.`, 'info');
    this.removeItemAt(idx, 1);
    this.hud.markDirty('inv', 'npc');
  }

  healAtHealer() {
    for (const u of this.units()) {
      if (u.ent.dead && !u.isLeader) this.reviveMerc(u, true);
      u.char.hp = u.char.maxHp; u.char.mp = u.char.maxMp;
    }
    const ch = this.char;
    this.effects.push({ type: 'ring', x: this.player.x, y: this.player.y, r: 1.2, t: 0, life: 0.6, color: '#8cffb0' });
    this.log('치유사 엘린: 몸과 마음이 회복되었어요. 조심히 다녀오세요!', 'system');
  }

  allocateStat(stat, u = this.selUnit()) {
    if (S.allocatePoint(u.char, stat)) {
      this.hud.markDirty('char');
      this.save();
    }
  }

  // ------------------------------------------------------------ hotbar
  setHotbar(i, entry) { this.char.hotbar[i] = entry; this.hud.markDirty('hotbar'); }
  swapHotbar(a, b) {
    const hb = this.char.hotbar;
    [hb[a], hb[b]] = [hb[b], hb[a]];
    this.hud.markDirty('hotbar');
  }
  selectSlot(i) { this.selectedSlot = (i + 8) % 8; this.hud.markDirty('hotbar'); }

  useSlot(i) {
    const entry = this.char.hotbar[i];
    if (!entry) { this.log(`${HOTBAR_KEYS[i]} 칸이 비어 있습니다.`, 'warn'); return; }
    if (entry.type === 'skill') this.useSkill(entry.id);
    else this.useItem(entry.id);
  }

  // ------------------------------------------------------------ helpers
  // 마우스 아래의 몬스터/NPC — 그림이 발밑에서 위로 서 있으므로 화면 좌표로 판정
  pick() {
    let best = null, bd = Infinity;
    const mx = this.mouse.sx, my = this.mouse.sy;
    for (const e of [...this.monsters, ...this.world.npcs]) {
      if (e.dead) continue;
      const s = this.renderer.worldToScreen(e.x, e.y, this.camera);
      const big = e.isBoss ? 1.6 : 1;
      const dx = mx - s.x, dy = my - s.y;
      if (Math.abs(dx) > 24 * big || dy < -74 * big || dy > 12) continue;
      const d = Math.abs(dx) + Math.abs(dy + 30 * big) * 0.5;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  floatText(e, text, color, size = 15, delay = 0) {
    this.effects.push({ type: 'text', x: e.x + (Math.random() - 0.5) * 0.3, y: e.y, text, color, size, t: -delay, life: 0.9 });
  }

  // 날아가는 화살 · 마법탄. 도착까지 걸리는 시간(초)을 돌려줌
  addProjectile(from, to, kind, color, sheet = null, delay = 0) {
    const life = Math.max(0.1, dist(from, to) / 16);
    this.effects.push({ type: 'proj', kind, color, sheet, x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: -delay, life });
    return life + delay;
  }


  updateEffects(dt) {
    for (const fx of this.effects) fx.t += dt;
    this.effects = this.effects.filter((fx) => fx.t < fx.life && (!fx.attackOrigin || this.hasAttackLine(fx.attackOrigin, fx.follow || fx)));
  }

  log(msg, type = 'info') { this.hud?.log(msg, type); }

  zoneName() { return mapTitle(this.world.def); }

  now() { return Date.now() + this.clockOffset; }

  // ------------------------------------------------------------ 맵 이동
  getWorld(id) {
    let w = this.worlds.get(id);
    if (!w) { w = new World(MAPS[id]); this.worlds.set(id, w); }
    return w;
  }

  enterMap(world, pos, first = false) {
    this.pendingTravel = null;
    this.dismissedPortal = null;
    this.hud?.closeTravelPrompt();
    // 이전 맵의 몬스터 · 그림 정리
    if (!first) {
      for (const z of this.world.zones) {
        if (this.artZones.has(z.id)) for (const name of this.zoneSheets(z).keys()) releaseSheet(name);
      }
    }
    this.world = world;
    this.zoneById = new Map(world.zones.map((z) => [z.id, z]));
    this.monsters = [];
    this.effects = [];
    this.tempPortals = [];
    this.pending = [];
    this.activeZones.clear();
    this.artZones.clear();
    const p = this.player;
    p.x = pos.x; p.y = pos.y;
    p.action = null; p.moveTarget = null;
    this.clearPath(p);
    this.mouse.left = false; this.mouse.mode = null;
    this.camera.x = p.x; this.camera.y = p.y;
    this.focusId = null;
    this.party.forEach((u, i) => {
      const off = [[-1.2, 0.8], [0.8, 1.3], [-0.6, 2]][i % 3];
      u.ent.x = p.x + off[0]; u.ent.y = p.y + off[1];
      if (world.blocked(u.ent.x, u.ent.y, u.ent.radius)) { u.ent.x = p.x; u.ent.y = p.y; }
      u.ent.action = null; u.target = null; this.clearPath(u.ent);
    });
    this.portalReadyAt = this.time + 0.6;
    this.openNpc = null;
    this.hud.onMapChange(first);
    this.streamZones();
    if (world.def.fieldBoss) this.fieldBossTick(true);
  }

  changeMap(mapId, spot = 'center', quiet = false) {
    const w = this.getWorld(mapId);
    const pos = w.spots[spot] || w.spawn;
    this.enterMap(w, { ...pos });
    this.hud.flashMap(this.world.def);
    if (!quiet) this.log(`${mapTitle(w.def)}에 들어왔습니다.`, 'system');
    this.save();
  }

  portalUnderPlayer() {
    const p = this.player;
    return this.world.portalAt(p.x, p.y)
      || this.tempPortals.find(q => p.x >= q.rect.x0 && p.x <= q.rect.x1 && p.y >= q.rect.y0 && p.y <= q.rect.y1);
  }

  checkPortal() {
    const p = this.player, portal = this.portalUnderPlayer();
    if (this.dismissedPortal && portal !== this.dismissedPortal) this.dismissedPortal = null;
    if (!portal || p.dead || this.time < this.portalReadyAt || this.pendingTravel || portal === this.dismissedPortal) return;
    const destination = MAPS[portal.to.map];
    if (this.world.type !== 'dungeon' && destination?.type !== 'dungeon') {
      this.changeMap(portal.to.map, portal.to.spot);
      return;
    }
    this.pendingTravel = { portal, from: this.world.id };
    p.action = null; p.moveTarget = null; this.clearPath(p);
    this.mouse.left = false; this.mouse.mode = null;
    this.hud.showTravelPrompt(destination, portal.kind);
  }

  resolveTravel(enter) {
    const pending = this.pendingTravel;
    if (!pending) return;
    this.pendingTravel = null;
    this.hud.closeTravelPrompt();
    // 취소한 자리에서는 다시 묻지 않고, 포탈 밖으로 나갔다 돌아오면 재확인.
    this.dismissedPortal = pending.portal;
    if (!enter || this.player.dead || this.world.id !== pending.from || this.portalUnderPlayer() !== pending.portal) return;
    this.changeMap(pending.portal.to.map, pending.portal.to.spot);
  }

  // 던전 최종 보스를 잡으면 보스 방에 입구로 돌아가는 포탈이 열림
  openReturnPortal(m) {
    const to = this.world.def.exitToEntrance;
    if (!to) return;
    const cx = m.x, cy = m.y + 3;
    this.tempPortals.push({
      id: 'return', kind: 'return', to, label: '던전 입구로 돌아가기', cx, cy,
      rect: { x0: cx - 1, y0: cy - 1, x1: cx + 1, y1: cy + 1 },
    });
    this.log('보스 방에 입구로 돌아가는 포탈이 열렸습니다.', 'system');
  }

  // 이동술사: 마을 · 필드는 그 맵으로, 던전은 입구 앞까지
  teleport(destId) {
    const npc = this.openNpc;
    const dest = teleportDestinations().find((d) => d.id === destId);
    if (!dest || npc?.kind !== 'teleporter') return;
    if (dest.map === this.world.id && dest.kind === 'village') { this.log('이미 이 마을에 있습니다.', 'warn'); return; }
    if (this.char.gold < dest.cost) { this.log(`골드가 부족합니다. (${dest.cost} 골드 필요)`, 'warn'); return; }
    this.char.gold -= dest.cost;
    this.hud.closePanel('npc');
    this.changeMap(dest.map, dest.spot, true);
    this.log(`${dest.cost} 골드를 내고 ${dest.name}(으)로 이동했습니다.`, 'system');
    this.hud.markDirty('inv', 'char');
  }

  // ------------------------------------------------------------ 필드 보스 (정해진 시간에만 등장)
  fieldBossTick(entering = false) {
    const wd = this.world.def;
    const fb = wd.fieldBoss;
    const win = bossWindow(fb.offset, this.now());
    const alive = this.monsters.find((m) => m.zone === FIELD_BOSS_ZONE && !m.dead);
    const def = MONSTERS[fb.type];
    if (win.active && !alive && this.char.fieldBossKills[wd.id] !== win.start) {
      const spot = this.world.spots.boss;
      const zone = { id: FIELD_BOSS_ZONE, rect: { x0: spot.x - 2, y0: spot.y - 2, x1: spot.x + 2, y1: spot.y + 2 }, monsters: [] };
      loadSheet(def.art.sheet, sheetCellPx(def) * (this.renderer.dpr || 1) * 1.1);
      if (this.spawnMonster(zone, true, fb.type, zone.rect)) {
        this.log(`[필드 보스] ${def.name}이(가) ${entering ? '출현 중입니다' : '나타났습니다'}! (${formatClock(win.end)}까지)`, 'rare');
      }
    } else if (!win.active && alive) {
      this.monsters = this.monsters.filter((m) => m !== alive);
      this.log(`[필드 보스] ${def.name}이(가) 사라졌습니다.`, 'system');
    }
  }

  fieldBossStatus() {
    const fb = this.world.def.fieldBoss;
    if (!fb) return '';
    const def = MONSTERS[fb.type];
    const now = this.now();
    const win = bossWindow(fb.offset, now);
    if (win.active && this.char.fieldBossKills[this.world.id] !== win.start) {
      return `필드 보스 ${def.name} 출현 중 (~${formatClock(win.end)})`;
    }
    const mins = Math.ceil((win.next - now) / 60000);
    return `필드 보스 ${def.name}: ${formatClock(win.next)} 출현 (${mins}분 후)`;
  }

  // ------------------------------------------------------------ input
  bindInput() {
    const c = this.canvas;
    this.handlers = {
      mousedown: (e) => {
        this.updateMouse(e);
        if (e.button === 1) { e.preventDefault(); this.useSlot(this.selectedSlot); return; }
        if (e.button !== 0 || this.player.dead) return;
        const p = this.player;
        const h = this.hover;
        this.mouse.left = true;
        if (h && h.isNpc) {
          p.action = { type: 'talk', targetId: h.id }; p.moveTarget = null; this.mouse.mode = 'npc';
        } else if (h) {
          p.action = { type: 'attack', targetId: h.id }; p.moveTarget = null; this.mouse.mode = 'attack';
          this.focusId = h.id; // 파티 전원이 이 대상을 집중 공격
        } else {
          this.mouse.mode = 'move';
          p.action = null;
          p.moveTarget = { x: this.mouse.wx, y: this.mouse.wy };
        }
      },
      mouseup: (e) => { if (e.button === 0) { this.mouse.left = false; this.mouse.mode = null; } },
      mousemove: (e) => this.updateMouse(e),
      wheel: (e) => { e.preventDefault(); this.selectSlot(this.selectedSlot + (e.deltaY > 0 ? 1 : -1)); },
      contextmenu: (e) => e.preventDefault(),
      auxclick: (e) => { if (e.button === 1) e.preventDefault(); },
      keydown: (e) => this.onKey(e),
      resize: () => this.renderer.resize(),
      blur: () => { this.mouse.left = false; this.mouse.mode = null; },
    };
    c.addEventListener('mousedown', this.handlers.mousedown);
    c.addEventListener('mousemove', this.handlers.mousemove);
    c.addEventListener('wheel', this.handlers.wheel, { passive: false });
    c.addEventListener('contextmenu', this.handlers.contextmenu);
    c.addEventListener('auxclick', this.handlers.auxclick);
    window.addEventListener('mouseup', this.handlers.mouseup);
    window.addEventListener('keydown', this.handlers.keydown);
    window.addEventListener('resize', this.handlers.resize);
    window.addEventListener('blur', this.handlers.blur);
  }

  unbindInput() {
    const c = this.canvas, h = this.handlers;
    c.removeEventListener('mousedown', h.mousedown);
    c.removeEventListener('mousemove', h.mousemove);
    c.removeEventListener('wheel', h.wheel);
    c.removeEventListener('contextmenu', h.contextmenu);
    c.removeEventListener('auxclick', h.auxclick);
    window.removeEventListener('mouseup', h.mouseup);
    window.removeEventListener('keydown', h.keydown);
    window.removeEventListener('resize', h.resize);
    window.removeEventListener('blur', h.blur);
  }

  updateMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.sx = e.clientX - rect.left;
    this.mouse.sy = e.clientY - rect.top;
    const w = this.renderer.screenToWorld(this.mouse.sx, this.mouse.sy, this.camera);
    this.mouse.wx = w.x;
    this.mouse.wy = w.y;
    this.hover = this.pick();
  }

  onKey(e) {
    if (this.pendingTravel) {
      if (e.key === 'Escape') { e.preventDefault(); this.resolveTravel(false); }
      return;
    }
    const slot = HOTBAR_KEYS.indexOf(e.key);
    if (slot >= 0) {
      e.preventDefault();
      if (!e.repeat) this.useSlot(slot);
      return;
    }
    if (e.target instanceof HTMLInputElement) return;
    switch (e.code) {
      case 'KeyC': this.hud.togglePanel('char'); break;
      case 'KeyI': this.hud.togglePanel('inv'); break;
      case 'KeyK': this.hud.togglePanel('skills'); break;
      case 'KeyP': this.hud.togglePanel('party'); break;
      case 'KeyA': this.cycleAutoMode(); break;
      case 'Escape': this.hud.escape(); break;
      default: return;
    }
    e.preventDefault();
  }
}
