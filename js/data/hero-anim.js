// 캐릭터 · 이펙트 프레임 규격 (assets/animations.json 에서 옮김 — 원본 그림 내용은 그대로)
//   캐릭터: 공격 6장 660ms (타격 = 4번째 장), 스킬 시전 6장 800ms (발사 = 4번째 장)
//   이펙트 시트 16장 = 발동(1~4) · 방출(5~8) · 명중(9~12) · 소멸(13~16)
export const HERO_BODY = {"archer": 152, "archer_male": 160, "knight": 152, "knight_female": 148, "mage": 152, "mage_male": 156, "monk": 160, "monk_female": 152, "novice": 152, "novice_female": 152, "paladin": 156, "paladin_female": 152, "priest": 152, "priest_female": 152, "spellsword": 152, "spellsword_female": 152, "warrior": 152, "warrior_female": 152};

export const HERO_ACTION = {
  attack: { dur: 0.66, contact: 3 },
  skill: { dur: 0.8, release: 3 },
  frames: 6,
};

// 이 프레임이 화면에 나오는 순간(초)
export const contactTime = () => HERO_ACTION.attack.dur * HERO_ACTION.attack.contact / HERO_ACTION.frames;
export const releaseTime = () => HERO_ACTION.skill.dur * HERO_ACTION.skill.release / HERO_ACTION.frames;

export const FX_PHASES = {
  activation: { from: 0, n: 4, dur: 0.24 },
  emission: { from: 4, n: 4, dur: 0.18 },
  impact: { from: 8, n: 4, dur: 0.2 },
  dissipation: { from: 12, n: 4, dur: 0.32 },
};
// 시전자 쪽 = 발동 + 방출, 대상 쪽 = 명중 + 소멸
export const FX_PART = {
  cast: { from: 0, n: 8, dur: FX_PHASES.activation.dur + FX_PHASES.emission.dur },
  hit: { from: 8, n: 8, dur: FX_PHASES.impact.dur + FX_PHASES.dissipation.dur },
};
