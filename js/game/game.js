import { advanceGait, monsterStride } from './locomotion.js';
// 인게임 루프: 이동 / 전투 / 스킬 / 아이템 / 입력
import { CLASSES } from '../data/classes.js';
import { SKILLS } from '../data/skills.js';
import { ITEMS, INVENTORY_SIZE, SHOPS, sellPrice, canEquip } from '../data/items.js';
import { MONSTERS, SPAWN_ZONES } from '../data/monsters.js';
import * as S from '../systems/stats.js';
import { World, VILLAGE, WORLD_VERSION } from './world.js';
import { preloadSheets } from './sprites.js';
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
const PICK_RADIUS = 0.75;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class Game {
  constructor({ canvas, hudRoot, character, onSave, onExit }) {
    this.canvas = canvas;
    this.char = character;
    this.cls = CLASSES[character.classId];
    this.onSave = onSave;
    this.onExit = onExit;
    this.world = new World();
    this.renderer = new Renderer(canvas);

    // 맵이 바뀐 뒤 처음 접속하면 예전 위치 대신 마을에서 시작
    let start = character.worldVersion === WORLD_VERSION ? character.pos : null;
    character.worldVersion = WORLD_VERSION;
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

    this.buffs = [];
    this.cooldowns = {};
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
    this.timers = { spawn: 0, regen: 0, save: 0, hud: 0 };

    for (const zone of SPAWN_ZONES) {
      for (let i = 0; i < zone.max; i++) this.spawnMonster(zone, true);
      if (zone.boss) this.bossTick(zone);
    }
    preloadSheets([...new Set(Object.values(MONSTERS).map((d) => d.art?.sheet).filter(Boolean))]);

    this.hud = new Hud(hudRoot, this);
    this.bindInput();
    this.log(`${this.char.name}님, ${VILLAGE.name}에 오신 것을 환영합니다!`, 'system');
    this.log('좌클릭(누른 채 유지)으로 이동, 몬스터 좌클릭으로 공격합니다. 안내원에게 말을 걸어보세요.', 'system');
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
    this.char.pos = p.dead ? { ...this.world.spawn } : { x: p.x, y: p.y };
    this.onSave?.(this.char);
  }

  update(dt) {
    this.time += dt;
    const before = this.buffs.length;
    this.buffs = this.buffs.filter((b) => b.until > this.time);
    if (this.buffs.length !== before) this.hud.markDirty('char');

    const w = this.renderer.screenToWorld(this.mouse.sx, this.mouse.sy, this.camera);
    this.mouse.wx = w.x; this.mouse.wy = w.y;
    this.hover = this.pick(w.x, w.y);

    const playerBefore = { x: this.player.x, y: this.player.y };
    this.updatePlayer(dt);
    advanceGait(this.player, Math.hypot(this.player.x - playerBefore.x, this.player.y - playerBefore.y), dt);
    this.tickStatus();
    this.updateMonsters(dt);
    this.updateEffects(dt);

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
  derived() { return S.derivedStats(this.char, this.buffs); }

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

  actionRange(action) {
    if (action.type === 'talk') return 1.8;
    if (action.type === 'skill') return this.skillRange(SKILLS[action.skillId]);
    return this.cls.attackRange;
  }

  skillRange(sk) { return sk.range ?? this.cls.attackRange; }

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
      if (dist(p, target) > range) {
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
      if (p.attackTimer <= 0) {
        p.attackTimer = this.cls.attackInterval;
        this.playerAttack(target);
      }
    } else if (action.type === 'talk') {
      p.action = null;
      this.openNpc = target;
      this.hud.openNpc(target);
    } else if (action.type === 'skill') {
      const sk = SKILLS[action.skillId];
      p.action = action.resume ? { type: 'attack', targetId: action.resume } : null;
      if (this.canCast(sk, true)) this.castDamageSkill(sk, target);
    }
  }

  playerAttack(m) {
    const ch = this.char;
    const stat = ch.stats[this.cls.primaryStat];
    const hit = Math.random() < S.physicalHitChance(stat, ch.level, m);
    this.player.attackAnim = 0.3;
    if (this.cls.projectile) this.addProjectile(this.player, m, this.cls.projectile, '#f5e6c8');
    else this.effects.push({ type: 'slash', x: m.x, y: m.y, t: 0, life: 0.2, color: '#ffffff' });
    if (!hit) { this.floatText(m, 'MISS', '#bbbbbb'); this.aggro(m); return; }
    this.damageMonster(m, S.normalDamage(this.derived().attack, m.armor), '#ffffff');
  }

  // ------------------------------------------------------------ skills
  canCast(sk, quiet = false) {
    const ch = this.char;
    const fail = (msg) => { if (!quiet) this.log(msg, 'warn'); return false; };
    if (!sk) return false;
    if (this.player.dead) return false;
    if (sk.classId !== ch.classId) return fail('이 직업은 사용할 수 없는 스킬입니다.');
    if (ch.level < sk.level) return fail(`${sk.name}: 레벨 ${sk.level}부터 사용할 수 있습니다.`);
    if (this.time < (this.cooldowns[sk.id] || 0)) return fail(`${sk.name}: 재사용 대기 중입니다.`);
    if (ch.mp < sk.mp) return fail('마나가 부족합니다.');
    return true;
  }

  useSkill(id) {
    const sk = SKILLS[id];
    if (!this.canCast(sk)) return;
    const p = this.player;
    if (sk.kind === 'damage') {
      const target = this.skillTarget(sk);
      if (!target) { this.log('대상이 없습니다. 몬스터에 마우스를 올리고 사용하세요.', 'warn'); return; }
      const resume = p.action?.type === 'attack' ? p.action.targetId : null;
      if (dist(p, target) > this.skillRange(sk) + target.radius) {
        p.action = { type: 'skill', skillId: id, targetId: target.id, resume };
        p.moveTarget = null;
        return;
      }
      this.face(p, target);
      this.castDamageSkill(sk, target);
    } else {
      this.castSelfSkill(sk);
    }
  }

  skillTarget(sk) {
    if (this.hover && !this.hover.isNpc && !this.hover.dead) return this.hover;
    const cur = this.player.action?.targetId && this.findEntity(this.player.action.targetId);
    if (cur && !cur.isNpc) return cur;
    let best = null, bd = this.skillRange(sk) + 3;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = dist(this.player, m);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  spend(sk) {
    this.char.mp -= sk.mp;
    this.cooldowns[sk.id] = this.time + sk.cooldown;
  }

  castDamageSkill(sk, m) {
    const ch = this.char;
    this.spend(sk);
    const stat = ch.stats[sk.stat];
    const atk = this.derived().attack;
    this.player.attackAnim = 0.35;
    this.player.castAnim = 0.4;
    if (sk.projectile) this.addProjectile(this.player, m, sk.projectile, sk.color);
    else this.effects.push({ type: 'slash', x: m.x, y: m.y, t: 0, life: 0.3, color: sk.color });
    this.floatText(this.player, sk.name, sk.color, 13);
    for (let i = 0; i < (sk.hits || 1) && !m.dead; i++) {
      this.skillHit(sk, m, stat, atk, i);
    }
  }

  skillHit(sk, m, stat, atk, i = 0) {
    const ch = this.char;
    const magic = sk.element === 'magic';
    const chance = magic ? S.magicHitChance(stat, ch.level, m) : S.physicalHitChance(stat, ch.level, m);
    if (Math.random() >= chance) { this.floatText(m, 'MISS', '#bbbbbb', 15, i * 0.12); this.aggro(m); return; }
    const raw = S.skillDamage(stat, atk, sk.coef);
    const dmg = magic ? S.magicMitigate(raw, m.mr) : S.physicalMitigate(raw, m.armor);
    this.damageMonster(m, dmg, sk.color, i * 0.12);
  }

  castSelfSkill(sk) {
    const ch = this.char;
    const p = this.player;
    p.castAnim = 0.4;
    if (sk.kind === 'aoe') {
      this.spend(sk);
      this.effects.push({ type: 'ring', x: p.x, y: p.y, r: sk.radius, t: 0, life: 0.5, color: sk.color });
      const atk = this.derived().attack;
      const stat = ch.stats[sk.stat];
      for (const m of this.monsters) {
        if (!m.dead && dist(p, m) <= sk.radius + m.radius) this.skillHit(sk, m, stat, atk);
      }
    } else if (sk.kind === 'buff') {
      this.spend(sk);
      this.addBuff(sk.buff, sk.color);
    } else if (sk.kind === 'heal') {
      if (ch.hp >= ch.maxHp) { this.log('이미 HP가 가득 찼습니다.', 'warn'); return; }
      this.spend(sk);
      const amount = Math.round(ch.stats.int * sk.healIntCoef + ch.level * sk.healPerLevel);
      ch.hp = Math.min(ch.maxHp, ch.hp + amount);
      this.floatText(p, `+${amount}`, '#7dff9a');
      this.effects.push({ type: 'ring', x: p.x, y: p.y, r: 1, t: 0, life: 0.5, color: sk.color });
    } else if (sk.kind === 'restore') {
      if (ch.mp >= ch.maxMp) { this.log('이미 MP가 가득 찼습니다.', 'warn'); return; }
      this.spend(sk);
      const amount = Math.round(ch.maxMp * sk.mpPercent);
      ch.mp = Math.min(ch.maxMp, ch.mp + amount);
      this.floatText(p, `MP +${amount}`, '#7ab8ff');
      this.effects.push({ type: 'ring', x: p.x, y: p.y, r: 1, t: 0, life: 0.5, color: sk.color });
    }
  }

  addBuff(buff, color = '#ffe680') {
    this.buffs = this.buffs.filter((b) => b.id !== buff.id);
    this.buffs.push({ ...buff, color, until: this.time + buff.duration });
    this.floatText(this.player, buff.name, color, 13);
    this.effects.push({ type: 'ring', x: this.player.x, y: this.player.y, r: 1, t: 0, life: 0.5, color });
    this.log(`${buff.name} 효과가 적용되었습니다. (${buff.duration}초)`, 'info');
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
      if (c && (initial || dist(c, this.player) > 10)) pos = c;
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

  respawnTick() {
    this.monsters = this.monsters.filter((m) => !m.dead || this.time - m.deathTime < 0.8);
    for (const zone of SPAWN_ZONES) {
      const alive = this.monsters.filter((m) => m.zone === zone.id && !m.dead && !m.isBoss).length;
      if (alive < zone.max && Math.random() < 0.5) this.spawnMonster(zone);
      if (zone.boss) this.bossTick(zone);
    }
  }

  bossTick(zone) {
    const b = zone.boss;
    const alive = this.monsters.some((m) => m.type === b.type && m.zone === zone.id && !m.dead);
    if (alive) return;
    this.bossRespawnAt ??= {};
    if (this.bossRespawnAt[zone.id] === undefined) this.bossRespawnAt[zone.id] = 0; // 첫 등장은 즉시
    if (this.time < this.bossRespawnAt[zone.id]) return;
    if (this.spawnMonster(zone, true, b.type, b.rect)) {
      this.bossRespawnAt[zone.id] = Infinity;
      // 네임드는 조용히, 보스는 전체 알림
      if (MONSTERS[b.type].rank !== 'guard') this.log(`보스 ${MONSTERS[b.type].name}이(가) ${zone.theme || zone.name.split(' (')[0]}에 나타났습니다!`, 'rare');
    }
  }

  aggro(m) {
    if (m.dead || m.state === 'return') return;
    const was = m.state;
    m.state = 'chase';
    // 무리 생활: 처음 싸움에 휘말리면 주변의 같은 종류가 함께 덤빔
    if (was !== 'chase' && MONSTERS[m.type].social) {
      for (const o of this.monsters) {
        if (o !== m && !o.dead && o.type === m.type && o.state === 'idle' && dist(o, m) < 6) o.state = 'chase';
      }
    }
  }

  updateMonsters(dt) {
    const p = this.player;
    const playerSafe = p.dead || this.world.inVillage(p.x, p.y);
    for (const m of this.monsters) {
      if (m.dead) continue;
      const def = MONSTERS[m.type];
      m.attackTimer -= dt;
      m.hurtFlash = Math.max(0, m.hurtFlash - dt);
      m.attackAnim = Math.max(0, m.attackAnim - dt);
      const pd = dist(m, p);
      // 화면에서 멀리 떨어진 대기 중 몬스터는 계산 생략 (몬스터 수백 마리)
      if (pd > 36 && m.state === 'idle') { m.moving = false; advanceGait(m, 0, dt); continue; }
      const mend = passive(def, 'mend');
      if (mend && m.hp < m.maxHp * 0.5) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * mend * dt);
      const ox = m.x, oy = m.y;
      this.monsterBrain(m, def, p, pd, playerSafe, dt);
      m.moving = Math.hypot(m.x - ox, m.y - oy) > 1e-4;
      advanceGait(m, Math.hypot(m.x - ox, m.y - oy), dt, monsterStride(def.family, def.size));
    }
  }

  monsterBrain(m, def, p, pd, playerSafe, dt) {
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
          const r = this.moveEntity(m, m.wanderTarget.x, m.wanderTarget.y, def.speed * 0.45, dt, true);
          if (r !== 'moving') m.wanderTarget = null;
        }
      } else if (m.state === 'chase') {
        if (playerSafe || dist(m, m.home) > (m.isBoss ? 18 : 14)) { m.state = 'return'; return; }
        const slam = def.boss?.slam;
        if (slam && this.time >= (m.nextSlam ?? (m.nextSlam = this.time + 3)) && pd < slam.radius + 2) {
          this.startSlam(m, slam);
          return;
        }
        if (pd <= def.attackRange + p.radius) {
          this.face(m, p);
          if (m.attackTimer <= 0) {
            m.attackTimer = def.attackInterval * (1 - passive(def, 'haste'));
            if (def.active?.length && m.nextSkill > 0 && this.time >= m.nextSkill) this.monsterSkill(m, def);
            else this.monsterAttack(m, def);
            if (!m.nextSkill) m.nextSkill = this.time + 2 + Math.random() * 3;
          }
        } else {
          const r = this.moveEntity(m, p.x, p.y, def.speed, dt, true);
          m.stuckTime = r === 'stuck' ? m.stuckTime + dt : 0;
          if (m.stuckTime > 3) { m.state = 'return'; m.stuckTime = 0; }
        }
      } else if (m.state === 'return') {
        m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.3 * dt);
        const r = this.moveEntity(m, m.home.x, m.home.y, def.speed * 1.2, dt, true);
        if (r !== 'moving') { m.state = 'idle'; m.hp = m.maxHp; m.nextSlam = undefined; }
      }
    }
  }

  startSlam(m, slam) {
    const p = this.player;
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
    const p = this.player;
    if (p.dead || m.dead || dist(p, at) > slam.radius + p.radius) return;
    const dmg = S.monsterDamage(def.atk * slam.mult, this.derived().defense);
    this.hurtPlayer(dmg, def);
  }

  monsterAttack(m, def) {
    m.animKind = 'attack'; m.animDur = 0.4; m.attackAnim = 0.4;
    if (def.projectile) {
      this.addProjectile(m, this.player, def.projectile, def.projectile === 'bolt' ? def.color : '#d8c8a0');
    } else {
      this.effects.push({ type: 'slash', x: this.player.x, y: this.player.y, t: 0, life: 0.2, color: '#ff6060' });
    }
    this.monsterHit(m, def, 1);
  }

  // 몬스터 한 번의 타격: 명중 판정 → 피해. 맞으면 true
  monsterHit(m, def, mult, delay = 0) {
    const ch = this.char;
    const d = this.derived();
    // 마법 공격은 방어력을 절반만 적용
    const pdef = def.magic ? d.defense / 2 : d.defense;
    const hit = S.monsterHitChance(def.level, ch.level, pdef) + passive(def, 'focus');
    if (Math.random() >= hit) { this.floatText(this.player, 'MISS', '#bbbbbb', 15, delay); return false; }
    let atk = def.atk * mult;
    const fury = passive(def, 'fury');
    if (fury && m.hp < m.maxHp * 0.5) atk *= 1 + fury;
    let dmg = S.monsterDamage(atk, pdef);
    const expose = this.buffs.reduce((a, b) => a + (b.expose || 0), 0);
    if (expose) dmg = Math.round(dmg * (1 + expose));
    this.hurtPlayer(dmg, def, delay);
    return true;
  }

  // 몬스터 스킬 (원본 「환생 루프」 액티브): 배율 피해 × 타수 + 상태이상
  monsterSkill(m, def) {
    const sk = def.active[Math.floor(Math.random() * def.active.length)];
    m.nextSkill = this.time + def.skillCooldown * (0.8 + Math.random() * 0.4);
    m.animKind = 'skill'; m.animDur = 0.6; m.attackAnim = 0.6;
    const p = this.player;
    const color = EFFECT_COLOR[sk.effect] || def.color;
    this.floatText(m, sk.name, color, 13);
    if (def.projectile) this.addProjectile(m, p, def.projectile, color);
    this.effects.push({ type: 'ring', x: p.x, y: p.y, r: 0.8, t: -0.15, life: 0.4, color });
    let landed = false;
    for (let i = 0; i < (sk.pulses || 1); i++) {
      if (this.player.dead) break;
      if (this.monsterHit(m, def, sk.mult, i * 0.15)) landed = true;
    }
    if (landed && Math.random() < 0.6) this.applyStatus(sk.effect, def);
  }

  applyStatus(effect, def) {
    const st = STATUS[effect];
    if (!st || this.player.dead) return;
    const tick = Math.max(1, Math.round(def.atk * 0.12));
    this.buffs = this.buffs.filter((b) => b.id !== st.id);
    this.buffs.push({ ...st, color: EFFECT_COLOR[effect], until: this.time + st.duration, debuff: true,
      dot: st.dot ? tick : 0, nextTick: this.time + 1, src: def.name });
    this.floatText(this.player, st.name, EFFECT_COLOR[effect], 13, 0.2);
    this.hud.markDirty('char');
  }

  // 지속 피해(출혈·화상·중독) 처리
  tickStatus() {
    for (const b of this.buffs) {
      if (!b.dot || this.time < b.nextTick || this.player.dead) continue;
      b.nextTick += 1;
      this.char.hp -= b.dot;
      this.player.lastHurt = this.time;
      this.floatText(this.player, `-${b.dot}`, b.color, 13);
      if (this.char.hp <= 0) this.playerDie({ name: `${b.name}(${b.src})` });
    }
  }

  hurtPlayer(dmg, def, delay = 0) {
    const ch = this.char;
    if (this.player.dead) return;
    ch.hp -= dmg;
    this.player.lastHurt = this.time;
    this.floatText(this.player, `-${dmg}`, '#ff5050', 15, delay);
    if (ch.hp <= 0) this.playerDie(def);
  }

  damageMonster(m, dmg, color, delay = 0) {
    const hide = passive(MONSTERS[m.type], 'hide');
    if (hide) dmg = Math.max(1, Math.round(dmg * (1 - hide)));
    m.hp -= dmg;
    m.hurtFlash = 0.12;
    this.floatText(m, `${dmg}`, color, 16, delay);
    this.aggro(m);
    if (m.hp <= 0) this.killMonster(m);
  }

  killMonster(m) {
    const ch = this.char;
    const def = MONSTERS[m.type];
    m.dead = true;
    m.deathTime = this.time;
    m.slamTarget = null;
    if (m.isBoss) {
      const zone = SPAWN_ZONES.find((z) => z.id === m.zone);
      this.bossRespawnAt ??= {};
      this.bossRespawnAt[m.zone] = this.time + (zone?.boss?.respawn ?? 120);
      this.log(`${def.rank === 'guard' ? '네임드' : '보스'} ${def.name}을(를) 쓰러뜨렸습니다!`, 'level');
      this.effects.push({ type: 'ring', x: m.x, y: m.y, r: 2.5, t: 0, life: 1, color: '#ffd24a' });
    }
    const gold = S.randInt(def.gold[0], def.gold[1]);
    ch.gold += gold;
    const ups = S.gainExp(ch, def.exp);
    this.log(`${def.name}을(를) 처치했습니다. 경험치 +${def.exp}, 골드 +${gold}`, 'loot');
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
    this.effects.push({ type: 'ring', x: p.x, y: p.y, r: 1.6, t: 0, life: 0.9, color: '#ffe066' });
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
    p.x = this.world.spawn.x; p.y = this.world.spawn.y;
    this.char.hp = this.char.maxHp;
    this.char.mp = Math.max(this.char.mp, Math.floor(this.char.maxMp / 2));
    this.log(`${VILLAGE.name}에서 부활했습니다.`, 'system');
    this.save();
  }

  regenTick() {
    const ch = this.char;
    const p = this.player;
    if (p.dead) return;
    const inTown = this.world.inVillage(p.x, p.y);
    if (!inTown && this.time - p.lastHurt < 6) return;
    const r = S.regenAmounts(ch);
    const mult = inTown ? 3 : 1;
    ch.hp = Math.min(ch.maxHp, ch.hp + r.hp * mult);
    ch.mp = Math.min(ch.maxMp, ch.mp + r.mp * mult);
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
      const p = this.player;
      p.x = this.world.spawn.x; p.y = this.world.spawn.y;
      p.action = null; p.moveTarget = null;
      for (const m of this.monsters) if (m.state === 'chase') m.state = 'return';
      this.effects.push({ type: 'ring', x: p.x, y: p.y, r: 1.5, t: 0, life: 0.7, color: '#c9b37a' });
      this.log(`${VILLAGE.name}(으)로 귀환했습니다.`, 'system');
    }
    this.removeItemAt(idx, 1);
    this.itemReadyAt = this.time + 0.4;
  }

  equip(idx) {
    const ch = this.char;
    const entry = ch.inventory[idx];
    if (!entry) return;
    const it = ITEMS[entry.id];
    if (!canEquip(entry.id, ch.classId)) { this.log(`${it.name}은(는) ${this.cls.name}이(가) 장착할 수 없습니다.`, 'warn'); return; }
    const slot = it.type;
    const old = ch.equipment[slot];
    ch.inventory.splice(idx, 1);
    ch.equipment[slot] = entry.id;
    if (old) ch.inventory.push({ id: old, qty: 1 });
    this.log(`${it.name}을(를) 장착했습니다.`, 'info');
    this.hud.markDirty('inv', 'char');
  }

  unequip(slot) {
    const ch = this.char;
    const id = ch.equipment[slot];
    if (!id) return;
    if (ch.inventory.length >= INVENTORY_SIZE) { this.log('인벤토리가 가득 찼습니다.', 'warn'); return; }
    ch.equipment[slot] = null;
    ch.inventory.push({ id, qty: 1 });
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
    const ch = this.char;
    ch.hp = ch.maxHp;
    ch.mp = ch.maxMp;
    this.effects.push({ type: 'ring', x: this.player.x, y: this.player.y, r: 1.2, t: 0, life: 0.6, color: '#8cffb0' });
    this.log('치유사 엘린: 몸과 마음이 회복되었어요. 조심히 다녀오세요!', 'system');
  }

  allocateStat(stat) {
    if (S.allocatePoint(this.char, stat)) {
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
  pick(wx, wy) {
    let best = null, bd = PICK_RADIUS;
    for (const e of [...this.monsters, ...this.world.npcs]) {
      if (e.dead) continue;
      // 캐릭터 그림이 위쪽으로 그려지므로 클릭 판정을 살짝 위로
      const d = Math.hypot(e.x - wx, e.y - 0.4 - wy);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  floatText(e, text, color, size = 15, delay = 0) {
    this.effects.push({ type: 'text', x: e.x + (Math.random() - 0.5) * 0.3, y: e.y, text, color, size, t: -delay, life: 0.9 });
  }

  addProjectile(from, to, kind, color) {
    const life = Math.max(0.08, dist(from, to) / 18);
    this.effects.push({ type: 'proj', kind, color, x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: 0, life });
  }

  updateEffects(dt) {
    for (const fx of this.effects) fx.t += dt;
    this.effects = this.effects.filter((fx) => fx.t < fx.life);
  }

  log(msg, type = 'info') { this.hud?.log(msg, type); }

  zoneName() {
    const p = this.player;
    if (this.world.inVillage(p.x, p.y)) return `${VILLAGE.name} (안전지대)`;
    const z = SPAWN_ZONES.find((zn) => p.x >= zn.rect.x0 && p.x <= zn.rect.x1 && p.y >= zn.rect.y0 && p.y <= zn.rect.y1);
    return z ? z.name : '마을 주변 들판';
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
    this.hover = this.pick(w.x, w.y);
  }

  onKey(e) {
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
      case 'Escape': this.hud.escape(); break;
      default: return;
    }
    e.preventDefault();
  }
}
