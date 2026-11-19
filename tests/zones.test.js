import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPAWN_ZONES } from '../js/data/monsters.js';
import { World, VILLAGE_CELL } from '../js/game/world.js';
import { STREAM, planZones, planArt, viewRect, rectsOverlap } from '../js/game/zones.js';

const world = new World(); // SPAWN_ZONES.rect 를 채움
const HW = 22, HH = 14; // 1400×900 화면 기준 반폭/반높이(타일)

function activeAt(p, active = new Set()) {
  const { activate, deactivate } = planZones(SPAWN_ZONES, active, p, HW, HH);
  for (const z of deactivate) active.delete(z.id);
  for (const z of activate) active.add(z.id);
  return active;
}

test('마을에서는 주변 사냥터 몇 곳만 켜진다', () => {
  const active = activeAt(world.spawn);
  assert.ok(active.size > 0, '마을 근처 사냥터가 하나는 있어야 함');
  assert.ok(active.size <= 8, `켜진 사냥터가 너무 많음: ${active.size}`);
  assert.ok(active.size < SPAWN_ZONES.length / 4);
});

test('켜지는 사냥터는 언제나 화면 밖 경계 안쪽에서만', () => {
  for (const z of SPAWN_ZONES) {
    const cx = (z.rect.x0 + z.rect.x1) / 2, cy = (z.rect.y0 + z.rect.y1) / 2;
    const active = activeAt({ x: cx, y: cy });
    assert.ok(active.has(z.id), `${z.id}: 안에 서 있으면 켜져야 함`);
  }
});

test('경계에서 왔다 갔다 해도 바로 꺼지지 않는다 (히스테리시스)', () => {
  const z = SPAWN_ZONES[0];
  const cy = (z.rect.y0 + z.rect.y1) / 2;
  // 사냥터 왼쪽 끝에서 정확히 켜지는 거리
  const xOn = z.rect.x0 - HW - STREAM.spawnMargin;
  const active = activeAt({ x: xOn, y: cy });
  assert.ok(active.has(z.id));
  // 몇 칸 물러나도 유지
  activeAt({ x: xOn - (STREAM.despawnMargin - STREAM.spawnMargin) + 1, y: cy }, active);
  assert.ok(active.has(z.id), '조금 물러났다고 꺼지면 안 됨');
  // 충분히 멀어지면 꺼짐
  activeAt({ x: xOn - (STREAM.despawnMargin - STREAM.spawnMargin) - 2, y: cy }, active);
  assert.ok(!active.has(z.id));
});

test('새로 켜지는 사냥터는 화면과 겹치지 않는다 (몬스터가 눈앞에서 생기지 않음)', () => {
  const active = activeAt(world.spawn);
  // 마을에서 한 방향으로 한 칸씩 걸으며 새로 켜지는 사냥터 확인
  for (let x = world.spawn.x; x < world.w - 3; x += 1) {
    const p = { x, y: world.spawn.y };
    const { activate } = planZones(SPAWN_ZONES, active, p, HW, HH);
    for (const z of activate) {
      assert.ok(!rectsOverlap(z.rect, viewRect(p.x, p.y, HW, HH)), `${z.id} 가 화면 안에서 켜짐`);
      active.add(z.id);
    }
    const { deactivate } = planZones(SPAWN_ZONES, active, p, HW, HH);
    for (const z of deactivate) active.delete(z.id);
  }
});

test('그림은 몬스터보다 먼저 불러오고, 더 멀어져야 해제', () => {
  assert.ok(STREAM.loadMargin > STREAM.spawnMargin);
  assert.ok(STREAM.unloadMargin > STREAM.loadMargin);
  assert.ok(STREAM.despawnMargin > STREAM.spawnMargin);
  const loaded = new Set();
  for (const z of planArt(SPAWN_ZONES, loaded, world.spawn, HW, HH).load) loaded.add(z.id);
  const active = activeAt(world.spawn);
  for (const id of active) assert.ok(loaded.has(id), `${id} 그림이 미리 로드되지 않음`);
  assert.ok(loaded.size < SPAWN_ZONES.length / 2);
});

test('성문 4곳 밖이 가장 쉬운 사냥터 4곳', () => {
  const easiest = SPAWN_ZONES.slice().sort((a, b) => a.minLevel - b.minLevel).slice(0, 4);
  for (const z of easiest) {
    const dx = z.cell.x - VILLAGE_CELL.x, dy = z.cell.y - VILLAGE_CELL.y;
    assert.equal(Math.abs(dx) + Math.abs(dy), 1, `${z.name} 이 성문 바로 앞이 아님`);
  }
  const south = SPAWN_ZONES.find((z) => z.cell.x === VILLAGE_CELL.x && z.cell.y === VILLAGE_CELL.y + 1);
  assert.equal(south.minLevel, 1, '처음 서 있는 남문 밖이 Lv.1');
});

test('마을에서 멀수록 사냥터 레벨이 높다', () => {
  const d = (z) => Math.hypot(z.cell.x - VILLAGE_CELL.x, z.cell.y - VILLAGE_CELL.y);
  for (const a of SPAWN_ZONES) for (const b of SPAWN_ZONES) {
    if (d(a) < d(b) - 1e-9) assert.ok(a.minLevel < b.minLevel, `${a.name}(거리 ${d(a).toFixed(2)}) 이 ${b.name}(거리 ${d(b).toFixed(2)}) 보다 어려움`);
  }
});
