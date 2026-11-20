// 화면 흐름: 로그인 → 캐릭터 선택 → (캐릭터 생성) → 게임
import * as Store from './systems/storage.js';
import {
  CLASSES, CLASS_ORDER, STAT_KEYS, STAT_NAMES, STAT_DESCRIPTIONS, CREATION, MAX_CHARACTERS, heroKey, GENDER_NAMES,
} from './data/classes.js';
import { url as artUrl, portrait } from './game/art.js';
import { SKILLS } from './data/skills.js';
import * as S from './systems/stats.js';
import { Game } from './game/game.js';
import { ITEMS } from './data/items.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
  user: null,
  selectedId: null,
  game: null,
  create: { classId: 'knight', stats: null, gender: 'f' },
};

// 로그인 화면: 시작 직업 4종 초상화 (「환생 루프」 초상화 그림)
function loginRosterMarkup() {
  return CLASS_ORDER.map((id) => {
    const c = CLASSES[id];
    return `<figure class="login-class"><img class="portrait" src="${artUrl(portrait(heroKey(id, c.defaultGender)))}" alt=""><figcaption>${esc(c.name)}</figcaption></figure>`;
  }).join('');
}

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

// ---------------------------------------------------------------- 로그인
function initLogin() {
  const roster = $('#login-roster');
  roster.innerHTML = loginRosterMarkup();
  const form = $('#login-form');
  const msg = $('#login-msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = e.submitter?.dataset.action || 'login';
    const { username, password } = Object.fromEntries(new FormData(form));
    msg.textContent = '';
    try {
      if (action === 'register') {
        await Store.register(username, password);
        msg.textContent = '가입 완료! 로그인되었습니다.';
      }
      state.user = await Store.login(username, password);
      form.reset();
      openSelect();
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}

// ---------------------------------------------------------------- 캐릭터 선택
function openSelect() {
  show('screen-select');
  $('#screen-select .user').textContent = `계정: ${state.user}`;
  renderSlots();
}

function renderSlots() {
  const chars = Store.listCharacters(state.user);
  if (!chars.some((c) => c.id === state.selectedId)) state.selectedId = chars[0]?.id ?? null;
  const html = [];
  for (let i = 0; i < MAX_CHARACTERS; i++) {
    const c = chars[i];
    if (!c) { html.push('<button class="slot-card empty" data-new>+ 새 캐릭터</button>'); continue; }
    const cls = CLASSES[c.classId];
    const grade = S.luckGrade(c);
    html.push(`<button class="slot-card ${c.id === state.selectedId ? 'selected' : ''}" data-id="${c.id}">
      <img class="portrait" src="${artUrl(portrait(heroKey(c.classId, c.gender)))}" alt="">
      <div class="slot-name">${esc(c.name)}</div>
      <div class="slot-class" style="color:${cls.color}">${cls.name}</div>
      <div>Lv.${c.level}</div>
      <div class="grade g-${grade.id}">${grade.short}</div>
      <small>힘 ${c.stats.str} · 민 ${c.stats.dex} · 지 ${c.stats.int} · 체 ${c.stats.con}</small>
    </button>`);
  }
  $('#char-slots').innerHTML = html.join('');
  $('#btn-start').disabled = !state.selectedId;
  $('#btn-delete').disabled = !state.selectedId;
}

function initSelect() {
  $('#char-slots').addEventListener('click', (e) => {
    const card = e.target.closest('.slot-card');
    if (!card) return;
    if (card.hasAttribute('data-new')) { openCreate(); return; }
    state.selectedId = card.dataset.id;
    renderSlots();
  });
  $('#char-slots').addEventListener('dblclick', (e) => {
    const card = e.target.closest('.slot-card[data-id]');
    if (card) startGame(card.dataset.id);
  });
  $('#btn-start').addEventListener('click', () => state.selectedId && startGame(state.selectedId));
  $('#btn-delete').addEventListener('click', () => {
    const c = Store.listCharacters(state.user).find((x) => x.id === state.selectedId);
    if (!c) return;
    const typed = prompt(`정말 삭제하려면 캐릭터 이름 "${c.name}"을(를) 입력하세요.`);
    if (typed === c.name) { Store.deleteCharacter(state.user, c.id); state.selectedId = null; renderSlots(); }
  });
  $('#btn-logout').addEventListener('click', () => { Store.logout(); state.user = null; show('screen-login'); });
}

// ---------------------------------------------------------------- 캐릭터 생성
function openCreate() {
  if (Store.listCharacters(state.user).length >= MAX_CHARACTERS) return;
  show('screen-create');
  $('#char-name').value = '';
  $('#create-msg').textContent = '';
  selectClass('knight');
}

function selectClass(classId) {
  state.create.classId = classId;
  state.create.gender = CLASSES[classId].defaultGender;
  state.create.stats = { ...CLASSES[classId].baseStats };
  renderCreate();
}

function renderCreate() {
  const { classId, stats } = state.create;
  const cls = CLASSES[classId];

  $('#class-cards').innerHTML = CLASS_ORDER.map((id) => {
    const c = CLASSES[id];
    const g = id === classId ? state.create.gender : c.defaultGender;
    return `<button class="class-card ${id === classId ? 'selected' : ''}" data-class="${id}" style="--c:${c.color}">
      <img class="portrait" src="${artUrl(portrait(heroKey(id, g)))}" alt=""><b>${c.name}</b><small>${c.role}</small></button>`;
  }).join('') + '<div class="class-card disabled"><div class="avatar"></div><b>???</b><small>추후 출시</small></div>';

  const firstSkill = SKILLS[S.firstSkillId(classId)];
  $('#class-info').innerHTML = `
    <div class="gender-pick">${['m', 'f'].map((g) => `<button data-gender="${g}" class="${state.create.gender === g ? 'selected' : ''}">
      <img class="portrait" src="${artUrl(portrait(heroKey(classId, g)))}" alt=""><br>${GENDER_NAMES[g]}</button>`).join('')}</div>
    <p>${cls.description}</p>
    <table>
      <tr><td>주스탯</td><td>${STAT_NAMES[cls.primaryStat]}</td></tr>
      <tr><td>시작 HP / MP</td><td>${cls.start.hp} / ${cls.start.mp}</td></tr>
      <tr><td>레벨업 HP</td><td>${cls.growth.hp[0]} ~ ${cls.growth.hp[1]} (+ 체력 보너스)</td></tr>
      <tr><td>레벨업 MP</td><td>${cls.growth.mp[0]} ~ ${cls.growth.mp[1]}</td></tr>
      <tr><td>일반공격</td><td>${cls.baseAttack} (${cls.attackType === 'ranged' ? '원거리' : '근접'})</td></tr>
      <tr><td>시작 스킬</td><td>${firstSkill.name} — ${firstSkill.desc}</td></tr>
    </table>`;

  const spent = S.allocationSpent(classId, stats);
  const left = CREATION.bonusPoints - spent;
  $('#points-left').textContent = `남은 포인트: ${left} / ${CREATION.bonusPoints}`;
  $('#stat-alloc').innerHTML = STAT_KEYS.map((k) => `
    <div class="alloc-row ${k === cls.primaryStat ? 'primary' : ''}">
      <span class="sn">${STAT_NAMES[k]}${k === cls.primaryStat ? ' ★' : ''}</span>
      <button data-dec="${k}" ${stats[k] <= cls.baseStats[k] ? 'disabled' : ''}>−</button>
      <span class="sv">${stats[k]}</span>
      <button data-inc="${k}" ${left <= 0 || stats[k] >= CREATION.maxStat ? 'disabled' : ''}>+</button>
      <small>${STAT_DESCRIPTIONS[k]}</small>
    </div>`).join('');

  const preview = { classId, level: 1, stats, equipment: cls.startEquipment };
  const d = S.derivedStats(preview, []);
  const skStat = stats[firstSkill.stat];
  $('#create-preview').innerHTML = `
    <div>공격 명중 <b>${Math.round(d.hit * 100)}%</b> · 마법 명중 <b>${Math.round(d.magicHit * 100)}%</b> · 방어력 <b>${d.defense}</b></div>
    <div>레벨업 HP: ${cls.growth.hp[0]}~${cls.growth.hp[1]} + 체력 보너스 <b>${d.conHpBonus}</b></div>
    <div>${firstSkill.name} 예상 피해: ${STAT_NAMES[firstSkill.stat]} ${skStat} × 일반공격 ${d.attack} × ${firstSkill.coef} ≈ <b>${Math.round(skStat * d.attack * firstSkill.coef)}</b></div>`;
  $('#btn-create').disabled = left !== 0;
}

function initCreate() {
  $('#class-cards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-class]');
    if (b) selectClass(b.dataset.class);
  });
  $('#class-info').addEventListener('click', (e) => {
    const b = e.target.closest('[data-gender]');
    if (b) { state.create.gender = b.dataset.gender; renderCreate(); }
  });
  $('#stat-alloc').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const st = state.create.stats;
    if (b.dataset.inc) st[b.dataset.inc] += 1;
    if (b.dataset.dec) st[b.dataset.dec] -= 1;
    renderCreate();
  });
  $('#btn-create-back').addEventListener('click', openSelect);
  $('#btn-create').addEventListener('click', () => {
    const msg = $('#create-msg');
    const name = $('#char-name').value.trim();
    if (!/^[A-Za-z0-9가-힣]{2,12}$/.test(name)) { msg.textContent = '이름은 2~12자의 한글/영문/숫자만 가능합니다.'; return; }
    try {
      const char = S.createCharacter({ id: Store.newId(), name, ...state.create });
      Store.addCharacter(state.user, char);
      state.selectedId = char.id;
      openSelect();
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}

// ---------------------------------------------------------------- 게임
function startGame(id) {
  const char = Store.listCharacters(state.user).find((c) => c.id === id);
  if (!char) return;
  show('screen-game');
  const user = state.user;
  state.game = new Game({
    canvas: $('#game-canvas'),
    hudRoot: $('#hud'),
    character: char,
    onSave: (c) => Store.saveCharacter(user, c),
    onExit: (to) => {
      state.game = null;
      if (to === 'logout') { Store.logout(); state.user = null; show('screen-login'); }
      else openSelect();
    },
  });
  state.game.start();
  if (new URLSearchParams(location.search).has('debug')) window.game = state.game;
}

window.addEventListener('beforeunload', () => state.game?.save());

initLogin();
initSelect();
initCreate();
state.user = Store.currentSession();
if (state.user) openSelect(); else show('screen-login');
