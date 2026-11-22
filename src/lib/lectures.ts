/**
 * His lectures on YouTube. He has no channel of his own: the Qur'an and Ḥiṣn al-Muslim are on the
 * Oslo mosque's channel (Tawfiiq Duruus), the books he teaches on KALMAD KOOBAN. Each series is a
 * playlist, and data/lessons.json lists every public lesson of each in teaching order, with what it
 * covers and its length (written by docs/research/youtube/lessons.mjs from the YouTube research of
 * 2026-09-24, which is kept out of the repo). Kept free of the JSON so the home page's script can
 * load that later.
 */
import { SURAHS } from './surahs';

export interface Lesson {
  id: string;
  n: number; /* its number in the series */
  m: number; /* minutes */
  t: string; /* what it covers, or "Lesson 12" */
  a?: string; /* the sūrahs in Arabic, tafsir only */
  s?: number; /* its first sūrah, tafsir only */
  w?: string; /* the Companion, as the title spells it */
  p?: number; /* part of a lesson given in two videos */
  f?: number; /* its picture, when not YouTube's middle frame (lib/stills.ts) */
  fv?: string; /* the video that picture is from, when none of its own shows him */
  x?: 'sd' | 'hq'; /* the largest size YouTube has of that picture, when it has no maxres */
}

export type Lessons = Record<string, { pl: string; lessons: Lesson[] }>;

export interface Series {
  key: string;
  title: string;
  ar: string;
  count: number; /* lessons, as YouTube counts the playlist (checked 2026-09-24) */
  pl: string; /* the playlist */
  live?: boolean; /* still being taught */
}

export const SERIES: Record<string, Series> = {
  quran: { key: 'quran', title: "The whole Qur'an, explained", ar: 'تفسير القرآن', count: 330, pl: 'PLvFvvYJalpBph1pAWVbLTT6PAlOOitaGo' },
  riyad: { key: 'riyad', title: 'Riyāḍ aṣ-Ṣāliḥīn', ar: 'رياض الصالحين', count: 151, pl: 'PLpbPDEjELZxiNUreuMGXbKjqFnk6hkoI0' },
  brief: { key: 'brief', title: "The Qur'an in brief", ar: 'تفسير الجلالين', count: 115, pl: 'PLvFvvYJalpBqADlBn4jnpdybPKBdkOf5z' },
  companions: { key: 'companions', title: 'Lives of the Companions', ar: 'صور من حياة الصحابة', count: 106, pl: 'PLpbPDEjELZxg1EoU1Bf4Ap78zS_f8-sZt' },
  sira: { key: 'sira', title: "The Prophet's life", ar: 'السيرة النبوية', count: 51, pl: 'PLpbPDEjELZxi8iizAv35dLP6jmlNRxshm' },
  bulugh: { key: 'bulugh', title: 'Bulūgh al-Marām', ar: 'بلوغ المرام', count: 26, pl: 'PLpbPDEjELZxjUT77fuQRtmeaOvB0mhlTS', live: true },
  hisn: { key: 'hisn', title: 'Ḥiṣn al-Muslim', ar: 'حصن المسلم', count: 4, pl: 'PLvFvvYJalpBohx6Q4bhnDBHsWkhm4E7d6' },
};

/* The series on the lectures page, in the order it lists them; the talks follow. */
export const ROOM = ['quran', 'brief', 'riyad', 'companions', 'sira', 'bulugh', 'hisn'] as const;

export const playlist = (pl: string) => `https://www.youtube.com/playlist?list=${pl}`;
export const video = (id: string) => `https://www.youtube.com/watch?v=${id}`;
/* A lesson opened inside its series, so the next one follows. */
export const watch = (id: string, pl: string) => `https://www.youtube.com/watch?v=${id}&list=${pl}`;

/** The line under a series: how many lessons, or that it is still being taught. */
export const seriesMeta = (s: Series) => (s.live ? 'Still being taught' : `${s.count} lessons`);

export function minutes(m: number) {
  if (m < 60) return `${m} minutes`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h} hour${h > 1 ? 's' : ''}${r ? ` ${r} minutes` : ''}`;
}

/** The same, short, for a list: "58 min", "1 h 10". */
export const mins = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}`);

/* What a tafsir lesson covers, under its sūrah's heading: "Verses 26 to 42". */
const within = (l: Lesson) => {
  const name = SURAHS[(l.s ?? 1) - 1][0];
  if (l.t.startsWith(`${name}, verses `)) return `Verses ${l.t.slice(name.length + 9)}`;
  if (l.t.startsWith(`${name}, verse `)) return `Verse ${l.t.slice(name.length + 8)}`;
  return l.t;
};

export interface Told {
  num: string; /* its number, when the words are not just "Lesson 12" */
  label: string; /* the words in the list */
  title: string; /* and in the preview */
  ar: string; /* the Arabic over the title: the sūrahs, or the book */
  meta: string; /* the line under it */
  len: string;
  href: string;
}

/** A lesson as the lectures page lists it and shows it. */
export function describe(key: string, l: Lesson, pl: string): Told {
  const s = SERIES[key];
  const tafsir = key === 'quran' || key === 'brief';
  const name = key === 'companions' ? l.w : undefined;
  const plain = !tafsir && !name;
  return {
    num: plain ? '' : String(l.n),
    /* A Companion taught over several videos: the list tells the parts apart. */
    label: key === 'quran' ? within(l) : name ? name + (l.p ? `, part ${l.p}` : '') : l.t,
    title: name ?? l.t,
    ar: tafsir && l.a ? l.a : s.ar,
    meta: [s.title, plain ? '' : tafsir ? `Lesson ${l.n}` : l.t, minutes(l.m), 'In Somali'].filter(Boolean).join(' · '),
    len: mins(l.m),
    href: watch(l.id, pl),
  };
}
