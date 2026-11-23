"""Pixel-level art regression check. Run with Python + Pillow after editing warrior art."""
from pathlib import Path
from PIL import Image

sheet = Image.open(Path(__file__).resolve().parents[1] / 'assets/chars/warrior/walk.webp').convert('RGBA')
assert sheet.size == (1280, 1280), 'Unexpected warrior walk atlas dimensions'
for frame in range(8):
    cell = sheet.crop((frame * 160, 0, (frame + 1) * 160, 160))
    coverage = []
    for side, x0, x1 in [('right (viewer left)', 68, 80), ('left (viewer right)', 80, 92)]:
        rows = [sum(cell.getpixel((x, y))[3] >= 128 for x in range(x0, x1)) for y in range(88, 113)]
        count = sum(rows)
        assert count >= 130, f'Frame {frame}: {side} leg loses opaque pixels ({count})'
        assert sum(n > 0 for n in rows) >= 18, f'Frame {frame}: {side} shin/boot is truncated'
        coverage.append(count)
    assert min(coverage) / max(coverage) >= 0.62, f'Frame {frame}: one leg becomes too thin'
print('Warrior front walk: both legs remain visible in all 8 frames')
