// 예전 프로젝트 「환생 루프 v85」 의 몬스터 데이터와 스프라이트 시트를 가져옵니다.
//
//   node tools/import-rebirth.mjs <압축을 푼 rebirth-loop-v85 폴더>
//
// 결과
//   js/data/rebirth-roster.js   몬스터 300종 원본 정보 (이름 · 지역 · 등급 · 공격방식 · 스킬 · 패시브 · 그림 위치)
//   assets/monsters/<지역>.webp 지역별 스프라이트 시트 (384px 칸, 가로 8포즈 × 세로 6마리)
//
// 원본 파일은 실행하지 않고 텍스트에서 JSON 부분만 읽습니다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src || !fs.existsSync(path.join(src, 'index.html'))) {
  console.error('사용법: node tools/import-rebirth.mjs <rebirth-loop-v85 폴더>');
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1) 몬스터 목록: index.html 안의 `var MONSTER_ROSTER = [...];` 한 줄
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const line = html.split('\n').find((l) => /^\s*var MONSTER_ROSTER\s*=\s*\[/.test(l));
if (!line) throw new Error('MONSTER_ROSTER 를 찾지 못했습니다');
const roster = JSON.parse(line.slice(line.indexOf('=') + 1).trim().replace(/;\s*$/, ''));

// 2) 그림 기준점: monster-animations.js 의 `window.MONSTER_ANIMATIONS={...};`
const animSrc = fs.readFileSync(path.join(src, 'monster-animations.js'), 'utf8');
const animStart = animSrc.indexOf('window.MONSTER_ANIMATIONS=');
const animJson = animSrc.slice(animSrc.indexOf('{', animStart)).trim().replace(/;\s*$/, '');
const anims = JSON.parse(animJson);

// 3) 다시 그린 시트(v58)를 쓰는 지역: monster-motion.js 의 refinedGroups
const motionSrc = fs.readFileSync(path.join(src, 'monster-motion.js'), 'utf8');
const refined = JSON.parse(/refinedGroups\s*=\s*(\{[^}]*\})/.exec(motionSrc)[1]);

const outDir = path.join(root, 'assets', 'monsters');
fs.mkdirSync(outDir, { recursive: true });

const out = [];
const groups = new Set();
for (const m of roster) {
  const a = anims[m.id];
  if (!a) throw new Error(`${m.id}: 그림 정보 없음`);
  const [, dungeon, region, slot] = /^([A-Z]+)-(\d+)-(\d+)$/.exec(m.id);
  const group = `${dungeon.toLowerCase()}-${region}`;
  groups.add(group);
  // 포즈 칸: 01~04 = 공격, 05~08 = 스킬, 대기 = 04
  const col = (p) => parseInt(/\/(\d+)\.webp$/.exec(p)[1], 10) - 1;
  const ok = col(a.idle) === 3 && a.attack.frames.every((f, i) => col(f) === i) && a.skill.frames.every((f, i) => col(f) === i + 4);
  if (!ok || a.cellSize !== 384) throw new Error(`${m.id}: 예상과 다른 시트 배치`);
  out.push({
    id: m.id, name: m.name, dungeon: m.dungeon, tier: m.tier, theme: m.theme,
    rank: m.rank, style: m.style, color: m.color, interval: m.interval,
    family: m.motion?.family || 'biped', scale: m.scale,
    basic: m.basic,
    active: m.active.map((s) => ({ name: s.name, effect: s.effect, mult: s.mult, pulses: s.pulses || 1 })),
    passive: m.passive.map((p) => ({ kind: p.kind, name: p.name, desc: p.desc, value: p.value })),
    art: {
      sheet: group, row: parseInt(slot, 10) - 1,
      centerX: a.centerX, footY: a.footY, bodyHeight: a.bodyHeight, bodyWidth: a.bodyWidth,
      attackMs: a.attack.duration, skillMs: a.skill.duration,
    },
  });
}

for (const g of groups) {
  const from = refined[g] ? path.join(src, 'img', 'monster-sheets-v58', `${g}.webp`) : path.join(src, 'img', 'monster-sheets', `${g}.webp`);
  fs.copyFileSync(from, path.join(outDir, `${g}.webp`));
}

const header = `// 자동 생성 파일 — 직접 고치지 말고 tools/import-rebirth.mjs 로 다시 만드세요.
// 출처: 「환생 루프 v85」 몬스터 ${out.length}종 (던전 5 × 지역 10 × 6마리)
// art: 시트(assets/monsters/<sheet>.webp)의 행 번호와 기준점(384px 칸 안의 발 위치·몸 높이)
`;
const body = 'export const ROSTER = [\n' + out.map((m) => '  ' + JSON.stringify(m)).join(',\n') + ',\n];\n';
fs.writeFileSync(path.join(root, 'js', 'data', 'rebirth-roster.js'), header + body);
console.log(`몬스터 ${out.length}종, 시트 ${groups.size}장 가져옴`);
