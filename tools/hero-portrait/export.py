"""Step 3: write the hero's two sources into src/assets/hero.

portrait-open.jpg  : the whole portrait on black (the banner).
portrait-plate.jpg : the print on the page, cut from the same image at the same scale, so
                     plate (x, y) = open (x + PLATE_X, y).

FACE and the plate's size are the SHOT and PLATE constants in src/components/Hero.astro, and
FACE / 2400 is the 0.4908 and 0.33 in its stylesheet: change them together.
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(HERE, '..', '..', 'src', 'assets', 'hero'))

FACE = (1178, 792)  # between his eyes, in master pixels
PLATE_W, PLATE_H = 1956, 2400  # the plate's 1180:1448 shape at full height
PLATE_X = FACE[0] - PLATE_W // 2


def write(img, name):
    """Write beside the target, then rename over it, so a failed save never empties it."""
    final = os.path.join(DEST, name)
    tmp = final + '.tmp.jpg'
    img.save(tmp, quality=95, subsampling=0, optimize=True)
    assert os.path.getsize(tmp) > 50_000, os.path.getsize(tmp)
    os.replace(tmp, final)
    print(name, img.size, os.path.getsize(final) // 1024, 'KB')


def main():
    master = Image.open(os.path.join(HERE, 'work', 'portrait.png')).convert('RGB')
    assert master.size == (2400, 2400), master.size
    assert 0 <= PLATE_X and PLATE_X + PLATE_W <= 2400, PLATE_X
    write(master, 'portrait-open.jpg')
    write(master.crop((PLATE_X, 0, PLATE_X + PLATE_W, PLATE_H)), 'portrait-plate.jpg')
    print('face in open', FACE, 'in plate', (FACE[0] - PLATE_X, FACE[1]))


if __name__ == '__main__':
    main()
