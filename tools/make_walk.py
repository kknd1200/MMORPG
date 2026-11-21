"""8방향 걷기 시트 만들기 (assets/chars/<이름>/idle.webp → walk.webp)

팩에 걷기 그림이 없어서, 각 방향의 대기 그림에서 다리를 떼어 8프레임 걸음을 만듭니다.
참고 걸음(8프레임, 프레임당 0.2초): 디딤 → 내려앉음 → 한 발 들고 지나감 → 올라감 → 반대 발 …
  - 앞 · 뒷모습(남 · 북): 다리를 왼쪽 · 오른쪽으로 나눠, 드는 발의 정강이를 1~2px 끌어올림
  - 옆 · 대각선: 같은 방식에 더해, 발 쪽으로 갈수록 앞뒤로 기울여(엉덩이는 고정) 다리가 벌어졌다 모임
  - 몸 전체: 두 발이 닿을 때 1px 내려가고, 발이 지나갈 때 원래 높이
사용: python3 tools/make_walk.py            (모든 캐릭터)
"""
import glob, os, sys
from PIL import Image

C = 160
# 방향 순서: 남 남서 서 북서 북 북동 동 남동. side = 화면에서 앞으로 나가는 x 방향(옆모습 성분)
SIDE = [0, -1, -1, -1, 0, 1, 1, 1]
SIDE_K = [0, 0.6, 1, 0.6, 0, 0.6, 1, 0.6]
# 8프레임: 왼발 기준 (들림 px, 앞뒤 벌림 비율), 오른발은 4프레임 늦게
LIFT = [0, 0, 1, 2, 2, 1, 0, 0]
STRIDE = [1, 0.6, 0, -0.6, -1, -0.6, 0, 0.6]   # +1 = 앞으로 가장 많이 나감
BOB = [0, 1, 0, 0, 0, 1, 0, 0]                   # 1 = 몸이 1px 내려감 (디딘 직후)


def bbox(im):
    return im.getchannel('A').getbbox()


def split_x(frame, y0, y1, x0, x1):
    """다리 사이 틈: 다리 영역에서 불투명 픽셀이 가장 적은 세로줄 (가운데 근처)"""
    a = frame.getchannel('A').load()
    cx = (x0 + x1) // 2
    best, bx = 1e9, cx
    for x in range(cx - 4, cx + 5):
        n = sum(1 for y in range(y0, y1) if a[x, y] > 0)
        score = n + abs(x - cx) * 0.3
        if score < best:
            best, bx = score, x
    return bx


def shear(piece, amount):
    """엉덩이(위)는 그대로, 발(아래)로 갈수록 amount 만큼 옆으로 — 다리가 앞뒤로 벌어지는 모양"""
    if not amount:
        return piece
    w, h = piece.size
    out = Image.new('RGBA', (w, h))
    for y in range(h):
        dx = round(amount * (y + 1) / h)
        out.alpha_composite(piece.crop((0, y, w, y + 1)), (dx, y))
    return out


def walk_frame(src, d, i):
    x0, top, x1, foot = bbox(src)
    h = foot - top
    hip = foot - round(h * 0.34)
    knee = foot - round(h * 0.18)
    out = src.copy()
    out.paste(Image.new('RGBA', (C, C - hip)), (0, hip))   # 다리 영역은 비우고 다시 그림
    side, k = SIDE[d], SIDE_K[d]
    sx = split_x(src, hip, foot, x0, x1)
    legs = src.crop((0, hip, C, C))
    halves = [(legs.crop((0, 0, sx, C - hip)), 0), (legs.crop((sx, 0, C, C - hip)), sx)]
    pieces = []
    for leg, (piece, ox) in enumerate(halves):
        f = (i + 4 * leg) % 8
        lift = LIFT[f]
        # 옆 · 대각선: 바라보는 쪽(side)으로 앞다리가 나갔다 들어옴 (최대 3px)
        piece = shear(piece, round(STRIDE[f] * 3 * k) * (side or 0))
        if lift:
            kk = knee - hip
            shin = piece.crop((0, kk, piece.width, piece.height))
            p2 = piece.copy()
            p2.paste(Image.new('RGBA', (piece.width, piece.height - kk)), (0, kk))
            p2.alpha_composite(shin, (0, kk - lift))
            piece = p2
        pieces.append((lift, piece, ox))
    pieces.sort(key=lambda t: t[0])   # 들린 발을 나중에(앞에) 그림
    for lift, piece, ox in pieces:
        out.alpha_composite(piece, (ox, hip))
    if BOB[i]:
        # 디딘 직후: 엉덩이 위 몸이 1px 내려앉음 (발은 땅에 그대로)
        upper = out.crop((0, 0, C, hip))
        lower = out.crop((0, hip, C, C))
        out = Image.new('RGBA', (C, C))
        out.alpha_composite(lower, (0, hip))
        out.alpha_composite(upper, (0, 1))
    return out


def make(key_dir):
    idle = Image.open(os.path.join(key_dir, 'idle.webp')).convert('RGBA')
    sheet = Image.new('RGBA', (C * 8, C * 8))
    for d in range(8):
        src = idle.crop((d * C, 0, d * C + C, C))
        for i in range(8):
            sheet.alpha_composite(walk_frame(src, d, i), (i * C, d * C))
    sheet.save(os.path.join(key_dir, 'walk.webp'), 'WEBP', lossless=True, quality=100, method=6)


if __name__ == '__main__':
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'chars')
    keys = sys.argv[1:] or sorted(os.listdir(root))
    for k in keys:
        if os.path.exists(os.path.join(root, k, 'idle.webp')):
            make(os.path.join(root, k))
            print('walk.webp', k)
