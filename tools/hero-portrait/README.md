# Hero portrait

The hero's photograph, `src/assets/hero/portrait-open.jpg` (the banner) and `portrait-plate.jpg`
(the print on the page), is made from the mosque portrait: `1000045176.jpg`, a 1254px phone
photo already cut to a circle on white, upscaled 5x with Upscayl
(`Downloads/1000045176_upscayl_5x_upscayl-standard-4x.png`). He is matted out, everything else
goes to pure black, and he fades into the dark where the circle cut through his shoulders.
Regenerate from the source rather than editing the JPEGs.

## Run

```
python -m venv venv
venv\Scripts\python -m pip install -r requirements.txt
venv\Scripts\python segment.py [source image]
venv\Scripts\python compose.py [--calligraphy]
venv\Scripts\python export.py
```

`segment.py` downloads the model on its first run (BiRefNet-portrait, 927 MB, from rembg's
releases, checked by md5) into `models/`, and takes about a minute on the CPU. `compose.py`
writes `work/preview.jpg` to look at before `export.py` replaces the site's images.

`--calligraphy` keeps the gold lettering of the two panels behind him, the name of God and the
shahada, lifted off their green onto the black. The circle had clipped the tops of the
shahada's first word, and that cut is only softened, not redrawn.

## Tied to this photograph

- `compose.py`: `SHAHADA`, the corners of the shahada's panel, and `GOLD`, the letters' colour.
  The circle is found from the white surround.
- `export.py`: `FACE` (between his eyes) and the plate's size and offset. These are the `SHOT`
  and `PLATE` constants in `src/components/Hero.astro`, and `FACE / 2400` is the `0.4908` and
  `0.33` in its stylesheet: change them together.

## Why not rembg

Importing rembg compiles pymatting with numba, whose cache path passes Windows' 260-character
limit from a deep folder, so the model is run directly on onnxruntime with rembg's own pre- and
post-processing.
