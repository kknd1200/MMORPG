"""Asset gate: knight main/off-hand sockets must touch opaque compiled body pixels."""
from pathlib import Path
import json
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
rig=json.loads((ROOT/'js/data/equipment-rig.js').read_text().split('export const EQUIPMENT_RIG=')[1].strip().rstrip(';'))
errors=[];frames=0
for key in ['knight','knight_female']:
 body=Image.open(ROOT/'assets/chars/rigged'/key/'body.webp').convert('RGBA')
 for action,rows in rig[key].items():
  for row,poses in enumerate(rows):
   for col,pose in enumerate(poses):
    frames+=1;sx=(row if action=='idle' else col)*160;sy={'idle':0,'walk':160,'normal':1440,'skill':2720}[action]+(0 if action=='idle' else row*160)
    for role in ['main','off']:
     x,y=map(round,pose[role])
     if body.getpixel((sx+x,sy+y))[3]<150:errors.append((key,action,row,col,role,pose[role]))
if errors:raise SystemExit('Floating sockets: '+repr(errors))
print(f'PASS: {frames} knight frames, {frames*2} main/off-hand sockets touch the body.')
