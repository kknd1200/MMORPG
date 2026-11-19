// 심리스 구역 스트리밍
// 맵은 하나로 이어져 있지만, 몬스터는 "화면 근처의 사냥터"에만 존재합니다.
//   - 화면 바깥 spawnMargin 칸 안으로 들어온 사냥터 → 몬스터 배치 (항상 화면 밖에서 생기므로 튀어나오는 모습이 안 보임)
//   - 화면 바깥 despawnMargin 칸보다 멀어진 사냥터 → 몬스터 정리 (쫓아오는 몬스터는 유지)
//   - 몬스터 그림(시트)은 loadMargin 안에서 미리 불러오고, unloadMargin 밖이면 메모리 해제
// 경계를 오갈 때 계속 생겼다 사라지지 않도록 들어오는 거리 < 나가는 거리 (히스테리시스)
export const STREAM = {
  spawnMargin: 10,
  despawnMargin: 22,
  loadMargin: 22,
  unloadMargin: 40,
  interval: 0.25, // 구역 검사 주기(초)
};

/** 화면(중심 cx, cy / 반폭 halfW, 반높이 halfH, 타일 단위)을 margin 만큼 넓힌 사각형 */
export function viewRect(cx, cy, halfW, halfH, margin = 0) {
  return { x0: cx - halfW - margin, y0: cy - halfH - margin, x1: cx + halfW + margin, y1: cy + halfH + margin };
}

export function rectsOverlap(a, b) {
  return a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
}

export function pointInRect(p, r) {
  return p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
}

/**
 * 이번 검사에서 켜고/끌 사냥터를 계산 (상태는 바꾸지 않음)
 * active: 지금 켜진 사냥터 id 의 Set
 * 반환: { activate: zone[], deactivate: zone[] }
 */
export function planZones(zones, active, view, halfW, halfH, cfg = STREAM) {
  const near = viewRect(view.x, view.y, halfW, halfH, cfg.spawnMargin);
  const keep = viewRect(view.x, view.y, halfW, halfH, cfg.despawnMargin);
  const activate = [], deactivate = [];
  for (const z of zones) {
    if (!z.rect) continue;
    if (active.has(z.id)) {
      if (!rectsOverlap(z.rect, keep)) deactivate.push(z);
    } else if (rectsOverlap(z.rect, near)) {
      activate.push(z);
    }
  }
  return { activate, deactivate };
}

/** 그림을 불러올 사냥터 / 해제할 사냥터 */
export function planArt(zones, loaded, view, halfW, halfH, cfg = STREAM) {
  const near = viewRect(view.x, view.y, halfW, halfH, cfg.loadMargin);
  const keep = viewRect(view.x, view.y, halfW, halfH, cfg.unloadMargin);
  const load = [], unload = [];
  for (const z of zones) {
    if (!z.rect) continue;
    if (loaded.has(z.id)) {
      if (!rectsOverlap(z.rect, keep)) unload.push(z);
    } else if (rectsOverlap(z.rect, near)) {
      load.push(z);
    }
  }
  return { load, unload };
}
