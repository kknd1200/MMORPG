"""Compile immutable per-frame equipment sockets and weapon-free body/hand layers.
Authored melee inpaint sheets remove the baked weapons. Original source files are
preserved; the runtime reads compiled poses without color/shape guessing.
"""
from pathlib import Path
import json,math,sys
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage,signal
ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT.parent/'weapon-repair';WORK.mkdir(exist_ok=True)
KEYS=['knight','knight_female','warrior','warrior_female','archer_male','archer','mage_male','mage','priest','priest_female']
# Source tip directions, authored per pose, remove the old near-body endpoint ambiguity.
KN=[[135,150,-50,-50,35,30,145,135],[135,150,-25,-45,50,35,150,135],[120,155,-25,-40,130,145,145,120],[120,150,-20,-35,145,145,150,120],[60,120,-30,-15,145,145,140,60],[65,40,-150,-165,20,40,25,65],[70,25,-150,-150,10,30,5,70],[135,140,-150,-140,35,45,0,135]]
WA=[[130,150,145,15,165,160,145,130],[125,150,150,25,175,155,145,125],[115,145,150,175,175,160,135,115],[115,145,150,180,175,165,135,115],[45,135,150,180,175,160,130,45],[60,40,150,-160,175,35,60,60],[60,45,180,-160,180,30,55,60],[135,150,180,25,165,30,135,135]]
IDLE_MAIN={
 'knight':[[69,85],[69,85],[73,84],[75,84],[91,85],[91,85],[91,85],[86,85]],
 'warrior':[[78,85],[74,85],[74,85],[75,84],[88,84],[89,85],[88,85],[81,85]],
 'elf':[[90,81],[87,82],[71,82],[72,81],[74,81],[86,81],[89,81],[90,81]],
 'mage':[[68,82],[68,82],[70,82],[73,82],[89,83],[91,82],[92,82],[92,82]],
 'priest':[[80,81],[75,81],[74,81],[73,80],[77,80],[85,80],[89,81],[85,81]],
}
IDLE_OFF={
 'knight':[[89,82],[84,82],[72,81],[69,81],[69,81],[75,82],[87,82],[91,82]],
 'mage':[[92,77],[87,77],[75,77],[74,77],[74,77],[83,77],[89,77],[93,77]],
}
W_GUIDES=[
 [[78,84],[75,88],[72,65],[64,72],[71,85],[79,100],[80,85],[78,84]],
 [[75,85],[74,88],[70,68],[62,70],[65,84],[75,101],[76,85],[75,85]],
 [[74,86],[76,88],[70,67],[65,73],[60,83],[70,103],[73,84],[74,86]],
 [[75,85],[78,86],[74,67],[72,71],[61,84],[74,103],[76,84],[75,85]],
 [[88,84],[79,88],[76,64],[77,65],[71,84],[79,102],[81,84],[88,84]],
 [[89,85],[89,90],[77,64],[79,67],[77,83],[92,105],[90,84],[89,85]],
 [[87,85],[89,90],[80,58],[79,67],[77,83],[95,104],[91,84],[87,85]],
 [[80,85],[76,90],[74,60],[68,70],[75,84],[91,105],[84,84],[80,85]],
]
GENERATED={
 **{(k,'walk'):'authored' for k in ['knight','knight_female','warrior','warrior_female']},
 ('warrior','normal'):'exec-d09666df-441f-464c-9170-4572a2d78326.png',
 ('knight','normal'):'exec-6f6fef6e-f0dd-4ab2-ae0c-6208f9e8718a.png',
 ('knight_female','normal'):'exec-3d84372f-10e6-43cb-92fc-59b3cb5b68fc.png',
 ('warrior_female','normal'):'exec-74eb84ae-988b-4538-8c4a-6cd4ba8d22d2.png',
 ('knight','skill'):'exec-7afa532a-fb73-4fff-8534-44f000351619.png',
 ('knight_female','skill'):'exec-b62715c1-4f93-41eb-80e4-011b538f30d2.png',
 ('warrior','skill'):'exec-8dd3dace-8d28-4509-abad-8b5061006ca7.png',
 ('warrior_female','skill'):'exec-6884706a-0feb-4b59-953d-9852d808badb.png',
}
def cls(key):return 'elf' if key.startswith('archer') else key.split('_')[0]
def get_frame(im,row,col):return np.array(im.crop((col*160,row*160,(col+1)*160,(row+1)*160)).convert('RGBA'))
def blade(frame,expected,seed,edit=None,exterior_only=False):
 rgb=frame[:,:,:3].astype(float);r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2];yy,xx=np.indices(r.shape)
 neutral=(frame[:,:,3]>100)&(r>95)&(g>95)&(b>95)&((rgb.max(2)-rgb.min(2))<66)&(b>r*.85)&(yy>22)&(yy<124)&(xx>32)&(xx<130)
 if edit is not None:
  exterior=(frame[:,:,3]>100)&~ndimage.binary_dilation(edit[:,:,3]>100,iterations=1)&(yy>24)&(yy<110)&(xx>32)&(xx<132)
  neutral = exterior if exterior_only else neutral | exterior
 labels,n=ndimage.label(ndimage.binary_dilation(neutral,iterations=1));candidates=[]
 for label in range(1,n+1):
  y,x=np.where((labels==label)&neutral)
  if len(x)<6:continue
  points=np.column_stack([x,y]);center=points.mean(0)
  if np.linalg.norm(center-[80,57])<8:continue
  cov=np.cov(points.T);vals,vecs=np.linalg.eigh(cov);u=vecs[:,-1];v=np.array([-u[1],u[0]]);proj=(points-center)@u;across=(points-center)@v;length=proj.max()-proj.min();thin=length/max(1,np.std(across))
  if length<6 or thin<2.8:continue
  direction=np.array([math.cos(expected),math.sin(expected)])
  def hand_quality(base,axis):
   hand=base-axis*3.5;x,y=np.round(hand).astype(int)
   patch=frame[max(0,y-2):y+3,max(0,x-2):x+3];rgbp=patch[:,:,:3].astype(float)
   colorful=(patch[:,:,3]>100)&(rgbp.max(2)-rgbp.min(2)>35)
   score=float(colorful.sum())
   if edit is not None:
    patch2=edit[max(0,y-2):y+3,max(0,x-2):x+3];score+=float((patch2[:,:,3]>100).sum())*.2
   return score
  base=center+u*proj.min();tip=center+u*proj.max();q1=hand_quality(base,u);q2=hand_quality(tip,-u)
  if q2>q1+1 or abs(q1-q2)<=1 and u@direction<0:u=-u;proj=-proj;base,tip=tip,base
  score=length*min(thin,8)*max(.1,max(q1,q2)/20)
  predicted=base-u*4;score-=min(900,float(np.linalg.norm(predicted-seed)**2))*.06
  if center[1]>99 and length<17:score*=.05
  if len(x)>120:score*=.2
  candidates.append((score,base,tip,points,labels==label))
 if not candidates:return None
 _,base,tip,points,component=max(candidates,key=lambda a:a[0]);u=(tip-base)/np.linalg.norm(tip-base)
 # Grip is in the handle BEHIND the guard, never the blade endpoint itself.
 hand=base-u*4
 return hand,tip,u,points,component

def track(frame,ref,seed,range_=16):
 x,y=map(round,seed);patch=ref[max(0,y-3):y+4,max(0,x-3):x+4].astype(float)
 # Match colored hand/gauntlet texture, not transparent background.
 mask=(patch[:,:,3]>100)&((patch[:,:,:3].max(2)-patch[:,:,:3].min(2))>22)
 if mask.sum()<3:mask=patch[:,:,3]>100
 if not mask.any():return np.array(seed,dtype=float)
 f=frame.astype(float);m=mask.astype(float);score=np.zeros((154,154))
 for ch in range(4):
  weight=.5 if ch==3 else 1/3
  score+=weight*(signal.correlate2d(f[:,:,ch]**2,m,mode='valid')-2*signal.correlate2d(f[:,:,ch],patch[:,:,ch]*m,mode='valid')+(patch[:,:,ch]**2*m).sum())/max(1,m.sum())
 yy,xx=np.indices(score.shape);score+=((xx+3-x)**2+(yy+3-y)**2)*15
 score[(abs(xx+3-x)>range_)|(abs(yy+3-y)>range_)]=np.inf
 cy,cx=np.unravel_index(np.argmin(score),score.shape);return np.array([cx+3,cy+3],float)

def merge_inpaint(original,edited,mask,hand,tip):
 # Keep the original identity/animation everywhere outside the blade mask.
 out=original.copy();out[mask]=0
 if edited is not None:
  # Only use regenerated armor where the original blade crosses the body core.
  yy,xx=np.indices(mask.shape);body=(xx>68)&(xx<94)&(yy>67)&(yy<98)
  fill=mask&body&(edited[:,:,3]>150)
  # A regenerated blade-like silver pixel is never allowed back into the body.
  ergb=edited[:,:,:3].astype(int);chrom=ergb.max(2)-ergb.min(2)
  fill &= (chrom>45)
  out[fill]=edited[fill]
 return out

def run():
 rig={};quality=[]
 selected=sys.argv[1:]
 if selected:rig=json.loads((ROOT/'js/data/equipment-rig.js').read_text().split('export const EQUIPMENT_RIG=')[1].strip().rstrip(';'))
 for key in (selected or KEYS):
  kind=cls(key);src=ROOT/'assets/chars'/key;dest=ROOT/'assets/chars/rigged'/key;dest.mkdir(parents=True,exist_ok=True);rig[key]={}
  idle=Image.open(src/'idle.webp').convert('RGBA')
  refs=[get_frame(idle,0,d) for d in range(8)]
  body_atlas=Image.new('RGBA',(1280,4000));hand_tiles=[]
  for action in ['idle','walk','normal','skill']:
   im=Image.open(src/(action+'.webp')).convert('RGBA');height=im.height;body=Image.new('RGBA',im.size);hands=Image.new('RGBA',im.size);frames=[]
   generated=None
   donor_action='normal' if action=='idle' else action
   if (key,donor_action) in GENERATED:
    donor=ROOT/'tools/rig/inpainted'/(key+'-'+donor_action+'.webp')
    if not donor.exists():donor=donor.with_suffix('.png')
    generated=Image.open(donor).convert('RGBA').resize((1280,1280),Image.Resampling.NEAREST)
   debug=Image.new('RGB',(1280,1280),'#303b48');dd=ImageDraw.Draw(debug)
   for row in range(8):
    rowdata=[]
    for col in range(1 if action=='idle' else 8):
     sx=row if action=='idle' else col;sy=0 if action=='idle' else row;frame=get_frame(im,sy,sx);ref=refs[row]
     main=track(frame,ref,IDLE_MAIN[kind][row],12 if action=='walk' else 22);angle=math.pi*.7 if row<4 or row==7 else math.pi*.3
     mask=np.zeros((160,160),bool);tip=None;secondary=None
     edit=get_frame(generated,row,0 if action=='idle' else col) if generated is not None else None
     if kind in ['knight','warrior']:
      table=KN if kind=='knight' else WA
      phase=0 if action in ['idle','walk'] else col
      expected=math.radians(table[row][phase])
      if action=='skill' and col==3:expected=math.radians(-145 if kind=='warrior' else table[row][phase])
      guide=W_GUIDES[row][phase] if kind=='warrior' and action=='normal' and key=='warrior' else main
      result=blade(frame,expected,guide,edit,key.endswith('female'))
      if result is not None:
       main,tip,u,points,component=result;angle=math.atan2(u[1],u[0]);mask=ndimage.binary_dilation(component,iterations=1)
       # Never erase the actual gripping glove or boots.
       yy,xx=np.indices(mask.shape);mask &= ((xx-main[0])**2+(yy-main[1])**2>7)
       mask &= ~((yy>101)&(xx>72)&(xx<89))
       if kind=='warrior':secondary=main-u*4
     if kind=='mage':
      # The source staff has a deterministic narrow socket-relative region.
      yy,xx=np.indices(mask.shape);gold=(frame[:,:,0]>frame[:,:,2]*1.3)&(frame[:,:,1]>frame[:,:,2]*1.25)
      mask |= (abs(xx-main[0])<5)&(yy>49)&(yy<110)&gold&((xx<74)|(xx>88));angle=-math.pi/2
     if kind=='elf':angle=-math.pi/2
     if kind=='priest':angle=-math.pi/2
     off=track(frame,ref,IDLE_OFF.get(kind,IDLE_MAIN[kind])[row],18) if kind in ['mage','knight'] else None
     edit=get_frame(generated,row,0 if action=='idle' else col) if generated is not None else None
     clean=merge_inpaint(frame,edit,mask,main,tip)
     if edit is not None:
      # The authored inpaint sheet contains no sword in any attack frame.
      clean=edit.copy();clean[clean[:,:,3]<180]=0;clean[clean[:,:,3]>=180,3]=255
      # Match the accepted original palette, without resizing/repainting poses.
      palette=Image.fromarray(frame).convert('RGB').quantize(colors=112,method=Image.Quantize.MEDIANCUT)
      recolored=Image.fromarray(clean).convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA')
      recolored.putalpha(Image.fromarray(clean[:,:,3]));clean=np.array(recolored)
      # Both lower legs are retained in the cleaned sheet; copying source boots
      # would reintroduce blade pixels when a low swing crosses the ankles.
     overrides={
      ('warrior','normal',5,2):([82,54],[59,65]),('warrior','normal',6,2):([82,52],[56,57]),('warrior','normal',7,2):([83,55],[59,66]),
      ('knight_female','normal',0,2):([65,60],[87,44]),('knight_female','normal',1,2):([64,60],[88,46]),('knight_female','normal',7,2):([73,58],[90,45]),
      ('warrior_female','normal',0,2):([75,64],[97,48]),
      ('warrior','skill',1,5):([72,96],[60,108]),('warrior','skill',3,5):([72,96],[58,108]),('warrior','skill',4,5):([74,97],[58,108]),('warrior','skill',6,4):([90,87],[102,105]),('warrior','skill',7,2):([80,55],[59,67]),
      ('knight','skill',2,2):([66,80],[91,54]),
     }
     override=overrides.get((key,action,row,col))
     if override:
      main=np.array(override[0],float);tip=np.array(override[1],float);u=(tip-main)/np.linalg.norm(tip-main);angle=math.atan2(u[1],u[0]);secondary=main-u*4 if kind=='warrior' else None
     if edit is not None:
      px,py=np.round(main).astype(int)
      if clean[py,px,3]<100:
       yy,xx=np.indices((160,160));choices=(clean[:,:,3]>180)&((xx-main[0])**2+(yy-main[1])**2<30)
       if choices.any():
        ys,xs=np.where(choices);n=np.argmin((xs-main[0])**2+(ys-main[1])**2);main=np.array([xs[n],ys[n]],float)
     if key=='warrior_female' and tip is not None:
      axis=np.array([math.cos(angle),math.sin(angle)])
      def skin_count(point):
       x,y=np.round(point).astype(int);patch=frame[max(0,y-2):y+3,max(0,x-2):x+3].astype(float);r,g,b=patch[:,:,0],patch[:,:,1],patch[:,:,2]
       return int(((patch[:,:,3]>100)&(r>155)&(g>95)&(b>80)&(r>g*1.14)&(b>g*.64)).sum())
      if skin_count(main)<3:
       for step in np.arange(.5,15,.5):
        point=main-axis*step
        if skin_count(point)>=3:main=point;break
      secondary=main-axis*4
     if action=='walk' and kind in ['knight','warrior']:
      # Carry poses keep the blade trailing; the hand follows the authored gait.
      main=track(clean,get_frame(generated,row,0),IDLE_MAIN[kind][row],10)
      angle=math.radians([130,140,150,150,40,40,50,130][row])
      secondary=main-np.array([math.cos(angle),math.sin(angle)])*4 if kind=='warrior' else None
     if kind in ['knight','warrior'] and action in ['normal','skill','idle']:
      # Explicit return pose: source frame 7 is the same closed-fist carry pose.
      if action=='idle' or col==7:
       seed=IDLE_MAIN[kind][row]
       main=track(clean,get_frame(generated,row,0),seed,8)
       angle=math.radians((KN if kind=='knight' else WA)[row][0])
      front={
       ('warrior','normal'):[[70,87],[64,89],[62,70],[64,70],[60,90],[69,91],[64,87],[70,87]],
       ('warrior_female','normal'):[[80,77],[78,77],[72,64],[72,78],[69,86],[79,86],[80,77],[80,77]],
       ('knight','normal'):[[68,89],[66,88],[65,65],[66,56],[88,81],[89,82],[68,89],[68,89]],
       ('warrior','skill'):[[67,84],[64,89],[65,78],[80,40],[73,82],[75,91],[66,87],[67,84]],
      }.get((key,'normal' if action=='idle' else action))
      if row==0 and front:main=np.array(front[0 if action=='idle' else col],float)
      if action in ['normal','skill']:
       angle=math.radians((KN if kind=='knight' else WA)[row][col])
      secondary=main-np.array([math.cos(angle),math.sin(angle)])*4 if kind=='warrior' else None
     if key=='warrior_female' and action in ['idle','normal']:
      female_hands=[
       [[80,77],[78,77],[72,64],[72,78],[69,86],[79,86],[80,77],[80,77]],
       [[75,78],[68,75],[70,64],[69,76],[67,83],[78,88],[70,75],[75,78]],
       [[74,80],[66,73],[68,62],[67,71],[64,86],[76,84],[70,76],[74,80]],
       [[71,84],[69,76],[72,65],[69,71],[65,89],[80,85],[71,78],[71,84]],
       [[89,75],[89,76],[70,63],[94,82],[93,83],[93,83],[88,76],[89,75]],
       [[90,82],[91,75],[85,65],[96,84],[95,85],[86,88],[92,77],[90,82]],
       [[90,81],[96,73],[87,65],[96,81],[98,87],[85,88],[96,76],[90,81]],
       [[82,78],[91,74],[91,66],[92,82],[94,86],[87,89],[84,79],[82,78]],
      ]
      main=np.array(female_hands[row][0 if action=='idle' else col],float)
      secondary=main-np.array([math.cos(angle),math.sin(angle)])*4
     hand_source=clean if edit is not None else frame
     # Closed original hands are a FOREGROUND layer, so fingers occlude the handle.
     overlay=np.zeros_like(frame);yy,xx=np.indices(mask.shape)
     for point in [main,secondary,off]:
      if point is None:continue
      radius=2.4 if kind in ['knight','warrior'] else 2.1
      circle=(xx-point[0])**2+(yy-point[1])**2<=radius**2
      colored=(frame[:,:,:3].max(2)-frame[:,:,:3].min(2)>25)
      circle &= ~(mask if edit is None else np.zeros_like(mask))
      if kind in ['knight','warrior']:circle &= colored
      overlay[circle]=hand_source[circle]
     clean[mask & (frame[:,:,3]==0)]=0
     body.paste(Image.fromarray(clean),(sx*160,sy*160));hands.paste(Image.fromarray(overlay),(sx*160,sy*160))
     meta={'main':[round(float(x),2) for x in main],'angle':round(float(angle),5),'off':[round(float(x),2) for x in off] if off is not None else None,'secondary':[round(float(x),2) for x in secondary] if secondary is not None else None,'mainBehind':row in [3,4,5] and action in ['idle','walk']}
     meta['hands']=[]
     for point in [main,secondary,off]:
      if point is None:continue
      x,y=map(lambda n:round(float(n)),point);tile=Image.fromarray(overlay).crop((x-4,y-4,x+4,y+4));idx=len(hand_tiles);hand_tiles.append(tile);meta['hands'].append({'xy':[idx%32*8,idx//32*8],'at':[x-4,y-4]})
     rowdata.append(meta)
     if action in ['normal','skill']:
      tile=Image.fromarray(frame).crop((35,25,125,120)).resize((152,160),Image.Resampling.NEAREST);debug.paste(tile,(col*160,row*160),tile)
      px=(main[0]-35)*152/90+col*160;py=(main[1]-25)*160/95+row*160;dd.ellipse((px-3,py-3,px+3,py+3),fill='red');dd.text((col*160,row*160),f'{row}:{col}',fill='white')
      if tip is not None:dd.line((px,py,(tip[0]-35)*152/90+col*160,(tip[1]-25)*160/95+row*160),fill='cyan',width=1)
    frames.append(rowdata)
   body_atlas.paste(body,(0,{'idle':0,'walk':160,'normal':1440,'skill':2720}[action]));rig[key][action]=frames
   if kind in ['knight','warrior'] and action in ['normal','skill']:debug.save(WORK/(key+'-'+action+'-rig.png'))
   quality.append({'sprite':key,'action':action,'frames':sum(map(len,frames))})
  body_atlas.save(dest/'body.webp',lossless=True)
  hand_atlas=Image.new('RGBA',(256,math.ceil(len(hand_tiles)/32)*8))
  for idx,tile in enumerate(hand_tiles):hand_atlas.paste(tile,(idx%32*8,idx//32*8))
  hand_atlas.save(dest/'hands.webp',lossless=True)
  for old in list(dest.glob('*.webp')):
   if old.name not in ['body.webp','hands.webp']:old.unlink()
 (ROOT/'js/data/equipment-rig.js').write_text('// Compiled, reviewed source-frame hand sockets. Coordinates use the 160px character cell.\nexport const EQUIPMENT_RIG='+json.dumps(rig,separators=(',',':'))+';\n')
 (WORK/'frame-report.json').write_text(json.dumps(quality,indent=2));print('Compiled',sum(q['frames'] for q in quality),'hand-rig frames')
if __name__=='__main__':
 run()
 # Reapply the separately reviewed walking action after the base rig rebuild.
 if (ROOT/'tools/rig/knight-walk/poses.json').exists():
  from compile_knight_walk import compile_walks
  compile_walks()
 if (ROOT/'tools/rig/warrior-walk/poses.json').exists():
  from compile_knight_walk import compile_walks
  compile_walks(ROOT/'tools/rig/warrior-walk')
 if (ROOT/'tools/rig/archer-walk/poses.json').exists():
  from compile_knight_walk import compile_walks
  compile_walks(ROOT/'tools/rig/archer-walk')
 if (ROOT/'tools/rig/caster-walk/poses.json').exists():
  from compile_knight_walk import compile_walks
  compile_walks(ROOT/'tools/rig/caster-walk')
