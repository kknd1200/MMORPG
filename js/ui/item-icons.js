import { REBIRTH_ATLAS } from '../data/rebirth-items.js';
import { ITEMS } from '../data/items.js';
import { ITEM_ICON_ATLAS, ITEM_ICON_CELLS } from '../data/item-icons.js';
import { url } from '../game/art.js';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Shared by inventory, equipment, shops and item hotbar slots.
export function itemIcon(id) {
  const item = ITEMS[id];
  if (!item) return '<span class="icon blank" aria-label="빈 아이템 칸"></span>';
  if (item.atlas || item.art) {
    const [cx,cy]=item.art?.xy || item.atlas, a=item.art || REBIRTH_ATLAS;
    return `<span class="icon item-art rebirth-item-art" role="img" aria-label="${esc(item.name)}" style="background-image:url('${url(a.path)}');background-size:${a.width/a.cell*100}% ${a.height/a.cell*100}%;background-position:${cx/(a.width-a.cell)*100}% ${cy/(a.height-a.cell)*100}%"></span>`;
  }
  const cell = ITEM_ICON_CELLS[item.baseId || id];
  if (cell == null) return `<span class="icon" style="--c:${item.icon.color}">${esc(item.icon.text)}</span>`;
  const x = cell % ITEM_ICON_ATLAS.columns / (ITEM_ICON_ATLAS.columns - 1) * 100;
  const y = Math.floor(cell / ITEM_ICON_ATLAS.columns) / (ITEM_ICON_ATLAS.rows - 1) * 100;
  return `<span class="icon item-art" role="img" aria-label="${esc(item.name)}" style="background-image:url('${url(ITEM_ICON_ATLAS.path)}');background-position:${x}% ${y}%"></span>`;
}
