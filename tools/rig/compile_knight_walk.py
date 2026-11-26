"""Install reviewed knight walk sheets and sockets without changing other actions.

Artwork originates from image generation; this compiler only packs finished pixels
and extracts foreground glove patches. Run after build_equipment_rig.py.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).with_name('knight-walk')
RIG_FILE = ROOT / 'js/data/equipment-rig.js'


def compile_walks(source=SOURCE):
    rig = json.loads(RIG_FILE.read_text().split('export const EQUIPMENT_RIG=')[1].strip().rstrip(';'))
    sockets = json.loads((source / 'poses.json').read_text())
    for key, rows in sockets.items():
        sheet = Image.open(source / (key + '.webp')).convert('RGBA')
        assert sheet.size == (1280, 1280)
        dest = ROOT / 'assets/chars/rigged' / key
        body = Image.open(dest / 'body.webp').convert('RGBA')
        hands = Image.open(dest / 'hands.webp').convert('RGBA')
        body.paste(sheet, (0, 160))
        for row in range(8):
            for col in range(8):
                frame = sheet.crop((col * 160, row * 160, (col + 1) * 160, (row + 1) * 160))
                old = rig[key]['walk'][row][col]
                pose = dict(rows[row][col])
                pose['hands'] = []
                names = [n for n in ['main', 'secondary', 'off'] if pose.get(n) is not None]
                assert len(names) == len(old['hands']), (key, row, col)
                for name, patch in zip(names, old['hands']):
                    x, y = (round(v) for v in pose[name])
                    at = [x - 4, y - 4]
                    tile = frame.crop((at[0], at[1], at[0] + 8, at[1] + 8))
                    # Only the fist covers the handle, not an entire sleeve/shield.
                    alpha = tile.getchannel('A')
                    for py in range(8):
                        for px in range(8):
                            if (px - 4) ** 2 + (py - 4) ** 2 > 6.25:
                                alpha.putpixel((px, py), 0)
                    tile.putalpha(alpha)
                    hands.paste(tile, tuple(patch['xy']))
                    pose['hands'].append({'xy': patch['xy'], 'at': at})
                rig[key]['walk'][row][col] = pose
        body.save(dest / 'body.webp', lossless=True)
        hands.save(dest / 'hands.webp', lossless=True)
        sheet.save(ROOT / 'assets/chars' / key / 'walk.webp', lossless=True)
    RIG_FILE.write_text('// Compiled, reviewed source-frame hand sockets. Coordinates use the 160px character cell.\nexport const EQUIPMENT_RIG=' + json.dumps(rig, separators=(',', ':')) + ';\n')
    print(f'Installed {len(sockets) * 64} walking poses: {", ".join(sockets)}')


if __name__ == '__main__':
    compile_walks()
