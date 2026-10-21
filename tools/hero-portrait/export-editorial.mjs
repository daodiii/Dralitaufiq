/** Export web source assets from the locally upscaled, lossless portrait masters.
 * Usage: node tools/hero-portrait/export-editorial.mjs hero-4x.png about-4x.png
 * Upscale the original imagegen PNGs, never the previously enlarged JPEGs.
 */
import sharp from 'sharp';
import { rename, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const [heroPath, aboutPath] = process.argv.slice(2);
if (!heroPath || !aboutPath) throw new Error('Provide the upscaled hero and biography PNG paths.');
const root = new URL('../../', import.meta.url);

async function write(pipeline, relativePath) {
  const target = fileURLToPath(new URL(relativePath, root));
  const temporary = `${target}.tmp.jpg`;
  await pipeline.jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(temporary);
  const { size } = await stat(temporary);
  if (size < 50_000) throw new Error(`Unexpectedly small portrait export: ${relativePath}`);
  await rename(temporary, target);
  console.log(`${relativePath}: ${Math.round(size / 1024)} KiB`);
}

// Both hero images share a 2400px coordinate system used by the scroll animation.
// Remove the upscaler's faint near-black pedestal so the banner meets #000 cleanly.
const hero = await sharp(heroPath).resize(2400, 2400, { fit: 'fill', kernel: 'lanczos3' })
  .linear(255 / 249, -6 * 255 / 249).png().toBuffer();
await write(sharp(hero), 'src/assets/hero/portrait-editorial-open.jpg');
await write(sharp(hero).extract({ left: 200, top: 0, width: 1956, height: 2400 }), 'src/assets/hero/portrait-editorial-plate.jpg');
await write(sharp(aboutPath).resize(1920, 2400, { fit: 'cover', position: 'centre', kernel: 'lanczos3' }), 'src/assets/about/portrait-editorial.jpg');
