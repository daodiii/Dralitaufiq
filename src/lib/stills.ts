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

/* Retouched versions of these exact video frames. Other lessons keep their own pictures.
   Frame identity matters: a different frame from the same video must not borrow the portrait. */
const EDITED: Record<string, string> = {
  "2BvSE_jiq9s:3": "opening",
  "g52cuiHSq38:1": "quran",
  "KcAzkOnBti4:2": "brief",
  "eE8yC43Z160:2": "riyad",
  "vS-8Djv1CTU:1": "companions",
  "A4h5rqVyH4I:3": "sira-wide",
  "Ni5qVkEbga8:2": "bulugh",
  "8nQoeSLaBL0:3": "quran-3",
  "laPH20wGe_o:1": "quran-4",
  "gvuRVNx7pAU:2": "quran-5",
  "VdR3cO62Ms8:2": "quran-6",
  "x_qDPEMMZqI:2": "quran-7",
  "7n_FDDG54mE:2": "quran-8",
  "1AQbS0-x58E:1": "quran-9",
  "buIoI7PchLg:2": "quran-10",
  "v3o2o6J4KFk:2": "quran-12",
  "viZNDKHIVfA:3": "quran-17",
  "cp6vWq6lIOc:3": "quran-18",
  "7IntiZTYGw4:2": "hisn"
};

export const still = (id: string, f: number | undefined, size: StillSize) => {
  const edited = EDITED[`${id}:${f ?? 2}`];
  if (edited) {
    const width = size === 'maxres' ? 1600 : size === 'sd' || size === 'hq' ? 960 : 480;
    return `/lecture-portraits/${edited}-${width}.webp`;
  }
  return `https://i.ytimg.com/vi/${id}/${size}${f === 0 ? 'default' : (f ?? 2)}.jpg`;
};

/** Which video's picture a lesson shows, which of its pictures, and its largest size (`x`). */
export const pictureOf = (l: { id: string; f?: number; fv?: string; x?: 'sd' | 'hq' }) => ({ id: l.fv ?? l.id, f: l.f, x: l.x });

/* The sharp sizes, largest first. */
const SHARP: StillSize[] = ['maxres', 'sd', 'hq'];

/** The sizes to try for a sharp picture, from the largest YouTube has of it (`x`, when it has no
    maxres; asked for, a size it lacks comes back as a 404). */
export const sharpSizes = (x: 'sd' | 'hq' | undefined) => SHARP.slice(SHARP.indexOf(x ?? 'maxres'));
