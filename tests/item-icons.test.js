import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ITEMS, SHOPS } from '../js/data/items.js';
import { ITEM_ICON_ATLAS, ITEM_ICON_CELLS } from '../js/data/item-icons.js';
import { itemIcon } from '../js/ui/item-icons.js';

test('every game item has an existing original-art atlas cell', () => {
  assert.ok(fs.existsSync(new URL(`../assets/${ITEM_ICON_ATLAS.path}`,import.meta.url)));
  assert.deepEqual(Object.keys(ITEM_ICON_CELLS).sort(),Object.keys(ITEMS).sort());
  const cells=Object.values(ITEM_ICON_CELLS);
  assert.equal(new Set(cells).size,cells.length);
  for(const n of cells)assert.ok(Number.isInteger(n)&&n>=0&&n<ITEM_ICON_ATLAS.columns*ITEM_ICON_ATLAS.rows);
});
test('all shop and starter items render artwork instead of the text placeholder', () => {
  for(const id of Object.keys(ITEMS)) {
    const html=itemIcon(id);
    assert.match(html,/class="icon item-art"/);
    assert.ok(html.includes(ITEMS[id].name));
    assert.match(html,/items\/icons.webp/);
    assert.doesNotMatch(html,/NaN|undefined/);
  }
  for(const ids of Object.values(SHOPS))for(const id of ids)assert.ok(ITEM_ICON_CELLS[id]!=null);
  assert.match(itemIcon('long_sword'),/background-position:85.71428571428571% 0%/);
  assert.match(itemIcon('chain_mail'),/background-position:85.71428571428571% 100%/);
});
