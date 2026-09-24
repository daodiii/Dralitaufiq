import { test } from 'node:test';
import assert from 'node:assert/strict';
import { still, pictureOf, sharpSizes } from '../../src/lib/stills.ts';

/* YouTube keeps three frames of every video (1, 2, 3: about a quarter, half and three quarters
   in). A lesson shows the middle one unless another was chosen for it (its `f`). */

test('a lesson without a chosen frame shows the middle one', () => {
  assert.equal(still('abc', undefined, 'mq'), 'https://i.ytimg.com/vi/abc/mq2.jpg');
});

test('a chosen frame is used in every size', () => {
  assert.equal(still('abc', 3, ''), 'https://i.ytimg.com/vi/abc/3.jpg');
  assert.equal(still('abc', 1, 'maxres'), 'https://i.ytimg.com/vi/abc/maxres1.jpg');
});

test('frame 0 is the video’s own thumbnail, in every size', () => {
  assert.equal(still('abc', 0, 'hq'), 'https://i.ytimg.com/vi/abc/hqdefault.jpg');
  assert.equal(still('abc', 0, ''), 'https://i.ytimg.com/vi/abc/default.jpg');
  assert.equal(still('abc', 0, 'maxres'), 'https://i.ytimg.com/vi/abc/maxresdefault.jpg');
});

test('a lesson’s picture is its own video’s, or the one named in fv', () => {
  assert.deepEqual(pictureOf({ id: 'a', f: 3 }), { id: 'a', f: 3, x: undefined });
  assert.deepEqual(pictureOf({ id: 'a' }), { id: 'a', f: undefined, x: undefined });
  assert.deepEqual(pictureOf({ id: 'a', f: 2, fv: 'b', x: 'sd' }), { id: 'b', f: 2, x: 'sd' });
});

/* `x` is the largest size YouTube has of the picture, when it has no maxres: the page asks for that
   one first, not for a size that would come back as a 404. */
test('the sharp sizes start at the largest the picture has', () => {
  assert.deepEqual(sharpSizes(undefined), ['maxres', 'sd', 'hq']);
  assert.deepEqual(sharpSizes('sd'), ['sd', 'hq']);
  assert.deepEqual(sharpSizes('hq'), ['hq']);
});
