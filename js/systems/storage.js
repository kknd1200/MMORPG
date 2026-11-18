// 계정 / 캐릭터 저장 (브라우저 localStorage).
// 서버가 붙기 전까지의 로컬 프로토타입용입니다. 실제 서비스에서는 서버 인증으로 교체하세요.
import { MAX_CHARACTERS } from '../data/classes.js';

const KEY = 'dawnland.v1';
const SESSION_KEY = 'dawnland.session';

function load() {
  try {
    const db = JSON.parse(localStorage.getItem(KEY));
    if (db && db.accounts) return db;
  } catch { /* 손상된 데이터는 새로 시작 */ }
  return { accounts: {} };
}

function persist(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

async function hashPassword(username, password) {
  const text = `dawnland:${username}:${password}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // 비보안 컨텍스트(http://내부IP) 대비 단순 해시
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `fnv-${(h >>> 0).toString(16)}`;
}

export function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export async function register(username, password) {
  username = username.trim();
  if (!/^[A-Za-z0-9가-힣_]{3,12}$/.test(username)) {
    throw new Error('아이디는 3~12자의 한글/영문/숫자/_ 만 가능합니다.');
  }
  if (password.length < 4) throw new Error('비밀번호는 4자 이상이어야 합니다.');
  const db = load();
  if (db.accounts[username]) throw new Error('이미 존재하는 아이디입니다.');
  db.accounts[username] = { pw: await hashPassword(username, password), characters: [] };
  persist(db);
  return username;
}

export async function login(username, password) {
  username = username.trim();
  const acc = load().accounts[username];
  if (!acc || acc.pw !== (await hashPassword(username, password))) {
    throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
  }
  sessionStorage.setItem(SESSION_KEY, username);
  return username;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function currentSession() {
  const u = sessionStorage.getItem(SESSION_KEY);
  return u && load().accounts[u] ? u : null;
}

export function listCharacters(username) {
  return load().accounts[username]?.characters ?? [];
}

export function isNameTaken(name) {
  const lower = name.toLowerCase();
  return Object.values(load().accounts).some((a) => a.characters.some((c) => c.name.toLowerCase() === lower));
}

export function addCharacter(username, char) {
  const db = load();
  const acc = db.accounts[username];
  if (!acc) throw new Error('계정을 찾을 수 없습니다.');
  if (acc.characters.length >= MAX_CHARACTERS) throw new Error(`캐릭터는 최대 ${MAX_CHARACTERS}개까지 만들 수 있습니다.`);
  if (isNameTaken(char.name)) throw new Error('이미 사용 중인 캐릭터 이름입니다.');
  acc.characters.push(char);
  persist(db);
}

export function saveCharacter(username, char) {
  const db = load();
  const acc = db.accounts[username];
  if (!acc) return;
  const i = acc.characters.findIndex((c) => c.id === char.id);
  const copy = JSON.parse(JSON.stringify(char));
  if (i >= 0) acc.characters[i] = copy;
  else acc.characters.push(copy);
  persist(db);
}

export function deleteCharacter(username, id) {
  const db = load();
  const acc = db.accounts[username];
  if (!acc) return;
  acc.characters = acc.characters.filter((c) => c.id !== id);
  persist(db);
}
