import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeIn, scrollFor, type Part } from '../src/scripts/part.ts';

/* Where the top of the screen is within a part of the page, and back again in another layout.
   Scroll positions are where the top of the screen is. A pinned part is held from `start` to
   `end`, then scrolls away over its height `h`; laid out plainly (phones) it is a stacked part at
   `top`, `h` tall, in a screen `vh` tall; anything else is a block. */

const near = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < 1e-6, msg ?? `${a} != ${b}`);

test('in a pinned part the place is the pin progress, then its last screen leaving', () => {
  const wall: Part = { kind: 'pinned', start: 1000, end: 3000, h: 900 };
  assert.deepEqual(placeIn(wall, 1000), { u: 0, px: 0 });
  assert.deepEqual(placeIn(wall, 2000), { u: 0.5, px: 0 });
  assert.deepEqual(placeIn(wall, 3000), { u: 1, px: 0 });
  assert.deepEqual(placeIn(wall, 3450), { u: 1.5, px: 0 });
});

test('a taller screen stretches the pin, and the place keeps its progress', () => {
  const short: Part = { kind: 'pinned', start: 1000, end: 3000, h: 900 };
  const tall: Part = { kind: 'pinned', start: 1100, end: 3322, h: 1000 };
  near(scrollFor(tall, placeIn(short, 2000)), 1100 + 0.5 * 2222);
  near(scrollFor(tall, placeIn(short, 3000)), 3322);
  near(scrollFor(tall, placeIn(short, 3450)), 3322 + 500);
});

test('pinned on a wide screen and stacked on a phone mean the same stage', () => {
  const pinned: Part = { kind: 'pinned', start: 1000, end: 3000, h: 900 };
  const stacked: Part = { kind: 'stacked', top: 5000, h: 2900, vh: 844 }; /* goes by over 2056 px */
  near(scrollFor(stacked, placeIn(pinned, 1000)), 5000);
  near(scrollFor(stacked, placeIn(pinned, 2000)), 5000 + 1028);
  near(scrollFor(stacked, placeIn(pinned, 3000)), 5000 + 2056);
  near(scrollFor(stacked, placeIn(pinned, 3450)), 5000 + 2056 + 422);
  near(scrollFor(pinned, placeIn(stacked, 5000 + 1028)), 2000);
  near(scrollFor(pinned, placeIn(stacked, 5000 + 2056 + 422)), 3450);
});

test('a block: how far through its height, and beyond its edges the margin in pixels', () => {
  const para: Part = { kind: 'block', top: 500, h: 200 };
  assert.deepEqual(placeIn(para, 550), { u: 0.25, px: 0 });
  assert.deepEqual(placeIn(para, 480), { u: 0, px: -20 });
  assert.deepEqual(placeIn(para, 730), { u: 1, px: 30 });
  /* The text rewraps: 300 px tall, 20 px lower. The margins stay, the rest scales. */
  const rewrapped: Part = { kind: 'block', top: 520, h: 300 };
  near(scrollFor(rewrapped, placeIn(para, 550)), 520 + 75);
  near(scrollFor(rewrapped, placeIn(para, 480)), 500);
  near(scrollFor(rewrapped, placeIn(para, 730)), 850);
});

test('before a pinned part, the distance to it is kept in pixels', () => {
  const pinned: Part = { kind: 'pinned', start: 1000, end: 3000, h: 900 };
  assert.deepEqual(placeIn(pinned, 960), { u: 0, px: -40 });
  near(scrollFor({ kind: 'pinned', start: 1200, end: 3500, h: 1000 }, { u: 0, px: -40 }), 1160);
});

test('a stacked part shorter than the screen only has its leaving stretch', () => {
  const short: Part = { kind: 'stacked', top: 100, h: 400, vh: 844 };
  assert.deepEqual(placeIn(short, 100), { u: 0, px: 0 });
  assert.deepEqual(placeIn(short, 300), { u: 1.5, px: 0 });
});

test('reading a place and scrolling to it lands where it was, in the same layout', () => {
  const parts: Part[] = [
    { kind: 'pinned', start: 1000, end: 3000, h: 900 },
    { kind: 'stacked', top: 5000, h: 2900, vh: 844 },
    { kind: 'stacked', top: 100, h: 400, vh: 844 },
    { kind: 'block', top: 500, h: 200 },
  ];
  for (const part of parts) {
    for (let y = 0; y <= 9000; y += 37) near(scrollFor(part, placeIn(part, y)), y, `${part.kind} at ${y}`);
  }
});
