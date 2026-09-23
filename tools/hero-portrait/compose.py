"""Step 2: the portrait on pure black.

Everything that is not him goes black, with his edges cleaned of the white wall behind him.
Where the circle the photograph was cut to ran through his shoulders and chest, he fades into
the dark instead. With --calligraphy, the gold lettering on the two green panels behind him
(the name of God and the shahada) is lifted off its green and kept.

Reads work/master.png and work/alpha.png (segment.py); writes work/portrait.png and
work/preview.jpg.
Usage: python compose.py [--calligraphy]
"""
import argparse
import os

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, 'work')

# The shahada's panel is a slightly tilted rectangle whose upper right corner the circle cut
# away; its corners, from lines fitted to its intact dark-green margin (master pixels).
SHAHADA = np.array([[1561, 326], [2096, 269], [2096, 480], [1561, 525]], np.int32)
GOLD = np.array([205, 158, 84], np.float32)  # the letters' own gold, from the Allah panel


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def blur_fusion(img, alpha, r):
    """Approximate fast foreground colour estimation (Forte & Pitie 2021)."""
    a3 = alpha[..., None]

    def once(F, B, r):
        ba = cv2.blur(alpha, (r, r))[..., None]
        bF = cv2.blur(F * a3, (r, r)) / (ba + 1e-5)
        bB = cv2.blur(B * (1 - a3), (r, r)) / ((1 - ba) + 1e-5)
        F = bF + a3 * (img - a3 * bF - (1 - a3) * bB)
        return np.clip(F, 0, 1), bB

    F, bB = once(img, img, r)
    F, _ = once(F, bB, 6)
    return F


def calligraphy(I, A, inside):
    """The gold letters of both panels on black; nothing else of the room."""
    H, W = A.shape
    Iu = I * 255
    R, G = Iu[..., 0], Iu[..., 1]
    green = ((G > R + 5) & (Iu.mean(2) < 95) & (A < 0.05) & (inside > 0)).astype(np.uint8)
    green = cv2.morphologyEx(green, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    _, lab, stats, _ = cv2.connectedComponentsWithStats(green, 8)
    big = np.argsort(-stats[:, cv2.CC_STAT_AREA])[1:3]
    allah = min(big, key=lambda i: stats[i, cv2.CC_STAT_LEFT])
    panels = np.zeros((H, W), np.uint8)
    cv2.fillConvexPoly(panels, cv2.convexHull(cv2.findNonZero((lab == allah).astype(np.uint8))), 1)
    cv2.fillConvexPoly(panels, SHAHADA, 1)
    panels = cv2.GaussianBlur(cv2.erode(panels, np.ones((7, 7), np.uint8)).astype(np.float32), (0, 0), 2)

    # The panel's own green, carried under the letters (normalised convolution).
    gm = green.astype(np.float32)
    num = cv2.GaussianBlur(Iu * gm[..., None], (0, 0), 18)
    den = cv2.GaussianBlur(gm, (0, 0), 18)[..., None]
    Bg = np.where(den > 0.02, num / np.maximum(den, 1e-4), np.array([43, 56, 47], np.float32))

    d = GOLD - Bg
    ag = np.clip(((Iu - Bg) * d).sum(2) / (d * d).sum(2), 0, 1)
    ag = ag * smoothstep(0.03, 0.10, ag)
    gold = np.clip(Iu - (1 - ag[..., None]) * Bg, 0, 255) / 255
    # The circle clipped the tops of the shahada's first letters. Keep what was photographed, but
    # end those strokes as softly as the out-of-focus letters end everywhere else.
    gold *= (panels * smoothstep(4, 18, inside))[..., None]
    # The panels' texture leaves a faint haze (up to 4/255) that would show as a lighter
    # rectangle on a good screen; the letters' soft edges run far above it.
    gold *= smoothstep(4 / 255, 10 / 255, gold.max(2))[..., None]
    # Nothing of the panel under him (his gold kufi must not be read as lettering).
    under = cv2.dilate((A > 0.02).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32)
    return gold * (1 - under)[..., None]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--calligraphy', action='store_true', help='keep the gold lettering behind him')
    args = ap.parse_args()

    I = np.asarray(Image.open(os.path.join(WORK, 'master.png')).convert('RGB'), np.float32) / 255
    A = np.asarray(Image.open(os.path.join(WORK, 'alpha.png')), np.float32) / 255
    H, W = A.shape
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    # The circle the photograph was cut to, from its white surround.
    ys, xs = np.nonzero(~(I > 250 / 255).all(2))
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    cr = ((xs.max() - xs.min()) + (ys.max() - ys.min())) / 4
    inside = cr - np.hypot(xx - cx, yy - cy)  # px inside the circle's edge, negative outside

    F = blur_fusion(I, A, 90)
    # Where the circle cut through his shoulders and chest, he falls away into the dark: a fade
    # that follows the circle's edge on the lower half, and a gentle one towards the foot.
    lower = smoothstep(0.50 * H, 0.66 * H, yy)
    fade = (1 - lower * (1 - smoothstep(8, 0.13 * H, inside))) * (1 - 0.9 * smoothstep(0.70 * H, 0.97 * H, yy))
    Ap = (A * fade)[..., None]

    back = calligraphy(I, A, inside) if args.calligraphy else 0
    out = np.clip(F * Ap + back * (1 - Ap), 0, 1)
    img = Image.fromarray((out * 255 + 0.5).astype(np.uint8))
    img.save(os.path.join(WORK, 'portrait.png'))
    img.resize((900, 900), Image.LANCZOS).save(os.path.join(WORK, 'preview.jpg'), quality=92)
    print('wrote work/portrait.png, work/preview.jpg', '(with calligraphy)' if args.calligraphy else '')


if __name__ == '__main__':
    main()
