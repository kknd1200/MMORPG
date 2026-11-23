import test from 'node:test';
import assert from 'node:assert/strict';
import { itemComparisonMarkup, itemTooltipMarkup } from '../js/ui/item-tooltip.js';
const game=(equipment={},classId='knight',name='선택한 기사')=>({selUnit:()=>({char:{name,classId,equipment}})});
test('hover compares the same equipped slot and marks both upgrades and downgrades',()=>{
 const upgrade=itemComparisonMarkup(game({weapon:'training_sword',armor:'chain_mail'}),'long_sword');assert.match(upgrade,/수련용 검/);assert.match(upgrade,/<td class="positive">\+4<\/td>/);assert.doesNotMatch(upgrade,/방어력/);
 const downgrade=itemComparisonMarkup(game({weapon:'steel_blade'}),'long_sword');assert.match(downgrade,/강철 대검/);assert.match(downgrade,/<td class="negative">-4<\/td>/);
});
test('hover uses selected character equipment, includes defense, equal and empty slot comparisons',()=>{
 const mage=itemComparisonMarkup(game({armor:'cloth_armor'},'mage','엘라'),'leather_armor');assert.match(mage,/엘라/);assert.match(mage,/방어력/);assert.match(mage,/<td class="positive">\+2<\/td>/);
 const same=itemComparisonMarkup(game({weapon:'long_sword'}),'long_sword');assert.match(same,/<td class="neutral">\+0<\/td>/);
 const empty=itemComparisonMarkup(game(),'long_sword');assert.match(empty,/현재 착용: 미장착/);
});
test('consumables show their effect instead of an unrelated equipment comparison',()=>{
 const html=itemTooltipMarkup(game({weapon:'long_sword'}),'red_potion');assert.match(html,/HP를 30/);assert.doesNotMatch(html,/착용 장비와 비교/);assert.equal(itemTooltipMarkup(game(),'missing'),'');
});
test('unusable gear warns without hiding stats and character names are escaped',()=>{
 const html=itemComparisonMarkup(game({weapon:'training_staff'},'mage','<엘라>'),'long_sword');assert.match(html,/장착할 수 없습니다/);assert.match(html,/&lt;엘라&gt;/);assert.match(html,/일반공격/);
});
