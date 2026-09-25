import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gestures, glide, hermite, landing, next } from '../src/scripts/carry.ts';

/* The arithmetic of the carry: the curve a glide lands on, how long it takes, which beat it lands
   on, and how wheel events are read into gestures. Distances in px, speeds in px/s, times in ms
   for events and in seconds for glides (as Lenis takes them). */

const slope = (f: (u: number) => number, u: number) => (f(u + 1e-5) - f(u)) / 1e-5;

test('the curve runs from 0 to 1, leaving at slope m and arriving at rest', () => {
  for (const m of [-1.2, 0, 0.8, 1.5, 2.4, 3]) {
    const f = hermite(m);
    assert.equal(f(0), 0);
    assert.ok(Math.abs(f(1) - 1) < 1e-12);
    assert.ok(Math.abs(slope(f, 0) - m) < 1e-3, `start slope for m=${m}`);
    assert.ok(Math.abs(slope(f, 1 - 1e-5)) < 1e-3, `end slope for m=${m}`);
  }
});

test('the curve never turns back on its way for a start slope from 0 to 3', () => {
  for (const m of [0, 1, 2, 2.4, 3]) {
    const f = hermite(m);
    for (let u = 0; u < 1; u += 0.01) assert.ok(f(u + 0.01) >= f(u) - 1e-12, `m=${m} u=${u}`);
  }
});

test('from rest a glide takes longer the further it goes, within bounds', () => {
  const short = glide(200, 0)!;
  const step = glide(1000, 0)!;
  const long = glide(5000, 0)!;
  assert.ok(short.duration >= 0.55 && short.duration < step.duration);
  assert.ok(step.duration > 0.9 && step.duration < 1.1);
  assert.equal(long.duration, 1.25);
  assert.equal(step.m, 0);
});

test('a glide leaves at the speed the page already has', () => {
  for (const [distance, speed] of [
    [900, 800],
    [-900, -800],
    [1200, 300],
  ]) {
    const g = glide(distance, speed)!;
    const start = (slope(g.ease, 0) * distance) / g.duration;
    assert.ok(Math.abs(start - speed) < 2, `${distance} at ${speed}: leaves at ${start}`);
  }
});

test('arriving fast with little room left, the glide is shorter but still leaves at that speed', () => {
  const g = glide(150, 1500)!;
  assert.ok(g.m >= 2.4 && g.m <= 3, `start slope ${g.m}`);
  assert.ok(g.duration < 0.55);
  const start = (slope(g.ease, 0) * 150) / g.duration;
  assert.ok(Math.abs(start - 1500) < 2);
});

test('moving away from the beat, the glide turns back without a long detour', () => {
  const g = glide(1000, -1500)!;
  assert.equal(g.m, -1.2);
  let low = 0;
  for (let u = 0; u <= 1; u += 0.01) low = Math.min(low, g.ease(u));
  assert.ok(low > -0.08, `goes back ${low * 1000} px`);
});

test('no distance, no glide', () => {
  assert.equal(glide(0, 500), null);
  assert.equal(glide(0.4, 0), null);
});

const beats = [0, 1000, 2000, 3000];

test('the next beat is past the page in the direction of travel, with a little grace', () => {
  assert.equal(next(beats, 1000, 1), 2000);
  assert.equal(next(beats, 1005, -1), 0);
  assert.equal(next(beats, 1500, 1), 2000);
  assert.equal(next(beats, 1500, -1), 1000);
  assert.equal(next(beats, 3000, 1), undefined);
  assert.equal(next(beats, 0, -1), undefined);
});

test('a glide lands on the next beat', () => {
  assert.equal(landing(beats, 1100, 900, 1), 2000);
  assert.equal(landing(beats, 1100, 0, 1), 2000);
  assert.equal(landing(beats, 1900, -600, -1), 1000);
});

test('too fast to stop at the next beat gently, it carries on to the one after', () => {
  /* 60 px left at 1500 px/s would need braking far harder than 4000 px/s² */
  assert.equal(landing(beats, 1940, 1500, 1), 3000);
  assert.equal(landing(beats, 1060, -1500, -1), 0);
});

test('too fast but nothing after it: it lands on the last beat', () => {
  assert.equal(landing(beats, 2960, 1500, 1), 3000);
});

test('moving the other way, speed does not carry it past', () => {
  assert.equal(landing(beats, 1940, -1500, 1), 2000);
});

test('nothing ahead: no landing', () => {
  assert.equal(landing(beats, 3000, 800, 1), undefined);
});

/* Wheel events: [time ms, deltaY px]. */
type Ev = [number, number];
const play = (evs: Ev[]) => {
  const read = gestures();
  return evs.map(([t, d]) => read(t, d));
};
/* A trackpad flick as Chrome hands it to the page: one event a frame, the fingers speeding up to
   the lift, then the browser's momentum decaying from there. */
const flick = (at: number, peak = 32, sign = 1, decay = 0.935): Ev[] => {
  const out: Ev[] = [];
  let t = at;
  for (let i = 1; i <= 10; i++, t += 16) out.push([t, sign * Math.max(1, Math.round(peak * Math.pow(i / 10, 1.4)))]);
  for (let v = peak * decay; v >= 0.5; v *= decay, t += 16) out.push([t, sign * Math.round(v * 10) / 10]);
  return out;
};

test('a mouse notch is a gesture of its own, known as a notch', () => {
  const [g] = play([[0, 100]]);
  assert.equal(g.fresh, true);
  assert.equal(g.notch, true);
  assert.equal(g.dir, 1);
});

test('a quick run of notches is one gesture; notches apart are separate ones', () => {
  const run = play([
    [0, 100],
    [45, 100],
    [90, 100],
  ]);
  assert.deepEqual(
    run.map((g) => g.id),
    [1, 1, 1]
  );
  const apart = play([
    [0, 100],
    [150, 100],
    [300, 100],
  ]);
  assert.deepEqual(
    apart.map((g) => g.id),
    [1, 2, 3]
  );
});

test('a flick, fingers and momentum, is one gesture, and it fades only once the fingers have lifted', () => {
  const evs = flick(0);
  const read = play(evs);
  assert.ok(read.every((g) => g.id === 1));
  assert.equal(read[0].notch, false);
  const firstFade = read.findIndex((g) => g.fading >= 3);
  assert.ok(firstFade >= 10, `fading from event ${firstFade}, inside the finger phase`);
  assert.ok(firstFade <= 16, `fading only from event ${firstFade}`);
});

test('two events in one frame do not make a new gesture', () => {
  const evs = flick(0);
  const bunched: Ev[] = evs.map(([t, d], i) => (i === 20 ? [evs[19][0] + 2, d] : [t, d]));
  assert.ok(play(bunched).every((g) => g.id === 1));
});

test('the other way, or after a pause, is a new gesture', () => {
  const back = play([...flick(0).slice(0, 25), ...flick(400, 20, -1)]);
  assert.equal(back[back.length - 1].id, 2);
  assert.equal(back[back.length - 1].dir, -1);
  const again = play([...flick(0).slice(0, 12), ...flick(12 * 16 + 100)]);
  assert.equal(again[again.length - 1].id, 2);
});

test('a slow frame that holds the events back is not a pause: the same momentum goes on', () => {
  /* the page stalls for 200 ms in the middle of the momentum; the events held back arrive together
     (or merged into one, as Chrome does) */
  const evs = flick(0);
  const held: Ev[] = evs.map(([t, d], i) => (i >= 20 && i < 32 ? [evs[32][0] + (i - 20) * 0.3, d] : [t, d]));
  const merged: Ev[] = [...evs.slice(0, 20), [evs[32][0], evs.slice(20, 33).reduce((s, [, d]) => s + d, 0)], ...evs.slice(33)];
  assert.ok(play(held).every((g) => g.id === 1), 'held back');
  assert.ok(play(merged).every((g) => g.id === 1), 'merged');
});

test('once the momentum has run out, a pause does end the gesture', () => {
  const read = play([...flick(0), ...flick(1400, 20)]);
  assert.equal(read[read.length - 1].id, 2);
});

test('a second flick while the first still trickles in is a new gesture', () => {
  /* the second flick starts 700 ms in; the first's momentum still delivers events until ~1.1 s */
  const first = flick(0);
  const second = flick(700, 40).map(([t, d]) => [t + 5, d] as Ev);
  const all = [...first, ...second].sort((a, b) => a[0] - b[0]);
  const read = play(all);
  const secondPeak = all.findIndex(([t]) => t === second[9][0]);
  assert.ok(read[secondPeak].id >= 2, 'the second push is read as its own gesture');
});
