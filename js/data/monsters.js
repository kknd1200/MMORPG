// 몬스터 정의
// armor: 물리 피해 감소(값/2), mr: 마법 저항(비율), eva: 회피(명중률 감소)

export const MONSTERS = {
  slime: {
    name: '초록 슬라임', level: 1, hp: 16, atk: 2, armor: 0, mr: 0, eva: 0,
    exp: 6, gold: [1, 4], aggressive: false, speed: 1.6,
    attackRange: 1.0, attackInterval: 1.6, size: 0.4, shape: 'slime', color: '#5cc25c',
    drops: [{ item: 'red_potion', chance: 0.08 }],
  },
  rat: {
    name: '들쥐', level: 2, hp: 22, atk: 3, armor: 0, mr: 0, eva: 0.03,
    exp: 9, gold: [2, 5], aggressive: false, speed: 2.4,
    attackRange: 1.0, attackInterval: 1.3, size: 0.32, shape: 'rat', color: '#8a6a4a',
    drops: [{ item: 'red_potion', chance: 0.1 }],
  },
  wolf: {
    name: '회색 늑대', level: 4, hp: 48, atk: 6, armor: 1, mr: 0, eva: 0.05,
    exp: 22, gold: [4, 10], aggressive: true, speed: 3.0,
    attackRange: 1.1, attackInterval: 1.4, size: 0.45, shape: 'wolf', color: '#8d939b',
    drops: [{ item: 'red_potion', chance: 0.12 }, { item: 'leather_armor', chance: 0.02 }],
  },
  goblin: {
    name: '고블린', level: 6, hp: 75, atk: 9, armor: 3, mr: 0.05, eva: 0.05,
    exp: 38, gold: [8, 18], aggressive: true, speed: 2.6,
    attackRange: 1.1, attackInterval: 1.5, size: 0.42, shape: 'humanoid', color: '#6b8f3a',
    drops: [
      { item: 'red_potion', chance: 0.15 }, { item: 'blue_potion', chance: 0.1 },
      { item: 'long_sword', chance: 0.01 }, { item: 'long_bow', chance: 0.01 },
      { item: 'oak_staff', chance: 0.01 }, { item: 'iron_mace', chance: 0.01 },
    ],
  },
  skeleton: {
    name: '해골 병사', level: 9, hp: 115, atk: 13, armor: 5, mr: 0.1, eva: 0.05,
    exp: 64, gold: [12, 25], aggressive: true, speed: 2.4,
    attackRange: 1.1, attackInterval: 1.5, size: 0.42, shape: 'skeleton', color: '#e8e4d8',
    drops: [
      { item: 'orange_potion', chance: 0.1 }, { item: 'blue_potion', chance: 0.12 },
      { item: 'chain_mail', chance: 0.015 },
    ],
  },
  orc_chief: {
    name: '오크 족장', level: 13, hp: 320, atk: 19, armor: 8, mr: 0.15, eva: 0.05,
    exp: 220, gold: [60, 120], aggressive: true, speed: 2.6,
    attackRange: 1.3, attackInterval: 1.6, size: 0.65, shape: 'humanoid', color: '#4a6b2a',
    drops: [
      { item: 'courage_potion', chance: 0.3 },
      { item: 'steel_blade', chance: 0.05 }, { item: 'elven_bow', chance: 0.05 },
      { item: 'arcane_staff', chance: 0.05 }, { item: 'holy_mace', chance: 0.05 },
    ],
  },
};

// 사냥터. rect 는 타일 좌표, monsters 는 [종류, 가중치]
export const SPAWN_ZONES = [
  {
    id: 'meadow', name: '동쪽 초원 (Lv.1~3)',
    rect: { x0: 76, y0: 38, x1: 113, y1: 82 },
    monsters: [['slime', 0.6], ['rat', 0.4]], max: 20,
  },
  {
    id: 'forest', name: '남쪽 숲 (Lv.4~8)',
    rect: { x0: 36, y0: 78, x1: 110, y1: 114 },
    monsters: [['wolf', 0.6], ['goblin', 0.4]], max: 18,
  },
  {
    id: 'ruins', name: '북쪽 폐허 (Lv.8~13)',
    rect: { x0: 30, y0: 6, x1: 94, y1: 42 },
    monsters: [['skeleton', 0.65], ['goblin', 0.3], ['orc_chief', 0.05]], max: 16,
  },
];
