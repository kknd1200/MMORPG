// 몬스터 정의
// armor: 물리 피해 감소(값/2), mr: 마법 저항(비율), eva: 회피(명중률 감소)
//
// 선택 필드
//   projectile: 'arrow' | 'bolt'  → 원거리 공격 (attackRange 안에서 멈춰서 쏨, 화살/마탄 표시)
//   magic: true                   → 공격이 방어력을 절반만 적용받음 (마법 공격)
//   social: true                  → 공격받으면 주변의 같은 종류가 함께 덤빔 (무리 생활)
//   boss: { ... }                 → 보스. SPAWN_ZONES 의 boss 항목으로만 등장
//     slam: { interval, windup, radius, mult } → interval 초마다 windup 초 예고 후 radius 범위에 atk×mult 피해
//   palette: 그림에 쓰는 보조 색 (render.js 의 각 shape 가 사용)

export const MONSTERS = {
  // ---------------- 동쪽 초원 (Lv.1~3)
  slime: {
    name: '초록 슬라임', level: 1, hp: 16, atk: 2, armor: 0, mr: 0, eva: 0,
    exp: 6, gold: [1, 4], aggressive: false, speed: 1.6,
    attackRange: 1.0, attackInterval: 1.6, size: 0.4, shape: 'slime', color: '#5cc25c',
    drops: [{ item: 'red_potion', chance: 0.08 }],
  },
  rat: {
    name: '들쥐', level: 2, hp: 22, atk: 3, armor: 0, mr: 0, eva: 0.03,
    exp: 9, gold: [2, 5], aggressive: false, speed: 2.4, social: true,
    attackRange: 1.0, attackInterval: 1.3, size: 0.32, shape: 'rat', color: '#8a6a4a',
    drops: [{ item: 'red_potion', chance: 0.1 }],
  },
  mushroom: {
    name: '독버섯', level: 3, hp: 34, atk: 4, armor: 1, mr: 0.05, eva: 0,
    exp: 14, gold: [3, 7], aggressive: false, speed: 1.2,
    attackRange: 1.0, attackInterval: 1.8, size: 0.38, shape: 'mushroom', color: '#c8463c',
    palette: { cap: '#c8463c', spots: '#f6e9d0', stem: '#eadbb8' },
    drops: [{ item: 'red_potion', chance: 0.12 }, { item: 'blue_potion', chance: 0.06 }],
  },

  // ---------------- 남쪽 숲 (Lv.4~8)
  wolf: {
    name: '회색 늑대', level: 4, hp: 48, atk: 6, armor: 1, mr: 0, eva: 0.05,
    exp: 22, gold: [4, 10], aggressive: true, speed: 3.0, social: true,
    attackRange: 1.1, attackInterval: 1.4, size: 0.45, shape: 'wolf', color: '#8d939b',
    drops: [{ item: 'red_potion', chance: 0.12 }, { item: 'leather_armor', chance: 0.02 }],
  },
  boar: {
    name: '멧돼지', level: 5, hp: 70, atk: 7, armor: 3, mr: 0, eva: 0,
    exp: 28, gold: [5, 12], aggressive: false, speed: 2.8,
    attackRange: 1.1, attackInterval: 1.7, size: 0.5, shape: 'boar', color: '#6e4a32',
    palette: { tusk: '#f2ead8', mane: '#3e2a1c' },
    drops: [{ item: 'red_potion', chance: 0.15 }, { item: 'leather_armor', chance: 0.03 }],
  },
  goblin: {
    name: '고블린', level: 6, hp: 75, atk: 9, armor: 3, mr: 0.05, eva: 0.05,
    exp: 38, gold: [8, 18], aggressive: true, speed: 2.6, social: true,
    attackRange: 1.1, attackInterval: 1.5, size: 0.42, shape: 'goblin', color: '#6b8f3a',
    palette: { cloth: '#7a4a2a', weapon: '#b8b8b8' },
    drops: [
      { item: 'red_potion', chance: 0.15 }, { item: 'blue_potion', chance: 0.1 },
      { item: 'long_sword', chance: 0.01 }, { item: 'long_bow', chance: 0.01 },
      { item: 'oak_staff', chance: 0.01 }, { item: 'iron_mace', chance: 0.01 },
    ],
  },
  goblin_archer: {
    name: '고블린 궁수', level: 7, hp: 58, atk: 8, armor: 2, mr: 0.05, eva: 0.08,
    exp: 42, gold: [8, 18], aggressive: true, speed: 2.4, social: true,
    projectile: 'arrow',
    attackRange: 5.5, attackInterval: 1.9, size: 0.4, shape: 'goblin', color: '#7d9a46',
    palette: { cloth: '#3f5a2a', weapon: 'bow' },
    drops: [
      { item: 'red_potion', chance: 0.15 }, { item: 'return_scroll', chance: 0.05 },
      { item: 'long_bow', chance: 0.02 },
    ],
  },
  spider: {
    name: '숲 거미', level: 7, hp: 66, atk: 10, armor: 2, mr: 0.05, eva: 0.12,
    exp: 46, gold: [6, 14], aggressive: true, speed: 3.2,
    attackRange: 1.1, attackInterval: 1.2, size: 0.42, shape: 'spider', color: '#3a3040',
    palette: { eyes: '#ff4040', mark: '#c83c3c' },
    drops: [{ item: 'orange_potion', chance: 0.06 }, { item: 'blue_potion', chance: 0.1 }],
  },

  // ---------------- 북쪽 폐허 (Lv.8~13)
  skeleton: {
    name: '해골 병사', level: 9, hp: 115, atk: 13, armor: 5, mr: 0.1, eva: 0.05,
    exp: 64, gold: [12, 25], aggressive: true, speed: 2.4,
    attackRange: 1.1, attackInterval: 1.5, size: 0.42, shape: 'skeleton', color: '#e8e4d8',
    drops: [
      { item: 'orange_potion', chance: 0.1 }, { item: 'blue_potion', chance: 0.12 },
      { item: 'chain_mail', chance: 0.015 },
    ],
  },
  wraith: {
    name: '폐허의 망령', level: 11, hp: 95, atk: 14, armor: 0, mr: 0.3, eva: 0.2,
    exp: 82, gold: [14, 30], aggressive: true, speed: 2.2,
    projectile: 'bolt', magic: true,
    attackRange: 4.5, attackInterval: 2.0, size: 0.44, shape: 'wraith', color: '#9fb6e0',
    palette: { glow: '#7ad0ff' },
    drops: [
      { item: 'blue_potion', chance: 0.2 }, { item: 'orange_potion', chance: 0.08 },
      { item: 'arcane_staff', chance: 0.008 },
    ],
  },
  orc_warrior: {
    name: '오크 전사', level: 11, hp: 165, atk: 16, armor: 7, mr: 0.08, eva: 0.03,
    exp: 90, gold: [18, 34], aggressive: true, speed: 2.3, social: true,
    attackRange: 1.2, attackInterval: 1.7, size: 0.5, shape: 'orc', color: '#5a7d34',
    palette: { armor: '#6a5a4a', weapon: '#9aa0a8' },
    drops: [
      { item: 'orange_potion', chance: 0.12 }, { item: 'courage_potion', chance: 0.04 },
      { item: 'chain_mail', chance: 0.02 },
    ],
  },
  orc_chief: {
    name: '오크 족장', level: 13, hp: 520, atk: 21, armor: 9, mr: 0.15, eva: 0.05,
    exp: 420, gold: [80, 160], aggressive: true, speed: 2.5,
    attackRange: 1.4, attackInterval: 1.6, size: 0.68, shape: 'orc', color: '#4a6b2a',
    palette: { armor: '#7a3a2a', weapon: '#c8ccd2', crown: '#ffd24a' },
    boss: { slam: { interval: 7, windup: 1.1, radius: 2.4, mult: 1.8 } },
    drops: [
      { item: 'courage_potion', chance: 0.5 },
      { item: 'steel_blade', chance: 0.08 }, { item: 'elven_bow', chance: 0.08 },
      { item: 'arcane_staff', chance: 0.08 }, { item: 'holy_mace', chance: 0.08 },
    ],
  },
};

// 사냥터. rect 는 타일 좌표, monsters 는 [종류, 가중치] (가중치 합 = 1)
// boss: 한 마리만 존재하고, 처치 후 respawn 초 뒤 다시 등장
export const SPAWN_ZONES = [
  {
    id: 'meadow', name: '동쪽 초원 (Lv.1~3)',
    rect: { x0: 76, y0: 38, x1: 113, y1: 82 },
    monsters: [['slime', 0.45], ['rat', 0.35], ['mushroom', 0.2]], max: 22,
  },
  {
    id: 'forest', name: '남쪽 숲 (Lv.4~8)',
    rect: { x0: 36, y0: 78, x1: 110, y1: 114 },
    monsters: [['wolf', 0.3], ['boar', 0.2], ['goblin', 0.2], ['goblin_archer', 0.15], ['spider', 0.15]], max: 22,
  },
  {
    id: 'ruins', name: '북쪽 폐허 (Lv.8~13)',
    rect: { x0: 30, y0: 6, x1: 94, y1: 42 },
    monsters: [['skeleton', 0.45], ['wraith', 0.25], ['orc_warrior', 0.3]], max: 18,
    boss: { type: 'orc_chief', respawn: 120, rect: { x0: 52, y0: 8, x1: 68, y1: 18 } },
  },
];
