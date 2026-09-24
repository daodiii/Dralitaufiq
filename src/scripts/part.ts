/* Where the top of the screen is within a part of the page, and back, so a place read in one
   layout can be found again in another. Positions are scroll positions: where the top of the
   screen is. A pinned part is held on screen from `start` to `end`, then scrolls away over its
   height `h`. Laid out plainly (on phones) the same part is stacked: it goes by through the screen
   and then leaves over its last screen. For both, 0 to 1 is the part going by (a pin's progress)
   and 1 to 2 its last screen leaving, so a place means the same stage in either layout. Any other
   element is a block, measured through its height. Outside a part the distance to its edge is
   kept in pixels, so margins stay as they are. */

export type Part =
  | { kind: 'pinned'; start: number; end: number; h: number }
  | { kind: 'stacked'; top: number; h: number; vh: number }
  | { kind: 'block'; top: number; h: number };

/* u: how far through the part; px: how far beyond its edge, when the place is outside it. */
export interface Place {
  u: number;
  px: number;
}

/* The part as scroll stretches: where it starts, then going by (0 to 1), then leaving (1 to 2). */
function stretches(part: Part): [from: number, by: number, away: number] {
  switch (part.kind) {
    case 'pinned':
      return [part.start, part.end - part.start, part.h];
    case 'stacked': {
      const by = Math.max(0, part.h - part.vh);
      return [part.top, by, part.h - by];
    }
    case 'block':
      return [part.top, part.h, 0];
  }
}

export function placeIn(part: Part, y: number): Place {
  const [from, by, away] = stretches(part);
  const d = y - from;
  if (d < 0) return { u: 0, px: d };
  if (d <= by) return { u: by ? d / by : 0, px: 0 };
  if (d <= by + away) return { u: 1 + (d - by) / away, px: 0 };
  return { u: away ? 2 : 1, px: d - by - away };
}

export function scrollFor(part: Part, place: Place): number {
  const [from, by, away] = stretches(part);
  const at = place.u <= 1 ? from + place.u * by : from + by + Math.min(1, place.u - 1) * away;
  return at + place.px;
}
