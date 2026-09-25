/* The books page scrolls by language: each run of books in one language (they come in page order,
   English, Arabic, Somali) is a chapter, titled in the sky while its books pass. Indices are the
   books' places on the page. */

export interface Chapter {
  lang: string;
  first: number;
  last: number;
}

export function chaptersOf(langs: string[]): Chapter[] {
  const chapters: Chapter[] = [];
  langs.forEach((lang, i) => {
    const open = chapters[chapters.length - 1];
    if (open && open.lang === lang) open.last = i;
    else chapters.push({ lang, first: i, last: i });
  });
  return chapters;
}

export const chapterOf = (chapters: Chapter[], i: number) => chapters.findIndex((c) => i >= c.first && i <= c.last);
