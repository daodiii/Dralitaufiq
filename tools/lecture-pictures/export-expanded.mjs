/** Export the selected imagegen masters. Originals are never overwritten.
 * node tools/lecture-pictures/export-expanded.mjs <results-directory> <source-inventory.json> [replacement-name]
 * Results contain {name, source, master, prompt}; the inventory records video and frame identity.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const [results, inventoryFile, replacement] = process.argv.slice(2);
const inventory = JSON.parse(await fs.readFile(inventoryFile, 'utf8'));
const output = 'src/assets/lectures/edited';
const publicOutput = 'public/lecture-portraits';
await fs.mkdir(output, {recursive:true});
await fs.mkdir(publicOutput, {recursive:true});
let count = 0;
for (const filename of (await fs.readdir(results)).filter(n => n.endsWith('.json'))) {
  const result = JSON.parse(await fs.readFile(path.join(results, filename), 'utf8'));
  if (!result.master || !/^[A-Za-z0-9_-]+$/.test(result.name)) throw new Error(`Invalid result: ${filename}`);
  const input = inventory.find(e => e.name === result.name);
  const name = input?.kind === 'talk' ? `talk-${result.name}` : result.name;
  const jpg = path.join(output, `${name}.jpg`);
  // An existing full set is immutable for this run, avoiding repeated image encoding.
  if (name !== replacement) {
    try { await fs.access(jpg); await fs.access(path.join(publicOutput, `${name}-1600.webp`)); continue; } catch {}
  }
  const master = await sharp(result.master).resize(1600, 900, {fit:'contain', background:'#ece2cf'}).toBuffer();
  await sharp(master).jpeg({quality:93, mozjpeg:true}).toFile(jpg);
  for (const width of [480,960,1600]) await sharp(master).resize(width).webp({quality:85}).toFile(path.join(publicOutput, `${name}-${width}.webp`));
  count++;
}
console.log(`Exported ${count} new enhanced photographs`);
