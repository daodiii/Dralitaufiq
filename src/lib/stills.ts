/**
 * YouTube's pictures of a lesson. Besides a video's own thumbnail (0; on the mosque's channel
 * often a title card, on KALMAD KOOBAN a designed poster), YouTube keeps three frames of it,
 * taken about a quarter, half and three quarters of the way in (1, 2, 3), each in several sizes.
 * A lesson shows the one where he looks most himself, chosen by eye from all of them: the middle
 * frame unless another was chosen (its `f`), and, for the few lessons where the camera never
 * shows him in any of them, a frame of the lesson beside it (`fv`, that lesson's video).
 */

/* '' is 120 x 90 and mq 320 x 180, which every video has; hq, sd and maxres are 480, 640 and
   1280 wide, hq and sd 4:3 with the picture between black bars. */
export type StillSize = '' | 'mq' | 'hq' | 'sd' | 'maxres';

export const still = (id: string, f: number | undefined, size: StillSize) =>
  `https://i.ytimg.com/vi/${id}/${size}${f === 0 ? 'default' : (f ?? 2)}.jpg`;

/** Which video's picture a lesson shows, which of its pictures, and its largest size (`x`). */
export const pictureOf = (l: { id: string; f?: number; fv?: string; x?: 'sd' | 'hq' }) => ({ id: l.fv ?? l.id, f: l.f, x: l.x });

/* The sharp sizes, largest first. */
const SHARP: StillSize[] = ['maxres', 'sd', 'hq'];

/** The sizes to try for a sharp picture, from the largest YouTube has of it (`x`, when it has no
    maxres; asked for, a size it lacks comes back as a 404). */
export const sharpSizes = (x: 'sd' | 'hq' | undefined) => SHARP.slice(SHARP.indexOf(x ?? 'maxres'));
