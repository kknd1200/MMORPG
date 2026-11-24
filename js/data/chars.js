import { SHIELD_BASH_MOTION } from './skill-motions.js';
// 8방향 도트 캐릭터 (assets/chars/<이름>/) — 사용자 제공 「Dynamic 8Directions」 팩 5종에서 옮김
//   idle.webp   : 대기 8방향 (160px 칸 8개, 가로)
//   normal.webp : 일반공격 8방향 × 8프레임 (행 = 방향, 열 = 시간)
//   skill.webp  : 대표 스킬 동작 8방향 × 8프레임
//   fx-normal.webp / fx-skill.webp : 캐릭터 앞에 고정되는 근접 이펙트 (128px 칸 4×2 시트를 방향 순서로 세로로 쌓음)
//   발 기준점 = 칸의 (80, 109). 방향 순서 = 남 · 남서 · 서 · 북서 · 북 · 북동 · 동 · 남동 (화면 기준)
//   anchor[action] = [dx, baseY, dy] → 이펙트 중심 = 발 + (dx·cos θ, baseY + dy·sin θ)
export const CHAR_CELL = 160;
export const CHAR_ORIGIN = [80, 109];
export const CHAR_FX_CELL = 128;
export const CHAR_DIRS = ["south", "south-west", "west", "north-west", "north", "north-east", "east", "south-east"];
// 화면 각도 (y 아래가 +): 남 = 90°
export const CHAR_ANGLES = [Math.PI / 2, Math.PI * 3 / 4, Math.PI, -Math.PI * 3 / 4, -Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4];
export const CHARS = {
 "archer_male": {
  "classId": "elf",
  "name": "남궁수",
  "skillName": "집중 사격",
  "anchor": {
   "normal": [
    25,
    -40,
    8
   ],
   "skill": [
    25,
    -40,
    8
   ]
  },
  "actions": {
   "normal": {
    "durations": [
     100,
     80,
     90,
     120,
     60,
     80,
     100,
     120
    ],
    "hits": [
     4
    ]
   },
   "skill": {
    "durations": [
     120,
     110,
     130,
     180,
     60,
     100,
     120,
     150
    ],
    "hits": [
     4
    ]
   }
  }
 },
 "archer": {
  "classId": "elf",
  "name": "여궁수",
  "skillName": "집중 사격",
  "anchor": {
   "normal": [
    25,
    -40,
    8
   ],
   "skill": [
    25,
    -40,
    8
   ]
  },
  "actions": {
   "normal": {
    "durations": [
     100,
     80,
     90,
     120,
     60,
     80,
     100,
     120
    ],
    "hits": [
     4
    ]
   },
   "skill": {
    "durations": [
     120,
     110,
     130,
     180,
     60,
     100,
     120,
     150
    ],
    "hits": [
     4
    ]
   }
  }
 },
 "knight": {
  "classId": "knight",
  "name": "남기사",
  "skillName": "방패 교차베기",
  "anchor": {
   "normal": [
    16,
    -31,
    10
   ],
   "skill": [
    16,
    -31,
    10
   ]
  },
  "actions": {
   "normal": {
    "durations": [
     100,
     80,
     100,
     45,
     75,
     65,
     80,
     110
    ],
    "hits": [
     4
    ]
   },
   "skill": {
    "durations": [
     110,
     80,
     55,
     90,
     65,
     85,
     90,
     120
    ],
    "hits": [
     2,
     4
    ]
   }
  }
 },
 "knight_female": {
  "classId": "knight",
  "name": "여기사",
  "skillName": "레이피어 교차베기",
  "anchor": {
   "normal": [
    16,
    -31,
    10
   ],
   "skill": [
    16,
    -31,
    10
   ]
  },
  "actions": {
   "normal": {
    "durations": [
     100,
     80,
     100,
     45,
     75,
     65,
     80,
     110
    ],
    "hits": [
     4
    ]
   },
   "skill": {
    "durations": [
     110,
     80,
     55,
     90,
     65,
     85,
     90,
     120
    ],
    "hits": [
     2,
     4
    ]
   }
  }
 },
 "mage_male": {
  "classId": "mage",
  "name": "남마법사",
  "skillName": "비전 충격",
  "anchor": {
   "normal": [
    16,
    -31,
    10
   ],
   "skill": [
    16,
    -31,
    10
   ]
  },
  "actions": {
   "normal": {
    "durations": [
     100,
     80,
     110,
     50,
     80,
     70,
     85,
     115
    ],
    "hits": [
     4
    ]
   },
   "skill": {
    "durations": [
     120,
     100,
     90,
     70,
     90,
     90,
     100,
     130
    ],
    "hits": [
     4
    ]
   }
  }
 },
 "mage": {
  "classId": "mage",
  "name": "여마법사",
  "skillName": "비전 개화",
  "anchor": {
   "normal": [
    16,
    -31,
    10
   ],
   "skill": [
    16,
    -31,
    10
   ]
  },
  "actions": {
   "normal": {
    "durations": [
     100,
     80,
     110,
     50,
     80,
     70,
     85,
     115
    ],
    "hits": [
     4
    ]
   },
   "skill": {
    "durations": [
     120,
     100,
     90,
     70,
     90,
     90,
     100,
     130
    ],
    "hits": [
     4
    ]
   }
  }
 },
 "priest": {
  "classId": "priest",
  "name": "남사제",
  "skillName": "성광 심판",
  "anchor": {
   "normal": [
    22,
    -20,
    14
   ],
   "skill": [
    22,
    -20,
    14
   ]
  },
  "actions": {
   "normal": {
    "durations": [
     110,
     90,
     110,
     60,
     90,
     90,
     100,
     120
    ],
    "hits": [
     4
    ]
   },
   "skill": {
    "durations": [
     130,
     100,
     120,
     100,
     80,
     110,
     110,
     140
    ],
    "hits": [
     4
    ]
   }
  }
 },
 "priest_female": {
  "classId": "priest",
  "name": "여사제",
  "skillName": "성광 심판",
  "anchor": {
   "normal": [
    22,
    -20,
    14
   ],
   "skill": [
    22,
    -20,
    14
   ]
  },
  "actions": {
   "normal": {
    "durations": [
     110,
     90,
     110,
     60,
     90,
     90,
     100,
     120
    ],
    "hits": [
     4
    ]
   },
   "skill": {
    "durations": [
     130,
     100,
     120,
     100,
     80,
     110,
     110,
     140
    ],
    "hits": [
     4
    ]
   }
  }
 },
 "warrior": {
  "classId": "warrior",
  "name": "남전사",
  "skillName": "사자 분쇄",
  "anchor": {
   "normal": [
    16,
    -31,
    10
   ],
   "skill": [
    22,
    -6,
    12
   ]
  },
  "actions": {
   "normal": {
    "durations": [
     120,
     100,
     100,
     55,
     90,
     95,
     100,
     120
    ],
    "hits": [
     4
    ]
   },
   "skill": {
    "durations": [
     130,
     120,
     110,
     100,
     60,
     120,
     110,
     140
    ],
    "hits": [
     4
    ]
   }
  }
 },
 "warrior_female": {
  "classId": "warrior",
  "name": "여전사",
  "skillName": "대검 강타",
  "anchor": {
   "normal": [
    16,
    -31,
    10
   ],
   "skill": [
    22,
    -6,
    12
   ]
  },
  "actions": {
   "normal": {
    "durations": [
     120,
     100,
     100,
     55,
     90,
     95,
     100,
     120
    ],
    "hits": [
     4
    ]
   },
   "skill": {
    "durations": [
     130,
     120,
     110,
     100,
     60,
     120,
     110,
     140
    ],
    "hits": [
     4
    ]
   }
  }
 }
};

for (const key of ['knight','knight_female']) CHARS[key].actions.shield_bash=SHIELD_BASH_MOTION;

/** 화면 방향 벡터 → 방향 번호 (0~7) */
export function dirIndex(f) {
  if (!f || (!f.x && !f.y)) return 0;
  const a = Math.atan2(f.y, f.x);
  let best = 0, bd = 9;
  CHAR_ANGLES.forEach((b, i) => { const d = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))); if (d < bd) { bd = d; best = i; } });
  return best;
}

/** 동작 전체 길이(초) */
export function actionDur(key, action) {
  const a = CHARS[key]?.actions[action];
  return a ? a.durations.reduce((s, x) => s + x, 0) / 1000 : 0;
}

/** 동작 시작부터 n번째 타격(발사) 프레임까지 걸리는 시간(초) */
export function hitTimes(key, action) {
  const a = CHARS[key]?.actions[action];
  if (!a) return [];
  return a.hits.map((f) => a.durations.slice(0, f).reduce((s, x) => s + x, 0) / 1000);
}

/** 경과 시간(초) → 프레임 번호 */
export function frameAt(key, action, t) {
  const a = CHARS[key]?.actions[action];
  if (!a) return 0;
  let s = 0;
  for (let i = 0; i < a.durations.length; i++) { s += a.durations[i] / 1000; if (t < s) return a.frames?.[i] ?? i; }
  return a.frames?.at(-1) ?? a.durations.length - 1;
}
