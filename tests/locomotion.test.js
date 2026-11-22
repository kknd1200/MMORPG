import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceGait, footPose, monsterStride, monsterLimbPose } from '../js/game/locomotion.js';

const entity = () => ({ walkPhase: 0, facing: { x: 1, y: 0 } });
test('equal travel distance produces the same stride at different frame rates', () => {
  const slow = entity(), fast = entity();
  for (let i = 0; i < 30; i++) advanceGait(slow, 3 / 30, 1 / 30);
  for (let i = 0; i < 144; i++) advanceGait(fast, 3 / 144, 1 / 144);
  assert.ok(Math.abs(slow.walkPhase - fast.walkPhase) < 1e-10);
});
test('slow movement reduces cadence and standing still does not slide the feet', () => {
  const slow = entity(), fast = entity();
  advanceGait(slow, 0.1, 0.1); advanceGait(fast, 0.2, 0.1);
  assert.ok(Math.abs(fast.walkPhase - slow.walkPhase * 2) < 1e-10);
  const phase = slow.walkPhase, weight = slow.walkWeight;
  advanceGait(slow, 0, 1 / 60);
  assert.equal(slow.walkPhase, phase);
  assert.ok(slow.walkWeight > 0 && slow.walkWeight < weight);
  for (let i = 0; i < 90; i++) advanceGait(slow, 0, 1 / 60);
  assert.equal(slow.walkWeight, 0);
});
test('alternating feet keep a supporting foot on the ground and neutral pose at rest', () => {
  for (let phase = 0; phase < Math.PI * 2; phase += 0.05) {
    const a = footPose(phase, -1, 0.5, 1), b = footPose(phase, 1, 0.5, 1);
    assert.ok(Math.min(a.lift, b.lift) < 1e-8);
    assert.ok(a.lift <= 2.3 && b.lift <= 2.3);
    const idle = footPose(phase, 1, 0.5, 0);
    assert.equal(idle.lift, 0); assert.equal(idle.stride, 0);
  }
});
test('visual turns ease through the shortest angle and death stops the gait', () => {
  const e = entity(); e.visualAngle = Math.PI - 0.1;
  e.facing = { x: Math.cos(-Math.PI + 0.1), y: Math.sin(-Math.PI + 0.1) };
  advanceGait(e, 0, 1 / 60);
  assert.ok(e.visualAngle > Math.PI - 0.1 && e.visualAngle < Math.PI + 0.1);
  e.dead = true; const phase = e.walkPhase;
  advanceGait(e, 1, 1 / 60);
  assert.equal(e.walkPhase, phase); assert.equal(e.walkWeight, 0);
});
test('body size and family determine stride length rather than the chase speed', () => {
  assert.ok(monsterStride('quadruped') > monsterStride('biped'));
  assert.ok(monsterStride('spider') < monsterStride('biped'));
  assert.ok(monsterStride('biped', 2) > monsterStride('biped', 1));
});

test('monster legs alternate support and freeze at rest through all eight steps', () => {
  for (const family of ['biped', 'quadruped', 'spider', 'construct', 'dragon']) {
    const poses = new Set();
    for (let frame = 0; frame < 8; frame++) {
      const phase = (frame + 0.1) / 8 * Math.PI * 2;
      const left = monsterLimbPose(phase, 0, family);
      const right = monsterLimbPose(phase, 1, family);
      assert.ok(Math.min(left.lift, right.lift) < 1e-10);
      assert.ok(Math.abs(left.stride + right.stride) < 1e-10);
      const rest = monsterLimbPose(phase, 0, family, 0);
      assert.equal(Math.abs(rest.stride), 0); assert.equal(rest.lift, 0);
      poses.add(JSON.stringify(left));
    }
    assert.ok(poses.size >= 6);
  }
});
