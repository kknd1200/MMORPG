export const HAND_ATLAS={path:'items/hand-equipment.webp',width:192,height:192,cell:64};
const tiers=[['구리',1,'#b87d45'],['철',12,'#a6adb7'],['강철',24,'#bdcddb'],['흑운',36,'#555b78'],['미스릴',48,'#a9d9d9'],['수정',60,'#8ce6ff'],['룬',72,'#6499f0'],['역린',86,'#df6954'],['타락',100,'#984ad2']];
export const EXTRA_EQUIPMENT=Object.fromEntries(tiers.flatMap(([material,level,color],i)=>[
 ['orb_'+i,{name:material+' 오브',type:'armor',slot:'shield',weaponType:'orb',category:'무기',group:'마법 무기 · 오브',level,minLevel:level,atk:Math.max(1,Math.round(1+level*.08)),def:0,price:Math.round(30+level*level*1.4),icon:{color,text:'오브'},art:{...HAND_ATLAS,xy:[i%3*64,Math.floor(i/3)%2*64]},source:{unique:false},bonuses:{accPct:.01+Math.floor(i/3)*.01},desc:'마법사 전용 보조 무기. 스태프와 함께 장착합니다.'}],
 ['hornbow_'+i,{name:material+' 각궁',type:'weapon',slot:'ranged',weaponType:'hornbow',category:'무기',group:'원거리 무기 · 각궁',level,minLevel:level,atk:Math.max(1,Math.round((1+level*.22)*1.12)),price:Math.round(40+level*level*1.7),icon:{color,text:'각궁'},art:{...HAND_ATLAS,xy:[i%3*64,128]},source:{unique:false},bonuses:{critRate:.02},desc:'궁수 전용 각궁. 양손으로 사용합니다.'}],
]));
