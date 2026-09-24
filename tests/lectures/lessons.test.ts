import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* data/lessons.json, as docs/research/youtube/lessons.mjs writes it: every lesson of the seven
   series, in teaching order, with its picture (lib/stills.ts). */

interface Lesson {
  id: string;
  n: number;
  m: number;
  t: string;
  s?: number;
  w?: string;
  p?: number;
  f?: number;
  fv?: string;
  x?: string;
}
const data: Record<string, { pl: string; lessons: Lesson[] }> = JSON.parse(
  fs.readFileSync(new URL('../../src/data/lessons.json', import.meta.url), 'utf8')
);

test('each lesson number appears once in its series, parts of one lesson aside', () => {
  for (const [key, { lessons }] of Object.entries(data)) {
    const seen = new Set<string>();
    for (const l of lessons) {
      const k = `${l.n}/${l.p ?? 0}`;
      assert.ok(!seen.has(k), `${key}: lesson ${l.n}${l.p ? ` part ${l.p}` : ''} twice`);
      seen.add(k);
    }
  }
});

test('a Companion’s name carries no part marker or number', () => {
  for (const l of data.companions.lessons) if (l.w) assert.doesNotMatch(l.w, /\d|\bQ\./, `lesson ${l.n}: "${l.w}"`);
});

test('the Qur’an’s lessons never go back to an earlier sūrah (each heading appears once)', () => {
  const s = data.quran.lessons.map((l) => l.s ?? 1);
  s.forEach((v, i) => i && assert.ok(v >= s[i - 1], `lesson ${data.quran.lessons[i].n} goes back to sūrah ${v}`));
});

test('the pictures name a frame YouTube has, a size, and a real lesson', () => {
  const ids = new Set(Object.values(data).flatMap((v) => v.lessons.map((l) => l.id)));
  for (const { lessons } of Object.values(data))
    for (const l of lessons) {
      if (l.f !== undefined) assert.ok([0, 1, 2, 3].includes(l.f), `${l.id}: f ${l.f}`);
      if (l.x !== undefined) assert.ok(['sd', 'hq'].includes(l.x), `${l.id}: x ${l.x}`);
      if (l.fv !== undefined) assert.ok(ids.has(l.fv) && l.fv !== l.id, `${l.id}: fv ${l.fv}`);
    }
});
