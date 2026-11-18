// 스킬 정의
// kind: damage(단일 대상) | aoe(자신 주변) | buff | heal | restore
// 피해 공식: 주스탯 × 일반공격력 × coef  (일반공격력 = 직업 기본 + 무기 + 버프)
// range 가 null 이면 직업의 일반공격 사거리를 사용

export const SKILLS = {
  // ---- 기사 ----
  power_strike: {
    id: 'power_strike', classId: 'knight', name: '강타', level: 1,
    kind: 'damage', element: 'physical', stat: 'str', coef: 0.15,
    mp: 4, cooldown: 2, range: null, color: '#ff8a5c',
    desc: '무기에 힘을 실어 강하게 내려칩니다.',
  },
  battle_cry: {
    id: 'battle_cry', classId: 'knight', name: '투지', level: 5,
    kind: 'buff', buff: { id: 'battle_cry', name: '투지', atk: 3, duration: 30 },
    mp: 8, cooldown: 40, color: '#ff5c5c',
    desc: '30초 동안 일반공격력 +3.',
  },
  iron_wall: {
    id: 'iron_wall', classId: 'knight', name: '강철 방벽', level: 10,
    kind: 'buff', buff: { id: 'iron_wall', name: '강철 방벽', def: 6, duration: 30 },
    mp: 10, cooldown: 60, color: '#a0a8b8',
    desc: '30초 동안 방어력 +6.',
  },

  // ---- 요정 ----
  piercing_shot: {
    id: 'piercing_shot', classId: 'elf', name: '관통 사격', level: 1,
    kind: 'damage', element: 'physical', stat: 'dex', coef: 0.18,
    mp: 4, cooldown: 2, range: 7, projectile: 'arrow', color: '#8cff8c',
    desc: '힘을 모아 날카로운 화살을 쏩니다.',
  },
  wind_step: {
    id: 'wind_step', classId: 'elf', name: '바람 걸음', level: 5,
    kind: 'buff', buff: { id: 'wind_step', name: '바람 걸음', speed: 0.3, duration: 25 },
    mp: 8, cooldown: 40, color: '#b8ffe0',
    desc: '25초 동안 이동 속도 +30%.',
  },
  triple_shot: {
    id: 'triple_shot', classId: 'elf', name: '연사', level: 10,
    kind: 'damage', element: 'physical', stat: 'dex', coef: 0.1, hits: 3,
    mp: 10, cooldown: 6, range: 7, projectile: 'arrow', color: '#d4ff6a',
    desc: '화살 3발을 연속으로 쏩니다. (발당 계수 0.1)',
  },

  // ---- 마법사 ----
  fire_bolt: {
    id: 'fire_bolt', classId: 'mage', name: '화염 화살', level: 1,
    kind: 'damage', element: 'magic', stat: 'int', coef: 0.6,
    mp: 5, cooldown: 1.5, range: 7, projectile: 'bolt', color: '#ff7a2e',
    desc: '불꽃 화살을 날립니다.',
  },
  meditation: {
    id: 'meditation', classId: 'mage', name: '명상', level: 5,
    kind: 'restore', mpPercent: 0.3,
    mp: 0, cooldown: 60, color: '#7ab8ff',
    desc: '최대 MP의 30%를 즉시 회복합니다.',
  },
  frost_nova: {
    id: 'frost_nova', classId: 'mage', name: '냉기 폭발', level: 10,
    kind: 'aoe', element: 'magic', stat: 'int', coef: 0.5, radius: 3,
    mp: 14, cooldown: 8, color: '#9fe8ff',
    desc: '주변 3칸 안의 모든 적에게 냉기 피해를 줍니다.',
  },

  // ---- 사제 ----
  holy_light: {
    id: 'holy_light', classId: 'priest', name: '신성한 빛', level: 1,
    kind: 'damage', element: 'magic', stat: 'int', coef: 0.4,
    mp: 5, cooldown: 2, range: 6, projectile: 'bolt', color: '#fff3a0',
    desc: '신성한 빛으로 적을 벌합니다.',
  },
  heal: {
    id: 'heal', classId: 'priest', name: '치유', level: 1,
    kind: 'heal', healIntCoef: 1.2, healPerLevel: 2,
    mp: 6, cooldown: 3, color: '#8cffb0',
    desc: 'HP를 회복합니다. (지능 × 1.2 + 레벨 × 2)',
  },
  blessing: {
    id: 'blessing', classId: 'priest', name: '축복', level: 5,
    kind: 'buff', buff: { id: 'blessing', name: '축복', atk: 2, def: 2, duration: 60 },
    mp: 10, cooldown: 60, color: '#ffe680',
    desc: '60초 동안 일반공격력 +2, 방어력 +2.',
  },
};
