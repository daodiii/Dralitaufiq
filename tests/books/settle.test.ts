import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleIndex } from '../../src/scripts/books/gl/settle.ts';

/* Where a scroll that has come to rest between two stops goes on to. `u` is the position in stops
   (1.5 is half way from the second stop to the third), `dir` the direction it was travelling,
   `tol` how near a stop counts as on it, in stops. */

const TOL = 0.03;

test('on a stop, or within the tolerance of one, it stays there', () => {
  assert.equal(settleIndex(2, 1, TOL), 2);
  assert.equal(settleIndex(2.02, 1, TOL), 2);
  assert.equal(settleIndex(1.98, -1, TOL), 2);
});

test('past the tolerance it carries on the way it was going', () => {
  assert.equal(settleIndex(0.1, 1, TOL), 1);
  assert.equal(settleIndex(0.9, -1, TOL), 0);
  assert.equal(settleIndex(1.95, -1, TOL), 1);
  assert.equal(settleIndex(1.05, 1, TOL), 2);
});

test('the direction decides, not the nearest stop', () => {
  assert.equal(settleIndex(1.2, -1, TOL), 1);
  assert.equal(settleIndex(1.2, 1, TOL), 2);
  assert.equal(settleIndex(1.8, -1, TOL), 1);
});

test('it never goes past the first or last stop', () => {
  assert.equal(settleIndex(0, -1, TOL), 0);
  assert.equal(settleIndex(3, 1, TOL, 3), 3);
  assert.equal(settleIndex(2.5, 1, TOL, 3), 3);
});
