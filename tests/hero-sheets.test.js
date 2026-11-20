import test from 'node:test';
import assert from 'node:assert/strict';
import { heroFrame, directionRow, drawHeroSheet } from '../js/game/hero-sheets.js';
import { LOOKS } from '../js/game/sprites.js';

test('directional walk poses follow the reference while keeping the original class looks', () => {
  assert.deepEqual([{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}].map(directionRow), [0,1,2,3]);
  assert.equal(LOOKS.knight.weapon, 'sword');
  assert.equal(LOOKS.elf.weapon, 'bow');
  assert.equal(LOOKS.mage.weapon, 'staff');
  assert.equal(LOOKS.priest.weapon, 'mace');
});
test('walk sequence alternates feet with a neutral pose between contacts', () => {
  assert.deepEqual([0,1,2,3,4].map(n => heroFrame({moving:true,walk:n*Math.PI/2+.01}).column), [1,0,1,2,1]);
  for (let n=0;n<20;n++) assert.equal(heroFrame({moving:false,walk:n}).column,1);
});
test('pose cache reuses the exact original look and rebuilds on equipment or direction changes', () => {
  const original=globalThis.document, calls=[];
  globalThis.document={createElement:()=>({getContext:()=>({setTransform(){}})})};
  const ctx={save(){},restore(){},translate(){},drawImage(){}};
  const painter=(_ctx,x,y,state)=>calls.push({x,y,state});
  try {
    const state={classId:'knight',look:LOOKS.knight,facing:{x:1,y:0},moving:true,walk:1};
    drawHeroSheet(ctx,0,0,state,painter);
    assert.equal(calls.length,3);
    for(const call of calls){assert.equal(call.state.look,LOOKS.knight);assert.equal(call.state.scale,1);assert.equal(call.y,76);assert.equal(call.state.lockBody,true)}
    assert.deepEqual(calls.map(c=>c.state.walk),[Math.PI/2,0,Math.PI*1.5]);
    drawHeroSheet(ctx,0,0,{...state,walk:3},painter);assert.equal(calls.length,3);
    drawHeroSheet(ctx,0,0,{...state,armorId:'chain_mail'},painter);assert.equal(calls.length,6);
    drawHeroSheet(ctx,0,0,{...state,weaponColor:'#aabbcc'},painter);assert.equal(calls.length,9);
    drawHeroSheet(ctx,0,0,{...state,facing:{x:1,y:1}},painter);assert.equal(calls.length,12);
    assert.ok(calls[9].state.facing.x>0&&calls[9].state.facing.y>0);
  } finally {globalThis.document=original}
});
test('walk frames preserve size/feet and combat defers to original attack, cast and death rendering', () => {
  const original=globalThis.document,draws=[];
  globalThis.document={createElement:()=>({getContext:()=>({setTransform(){}})})};
  const ctx={save(){},restore(){},translate(){},drawImage(...args){draws.push(args)}};
  const state={classId:'elf',look:LOOKS.elf,facing:{x:0,y:1},moving:true};
  try {
    for(let n=0;n<4;n++)assert.equal(drawHeroSheet(ctx,50,70,{...state,walk:n*Math.PI/2+.01},()=>{}),true);
    assert.deepEqual(draws.map(d=>d[1]),[192,0,192,384]);
    for(const draw of draws)assert.deepEqual(draw.slice(5),draws[0].slice(5));
    assert.equal(drawHeroSheet(ctx,0,0,{...state,attack:.5},()=>{}),false);
    assert.equal(drawHeroSheet(ctx,0,0,{...state,cast:.5},()=>{}),false);
    assert.equal(drawHeroSheet(ctx,0,0,{...state,dead:true},()=>{}),false);
  } finally {globalThis.document=original}
});
