// Render the approved Dynamic 8Directions artwork for every player surface.
import { drawChar, charFiles } from './chars.js';
import { CHARS, dirIndex, actionDur } from '../data/chars.js';
import { loadImages } from './art.js';

const CLASS_SPRITES = {
  knight: ['knight', 'knight_female'],
  elf: ['archer_male', 'archer'],
  mage: ['mage_male', 'mage'],
  priest: ['priest', 'priest_female'],
  warrior: ['warrior', 'warrior_female'],
};
export function heroSprite(state) {
  return CLASS_SPRITES[state.classId]?.[state.gender === 'female' ? 1 : 0] || null;
}
export const directionRow = dirIndex;
export function heroFrame(state) {
  const phase = (((state.walk || 0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return { row: dirIndex(state.facing), column: state.moving && !state.dead ? Math.floor(phase / (Math.PI * 2) * 8) : 0 };
}
export function preloadHeroArt() {
  return loadImages([...Object.keys(CHARS).map(key => `chars/${key}/idle.webp`),'items/rebirth-items.webp','items/icons.webp','items/hand-equipment.webp']);
}
export function preloadHeroActions(state) {
  const key = heroSprite(state);
  return key ? loadImages([...charFiles(key),'items/rebirth-items.webp','items/icons.webp','items/hand-equipment.webp']) : Promise.resolve();
}
export function drawHeroSheet(ctx, x, y, state) {
  const sprite = heroSprite(state);
  if (!sprite) return false; // NPCs continue to use their own appearance.
  const action = state.cast > 0 ? state.castAction || 'skill' : state.attack > 0 ? 'normal' : null;
  const progress = state.cast > 0 ? state.cast : state.attack;
  const act = action ? { name: action, t: (1 - Math.max(0, Math.min(1, progress))) * actionDur(sprite, action) } : null;
  // A loading image must never turn an approved character back into a primitive.
  drawChar(ctx, x, y, { ...state, sprite, act });
  return true;
}
