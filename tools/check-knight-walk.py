"""Check the delivered walking pixels, compiled atlas, and foreground sockets."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
rig = json.loads((ROOT / 'js/data/equipment-rig.js').read_text().split('export const EQUIPMENT_RIG=')[1].strip().rstrip(';'))
for key in ['knight', 'knight_female']:
    walk = Image.open(ROOT / 'assets/chars' / key / 'walk.webp').convert('RGBA')
    body = Image.open(ROOT / 'assets/chars/rigged' / key / 'body.webp').convert('RGBA')
    assert walk.size == (1280, 1280)
    assert body.crop((0, 160, 1280, 1440)).tobytes() == walk.tobytes()
    for row in range(8):
        frames = []
        for col in range(8):
            f = walk.crop((col * 160, row * 160, (col + 1) * 160, (row + 1) * 160))
            box = f.getbbox()
            assert box and 0 < box[0] < box[2] < 160 and 0 < box[1] < box[3] < 160
            assert 45 <= box[3] - box[1] <= 62, (key, row, col, box)
            for name in ['main', 'off']:
                x, y = (round(v) for v in rig[key]['walk'][row][col][name])
                assert f.getpixel((x, y))[3] > 100, (key, row, col, name)
            if row == 0:
                # Both front-view greaves/boots must remain present in every pose.
                for left, right in [(68, 80), (80, 92)]:
                    coverage = sum(f.getpixel((x, y))[3] > 128 for x in range(left, right) for y in range(91, 110))
                    assert coverage >= 35, (key, col, left, coverage)
            frames.append(f.tobytes())
        assert len(set(frames)) == 8, (key, row, 'duplicate pose')
print('128 knight walking frames: complete, distinct, both front legs present, sockets attached')
