# Editorial homepage portraits

Created on 2026-10-21 with the built-in imagegen tool, using the existing website portraits as edit targets. The original photographs remain in the repository.

## Delivered assets

- `src/assets/hero/portrait-editorial-open.jpg`: 2400 × 2400 banner.
- `src/assets/hero/portrait-editorial-plate.jpg`: 1956 × 2400 crop of the same banner, beginning at x=200, y=0. This preserves the existing animation's shared coordinate system.
- `src/assets/about/portrait-editorial.jpg`: 1920 × 2400 biography portrait.

The imagegen originals are 1254 × 1254 (hero) and 1122 × 1402 (biography). Both were enhanced locally with Upscayl's `high-fidelity-4x` model, producing 5016 × 5016 and 4488 × 5608 lossless PNG masters. These enhanced details are inferred, not newly captured photographic detail. Sharp downsamples the enhanced masters to the website source dimensions above, with JPEG quality 92 and 4:4:4 chroma. Astro serves responsive WebP derivatives at quality 82 rather than delivering these large source files to visitors.

The banner uses 480, 720, 960, 1300, 1800 and 2400px variants; the plate uses 480, 720 and 1180px variants; the biography uses 320, 520, 800 and 1200px variants. The `sizes` attributes match the portrait layout rules so smaller screens can select smaller files. The banner remains eagerly loaded with high fetch priority; the biography remains lazy loaded.

### Local upscale and export

Use the installed Upscayl CLI with the original imagegen PNGs as inputs, and save intermediates under the ignored `work/editorial/` directory:

```powershell
& 'C:/Program Files/Upscayl/resources/bin/upscayl-bin.exe' -i <original.png> -o <master-4x.png> -m 'C:/Program Files/Upscayl/resources/models' -n high-fidelity-4x -s 4 -f png
node tools/hero-portrait/export-editorial.mjs tools/hero-portrait/work/editorial/hero-4x.png tools/hero-portrait/work/editorial/about-4x.png
npm run build
```

The lossless working masters are excluded from Git; the optimized source assets and export script are versioned. The export script writes each JPEG to a temporary sibling and then replaces the destination. The hero's black point is corrected by six levels to remove the upscaler's faint background pedestal and blend cleanly into the page's pure-black banner.

## Prompt direction

Both prompts used the `identity-preserve` edit category and explicitly required preservation of the subject's identity, age, skin tone, facial proportions, beard, glasses, clothing, gaze and expression. They requested photorealistic editorial portraiture, natural pores and age lines, fine textile detail, and no text, watermarks, props or artificial skin smoothing.

### Opening portrait

Retouch the exact portrait into an exceptional fine-art editorial studio photograph. Preserve the square composition and head/shoulder scale, with the eye midpoint around x49.08%, y33% and the cap beginning around y13%. Use a large soft sculpting key light from upper camera left, delicate warm edge separation, rich open shadows, luminous natural skin and clear eyes. Remove distracting blue eyeglass reflections without changing the eyes. Restore photographic beard, embroidery and fabric detail; correct excessive orange cast and oily highlights. Keep the outer background pure black and gently fade the shoulders into black at the bottom. Use restrained warm gold and deep brown tonal harmony.

### Biography portrait

Transform the exact photograph into a professional editorial portrait with fine-art photographic lighting and natural detail. Preserve the thoughtful expression, head angle and gaze toward camera left, the white embroidered kufi and white thobe. Remove the microphone, boom arm and cable, reconstructing only the obscured garment. Replace distracting furniture and lamps with a softly graduated, subtly textured warm taupe/umber studio backdrop. Use a large soft north-window key light from camera left and gentle warm shoulder separation; retain detail in the white fabric, natural brown skin and clear eyeglasses. Compose a vertical 4:5 mid-chest portrait with breathing room above the entire kufi, head centered, shoulders retained and face in the upper half. Complement ivory paper and antique gold typography.

## Regeneration

The older segmentation scripts described in `README.md` produce the original image files. They do not reproduce these AI-assisted editorial edits. Keep the opening banner and plate derived from the same master if either is updated.
