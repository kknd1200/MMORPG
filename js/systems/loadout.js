import {CLASSES} from '../data/classes.js';
import {SKILLS} from '../data/skills.js';
import {PASSIVES} from '../data/passives.js';
export const ACTIVE_SLOTS=2,PASSIVE_SLOTS=2;
const defaults={knight:['power_strike','battle_cry','shield_bash','whirl_slash'],warrior:['ground_smash','crush','berserk','spin_cleave'],elf:['piercing_shot','wind_step','triple_shot','thorn_burst'],mage:['fire_bolt','meditation','frost_nova','ice_lance'],priest:['holy_light','heal','blessing','wrath']};
export function activeBook(char) {
 const personal=char.isMerc && char.mercSkillBook;
 if(Array.isArray(personal))return personal.filter(e=>SKILLS[e.id]?.classId===char.classId).slice(0,4);
 if(!Array.isArray(char.activeSkillBook)) {
  const ids=[...new Set([...(char.skillSlots || []).filter(Boolean).map(e=>e.id),...defaults[char.classId]].filter(id=>SKILLS[id]?.classId===char.classId))].slice(0,4);
  char.activeSkillBook=ids.map(id=>({id,level:SKILLS[id].level}));
 }
 return char.activeSkillBook.filter(e=>SKILLS[e.id]?.classId===char.classId).slice(0,4);
}
export const passiveBook=char=>Object.values(PASSIVES).filter(p=>p.classId===char.classId);
export function ensureLoadout(char) {
 const book=activeBook(char),learned=book.filter(e=>e.level<=char.level).map(e=>e.id);
 const fresh=char.loadoutVersion!==2,used=new Set();
 const slots=(char.skillSlots || []).filter(e=>e && learned.includes(e.id) && !used.has(e.id) && used.add(e.id)).slice(0,2);
 if(fresh && slots.length===0)for(const id of learned)if(slots.length<2 && !used.has(id)){slots.push({id,cond:SKILLS[id].kind==='heal'?'ally50':SKILLS[id].kind==='aoe'?'enemies3':'always'});used.add(id);}
 // Preserve intentional empty slots after migration.
 if(!fresh) {
  used.clear();char.skillSlots=Array.from({length:2},(_,i)=>{const e=char.skillSlots?.[i];return e && learned.includes(e.id) && !used.has(e.id) && used.add(e.id) ? e:null;});
 } else char.skillSlots=Array.from({length:2},(_,i)=>slots[i] || null);
 const valid=new Set(passiveBook(char).map(p=>p.id)),seen=new Set();
 char.passiveSlots=Array.from({length:2},(_,i)=>{const id=char.passiveSlots?.[i] || (fresh?passiveBook(char)[i]?.id:null);return valid.has(id) && !seen.has(id) && seen.add(id)?id:null;});
 char.loadoutVersion=2;return char.skillSlots;
}
export function passiveModifiers(char) {
 const result={},seen=new Set();
 for(const id of (char.passiveSlots || []).slice(0,2)) {
  const p=PASSIVES[id];if(!p || p.classId!==char.classId || seen.has(id))continue;seen.add(id);
  for(const [key,n] of Object.entries(p.effects))result[key]=(result[key] || 0)+n;
 }
 return result;
}
export function setPassive(char,index,id) {
 ensureLoadout(char);
 if(!Number.isInteger(index)||index<0||index>=2 || id && PASSIVES[id]?.classId!==char.classId)return false;
 const other=char.passiveSlots.indexOf(id);
 if(id && other>=0 && other!==index)char.passiveSlots[other]=char.passiveSlots[index];
 char.passiveSlots[index]=id || null;return true;
}
