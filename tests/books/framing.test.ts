import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookRange, tiltTo, wideFrame } from '../../src/scripts/books/framing.ts';

/* The books page's camera on wide screens: the chosen book stands close, in the middle, below the
   words at the top and clear of the words beside it; and when the page opens inside the ring of
   books, how far the view may turn. Expected values were worked out apart from this code
   (projection, bisection and brute-force search). */

const near = (actual: number, expected: number, tol = 1e-5) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} is not ${expected} ± ${tol}`);

test('a point on the eye line shows at the top edge when the camera looks down half the field', () => {
  near(tiltTo(46, 960, 0, 0), -0.401426);
  near(tiltTo(46, 960, 0, 480), 0);
});

/* The page as built: the camera 20 cm above the ice with a 46° field, tilted 0.09 down, the book
   61.6 cm away. The English chapter's tallest book is 23.39 cm (its top 23.59 cm above the ice),
   its widest 15.6 cm, its thickest 2.82 cm; the Arabic chapter's 24.41 cm tall, 16.99 cm wide. On
   the laptop the languages' row ends 242 px down and the caption 501 px from the left. */
const design = { margin: 16, fov: 46, eye: 0.2, pitch: -0.09, near: 0.616, limit: 0.99, thickest: 0.0282 };
const english = { tallest: 0.2359, widest: 0.156 };
const arabic = { tallest: 0.2461, widest: 0.1699 };

test('a full-height laptop screen keeps the designed framing, the book in the middle', () => {
  const f = wideFrame({ ...design, ...english, H: 960, W: 1536, above: 258, clear: 517 });
  assert.equal(f.fits, true);
  near(f.near, 0.616);
  near(f.pitch, -0.09);
  near(f.shift, 0);
  near(f.aside, 0);
});

test('where the words at the top would cover the book, the camera tilts up just enough', () => {
  const f = wideFrame({ ...design, ...arabic, H: 830, W: 1536, above: 256, clear: 517 });
  assert.equal(f.fits, true);
  near(f.near, 0.616);
  near(f.pitch, -0.084777);
});

test('on a short screen the book steps back until it fits', () => {
  const f = wideFrame({ ...design, ...english, H: 390, W: 844, above: 216, clear: 341 });
  assert.equal(f.fits, true);
  near(f.near, 0.736);
  near(f.pitch, 0.09537);
});

test('on a squarer screen the book moves over to clear the words beside it, keeping its size', () => {
  const f = wideFrame({ ...design, ...english, H: 900, W: 900, above: 236, clear: 362.5 });
  assert.equal(f.fits, true);
  near(f.near, 0.616);
  near(f.shift, 49.882, 1e-3);
  /* The camera turns left of the book by the angle that stands it that far right. */
  near(f.aside, 0.047018);
});

test('where moving over is not enough, the book also steps back', () => {
  const f = wideFrame({ ...design, ...arabic, H: 900, W: 600, above: 236, clear: 300 });
  assert.equal(f.fits, true);
  near(f.near, 0.656);
  near(f.shift, 140.3, 1e-3);
});

test('where the words beside it leave no room at all, the book still stays on screen', () => {
  const f = wideFrame({ ...design, ...english, H: 700, W: 760, above: 241, clear: 742 });
  assert.equal(f.fits, false);
  near(f.near, 0.996);
  near(f.shift, 298.5, 1e-2);
});

test('with no room even at its furthest, it says so', () => {
  const f = wideFrame({ ...design, ...english, H: 300, W: 1536, above: 235, clear: 517 });
  assert.equal(f.fits, false);
  near(f.near, 0.996);
});

/* The ring: radius 2.2 m, running 0.86 rad either side of its middle, the camera 0.75 m out from
   its centre, 0.07 rad kept for the end book. */
const ring = { r: 2.2, forward: 0.75, arc: 0.86, pad: 0.07 };

test('on the laptop the view turns about half a radian either way', () => {
  near(lookRange({ ...ring, half: 0.596602 }), 0.52612);
});

test('a phone held upright sees less of the ring, so it turns further', () => {
  near(lookRange({ ...ring, half: 0.270827 }), 0.7505);
});

test('a view that holds the whole ring does not turn', () => {
  assert.equal(lookRange({ ...ring, half: 1.3 }), 0);
});
