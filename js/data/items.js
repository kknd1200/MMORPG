// 아이템 정의
// type: consumable | weapon | armor
// 무기 atk 는 일반공격력에 더해집니다 (스킬 피해에도 반영).

export const ITEMS = {
  // ---- 소모품 ----
  red_potion: {
    name: '빨간 물약', type: 'consumable', price: 20,
    effect: { hp: 30, hpPct: 0.08 }, icon: { color: '#d9443b', text: 'HP' },
    desc: 'HP를 30 + 최대 HP의 8% 회복합니다.',
  },
  orange_potion: {
    name: '주황 물약', type: 'consumable', price: 60,
    effect: { hp: 80, hpPct: 0.2 }, icon: { color: '#e8862c', text: 'HP+' },
    desc: 'HP를 80 + 최대 HP의 20% 회복합니다.',
  },
  blue_potion: {
    name: '파란 물약', type: 'consumable', price: 35,
    effect: { mp: 25, mpPct: 0.1 }, icon: { color: '#3b6ed9', text: 'MP' },
    desc: 'MP를 25 + 최대 MP의 10% 회복합니다.',
  },
  courage_potion: {
    name: '용기의 물약', type: 'consumable', price: 80,
    effect: { buff: { id: 'courage', name: '용기', atk: 2, duration: 120 } },
    icon: { color: '#b44bd9', text: '용' },
    desc: '120초 동안 일반공격력 +2.',
  },
  return_scroll: {
    name: '귀환 주문서', type: 'consumable', price: 30,
    effect: { teleport: 'village' }, icon: { color: '#c9b37a', text: '귀' },
    desc: '현재 지역에서 가장 가까운 마을로 즉시 돌아갑니다.',
  },

  // ---- 무기: 기사 ----
  training_sword: { name: '수련용 검', type: 'weapon', atk: 0, classes: ['knight'], price: 10, icon: { color: '#9aa4b0', text: '검' }, desc: '초보 기사의 연습용 검.' },
  long_sword: { name: '장검', type: 'weapon', atk: 4, classes: ['knight'], price: 300, icon: { color: '#c7d0dc', text: '검' }, desc: '일반공격 +4' },
  steel_blade: { name: '강철 대검', type: 'weapon', atk: 8, classes: ['knight'], price: 1500, icon: { color: '#e6ecf5', text: '검' }, desc: '일반공격 +8' },

  // ---- 무기: 요정 ----
  training_bow: { name: '수련용 활', type: 'weapon', atk: 0, classes: ['elf'], price: 10, icon: { color: '#a78457', text: '활' }, desc: '초보 요정의 연습용 활.' },
  long_bow: { name: '장궁', type: 'weapon', atk: 3, classes: ['elf'], price: 300, icon: { color: '#c79a5c', text: '활' }, desc: '일반공격 +3' },
  elven_bow: { name: '숲의 활', type: 'weapon', atk: 7, classes: ['elf'], price: 1500, icon: { color: '#7fd17a', text: '활' }, desc: '일반공격 +7' },

  // ---- 무기: 마법사 ----
  training_staff: { name: '수련용 지팡이', type: 'weapon', atk: 0, classes: ['mage'], price: 10, icon: { color: '#8a6d4a', text: '봉' }, desc: '초보 마법사의 연습용 지팡이.' },
  oak_staff: { name: '참나무 지팡이', type: 'weapon', atk: 1, classes: ['mage'], price: 300, icon: { color: '#a8875a', text: '봉' }, desc: '일반공격 +1' },
  arcane_staff: { name: '비전 지팡이', type: 'weapon', atk: 3, classes: ['mage'], price: 1500, icon: { color: '#8a7cff', text: '봉' }, desc: '일반공격 +3' },

  // ---- 무기: 사제 ----
  training_mace: { name: '수련용 철퇴', type: 'weapon', atk: 0, classes: ['priest'], price: 10, icon: { color: '#8f8a7a', text: '퇴' }, desc: '초보 사제의 연습용 철퇴.' },
  iron_mace: { name: '쇠 철퇴', type: 'weapon', atk: 2, classes: ['priest'], price: 300, icon: { color: '#b0aa98', text: '퇴' }, desc: '일반공격 +2' },
  holy_mace: { name: '성스러운 철퇴', type: 'weapon', atk: 4, classes: ['priest'], price: 1500, icon: { color: '#ffe38a', text: '퇴' }, desc: '일반공격 +4' },

  // ---- 무기: 전사 (용병) ----
  training_axe: { name: '수련용 도끼', type: 'weapon', atk: 0, classes: ['warrior'], price: 10, icon: { color: '#9a8a7a', text: '도' }, desc: '초보 전사의 연습용 도끼.' },
  battle_axe: { name: '전투 도끼', type: 'weapon', atk: 5, classes: ['warrior'], price: 320, icon: { color: '#b8a898', text: '도' }, desc: '일반공격 +5' },
  war_axe: { name: '대형 전투 도끼', type: 'weapon', atk: 9, classes: ['warrior'], price: 1600, icon: { color: '#e0c8a0', text: '도' }, desc: '일반공격 +9' },

  // ---- 방어구 ----
  cloth_armor: { name: '천 옷', type: 'armor', def: 1, price: 20, icon: { color: '#b8a98a', text: '옷' }, desc: '방어력 +1' },
  leather_armor: { name: '가죽 갑옷', type: 'armor', def: 3, price: 250, icon: { color: '#8a5a32', text: '갑' }, desc: '방어력 +3' },
  chain_mail: { name: '사슬 갑옷', type: 'armor', def: 6, classes: ['knight', 'priest', 'warrior'], price: 1000, icon: { color: '#a3abb8', text: '갑' }, desc: '방어력 +6 (기사/사제)' },
};

export const INVENTORY_SIZE = 24;

export const SHOPS = {
  merchant: ['red_potion', 'orange_potion', 'blue_potion', 'courage_potion', 'return_scroll'],
  smith: [
    'training_sword', 'long_sword', 'training_bow', 'long_bow',
    'training_staff', 'oak_staff', 'training_mace', 'iron_mace', 'training_axe', 'battle_axe',
    'cloth_armor', 'leather_armor', 'chain_mail',
  ],
};

export function sellPrice(itemId) {
  return Math.floor((ITEMS[itemId]?.price || 0) / 2);
}

export function canEquip(itemId, classId) {
  const it = ITEMS[itemId];
  if (!it || (it.type !== 'weapon' && it.type !== 'armor')) return false;
  return !it.classes || it.classes.includes(classId);
}
