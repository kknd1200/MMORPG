// 스킬 정의 — 직업마다 8개 (그림: 「환생 루프」 스킬 이펙트 · 아이콘, assets/skills/<직업>_a1~a8)
//
// kind
//   damage     : 단일 대상 피해
//   aoe        : 내 주변 radius 칸 안의 모든 적
//   aoe_target : 대상 주변 radius 칸 안의 모든 적
//   chain      : 대상에서 가까운 적으로 튕기며 chain 마리까지
//   buff / heal / restore : 자신에게
// 피해 공식: 주스탯 × 일반공격력 × coef  (일반공격력 = 직업 기본 + 무기 + 버프)
// range 가 null 이면 직업의 일반공격 사거리를 사용
// slow: 맞은 몬스터 이동속도 40% 감소(초), dot: 맞은 몬스터에 초당 피해(계수 × 초)
// fx: 이펙트 시트 이름 · 그릴 곳(target/self) · 크기 · 높이(px), proj: 날아가는 그림(flight_*)

export const SKILLS = {
  // ---------------------------------------------------------------- 기사 (힘)
  power_strike: {
    id: 'power_strike', classId: 'knight', name: '강타', level: 1,
    kind: 'damage', element: 'physical', stat: 'str', coef: 0.15,
    mp: 4, cooldown: 2, range: null, color: '#ffb84a',
    fx: { sheet: 'knight_a2', at: 'target', scale: 1.3, z: 26 },
    desc: '무기에 힘을 실어 강하게 내려칩니다.',
  },
  battle_cry: {
    id: 'battle_cry', classId: 'knight', name: '투지', level: 5, party: true,
    kind: 'buff', buff: { id: 'battle_cry', name: '투지', atk: 3, duration: 30, icon: 'roar' },
    mp: 8, cooldown: 40, color: '#ff8a4a',
    fx: { sheet: 'knight_a5', at: 'self', scale: 1.5, z: 30 },
    desc: '파티 전원 30초 동안 일반공격력 +3.',
  },
  iron_wall: {
    id: 'iron_wall', classId: 'knight', name: '강철 방벽', level: 10,
    kind: 'buff', buff: { id: 'iron_wall', name: '강철 방벽', def: 6, duration: 30, icon: 'guard' },
    mp: 10, cooldown: 60, color: '#8ad0ff',
    fx: { sheet: 'knight_a6', at: 'self', scale: 1.4, z: 30 },
    desc: '30초 동안 방어력 +6.',
  },
  shield_bash: {
    id: 'shield_bash', classId: 'knight', name: '방패 강타', level: 15,
    kind: 'damage', element: 'physical', stat: 'str', coef: 0.2, slow: 3,
    mp: 8, cooldown: 5, range: null, color: '#9ad8ff',
    fx: { sheet: 'knight_a1', at: 'target', scale: 1.2, z: 26, impactFrame: 4 },
    desc: '방패로 후려쳐 3초 동안 대상을 느리게 합니다.',
  },
  whirl_slash: {
    id: 'whirl_slash', classId: 'knight', name: '회오리 베기', level: 20,
    kind: 'aoe', element: 'physical', stat: 'str', coef: 0.14, radius: 2.2,
    mp: 12, cooldown: 6, color: '#e8f0ff',
    fx: { sheet: 'knight_a3', at: 'self', scale: 1.8, z: 22 },
    desc: '검을 크게 휘둘러 주변 2칸의 적을 모두 벱니다.',
  },
  earth_splitter: {
    id: 'earth_splitter', classId: 'knight', name: '대지 가르기', level: 30,
    kind: 'aoe_target', element: 'physical', stat: 'str', coef: 0.18, radius: 2.5,
    mp: 16, cooldown: 8, range: null, color: '#7affb0',
    fx: { sheet: 'knight_a4', at: 'target', scale: 2.2, z: 8 },
    desc: '땅을 내리쳐 대상 주변 2.5칸에 충격파를 일으킵니다.',
  },
  charge_strike: {
    id: 'charge_strike', classId: 'knight', name: '돌진 베기', level: 40,
    kind: 'damage', element: 'physical', stat: 'str', coef: 0.32, dash: true,
    mp: 18, cooldown: 7, range: 5, color: '#dfe8ff',
    fx: { sheet: 'knight_a7', at: 'target', scale: 1.5, z: 26 },
    desc: '5칸 안의 적에게 순식간에 달려들어 벱니다.',
  },
  judgment_blade: {
    id: 'judgment_blade', classId: 'knight', name: '심판의 검', level: 50,
    kind: 'damage', element: 'physical', stat: 'str', coef: 0.55,
    mp: 30, cooldown: 15, range: null, color: '#ffd84a',
    fx: { sheet: 'knight_a8', at: 'target', scale: 1.8, z: 40 },
    desc: '하늘에서 빛의 검을 내리꽂는 기사의 비기.',
  },

  // ---------------------------------------------------------------- 요정 (민첩)
  piercing_shot: {
    id: 'piercing_shot', classId: 'elf', name: '관통 사격', level: 1,
    kind: 'damage', element: 'physical', stat: 'dex', coef: 0.18,
    mp: 4, cooldown: 2, range: 7, color: '#ffd86a',
    proj: 'flight_arrow_holy', fx: { sheet: 'archer_a1', at: 'target', scale: 1.2, z: 26 },
    desc: '힘을 모아 날카로운 화살을 쏩니다.',
  },
  wind_step: {
    id: 'wind_step', classId: 'elf', name: '바람 걸음', level: 5,
    kind: 'buff', buff: { id: 'wind_step', name: '바람 걸음', speed: 0.3, duration: 25, icon: 'instinct' },
    mp: 8, cooldown: 40, color: '#8affc8',
    fx: { sheet: 'archer_a7', at: 'self', scale: 1.4, z: 30 },
    desc: '25초 동안 이동 속도 +30%.',
  },
  triple_shot: {
    id: 'triple_shot', classId: 'elf', name: '연사', level: 10,
    kind: 'damage', element: 'physical', stat: 'dex', coef: 0.1, hits: 3,
    mp: 10, cooldown: 6, range: 7, color: '#6affd8',
    proj: 'flight_arrow_wind', fx: { sheet: 'archer_a2', at: 'target', scale: 1.2, z: 26 },
    desc: '화살 3발을 연속으로 쏩니다. (발당 계수 0.1)',
  },
  venom_arrow: {
    id: 'venom_arrow', classId: 'elf', name: '독화살', level: 15,
    kind: 'damage', element: 'physical', stat: 'dex', coef: 0.2, dot: 0.04, dotTime: 5,
    mp: 8, cooldown: 4, range: 7, color: '#b8ff5a',
    proj: 'flight_arrow_poison', fx: { sheet: 'archer_a3', at: 'target', scale: 1.3, z: 20 },
    desc: '독을 바른 화살. 5초 동안 독 피해가 이어집니다.',
  },
  focus_shot: {
    id: 'focus_shot', classId: 'elf', name: '집중 사격', level: 20,
    kind: 'damage', element: 'physical', stat: 'dex', coef: 0.35,
    mp: 12, cooldown: 8, range: 8, color: '#ffb84a',
    proj: 'flight_arrow_fire', fx: { sheet: 'archer_a4', at: 'target', scale: 1.4, z: 26 },
    desc: '숨을 고르고 급소를 노려 강력한 한 발을 쏩니다.',
  },
  thorn_burst: {
    id: 'thorn_burst', classId: 'elf', name: '가시 폭발', level: 30,
    kind: 'aoe_target', element: 'physical', stat: 'dex', coef: 0.18, radius: 2.2,
    mp: 16, cooldown: 8, range: 7, color: '#ffd86a',
    proj: 'flight_arrow_steel', fx: { sheet: 'archer_a5', at: 'target', scale: 2, z: 16 },
    desc: '화살이 꽂힌 자리에 가시덩굴이 터져 주변 적을 찌릅니다.',
  },
  frost_arrow: {
    id: 'frost_arrow', classId: 'elf', name: '얼음 화살', level: 40,
    kind: 'damage', element: 'physical', stat: 'dex', coef: 0.3, slow: 4,
    mp: 16, cooldown: 6, range: 7, color: '#8adcff',
    proj: 'flight_arrow_ice', fx: { sheet: 'archer_a6', at: 'target', scale: 1.4, z: 24 },
    desc: '얼음 화살로 4초 동안 대상을 느리게 합니다.',
  },
  forest_blessing: {
    id: 'forest_blessing', classId: 'elf', name: '숲의 축복', level: 50, party: true,
    kind: 'buff', buff: { id: 'forest_blessing', name: '숲의 축복', atk: 4, def: 3, duration: 60, icon: 'seed' },
    mp: 25, cooldown: 90, color: '#6affb0',
    fx: { sheet: 'archer_a8', at: 'self', scale: 1.6, z: 34 },
    desc: '파티 전원 60초 동안 일반공격력 +4, 방어력 +3.',
  },

  // ---------------------------------------------------------------- 마법사 (지능)
  fire_bolt: {
    id: 'fire_bolt', classId: 'mage', name: '화염 화살', level: 1,
    kind: 'damage', element: 'magic', stat: 'int', coef: 0.6,
    mp: 5, cooldown: 1.5, range: 7, color: '#ff7a2e',
    proj: 'flight_bolt_fire', fx: { sheet: 'mage_a1', at: 'target', scale: 1.2, z: 24 },
    desc: '불꽃 화살을 날립니다.',
  },
  meditation: {
    id: 'meditation', classId: 'mage', name: '명상', level: 5,
    kind: 'restore', mpPercent: 0.3,
    mp: 0, cooldown: 60, color: '#c88aff',
    fx: { sheet: 'mage_a5', at: 'self', scale: 1.6, z: 10 },
    desc: '최대 MP의 30%를 즉시 회복합니다.',
  },
  frost_nova: {
    id: 'frost_nova', classId: 'mage', name: '냉기 폭발', level: 10,
    kind: 'aoe', element: 'magic', stat: 'int', coef: 0.5, radius: 3, slow: 3,
    mp: 14, cooldown: 8, color: '#9fe8ff',
    fx: { sheet: 'mage_a7', at: 'self', scale: 2.4, z: 20 },
    desc: '주변 3칸의 적에게 냉기 피해를 주고 3초 동안 느리게 합니다.',
  },
  ice_lance: {
    id: 'ice_lance', classId: 'mage', name: '얼음 창', level: 15,
    kind: 'damage', element: 'magic', stat: 'int', coef: 0.8, slow: 3,
    mp: 10, cooldown: 3, range: 7, color: '#8adcff',
    proj: 'flight_bolt_ice', fx: { sheet: 'mage_a2', at: 'target', scale: 1.3, z: 24 },
    desc: '얼음 창을 꽂아 3초 동안 대상을 느리게 합니다.',
  },
  chain_lightning: {
    id: 'chain_lightning', classId: 'mage', name: '연쇄 번개', level: 20,
    kind: 'chain', element: 'magic', stat: 'int', coef: 0.55, chain: 4, chainRange: 4,
    mp: 16, cooldown: 5, range: 7, color: '#8ab8ff',
    proj: 'flight_bolt_electric', fx: { sheet: 'mage_a3', at: 'target', scale: 1.2, z: 24 },
    desc: '번개가 가까운 적에게 튕기며 최대 4마리를 칩니다.',
  },
  arcane_burst: {
    id: 'arcane_burst', classId: 'mage', name: '비전 폭발', level: 30,
    kind: 'aoe_target', element: 'magic', stat: 'int', coef: 0.7, radius: 2,
    mp: 20, cooldown: 6, range: 7, color: '#d88aff',
    proj: 'flight_bolt_arcane', fx: { sheet: 'mage_a4', at: 'target', scale: 1.8, z: 20 },
    desc: '마력 구체가 터져 대상 주변 2칸에 피해를 줍니다.',
  },
  mana_shield: {
    id: 'mana_shield', classId: 'mage', name: '마나 방패', level: 40,
    kind: 'buff', buff: { id: 'mana_shield', name: '마나 방패', def: 10, duration: 40, icon: 'guard' },
    mp: 20, cooldown: 60, color: '#7affc8',
    fx: { sheet: 'mage_a6', at: 'self', scale: 1.6, z: 8 },
    desc: '40초 동안 방어력 +10.',
  },
  meteor: {
    id: 'meteor', classId: 'mage', name: '메테오', level: 50,
    kind: 'aoe_target', element: 'magic', stat: 'int', coef: 1.2, radius: 3,
    mp: 40, cooldown: 15, range: 8, color: '#ff6a2a',
    fx: { sheet: 'mage_a8', at: 'target', scale: 2.6, z: 30 },
    desc: '하늘에서 운석을 떨어뜨려 넓은 범위를 불태웁니다.',
  },

  // ---------------------------------------------------------------- 사제 (지능)
  holy_light: {
    id: 'holy_light', classId: 'priest', name: '신성한 빛', level: 1,
    kind: 'damage', element: 'magic', stat: 'int', coef: 0.4,
    mp: 5, cooldown: 2, range: 6, color: '#fff3a0',
    fx: { sheet: 'priest_a1', at: 'target', scale: 1.3, z: 26 },
    desc: '신성한 빛으로 적을 벌합니다.',
  },
  heal: {
    id: 'heal', classId: 'priest', name: '치유', level: 1,
    kind: 'heal', healIntCoef: 1.2, healPerLevel: 2,
    mp: 6, cooldown: 3, color: '#8cffb0',
    fx: { sheet: 'priest_a5', at: 'self', scale: 1.5, z: 6 },
    desc: 'HP가 가장 낮은 파티원을 회복합니다. (지능 × 1.2 + 레벨 × 2)',
  },
  blessing: {
    id: 'blessing', classId: 'priest', name: '축복', level: 5, party: true,
    kind: 'buff', buff: { id: 'blessing', name: '축복', atk: 2, def: 2, duration: 60, icon: 'scroll' },
    mp: 10, cooldown: 60, color: '#ffe680',
    fx: { sheet: 'priest_a8', at: 'self', scale: 1.6, z: 30 },
    desc: '파티 전원 60초 동안 일반공격력 +2, 방어력 +2.',
  },
  holy_bolt: {
    id: 'holy_bolt', classId: 'priest', name: '성스러운 화살', level: 15,
    kind: 'damage', element: 'magic', stat: 'int', coef: 0.55,
    mp: 8, cooldown: 3, range: 7, color: '#ffe680',
    proj: 'flight_bolt_holy', fx: { sheet: 'priest_a2', at: 'target', scale: 1.3, z: 24 },
    desc: '빛의 화살을 날립니다.',
  },
  radiance: {
    id: 'radiance', classId: 'priest', name: '광휘', level: 20,
    kind: 'aoe', element: 'magic', stat: 'int', coef: 0.4, radius: 2.5,
    mp: 14, cooldown: 6, color: '#fff3c0',
    fx: { sheet: 'priest_a3', at: 'self', scale: 1.9, z: 30 },
    desc: '몸에서 빛을 뿜어 주변 2.5칸의 적을 태웁니다.',
  },
  divine_shield: {
    id: 'divine_shield', classId: 'priest', name: '신성한 방패', level: 30,
    kind: 'buff', buff: { id: 'divine_shield', name: '신성한 방패', def: 8, duration: 40, icon: 'guard' },
    mp: 18, cooldown: 60, color: '#ffffff',
    fx: { sheet: 'priest_a6', at: 'self', scale: 1.4, z: 30 },
    desc: '40초 동안 방어력 +8.',
  },
  judgment: {
    id: 'judgment', classId: 'priest', name: '심판', level: 40,
    kind: 'damage', element: 'magic', stat: 'int', coef: 0.9,
    mp: 22, cooldown: 8, range: 7, color: '#ffd84a',
    fx: { sheet: 'priest_a4', at: 'target', scale: 1.7, z: 40 },
    desc: '하늘에서 빛기둥을 내려 대상을 심판합니다.',
  },
  wrath: {
    id: 'wrath', classId: 'priest', name: '신의 분노', level: 50,
    kind: 'aoe_target', element: 'magic', stat: 'int', coef: 0.8, radius: 2.8,
    mp: 30, cooldown: 12, range: 7, color: '#9adcff',
    fx: { sheet: 'priest_a7', at: 'target', scale: 2.2, z: 20 },
    desc: '빛의 창이 쏟아져 대상 주변 2.8칸을 꿰뚫습니다.',
  },

  // ---------------------------------------------------------------- 전사 (힘, 용병)
  ground_smash: {
    id: 'ground_smash', classId: 'warrior', name: '대지 강타', level: 1,
    kind: 'damage', element: 'physical', stat: 'str', coef: 0.16,
    mp: 3, cooldown: 2, range: null, color: '#ffc86a',
    fx: { sheet: 'warrior_a1', at: 'target', scale: 1.2, z: 14 },
    desc: '도끼로 땅째 내려찍습니다.',
  },
  crush: {
    id: 'crush', classId: 'warrior', name: '분쇄', level: 5,
    kind: 'damage', element: 'physical', stat: 'str', coef: 0.22,
    mp: 5, cooldown: 4, range: null, color: '#ffd86a',
    fx: { sheet: 'warrior_a2', at: 'target', scale: 1.3, z: 24 },
    desc: '온 힘을 실어 대상을 분쇄합니다.',
  },
  rend: {
    id: 'rend', classId: 'warrior', name: '찢어발기기', level: 10,
    kind: 'damage', element: 'physical', stat: 'str', coef: 0.14, dot: 0.05, dotTime: 5,
    mp: 6, cooldown: 5, range: null, color: '#ff5a5a',
    fx: { sheet: 'warrior_a3', at: 'target', scale: 1.2, z: 26 },
    desc: '상처를 찢어 5초 동안 출혈 피해를 줍니다.',
  },
  berserk: {
    id: 'berserk', classId: 'warrior', name: '광폭화', level: 15,
    kind: 'buff', buff: { id: 'berserk', name: '광폭화', atk: 5, duration: 30, icon: 'roar' },
    mp: 8, cooldown: 45, color: '#ff8a3a',
    fx: { sheet: 'warrior_a4', at: 'self', scale: 1.4, z: 30 },
    desc: '30초 동안 일반공격력 +5.',
  },
  war_banner: {
    id: 'war_banner', classId: 'warrior', name: '전투 깃발', level: 20, party: true,
    kind: 'buff', buff: { id: 'war_banner', name: '전투 깃발', atk: 3, def: 2, duration: 60, icon: 'roar' },
    mp: 12, cooldown: 90, color: '#ffd84a',
    fx: { sheet: 'warrior_a5', at: 'self', scale: 1.5, z: 30 },
    desc: '파티 전원 60초 동안 일반공격력 +3, 방어력 +2.',
  },
  venom_axe: {
    id: 'venom_axe', classId: 'warrior', name: '독도끼', level: 30,
    kind: 'aoe_target', element: 'physical', stat: 'str', coef: 0.18, radius: 2, dot: 0.03, dotTime: 5,
    mp: 14, cooldown: 8, range: null, color: '#8aff5a',
    fx: { sheet: 'warrior_a6', at: 'target', scale: 1.8, z: 18 },
    desc: '독을 머금은 도끼로 대상 주변 2칸을 휩씁니다.',
  },
  spin_cleave: {
    id: 'spin_cleave', classId: 'warrior', name: '회전 베기', level: 40,
    kind: 'aoe', element: 'physical', stat: 'str', coef: 0.2, radius: 2.5,
    mp: 16, cooldown: 7, color: '#ffe8a0',
    fx: { sheet: 'warrior_a7', at: 'self', scale: 2.2, z: 12 },
    desc: '도끼를 휘돌려 주변 2.5칸의 적을 벱니다.',
  },
  quake: {
    id: 'quake', classId: 'warrior', name: '대지 진동', level: 50,
    kind: 'aoe_target', element: 'physical', stat: 'str', coef: 0.45, radius: 3,
    mp: 28, cooldown: 14, range: null, color: '#ffc86a',
    fx: { sheet: 'warrior_a8', at: 'target', scale: 2.4, z: 20 },
    desc: '땅을 뒤흔들어 대상 주변 3칸을 무너뜨립니다.',
  },
};

// 기본 공격 · 상태이상 · 레벨업 이펙트
export const BASIC_FX = {
  knight: { sheet: 'knight_basic', scale: 0.95, z: 26 },
  elf: { sheet: 'archer_basic', scale: 0.9, z: 24, proj: 'flight_arrow_steel' },
  mage: { sheet: 'mage_basic', scale: 0.8, z: 26, proj: 'flight_bolt_arcane' },
  priest: { sheet: 'priest_basic', scale: 0.85, z: 26, proj: 'flight_bolt_holy' },
  warrior: { sheet: 'warrior_basic', scale: 0.95, z: 22 },
};

export const STATUS_FX = {
  slow: { sheet: 'mage_a2', scale: 0.8, z: 24 },
  burn: { sheet: 'mage_a1', scale: 0.8, z: 24 },
  poison: { sheet: 'archer_a3', scale: 0.8, z: 20 },
  bleed: { sheet: 'warrior_a1', scale: 0.8, z: 26 },
  expose: { sheet: 'archer_a4', scale: 0.8, z: 26 },
};

export const LEVELUP_FX = { sheet: 'priest_a4', scale: 1.8, z: 44 };

// 상태 · 버프 아이콘 (assets/ui)
export const STATUS_ICON = { st_slow: 'frost', st_burn: 'burn', st_poison: 'poison', st_bleed: 'bleed', st_expose: 'shock', courage: 'potion' };
