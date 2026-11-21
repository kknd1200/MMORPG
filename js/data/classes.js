// 직업 정의. 새 직업은 여기에 항목을 추가하고 CLASS_ORDER 에 id 를 넣으면 됩니다.
// (스킬은 skills.js, 시작 무기는 items.js 에 함께 추가)

export const STAT_KEYS = ['str', 'dex', 'int', 'con'];

export const STAT_NAMES = { str: '힘', dex: '민첩', int: '지능', con: '체력' };

export const STAT_DESCRIPTIONS = {
  str: '근접 직업의 주스탯. 근접 공격 명중과 근접 스킬 피해가 오릅니다.',
  dex: '원거리 직업의 주스탯. 원거리 공격 명중과 원거리 스킬 피해가 오릅니다.',
  int: '마법 직업의 주스탯. 마법 명중과 마법 스킬 피해가 오릅니다.',
  con: '공통 스탯. 방어력과 레벨업 시 HP 성장량이 오릅니다.',
};

export const CLASSES = {
  knight: {
    id: 'knight',
    name: '기사',
    role: '근접 전사',
    description: '검과 갑옷으로 최전선을 지키는 근접 전사. HP 성장이 가장 높습니다.',
    primaryStat: 'str',
    attackType: 'melee',
    attackRange: 1.3,
    attackInterval: 0.9,
    projectile: null,
    baseAttack: 10,
    attackGrowth: 0.5, // 레벨당 일반공격력 증가 (Lv.1 = 0)
    baseStats: { str: 14, dex: 9, int: 8, con: 12 },
    start: { hp: 40, mp: 20 },
    growth: { hp: [8, 12], mp: [3, 5] },
    skills: ['shield_bash', 'power_strike', 'whirl_slash', 'earth_splitter', 'battle_cry', 'iron_wall', 'charge_strike', 'judgment_blade'],
    sprites: { m: 'knight', f: 'knight_female' }, defaultGender: 'f', fx: 'knight',
    startEquipment: { weapon: 'training_sword', armor: 'cloth_armor' },
    color: '#c84b3c',
  },
  elf: {
    id: 'elf',
    name: '요정',
    role: '원거리 궁수',
    description: '숲의 축복을 받은 궁수. 멀리서 활로 적을 제압합니다.',
    primaryStat: 'dex',
    attackType: 'ranged',
    attackRange: 6.5,
    attackInterval: 1.0,
    projectile: 'arrow',
    baseAttack: 8,
    attackGrowth: 0.45,
    baseStats: { str: 9, dex: 14, int: 10, con: 10 },
    start: { hp: 35, mp: 25 },
    growth: { hp: [6, 10], mp: [4, 7] },
    skills: ['piercing_shot', 'triple_shot', 'venom_arrow', 'focus_shot', 'thorn_burst', 'frost_arrow', 'wind_step', 'forest_blessing'],
    sprites: { f: 'archer', m: 'archer_male' }, defaultGender: 'm', fx: 'archer',
    startEquipment: { weapon: 'training_bow', armor: 'cloth_armor' },
    color: '#3fa45b',
  },
  mage: {
    id: 'mage',
    name: '마법사',
    role: '마법 딜러',
    description: '강력한 원소 마법을 다루지만 몸은 약합니다. MP 성장이 가장 높습니다.',
    primaryStat: 'int',
    attackType: 'melee',
    attackRange: 1.3,
    attackInterval: 1.1,
    projectile: null,
    baseAttack: 3,
    attackGrowth: 0.15,
    baseStats: { str: 8, dex: 9, int: 15, con: 10 },
    start: { hp: 25, mp: 35 },
    growth: { hp: [4, 7], mp: [7, 11] },
    skills: ['fire_bolt', 'ice_lance', 'chain_lightning', 'arcane_burst', 'meditation', 'mana_shield', 'frost_nova', 'meteor'],
    sprites: { f: 'mage', m: 'mage_male' }, defaultGender: 'm', fx: 'mage',
    startEquipment: { weapon: 'training_staff', armor: 'cloth_armor' },
    color: '#4a6fd1',
  },
  priest: {
    id: 'priest',
    name: '사제',
    role: '신성 마법 / 지원',
    description: '신성한 힘으로 적을 벌하고 자신을 치유합니다. HP와 MP가 균형 있게 성장합니다.',
    primaryStat: 'int',
    attackType: 'melee',
    attackRange: 1.3,
    attackInterval: 1.0,
    projectile: null,
    baseAttack: 5,
    attackGrowth: 0.25,
    baseStats: { str: 10, dex: 9, int: 13, con: 11 },
    start: { hp: 30, mp: 30 },
    growth: { hp: [5, 9], mp: [5, 9] },
    skills: ['holy_light', 'holy_bolt', 'radiance', 'judgment', 'heal', 'divine_shield', 'wrath', 'blessing'],
    sprites: { m: 'priest', f: 'priest_female' }, defaultGender: 'f', fx: 'priest',
    startEquipment: { weapon: 'training_mace', armor: 'cloth_armor' },
    color: '#d8b43c',
  },
  // 전사: 캐릭터 생성 · 용병 모두 가능
  warrior: {
    id: 'warrior',
    name: '전사',
    role: '근접 광전사',
    description: '거대한 대검을 휘두르는 전사. HP 성장이 높고 공격력이 강하지만 마나가 적습니다.',
    primaryStat: 'str',
    attackType: 'melee',
    attackRange: 1.3,
    attackInterval: 1.05,
    projectile: null,
    baseAttack: 11,
    attackGrowth: 0.55,
    baseStats: { str: 15, dex: 8, int: 7, con: 13 },
    start: { hp: 45, mp: 15 },
    growth: { hp: [9, 13], mp: [2, 4] },
    skills: ['ground_smash', 'crush', 'rend', 'berserk', 'war_banner', 'venom_axe', 'spin_cleave', 'quake'],
    sprites: { m: 'warrior', f: 'warrior_female' }, defaultGender: 'm', fx: 'warrior',
    startEquipment: { weapon: 'training_axe', armor: 'cloth_armor' },
    color: '#c8642c',
  },
};

// 캐릭터 생성 화면에 표시되는 순서
// 캐릭터 그림 이름 (assets/heroes/<이름>). 성별을 고르지 않은 예전 캐릭터는 defaultGender
export function heroKey(classId, gender) {
  const c = CLASSES[classId];
  if (!c?.sprites) return null;
  return c.sprites[gender] || c.sprites[c.defaultGender];
}

export const GENDER_NAMES = { m: '남', f: '여' };

export const CLASS_ORDER = ['knight', 'elf', 'mage', 'priest', 'warrior'];

// 캐릭터 생성 규칙: 직업 기본 스탯 위에 보너스 포인트를 배분
export const CREATION = { bonusPoints: 6, maxStat: 18 };

export const STAT_CAP = 60;
export const MAX_LEVEL = 99;
export const MAX_CHARACTERS = 4;
