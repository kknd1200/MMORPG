import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, VILLAGES, FIELDS, DUNGEONS, WORLD_ROUTES } from '../js/data/maps.js';
import { World } from '../js/game/world.js';
import { STREAM, planZones, planArt, viewRect, rectsOverlap } from '../js/game/zones.js';

const HW = 22, HH = 14; // 1400×900 화면 기준 반폭/반높이(타일)
const field = new World(MAPS.f1);

function activeAt(zones, p, active = new Set()) {
  const { activate, deactivate } = planZones(zones, active, p, HW, HH);
  for (const z of deactivate) active.delete(z.id);
  for (const z of activate) active.add(z.id);
  return active;
}

test('넓은 곳에서는 근처 사냥 구역 몇 곳만 켜진다', () => {
  const zones = [];
  for (let gx = 0; gx < 12; gx++) zones.push({ id: `w${gx}`, rect: { x0: gx * 20, y0: 0, x1: gx * 20 + 16, y1: 16 } });
  const active = activeAt(zones, { x: 10, y: 8 });
  assert.ok(active.size > 0);
  assert.ok(active.size < zones.length, `켜진 구역이 너무 많음: ${active.size}`);
  assert.ok(activeAt(field.zones, field.spawn).size > 0, '필드 시작 지점 근처에 사냥 구역이 없음');
});

test('구역 안에 서 있으면 그 구역은 켜진다', () => {
  for (const z of field.zones) {
    const cx = (z.rect.x0 + z.rect.x1) / 2, cy = (z.rect.y0 + z.rect.y1) / 2;
    assert.ok(activeAt(field.zones, { x: cx, y: cy }).has(z.id), z.id);
  }
});

test('경계에서 왔다 갔다 해도 바로 꺼지지 않는다 (히스테리시스)', () => {
  const z = { id: 'test', rect: { x0: 200, y0: 0, x1: 230, y1: 30 } };
  const cy = 15;
  const xOn = z.rect.x0 - HW - STREAM.spawnMargin;
  const active = activeAt([z], { x: xOn, y: cy });
  assert.ok(active.has(z.id));
  activeAt([z], { x: xOn - (STREAM.despawnMargin - STREAM.spawnMargin) + 1, y: cy }, active);
  assert.ok(active.has(z.id), '조금 물러났다고 꺼지면 안 됨');
  activeAt([z], { x: xOn - (STREAM.despawnMargin - STREAM.spawnMargin) - 2, y: cy }, active);
  assert.ok(!active.has(z.id));
});

test('걸어가며 새로 켜지는 구역은 화면과 겹치지 않는다', () => {
  const active = activeAt(field.zones, field.spots.west);
  for (let x = field.spots.west.x; x < field.w - 3; x += 1) {
    const p = { x, y: field.spots.west.y };
    const { activate, deactivate } = planZones(field.zones, active, p, HW, HH);
    for (const z of activate) {
      assert.ok(!rectsOverlap(z.rect, viewRect(p.x, p.y, HW, HH)), `${z.id} 가 화면 안에서 켜짐`);
      active.add(z.id);
    }
    for (const z of deactivate) active.delete(z.id);
  }
});

test('그림은 몬스터보다 먼저 불러오고, 더 멀어져야 해제', () => {
  assert.ok(STREAM.loadMargin >= STREAM.spawnMargin);
  assert.ok(STREAM.unloadMargin > STREAM.loadMargin);
  const loaded = new Set();
  for (const z of planArt(field.zones, loaded, field.spawn, HW, HH).load) loaded.add(z.id);
  for (const id of activeAt(field.zones, field.spawn)) assert.ok(loaded.has(id), `${id} 그림이 미리 로드되지 않음`);
});

// ---------------------------------------------------------------- 월드 구성
test('성도와 마을 7 · 필드 10 · 던전 7개 × 7층, 마지막 층은 보스', () => {
  assert.equal(VILLAGES.length, 7);
  assert.equal(FIELDS.length, 10);
  assert.equal(DUNGEONS.length, 7);
  for (const d of DUNGEONS) {
    assert.equal(d.floorIds.length, 7, d.id);
    d.floorIds.forEach((id, i) => {
      const m = MAPS[id];
      assert.equal(m.floor, i + 1);
      assert.equal(!!m.floorBoss.final, i === 6, `${id} 최종 보스 여부`);
      assert.equal(!!m.down, i < 6, `${id} 내려가는 계단`);
    });
    assert.equal(MAPS[d.floorIds[6]].floorBoss.final, true);
    assert.ok(MAPS[d.field].entrances.includes(d.id), `${d.id} 입구가 필드에 없음`);
  }
});

test('필드마다 필드 보스가 있고, 출현 시각이 서로 다름', () => {
  const offsets = new Set();
  for (const f of FIELDS) {
    assert.ok(MAPS[f.id].fieldBoss, f.id);
    offsets.add(MAPS[f.id].fieldBoss.offset);
  }
  assert.equal(offsets.size, FIELDS.length);
});

test('성도의 네 방향 출구와 모든 지역의 왕복 연결', () => {
  const opposite={north:'south',south:'north',east:'west',west:'east'};
  assert.equal(Object.keys(MAPS.capital.exits).length,4);
  for(const [a,dir,b] of WORLD_ROUTES){
    assert.deepEqual(MAPS[a].exits[dir],{map:b,spot:opposite[dir]});
    assert.deepEqual(MAPS[b].exits[opposite[dir]],{map:a,spot:dir});
  }
  const queue=['capital'],seen=new Set(queue);
  for(let i=0;i<queue.length;i++)for(const ex of Object.values(MAPS[queue[i]].exits))if(!seen.has(ex.map)){seen.add(ex.map);queue.push(ex.map)}
  assert.equal(seen.size,VILLAGES.length+FIELDS.length);
});

test('맵 66개 전부: 도착 지점 · 포탈 · 사냥 구역에 걸어서 닿고, 포탈 목적지가 존재', () => {
  const worlds = Object.fromEntries(Object.values(MAPS).map((d) => [d.id, new World(d)]));
  assert.equal(Object.keys(worlds).length, 7 + 10 + 49);
  for (const w of Object.values(worlds)) {
    for (const [k, p] of Object.entries(w.spots)) assert.ok(w.reachable(p), `${w.id} 도착 지점 ${k}`);
    for (const p of w.portals) {
      const touch = [[p.cx, p.cy], [p.cx, p.rect.y1 + 0.6], [p.cx, p.rect.y0 - 0.6], [p.rect.x0 - 0.6, p.cy], [p.rect.x1 + 0.6, p.cy]];
      assert.ok(touch.some(([x, y]) => x >= 0 && y >= 0 && x < w.w && y < w.h && w.reachable({ x, y })), `${w.id} 포탈 ${p.label}`);
      assert.ok(worlds[p.to.map].spots[p.to.spot], `${w.id} → ${p.to.map}:${p.to.spot} 도착 지점 없음`);
      for (const s of Object.values(w.spots)) assert.ok(!w.portalAt(s.x, s.y), `${w.id}: 도착 지점이 포탈 안에 있음`);
    }
    for (const z of w.zones) assert.ok(w.findOpenTileIn(z.rect, Math.random, 200), `${w.id} ${z.id} 빈 자리 없음`);
    if (w.type === 'village') assert.equal(w.zones.length, 0, `${w.id} 마을에 몬스터 구역`);
    if (w.type === 'village') assert.equal(w.npcs.filter((n) => n.kind === 'teleporter').length, 1, `${w.id} 이동술사`);
  }
});

import { bossWindow, BOSS_SCHEDULE, teleportDestinations } from '../js/data/maps.js';

test('필드 보스 시간표: 매시 offset 분에 나타나 stay 분 머묾', () => {
  const base = new Date(2026, 10, 19, 14, 0, 0).getTime(); // 14:00
  const min = 60000;
  assert.equal(bossWindow(6, base + 5 * min).active, false);
  assert.equal(bossWindow(6, base + 6 * min).active, true);
  assert.equal(bossWindow(6, base + (6 + BOSS_SCHEDULE.stay) * min - 1).active, true);
  assert.equal(bossWindow(6, base + (6 + BOSS_SCHEDULE.stay) * min).active, false);
  const w = bossWindow(6, base + 30 * min);
  assert.equal(w.next, base + 66 * min);
});

test('이동술사: 성도와 마을 7 · 필드 10 · 던전 입구 7, 던전은 입구 앞까지만', () => {
  const d = teleportDestinations();
  assert.equal(d.filter((x) => x.kind === 'village').length, 7);
  assert.equal(d.filter((x) => x.kind === 'field').length, 10);
  const dun = d.filter((x) => x.kind === 'dungeon');
  assert.equal(dun.length, 7);
  for (const x of dun) {
    assert.equal(MAPS[x.map].type, 'field', `${x.id} 가 던전 안으로 보냄`);
    assert.match(x.spot, /^entrance:/);
  }
  for (const x of d) assert.ok(x.cost > 0);
});
