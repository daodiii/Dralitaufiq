import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distinct, hex, kmeans, type RGB } from '../../src/lib/palette.ts';

const cluster = (c: RGB, n: number): RGB[] =>
  Array.from({ length: n }, (_, i) => [c[0] + (i % 3) - 1, c[1], c[2] + (i % 2)] as RGB);

test('kmeans finds two clusters, the larger first', () => {
  const out = kmeans([...cluster([240, 20, 20], 60), ...cluster([20, 20, 240], 30)], 2);
  assert.equal(out.length, 2);
  assert.equal(out[0].n, 60);
  assert.ok(Math.abs(out[0].c[0] - 240) < 2);
  assert.ok(Math.abs(out[1].c[2] - 240) < 2);
});

test('kmeans is deterministic', () => {
  const px = [...cluster([200, 150, 30], 40), ...cluster([30, 90, 160], 25), ...cluster([240, 240, 235], 35)];
  assert.deepEqual(kmeans(px, 3), kmeans(px, 3));
});

test('distinct merges near colours and keeps far ones', () => {
  const out = distinct([
    { c: [100, 100, 100], n: 5 },
    { c: [110, 104, 100], n: 3 },
    { c: [200, 20, 20], n: 4 },
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(
    out.map((s) => s.n),
    [8, 4]
  );
});

test('hex rounds and clamps', () => {
  assert.equal(hex([255.4, -3, 16]), '#ff0010');
});
