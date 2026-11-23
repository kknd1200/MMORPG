export function formatVital(char, kind) {
  const hp = kind === 'hp';
  const current = Math.max(0, hp ? Math.ceil(char.hp) : Math.floor(char.mp));
  return `${hp ? 'HP' : 'MP'} ${current} / ${hp ? char.maxHp : char.maxMp}`;
}

// 파티창 전체를 다시 그리지 않아 스킬 조건 선택·드래그 중에도 수치만 갱신한다.
export function refreshPartyVitals(root, game) {
  for (const el of root.querySelectorAll('[data-unit-vital]')) {
    const unit = game.unitById(el.dataset.unitId);
    if (!unit) continue;
    const text = formatVital(unit.char, el.dataset.unitVital);
    if (el.textContent !== text) el.textContent = text;
  }
}
