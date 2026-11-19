// DOM 기반 HUD: 상태바, 단축칸(F5~F12), 캐릭터/인벤토리/스킬 창, NPC 대화
import { CLASSES, STAT_KEYS, STAT_NAMES, STAT_DESCRIPTIONS, STAT_CAP } from '../data/classes.js';
import { SKILLS } from '../data/skills.js';
import { ITEMS, INVENTORY_SIZE, SHOPS, sellPrice, canEquip } from '../data/items.js';
import * as S from '../systems/stats.js';
import { T } from './world.js';
import { MAPS, BOSS_SCHEDULE, bossWindow, formatClock, mapTitle, teleportDestinations } from '../data/maps.js';
import { MONSTERS } from '../data/monsters.js';
import { url as artUrl, fxIcon, statusIcon, portrait } from './art.js';
import { heroKey } from '../data/classes.js';
import { CONDITIONS, SKILL_SLOTS, MAX_MERCS, learnedSkills } from '../systems/party.js';
import { HOTBAR_KEYS } from './game.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (v) => `${Math.round(v * 100)}%`;

// 이 마을 동/서 출구로 이어지는 맵 안내
function exitsText(def) {
  const parts = [];
  if (def.exits.west) parts.push(`서쪽 출구 → ${esc(mapTitle(MAPS[def.exits.west.map]))}`);
  if (def.exits.east) parts.push(`동쪽 출구 → ${esc(mapTitle(MAPS[def.exits.east.map]))}`);
  return parts.join(' · ');
}

function iconHtml(color, text, extra = '') {
  return `<span class="icon" style="--c:${color}">${esc(text)}</span>${extra}`;
}

// 스킬 아이콘: 「환생 루프」 아이콘 그림 (assets/skills/<이펙트>-icon.webp)
function skillIcon(sk) {
  if (sk.fx?.sheet) return `<img class="icon img" src="${artUrl(fxIcon(sk.fx.sheet))}" alt="${esc(sk.name)}" draggable="false">`;
  return iconHtml(sk.color, sk.name.slice(0, 2));
}
function itemIcon(id) { const it = ITEMS[id]; return iconHtml(it.icon.color, it.icon.text); }

export class Hud {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.dirty = new Set(['hotbar', 'char', 'inv', 'skills']);
    this.open = new Set();
    this.dragging = false;
    this.build();
  }

  build() {
    const r = this.root;
    r.innerHTML = `
      <div class="hud-status">
        <img class="hud-portrait" alt="" draggable="false">
        <div class="hud-name"></div>
        <div class="bar hp"><div class="fill"></div><span></span></div>
        <div class="bar mp"><div class="fill"></div><span></span></div>
        <div class="bar exp"><div class="fill"></div><span></span></div>
        <div class="hud-buffs"></div>
      </div>
      <div class="hud-party"></div>
      <div class="hud-topright">
        <div class="hud-zone"></div>
        <div class="hud-boss"></div>
        <canvas class="hud-minimap" width="150" height="150"></canvas>
      </div>
      <div class="hud-log"></div>
      <div class="hud-bottom">
        <div class="hud-hotbar"></div>
        <div class="hud-hint">휠: 칸 선택 · 휠 클릭: 사용 · F5~F12: 바로 사용 · 드래그로 등록 · 우클릭: 비우기</div>
      </div>
      <div class="hud-buttons">
        <button class="auto-btn" data-auto>자동사냥: 끔</button>
        <button data-toggle="party">파티 (P)</button>
        <button data-toggle="char">캐릭터 (C)</button>
        <button data-toggle="inv">인벤토리 (I)</button>
        <button data-toggle="skills">스킬 (K)</button>
        <button data-toggle="menu">메뉴 (Esc)</button>
      </div>
      <section class="panel" data-panel="char"><header><span>캐릭터 정보</span><button class="close">×</button></header><div class="body"></div></section>
      <section class="panel" data-panel="inv"><header><span>인벤토리</span><button class="close">×</button></header><div class="body"></div></section>
      <section class="panel" data-panel="party"><header><span>파티 · 스킬 배치</span><button class="close">×</button></header><div class="body"></div></section>
      <section class="panel" data-panel="skills"><header><span>스킬</span><button class="close">×</button></header><div class="body"></div></section>
      <section class="panel" data-panel="npc"><header><span class="npc-title"></span><button class="close">×</button></header><div class="body"></div></section>
      <section class="panel small" data-panel="menu"><header><span>메뉴</span><button class="close">×</button></header>
        <div class="body menu-body">
          <button data-menu="resume">게임으로 돌아가기</button>
          <button data-menu="save">저장</button>
          <button data-menu="select">캐릭터 선택 화면</button>
          <button data-menu="logout">로그아웃</button>
        </div>
      </section>
      <div class="levelup-banner"></div>
      <div class="map-banner"></div>
      <div class="death-overlay"><div>쓰러졌습니다</div><small></small></div>
    `;
    this.el = {
      name: r.querySelector('.hud-name'),
      portrait: r.querySelector('.hud-portrait'),
      party: r.querySelector('.hud-party'),
      autoBtn: r.querySelector('[data-auto]'),
      hp: r.querySelector('.bar.hp'),
      mp: r.querySelector('.bar.mp'),
      exp: r.querySelector('.bar.exp'),
      buffs: r.querySelector('.hud-buffs'),
      zone: r.querySelector('.hud-zone'),
      boss: r.querySelector('.hud-boss'),
      mapBanner: r.querySelector('.map-banner'),
      minimap: r.querySelector('.hud-minimap'),
      log: r.querySelector('.hud-log'),
      hotbar: r.querySelector('.hud-hotbar'),
      banner: r.querySelector('.levelup-banner'),
      death: r.querySelector('.death-overlay'),
    };
    this.panels = {};
    r.querySelectorAll('.panel').forEach((p) => { this.panels[p.dataset.panel] = p; });

    r.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => this.togglePanel(b.dataset.toggle)));
    r.querySelectorAll('.panel .close').forEach((b) => b.addEventListener('click', () => this.closePanel(b.closest('.panel').dataset.panel)));
    r.querySelectorAll('.panel header').forEach((h) => this.makeDraggable(h.closest('.panel'), h));
    r.querySelectorAll('[data-menu]').forEach((b) => b.addEventListener('click', () => this.menu(b.dataset.menu)));

    this.buildHotbar();
    this.buildMinimap();
    this.bindPanelEvents();
  }

  destroy() { this.root.innerHTML = ''; }

  // 창 제목을 잡고 끌어서 이동
  makeDraggable(panel, handle) {
    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const host = this.root.getBoundingClientRect();
      const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
      const move = (ev) => {
        const x = Math.max(0, Math.min(host.width - 60, ev.clientX - host.left - ox));
        const y = Math.max(0, Math.min(host.height - 40, ev.clientY - host.top - oy));
        Object.assign(panel.style, { left: `${x}px`, top: `${y}px`, right: 'auto', transform: 'none' });
      };
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      // 클릭한 창을 맨 앞으로
      this.z = (this.z || 10) + 1;
      panel.style.zIndex = this.z;
    });
  }

  markDirty(...names) { names.forEach((n) => this.dirty.add(n)); }

  // ------------------------------------------------------------ periodic update
  update() {
    const g = this.game, ch = g.char;
    const cls = CLASSES[ch.classId];
    const grade = S.luckGrade(ch);
    this.el.name.innerHTML = `<b>Lv.${ch.level}</b> ${esc(ch.name)} <span class="cls" style="color:${cls.color}">${cls.name}</span>`
      + ` <span class="grade g-${grade.id}" title="${esc(grade.label)}">${grade.short}</span>`
      + (ch.bonusPoints > 0 ? ` <span class="bp" title="캐릭터 창(C)에서 사용">보너스 ${ch.bonusPoints}</span>` : '');
    this.setBar(this.el.hp, ch.hp, ch.maxHp, `HP ${Math.max(0, Math.ceil(ch.hp))} / ${ch.maxHp}`);
    this.setBar(this.el.mp, ch.mp, ch.maxMp, `MP ${Math.floor(ch.mp)} / ${ch.maxMp}`);
    const need = S.expToNext(ch.level);
    this.setBar(this.el.exp, ch.exp, need, `EXP ${(ch.exp / need * 100).toFixed(2)}%`);

    if (!this.el.portrait.src) this.el.portrait.src = artUrl(portrait(heroKey(ch.classId, ch.gender)));
    this.el.buffs.innerHTML = g.buffs.map((b) => {
      const left = Math.ceil(b.until - g.time);
      const ic = b.icon ? `<img src="${artUrl(statusIcon(b.icon))}" alt="">` : '';
      return `<span class="buff ${b.debuff ? 'debuff' : ''} ${ic ? 'has-icon' : ''}" style="--c:${b.color}" title="${esc(b.name)} (${left}초)">${ic}<em>${ic ? '' : esc(b.name) + ' '}${left}s</em></span>`;
    }).join('');
    this.el.zone.textContent = g.zoneName();
    const bossText = g.fieldBossStatus();
    this.el.boss.textContent = bossText;
    this.el.boss.style.display = bossText ? '' : 'none';

    this.renderPartyFrames();
    this.el.autoBtn.textContent = { manual: '자동사냥: 끔', normal: '자동사냥: 일반공격', skill: '자동사냥: 스킬 사용' }[g.autoMode];
    this.el.autoBtn.classList.toggle('on', g.autoMode !== 'manual');
    this.el.portrait.classList.toggle('selected', g.selectedId === 'player');

    this.updateHotbarCooldowns();
    this.drawMinimap();

    const p = g.player;
    this.el.death.classList.toggle('show', p.dead);
    if (p.dead) this.el.death.querySelector('small').textContent = `${Math.max(0, Math.ceil(p.respawnAt - g.time))}초 후 마을에서 부활합니다`;

    if (!this.dragging) {
      if (this.dirty.has('hotbar')) this.renderHotbar();
      for (const name of ['char', 'inv', 'skills', 'npc', 'party']) {
        if (this.dirty.has(name) && this.open.has(name)) this.renderPanel(name);
      }
      this.dirty.clear();
    }
    // 열린 캐릭터 창의 HP/MP 등 실시간 반영 (1초마다)
    if (this.open.has('char') && Math.floor(g.time) !== this.lastCharSecond) {
      this.lastCharSecond = Math.floor(g.time);
      if (!this.dragging) this.renderPanel('char');
    }
  }

  setBar(el, v, max, text) {
    el.querySelector('.fill').style.width = `${Math.max(0, Math.min(1, v / max)) * 100}%`;
    el.querySelector('span').textContent = text;
  }

  log(msg, type = 'info') {
    const line = document.createElement('div');
    line.className = `log-${type}`;
    line.textContent = msg;
    this.el.log.appendChild(line);
    while (this.el.log.children.length > 60) this.el.log.firstChild.remove();
    this.el.log.scrollTop = this.el.log.scrollHeight;
  }

  showLevelUp(r) {
    const con = r.conBonus ? ` + 체력 ${r.conBonus}` : '';
    this.el.banner.innerHTML = `<div class="big">LEVEL UP!  Lv.${r.level}</div>
      <div>HP +${r.hpGain} <small>(주사위 ${r.hpRoll}${con})</small> · MP +${r.mpGain}</div>
      ${r.bonus ? '<div class="bonus">보너스 포인트 +1</div>' : ''}`;
    this.el.banner.classList.remove('show');
    void this.el.banner.offsetWidth;
    this.el.banner.classList.add('show');
  }

  // ------------------------------------------------------------ hotbar
  buildHotbar() {
    const g = this.game;
    this.slots = HOTBAR_KEYS.map((key, i) => {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML = `<div class="content"></div><div class="cd"></div><span class="key">${key}</span>`;
      el.draggable = true;
      el.addEventListener('click', () => g.selectSlot(i));
      el.addEventListener('dblclick', () => g.useSlot(i));
      el.addEventListener('mousedown', (e) => { if (e.button === 1) { e.preventDefault(); g.selectSlot(i); g.useSlot(i); } });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); g.setHotbar(i, null); });
      el.addEventListener('dragstart', (e) => {
        if (!g.char.hotbar[i]) { e.preventDefault(); return; }
        this.dragging = true;
        e.dataTransfer.setData('text/plain', JSON.stringify({ ...g.char.hotbar[i], fromSlot: i }));
      });
      el.addEventListener('dragend', () => { this.dragging = false; });
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
      el.addEventListener('dragleave', () => el.classList.remove('over'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('over');
        this.dragging = false;
        let data;
        try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
        if (data.fromSlot !== undefined) g.swapHotbar(data.fromSlot, i);
        else if (data.type === 'skill' || data.type === 'item') g.setHotbar(i, { type: data.type, id: data.id });
      });
      this.el.hotbar.appendChild(el);
      return el;
    });
    this.el.hotbar.addEventListener('wheel', (e) => {
      e.preventDefault();
      g.selectSlot(g.selectedSlot + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });
  }

  renderHotbar() {
    const g = this.game;
    g.char.hotbar.forEach((entry, i) => {
      const el = this.slots[i];
      el.classList.toggle('selected', i === g.selectedSlot);
      const content = el.querySelector('.content');
      if (!entry) { content.innerHTML = ''; el.title = '비어 있음 — 스킬/아이템을 끌어다 놓으세요'; return; }
      if (entry.type === 'skill') {
        const sk = SKILLS[entry.id];
        content.innerHTML = sk ? skillIcon(sk) : '';
        el.title = sk ? `${sk.name} (MP ${sk.mp})\n${sk.desc}` : '';
      } else {
        const it = ITEMS[entry.id];
        content.innerHTML = it ? itemIcon(entry.id) + '<span class="qty"></span>' : '';
        el.title = it ? `${it.name}\n${it.desc}` : '';
      }
    });
  }

  updateHotbarCooldowns() {
    const g = this.game;
    g.char.hotbar.forEach((entry, i) => {
      const el = this.slots[i];
      const cd = el.querySelector('.cd');
      let frac = 0, unusable = false;
      if (entry?.type === 'skill') {
        const sk = SKILLS[entry.id];
        if (sk) {
          const left = (g.cooldowns[sk.id] || 0) - g.time;
          frac = left > 0 ? left / sk.cooldown : 0;
          unusable = g.char.level < sk.level || g.char.mp < sk.mp;
        }
      } else if (entry?.type === 'item') {
        const n = g.countItem(entry.id);
        const q = el.querySelector('.qty');
        if (q) q.textContent = ITEMS[entry.id]?.type === 'consumable' ? n : '';
        unusable = n === 0;
      }
      cd.style.height = `${frac * 100}%`;
      el.classList.toggle('unusable', unusable);
    });
  }

  // ------------------------------------------------------------ minimap
  buildMinimap() {
    const w = this.game.world;
    const off = document.createElement('canvas');
    off.width = w.w; off.height = w.h;
    const octx = off.getContext('2d');
    const img = octx.createImageData(w.w, w.h);
    const colors = {
      [T.GRASS]: [76, 138, 58], [T.FLOWER]: [86, 148, 66], [T.DIRT]: [151, 122, 82], [T.TREE]: [40, 90, 36],
      [T.WATER]: [46, 106, 163], [T.WALL]: [70, 60, 52], [T.FLOOR]: [180, 156, 116], [T.STONE]: [119, 117, 111],
      [T.ROCK]: [80, 78, 74], [T.SAND]: [214, 194, 140],
      [T.SWAMP]: [72, 96, 60], [T.ASH]: [70, 64, 62], [T.DARKGRASS]: [44, 74, 46], [T.LAVA]: [220, 90, 30],
      [T.GRAVE]: [120, 120, 128], [T.DEADTREE]: [52, 44, 40],
      [T.SNOW]: [228, 234, 240], [T.ICE]: [150, 200, 230], [T.CRYSTAL]: [150, 110, 220], [T.CORAL]: [230, 100, 110],
      [T.SHELF]: [110, 70, 40], [T.VOID]: [50, 40, 70], [T.CACTUS]: [70, 140, 70], [T.HOUSE]: [150, 74, 52],
    };
    for (let i = 0; i < w.w * w.h; i++) {
      const c = colors[w.tiles[i]] || [0, 0, 0];
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    octx.putImageData(img, 0, 0);
    this.minimapBase = off;
  }

  // 미니맵은 화면과 같은 방향의 마름모로: 월드 (x, y) → ((x − y)·k + h·k, (x + y)·k/2)
  mini(x, y) {
    const k = this.miniK, h = this.game.world.h;
    return [(x - y) * k + h * k, (x + y) * k / 2];
  }

  drawMinimap() {
    const g = this.game;
    const cv = this.el.minimap, ctx = cv.getContext('2d');
    const k = this.miniK, h = g.world.h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c0d0a';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = true;
    ctx.setTransform(k, k / 2, -k, k / 2, h * k, 0);
    ctx.drawImage(this.minimapBase, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dot = (x, y, s) => { const [px, py] = this.mini(x, y); ctx.fillRect(px - s / 2, py - s / 2, s, s); };
    ctx.fillStyle = '#ff5050';
    for (const m of g.monsters) if (!m.dead && !m.isBoss) dot(m.x, m.y, 2);
    for (const m of g.monsters) {
      if (m.dead || !m.isBoss) continue;
      ctx.fillStyle = Math.sin(g.time * 6) > 0 ? '#ffd24a' : '#ff3030';
      dot(m.x, m.y, 5);
    }
    ctx.fillStyle = '#ffe680';
    for (const n of g.world.npcs) dot(n.x, n.y, 3);
    for (const q of [...g.world.portals, ...g.tempPortals]) {
      ctx.fillStyle = q.kind === 'exit' ? '#6ae0ff' : '#c87aff';
      dot(q.cx, q.cy, 5);
    }
    const [px, py] = this.mini(g.player.x, g.player.y);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // 맵이 바뀌면: 미니맵 다시 만들기, NPC 창 닫기
  onMapChange(first) {
    this.buildMinimap();
    if (!first) this.closePanel('npc');
    const cv = this.el.minimap, w = this.game.world;
    cv.width = 200;
    this.miniK = cv.width / (w.w + w.h);
    cv.height = Math.ceil((w.w + w.h) * this.miniK / 2);
    cv.style.width = '200px';
  }

  // 맵 이름 띄우기
  flashMap(def) {
    const sub = def.type === 'village' ? def.desc : def.type === 'dungeon' ? `권장 Lv.${def.level[0]}~${def.level[1] + 2}` : `Lv.${def.level[0]}~${def.level[1]} 사냥터`;
    this.el.mapBanner.innerHTML = `<div class="big">${esc(def.name)}</div><div>${esc(sub || '')}</div>`;
    this.el.mapBanner.classList.remove('show');
    void this.el.mapBanner.offsetWidth;
    this.el.mapBanner.classList.add('show');
  }

  // ------------------------------------------------------------ panels
  togglePanel(name) {
    if (this.open.has(name)) this.closePanel(name);
    else this.openPanel(name);
  }

  openPanel(name) {
    this.open.add(name);
    this.panels[name].classList.add('show');
    this.renderPanel(name);
  }

  closePanel(name) {
    this.open.delete(name);
    this.panels[name].classList.remove('show');
    if (name === 'npc') this.game.openNpc = null;
  }

  escape() {
    const order = ['npc', 'party', 'skills', 'inv', 'char'];
    const top = order.find((n) => this.open.has(n));
    if (top) this.closePanel(top);
    else this.togglePanel('menu');
  }

  menu(action) {
    const g = this.game;
    if (action === 'resume') this.closePanel('menu');
    else if (action === 'save') { g.save(); this.log('저장되었습니다.', 'system'); this.closePanel('menu'); }
    else if (action === 'select') g.exit('select');
    else if (action === 'logout') g.exit('logout');
  }

  selectUnit(id) {
    this.game.selectedId = id;
    this.markDirty('party', 'char', 'inv');
    this.lastPartyHtml = null;
  }

  openNpc(npc) {
    this.npc = npc;
    this.panels.npc.querySelector('.npc-title').textContent = npc.name;
    this.openPanel('npc');
    if (SHOPS[npc.kind] && !this.open.has('inv')) this.openPanel('inv');
  }

  renderPanel(name) {
    const body = this.panels[name].querySelector('.body');
    if (name === 'char') body.innerHTML = this.charHtml();
    else if (name === 'inv') body.innerHTML = this.invHtml();
    else if (name === 'skills') body.innerHTML = this.skillsHtml();
    else if (name === 'npc') body.innerHTML = this.npcHtml();
    else if (name === 'party') body.innerHTML = this.partyHtml();
  }

  // ------------------------------------------------------------ 파티
  renderPartyFrames() {
    const g = this.game;
    const html = g.party.map((u) => {
      const ch = u.char, cls = CLASSES[ch.classId];
      return `<div class="pframe ${g.selectedId === u.id ? 'selected' : ''} ${u.ent.dead ? 'dead' : ''}" data-sel="${u.id}" title="클릭: 선택 · 파티 창">
        <img src="${artUrl(portrait(g.spriteOf(u)))}" alt="">
        <div class="pinfo"><div class="pname"><b>Lv.${ch.level}</b> ${esc(ch.name)} <span style="color:${cls.color}">${cls.name}</span></div>
          <div class="pbar hp"><i style="width:${Math.max(0, ch.hp / ch.maxHp) * 100}%"></i></div>
          <div class="pbar mp"><i style="width:${Math.max(0, ch.mp / ch.maxMp) * 100}%"></i></div></div>
      </div>`;
    }).join('');
    if (html !== this.lastPartyHtml) { this.el.party.innerHTML = html; this.lastPartyHtml = html; }
  }

  partyHtml() {
    const g = this.game, u = g.selUnit(), ch = u.char, cls = CLASSES[ch.classId];
    const tabs = g.units().map((x) => `<button class="ptab ${x === u ? 'selected' : ''}" data-sel="${x.id}">
      <img src="${artUrl(portrait(g.spriteOf(x)))}" alt="">${esc(x.char.name)}${x.isLeader ? ' ★' : ''}</button>`).join('');
    const learned = new Set(learnedSkills(ch));
    const slots = [];
    for (let i = 0; i < SKILL_SLOTS; i++) {
      const sl = ch.skillSlots?.[i];
      const sk = sl && SKILLS[sl.id];
      slots.push(`<div class="pslot ${sk ? '' : 'empty'}" data-pslot="${i}" ${sk ? `draggable="true" data-drag='${JSON.stringify({ type: 'pslot', from: i })}'` : ''} title="${sk ? '끌어서 순서 바꾸기 · 우클릭: 비우기' : '아래 스킬을 끌어다 놓으세요'}">
        <span class="num">${i + 1}</span>${sk ? skillIcon(sk) : '<span class="icon blank"></span>'}
        <div class="pslot-info"><b>${sk ? esc(sk.name) : '비어 있음'}</b>
        ${sk ? `<select data-slotcond="${i}">${Object.entries(CONDITIONS).map(([k, v]) => `<option value="${k}" ${sl.cond === k ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}</div>
      </div>`);
    }
    const list = [...cls.skills].sort((a, b) => SKILLS[a].level - SKILLS[b].level).map((id) => {
      const sk = SKILLS[id], ok = learned.has(id);
      return `<div class="pskill ${ok ? '' : 'locked'}" ${ok ? `draggable="true" data-drag='${JSON.stringify({ type: 'pskill', id })}'` : ''} title="${esc(sk.name)} (Lv.${sk.level} · MP ${sk.mp} · ${sk.cooldown}초)\n${esc(sk.desc)}">
        ${skillIcon(sk)}<small>${esc(sk.name)}<br>Lv.${sk.level}</small></div>`;
    }).join('');
    const d = g.derived(u);
    return `<div class="ptabs">${tabs}</div>
      <div class="pdetail">
        <img class="portrait" src="${artUrl(portrait(g.spriteOf(u)))}" alt="">
        <div><b>${esc(ch.name)}</b> <span style="color:${cls.color}">${cls.name}</span> · Lv.${ch.level} ${u.isLeader ? '<small>(대표 캐릭터)</small>' : '<small>(용병)</small>'}<br>
          HP ${Math.ceil(ch.hp)} / ${ch.maxHp} · MP ${Math.floor(ch.mp)} / ${ch.maxMp} · 공격 ${d.attack} · 방어 ${d.defense}<br>
          <button data-open="char">캐릭터 정보</button> <button data-open="inv">장비 바꾸기</button>
          ${u.isLeader ? '' : `<button class="danger" data-dismiss="${u.id}">내보내기</button>`}</div>
      </div>
      <h4>스킬 칸 <small>앞 칸부터, 조건이 맞고 재사용이 끝난 스킬을 자동으로 씁니다</small></h4>
      <div class="pslots">${slots.join('')}</div>
      <h4>스킬 <small>끌어서 위 칸에 놓기</small></h4>
      <div class="pskills">${list}</div>
      <small class="hint">자동사냥 '일반공격'일 때는 스킬을 쓰지 않습니다. 파티 버프(투지 · 축복 · 숲의 축복 · 전투 깃발)는 파티 전원에게 걸리고, 치유는 HP가 가장 낮은 파티원에게 갑니다.</small>`;
  }

  mercHtml() {
    const g = this.game;
    const offers = g.mercOffers();
    const full = g.party.length >= MAX_MERCS;
    const rows = offers.map((o) => {
      const cls = CLASSES[o.classId];
      return `<div class="merc-row">
        <img class="portrait" src="${artUrl(portrait(o.look))}" alt="">
        <div class="info"><b>${esc(o.name)}</b> <span style="color:${cls.color}">${cls.name}</span> Lv.${o.level}<br><small>${esc(cls.role)} · HP ${cls.growth.hp[0]}~${cls.growth.hp[1]}/레벨</small></div>
        <span class="price">${o.price.toLocaleString()}G</span>
        <button data-hire="${o.offerId}" ${full || g.char.gold < o.price ? 'disabled' : ''}>고용</button>
      </div>`;
    }).join('') || '<p>지금은 고용할 용병이 없습니다. 잠시 뒤 다시 오세요.</p>';
    return `<p>함께 싸울 용병을 찾나? 실력은 내가 보증하지. (파티 ${g.party.length} / ${MAX_MERCS}명)</p>
      <div class="gold">보유 골드 ${g.char.gold.toLocaleString()}</div>${rows}
      <small class="hint">용병 목록은 1시간마다 바뀝니다. 고용한 용병은 따로 레벨업하며, 성장 주사위에 따라 축캐 · 저주캐가 될 수 있습니다.</small>`;
  }

  charHtml() {
    const g = this.game, su = g.selUnit(), ch = su.char, cls = CLASSES[ch.classId];
    const d = g.derived(su);
    const grade = S.luckGrade(ch);
    const sign = (v) => (v >= 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);
    const stats = STAT_KEYS.map((k) => `
      <div class="stat-row ${k === cls.primaryStat ? 'primary' : ''}" title="${esc(STAT_DESCRIPTIONS[k])}">
        <span class="sn">${STAT_NAMES[k]}${k === cls.primaryStat ? ' ★' : ''}</span>
        <span class="sv">${ch.stats[k]}</span>
        <button data-stat="${k}" ${ch.bonusPoints > 0 && ch.stats[k] < STAT_CAP ? '' : 'disabled'}>+</button>
      </div>`).join('');
    const hist = ch.growth.history.slice(-5).reverse().map((h) =>
      `<li>Lv.${h.level}: HP 주사위 ${h.hpRoll}${h.conBonus ? ` (+체력 ${h.conBonus})` : ''}, MP 주사위 ${h.mpRoll}</li>`).join('') || '<li>아직 레벨업 기록이 없습니다.</li>';
    const ap = d.attackParts;
    return `
      <div class="char-head">
        <div><b>${esc(ch.name)}</b> <span style="color:${cls.color}">${cls.name}</span> · Lv.${ch.level}</div>
        <div class="gold">${su.isLeader ? `골드 ${g.char.gold.toLocaleString()}` : '용병'}</div>
      </div>
      <div class="grade-box g-${grade.id}">
        <div class="grade-title">${grade.label}</div>
        <div>HP 성장: 주사위 합 ${grade.hp.sum} / 평균 ${grade.hp.expected.toFixed(1)} (${sign(grade.hp.diff)})</div>
        <div>MP 성장: 주사위 합 ${grade.mp.sum} / 평균 ${grade.mp.expected.toFixed(1)} (${sign(grade.mp.diff)})</div>
        <small>레벨업 ${grade.n}회 기준 · 행운 지수 ${grade.z.toFixed(2)}</small>
      </div>
      <h4>스탯 <small>보너스 포인트: <b>${ch.bonusPoints}</b> · 다음 획득 Lv.${S.nextBonusLevel(ch.level)}</small></h4>
      <div class="stats">${stats}</div>
      <h4>전투 능력</h4>
      <table class="derived">
        <tr><td>HP / MP</td><td>${Math.ceil(ch.hp)} / ${ch.maxHp} · ${Math.floor(ch.mp)} / ${ch.maxMp}</td></tr>
        <tr><td>일반공격</td><td>${d.attack} <small>(기본 ${ap.base} + 레벨 ${ap.level} + 무기 ${ap.weapon} + 버프 ${ap.buff})</small></td></tr>
        <tr><td>공격 명중</td><td>${pct(d.hit)} <small>(${STAT_NAMES[cls.primaryStat]} 기준, 동레벨 상대)</small></td></tr>
        <tr><td>마법 명중</td><td>${pct(d.magicHit)} <small>(지능 기준)</small></td></tr>
        <tr><td>방어력</td><td>${d.defense}</td></tr>
        <tr><td>이동 속도</td><td>${d.speed.toFixed(1)} 칸/초</td></tr>
        <tr><td>레벨업 HP</td><td>${cls.growth.hp[0]}~${cls.growth.hp[1]} + 체력 보너스 ${d.conHpBonus}</td></tr>
        <tr><td>레벨업 MP</td><td>${cls.growth.mp[0]}~${cls.growth.mp[1]}</td></tr>
      </table>
      <h4>최근 레벨업</h4>
      <ul class="history">${hist}</ul>`;
  }

  invHtml() {
    const g = this.game, ch = g.char, su = g.selUnit();
    const shopOpen = !!(this.game.openNpc && SHOPS[this.game.openNpc.kind]);
    const eq = (slot, label) => {
      const id = su.char.equipment[slot];
      return `<div class="equip-slot">${label}: ${id ? `${itemIcon(id)} ${esc(ITEMS[id].name)} <button data-unequip="${slot}">해제</button>` : '<i>없음</i>'}</div>`;
    };
    const cells = [];
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const e = ch.inventory[i];
      if (!e) { cells.push('<div class="cell empty"></div>'); continue; }
      const it = ITEMS[e.id];
      const usable = it.type === 'consumable' || canEquip(e.id, su.char.classId);
      const tip = `${it.name}\n${it.desc}${it.type !== 'consumable' && !usable ? '\n(장착 불가)' : ''}\n더블클릭: ${it.type === 'consumable' ? '사용' : '장착'}${shopOpen ? `\n판매가 ${sellPrice(e.id)} 골드` : ''}`;
      cells.push(`<div class="cell ${usable ? '' : 'nouse'}" draggable="true" data-inv="${i}" data-drag='${JSON.stringify({ type: 'item', id: e.id })}' title="${esc(tip)}">
        ${itemIcon(e.id)}${e.qty > 1 ? `<span class="qty">${e.qty}</span>` : ''}
        ${shopOpen && sellPrice(e.id) > 0 ? `<button class="sell" data-sell="${i}">판매</button>` : ''}</div>`);
    }
    return `
      <div class="gold">골드 ${ch.gold.toLocaleString()}</div>
      <div class="equip-who">장비: <b>${esc(su.char.name)}</b> <small>(${CLASSES[su.char.classId].name} · 파티 창에서 다른 파티원 선택)</small></div>
      ${eq('weapon', '무기')}${eq('armor', '갑옷')}
      <div class="grid">${cells.join('')}</div>
      <small class="hint">더블클릭: 사용/장착 · 단축칸으로 끌어다 놓기${shopOpen ? ' · 판매 버튼으로 상점에 판매' : ''}</small>`;
  }

  skillsHtml() {
    const g = this.game, ch = g.char, cls = CLASSES[ch.classId];
    const atk = g.derived().attack;
    const rows = [...cls.skills].sort((a, b) => SKILLS[a].level - SKILLS[b].level).map((id) => {
      const sk = SKILLS[id];
      const learned = ch.level >= sk.level;
      let formula = '';
      if (sk.kind === 'damage' || sk.kind === 'aoe') {
        const stat = ch.stats[sk.stat];
        const est = stat * atk * sk.coef;
        formula = `${STAT_NAMES[sk.stat]}(${stat}) × 일반공격(${atk}) × ${sk.coef} ≈ <b>${Math.round(est)}</b>${sk.hits ? ` × ${sk.hits}회` : ''}`;
      } else if (sk.kind === 'heal') {
        formula = `회복량 ≈ <b>${Math.round(ch.stats.int * sk.healIntCoef + ch.level * sk.healPerLevel)}</b>`;
      }
      return `<div class="skill-row ${learned ? '' : 'locked'}" ${learned ? `draggable="true" data-drag='${JSON.stringify({ type: 'skill', id })}'` : ''}>
        ${skillIcon(sk)}
        <div class="info">
          <div><b>${sk.name}</b> <small>Lv.${sk.level} · MP ${sk.mp} · 재사용 ${sk.cooldown}초</small></div>
          <div class="desc">${esc(sk.desc)}</div>
          ${formula ? `<div class="formula">${formula}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    return `${rows}<small class="hint">배운 스킬을 화면 아래 단축칸(F5~F12)으로 끌어다 놓으세요.</small>`;
  }

  npcHtml() {
    const g = this.game, npc = g.openNpc;
    if (!npc) return '';
    if (npc.kind === 'healer') {
      return `<p>여행은 힘들죠? 제가 상처를 치료해 드릴게요. 초보자에게는 무료랍니다.</p>
        <button class="wide" data-npc="heal">HP/MP 모두 회복</button>`;
    }
    if (npc.kind === 'guide') {
      const cls = CLASSES[g.char.classId];
      const def = g.world.def;
      return `<p>${esc(def.name)}에 온 걸 환영해요, ${esc(g.char.name)}님!</p>
        <ul class="guide">
          <li><b>이동</b>: 땅을 좌클릭하거나 누른 채로 마우스를 움직이세요. 맵 끝의 빛나는 출구로 옆 맵에 갈 수 있어요.</li>
          <li><b>공격</b>: 몬스터를 좌클릭하면 다가가서 계속 공격해요.</li>
          <li><b>단축칸</b>: F5~F12를 누르거나, 휠로 칸을 고른 뒤 휠 클릭으로 사용해요.</li>
          <li><b>성장</b>: ${cls.name}은(는) 레벨업마다 HP ${cls.growth.hp[0]}~${cls.growth.hp[1]}, MP ${cls.growth.mp[0]}~${cls.growth.mp[1]}이 올라요. 운이 좋으면 '축캐', 나쁘면 '저주캐'가 되죠.</li>
          <li><b>보너스 포인트</b>: 10레벨마다 1점, 50레벨 이후엔 레벨업마다 1점을 받아요.</li>
          <li><b>이 마을 출구</b>: ${exitsText(def)}</li>
          <li><b>이동술사</b>: 골드를 내면 다른 마을 · 필드, 던전 입구까지 데려다줘요.</li>
          <li><b>파티</b>: 용병단장에게 골드를 내고 용병을 최대 3명 고용할 수 있어요. 파티원은 나를 따라다니며 근처 적과 알아서 싸워요. 몬스터를 클릭하면 모두 그 대상을 집중 공격해요.</li>
          <li><b>스킬 배치</b>: 파티 창(P)에서 파티원마다 스킬 칸 4개에 스킬을 넣고 순서와 조건을 정해요. 앞 칸부터 자동으로 써요.</li>
          <li><b>자동사냥</b>: 오른쪽 아래 버튼(A)으로 끔 → 일반공격만 → 스킬까지 사용 순서로 바뀌어요. 켜면 파티가 스스로 적을 찾아다녀요.</li>
          <li><b>던전</b>: 7곳, 각각 지하 7층까지 있고 마지막 층에 보스가 있어요. 입구는 필드 안의 동굴이에요.</li>
          <li><b>필드 보스</b>: 필드마다 정해진 시각에만 나타나서 ${BOSS_SCHEDULE.stay}분 동안 머물러요. 이동술사에게 시간표가 있어요.</li>
          <li>마을은 안전지대라 몬스터가 들어오지 못해요.</li>
        </ul>`;
    }
    if (npc.kind === 'teleporter') return this.teleporterHtml();
    if (npc.kind === 'mercenary') return this.mercHtml();
    const shop = SHOPS[npc.kind];
    if (!shop) return '';
    const rows = shop.map((id) => {
      const it = ITEMS[id];
      const usable = it.type === 'consumable' || canEquip(id, g.char.classId);
      const afford = g.char.gold >= it.price;
      return `<div class="shop-row ${usable ? '' : 'nouse'}">
        ${itemIcon(id)}
        <div class="info"><b>${esc(it.name)}</b> <small>${esc(it.desc)}</small></div>
        <span class="price">${it.price}G</span>
        <button data-buy="${id}" data-qty="1" ${afford ? '' : 'disabled'}>구매</button>
        ${it.type === 'consumable' ? `<button data-buy="${id}" data-qty="10" ${g.char.gold >= it.price * 10 ? '' : 'disabled'}>×10</button>` : ''}
      </div>`;
    }).join('');
    return `<div class="gold">보유 골드 ${g.char.gold.toLocaleString()}</div>${rows}
      <small class="hint">판매는 인벤토리 창의 판매 버튼으로 합니다. (구입가의 50%)</small>`;
  }

  teleporterHtml() {
    const g = this.game;
    const now = g.now();
    const dests = teleportDestinations();
    const row = (d) => {
      const here = d.kind === 'village' && d.map === g.world.id;
      const afford = g.char.gold >= d.cost;
      let extra = '';
      if (d.kind === 'field') {
        const f = MAPS[d.map];
        const w = bossWindow(f.fieldBoss.offset, now);
        const boss = MONSTERS[f.fieldBoss.type].name;
        const killed = g.char.fieldBossKills[f.id] === w.start;
        extra = w.active && !killed
          ? `<small class="boss-on">보스 ${esc(boss)} 출현 중 (~${formatClock(w.end)})</small>`
          : `<small>보스 ${esc(boss)} ${formatClock(w.next)}</small>`;
      }
      if (d.kind === 'dungeon') extra = `<small>${esc(d.where)} 안 · 7층 보스</small>`;
      return `<div class="tp-row ${here ? 'here' : ''}">
        <div class="info"><b>${esc(d.name)}</b> <small>${d.levelText || `Lv.${d.level}`}</small>${extra ? `<br>${extra}` : ''}</div>
        <span class="price">${d.cost}G</span>
        <button data-tp="${d.id}" ${here || !afford ? 'disabled' : ''}>${here ? '현재 위치' : '이동'}</button>
      </div>`;
    };
    const group = (kind, title) => `<h4>${title}</h4>${dests.filter((d) => d.kind === kind).map(row).join('')}`;
    return `<p>어디로 보내드릴까요? 던전은 입구 앞까지만 보내드려요.</p>
      <div class="gold">보유 골드 ${g.char.gold.toLocaleString()}</div>
      ${group('village', '마을')}${group('field', `필드 <small>(필드 보스는 매시 정해진 분에 ${BOSS_SCHEDULE.stay}분간 출현)</small>`)}${group('dungeon', '던전 입구')}`;
  }

  bindPanelEvents() {
    const g = this.game;
    this.root.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.stat) g.allocateStat(t.dataset.stat);
      else if (t.dataset.unequip) g.unequip(t.dataset.unequip);
      else if (t.dataset.sell) g.sell(Number(t.dataset.sell));
      else if (t.dataset.buy) g.buy(t.dataset.buy, Number(t.dataset.qty));
      else if (t.dataset.npc === 'heal') g.healAtHealer();
      else if (t.dataset.tp) g.teleport(t.dataset.tp);
      else if (t.dataset.hire) g.hireMerc(t.dataset.hire);
      else if (t.dataset.dismiss) { if (confirm('이 용병을 파티에서 내보낼까요? (장비는 인벤토리로 돌아옵니다)')) g.dismissMerc(t.dataset.dismiss); }
      else if (t.dataset.sel) this.selectUnit(t.dataset.sel);
      else if (t.dataset.open) this.openPanel(t.dataset.open);
      else if (t.hasAttribute('data-auto')) g.cycleAutoMode();
    });
    this.root.addEventListener('click', (e) => {
      const f = e.target.closest('.pframe[data-sel]');
      if (f) { this.selectUnit(f.dataset.sel); if (!this.open.has('party')) this.openPanel('party'); }
      if (e.target.closest('.hud-portrait')) this.selectUnit('player');
    });
    this.root.addEventListener('change', (e) => {
      const sel = e.target.closest('select[data-slotcond]');
      if (sel) g.setSlotCond(g.selectedId, Number(sel.dataset.slotcond), sel.value);
    });
    // 파티 스킬 칸: 끌어다 놓기 / 순서 바꾸기 / 우클릭 비우기
    this.root.addEventListener('dragover', (e) => { if (e.target.closest('.pslot')) e.preventDefault(); });
    this.root.addEventListener('drop', (e) => {
      const slot = e.target.closest('.pslot');
      if (!slot) return;
      e.preventDefault();
      this.dragging = false;
      let data;
      try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
      const i = Number(slot.dataset.pslot);
      if (data.type === 'pslot') g.swapSkillSlot(g.selectedId, data.from, i);
      else if (data.type === 'pskill' || data.type === 'skill') g.setSkillSlot(g.selectedId, i, { id: data.id });
    });
    this.root.addEventListener('contextmenu', (e) => {
      const slot = e.target.closest('.pslot');
      if (slot) { e.preventDefault(); g.setSkillSlot(g.selectedId, Number(slot.dataset.pslot), null); }
    });
    this.root.addEventListener('dblclick', (e) => {
      const cell = e.target.closest('[data-inv]');
      if (!cell) return;
      const entry = g.char.inventory[Number(cell.dataset.inv)];
      if (entry) g.useItem(entry.id);
    });
    this.root.addEventListener('dragstart', (e) => {
      const src = e.target.closest?.('[data-drag]');
      if (!src) return;
      this.dragging = true;
      e.dataTransfer.setData('text/plain', src.dataset.drag);
    });
    this.root.addEventListener('dragend', () => { this.dragging = false; });
  }
}
