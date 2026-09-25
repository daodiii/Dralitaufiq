/* The camera of the books page on a wide screen, as plain maths (angles in radians, lengths in
   metres, the screen in CSS px): where the chosen book stands and how the camera turns and tilts to
   show it whole, close, in the middle of the screen, clear of the words; and, when the page opens
   inside the ring of books, how far the view may turn along it. */

export interface WideFrame {
  near: number; /* how far in front of the camera the chosen book stands */
  pitch: number; /* the camera's tilt, negative looking down */
  shift: number; /* how far right of the screen's middle the book stands, px */
  aside: number; /* how far left of the book the camera turns to stand it there */
  fits: boolean;
}

/* The tilt that shows a point seen `angle` above the eye line at `y` px from the top of a screen
   `H` px high, with a vertical field of `fov` degrees. */
export function tiltTo(fov: number, H: number, angle: number, y: number): number {
  return angle - Math.atan(Math.tan((fov * Math.PI) / 360) * (1 - (2 * y) / H));
}

/* The book stands `near` in front of a camera `eye` above the ice, tilted by `pitch`, in the middle
   of a screen `W` by `H`, as designed. Where the words at the top (down to `above` px) would cover
   its top, the camera tilts up just enough; where the words beside it (out to `clear` px from the
   left) would cover its side, it moves over, right of the middle. Where its foot would then leave
   the screen, or its other side (`margin` px from the edges), it steps back a little at a time, up
   to `limit`; if there is still no room beside the words, it stays whole on screen rather than
   clear of them. `tallest` is the top of the chapter's tallest book above the ice, `widest` its
   widest book and `thickest` its thickest, whose front stands half its thickness nearer. */
export function wideFrame(o: {
  H: number;
  W: number;
  above: number;
  clear: number;
  margin: number;
  fov: number;
  eye: number;
  pitch: number;
  near: number;
  limit: number;
  tallest: number;
  widest: number;
  thickest: number;
}): WideFrame {
  const tan = Math.tan((o.fov * Math.PI) / 360);
  const place = (d: number): WideFrame => {
    const front = d - o.thickest / 2;
    const pitch = Math.max(o.pitch, tiltTo(o.fov, o.H, Math.atan2(o.tallest - o.eye, front), o.above));
    /* Half the book's width on screen: pixels are square, so the height sets the scale. */
    const half = ((o.H / 2) * (o.widest / 2)) / (front * tan);
    const middle = Math.min(Math.max(o.W / 2, o.clear + half), o.W - o.margin - half);
    const room = o.clear + 2 * half <= o.W - o.margin && half <= o.W / 2 - o.margin;
    const fits = pitch <= tiltTo(o.fov, o.H, Math.atan2(-o.eye, front), o.H - o.margin) && room;
    const shift = middle - o.W / 2;
    return { near: d, pitch, shift, aside: Math.atan((shift * tan) / (o.H / 2)), fits };
  };
  let p = place(o.near);
  while (!p.fits && p.near < o.limit) p = place(p.near + 0.02);
  return p;
}

/* The camera stands `forward` out from the centre of the ring (radius `r`) towards the books, and
   turns about that centre, so the books ahead are always as near. The ring runs `arc` either side
   of its middle and the view `half` either side of ahead; the view may turn until the end book
   (kept whole by `pad`) reaches its edge. Zero where the view holds the whole ring. */
export function lookRange(o: { r: number; forward: number; arc: number; half: number; pad: number }): number {
  const { r, forward: f, half: h } = o;
  /* Where the edge of the view meets the ring, and that point's angle about the centre. */
  const t = Math.sqrt(r * r - (f * Math.sin(h)) ** 2) - f * Math.cos(h);
  const edge = Math.atan2(t * Math.sin(h), f + t * Math.cos(h));
  return Math.max(0, o.arc + o.pad - edge);
}
