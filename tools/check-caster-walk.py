"""Verify the delivered mage/priest walking frames, sockets and visible foot band."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
rig = json.loads((ROOT / 'js/data/equipment-rig.js').read_text().split('export const EQUIPMENT_RIG=')[1].strip().rstrip(';'))
for key in ['mage_male', 'mage', 'priest', 'priest_female']:
    walk = Image.open(ROOT / 'assets/chars' / key / 'walk.webp').convert('RGBA')
    body = Image.open(ROOT / 'assets/chars/rigged' / key / 'body.webp').convert('RGBA')
    assert walk.size == (1280, 1280)
    assert body.crop((0, 160, 1280, 1440)).tobytes() == walk.tobytes()
    for row in range(8):
        frames, lower = [], []
        for col in range(8):
            f = walk.crop((col * 160, row * 160, (col + 1) * 160, (row + 1) * 160))
            box = f.getbbox()
            assert box and 0 < box[0] < box[2] < 160 and 0 < box[1] < box[3] < 160
            assert 46 <= box[3] - box[1] <= 62, (key, row, col, box)
            pose = rig[key]['walk'][row][col]
            for name in ['main', 'off']:
                if pose.get(name) is None:
                    continue
                x, y = (round(v) for v in pose[name])
                assert f.getpixel((x, y))[3] > 100, (key, row, col, name)
            # A full robe can cover the swing foot; at least the supporting
            # boot/hem must remain grounded and the lower silhouette must move.
            grounded = sum(f.getpixel((x, y))[3] > 128 for x in range(55, 106) for y in range(102, 111))
            assert grounded >= 4, (key, row, col, grounded)
            frames.append(f.tobytes())
            lower.append(f.crop((48, 94, 112, 112)).tobytes())
        assert len(set(frames)) == 8, (key, row, 'duplicate pose')
        assert len(set(lower)) >= 6, (key, row, 'stationary lower robe/feet')
print('256 mage/priest walk frames: complete, distinct, grounded foot bands and attached sockets')
