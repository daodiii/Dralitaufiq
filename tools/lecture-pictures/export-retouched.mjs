/** Export selected retouched masters; this does not generate or retouch images.
 * node tools/lecture-pictures/export-retouched.mjs <JSON mapping name to master PNG path>
 * Originals under assets/lectures/screen stay untouched. */
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
const source = 'src/assets/lectures/edited';
const web = 'public/lecture-portraits';
await mkdir(source, { recursive: true });
await mkdir(web, { recursive: true });
for (const name of ['quran', 'brief', 'riyad', 'companions', 'sira', 'bulugh', 'opening']) {
  if (!input[name]) throw new Error(`Missing retouched master: ${name}`);
  const master = await sharp(input[name]).resize(1600, 900, { fit: 'cover' }).toBuffer();
  await sharp(master).jpeg({ quality: 93, mozjpeg: true }).toFile(path.join(source, `${name}.jpg`));
  for (const width of [480, 960, 1600]) {
    await sharp(master).resize(width).webp({ quality: 85 }).toFile(path.join(web, `${name}-${width}.webp`));
  }
  console.log(`Exported ${name}: JPEG master and 480/960/1600 WebP`);
}
