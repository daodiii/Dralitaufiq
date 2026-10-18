import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yFor } from '../src/scripts/revisit.ts';

/* Where a reload or a Back lands: the same pixel in the same window, the same share of the way
   down in another, never off the page, and the top for a place that was the top. */

const kept = { y: 4325, w: 1440, h: 900, max: 12469 };

test('the same window returns to the same pixel', () => {
  assert.equal(yFor(kept, 1440, 900, 12469), 4325);
});

test('the same window returns to the same pixel even if the page grew a little', () => {
  assert.equal(yFor(kept, 1440, 900, 12480), 4325);
});

test('another window returns to the same share of the way down', () => {
  assert.equal(yFor(kept, 810, 1080, 13690), Math.round((4325 / 12469) * 13690));
});

test('a page that is shorter now holds the reader inside it', () => {
  assert.equal(yFor(kept, 1440, 900, 3000), 3000);
});

test('the top stays the top, and a page that cannot scroll has no place to return to', () => {
  assert.equal(yFor({ ...kept, y: 0 }, 1440, 900, 12469), 0);
  assert.equal(yFor(kept, 1440, 900, 0), 0);
});

test('a place kept with no length to scale by falls back to the top in a different window', () => {
  assert.equal(yFor({ ...kept, max: 0 }, 810, 1080, 13690), 0);
});
