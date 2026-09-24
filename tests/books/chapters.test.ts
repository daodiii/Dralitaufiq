import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterOf, chaptersOf } from '../../src/scripts/books/chapters.ts';

/* The books page reads its books in language order (English, Arabic, Somali); each language is
   one chapter of the scroll. */

test('a chapter per run of one language, in page order', () => {
  const langs = ['en', 'en', 'en', 'ar', 'ar', 'so'];
  assert.deepEqual(chaptersOf(langs), [
    { lang: 'en', first: 0, last: 2 },
    { lang: 'ar', first: 3, last: 4 },
    { lang: 'so', first: 5, last: 5 },
  ]);
});

test('the site today: 11 English, 4 Arabic, 3 Somali', () => {
  const langs = [...Array(11).fill('en'), ...Array(4).fill('ar'), ...Array(3).fill('so')];
  const chapters = chaptersOf(langs);
  assert.equal(chapters.length, 3);
  assert.deepEqual(
    chapters.map((c) => [c.first, c.last]),
    [
      [0, 10],
      [11, 14],
      [15, 17],
    ]
  );
});

test('no books, no chapters', () => {
  assert.deepEqual(chaptersOf([]), []);
});

test('each book belongs to the chapter that holds it', () => {
  const chapters = chaptersOf(['en', 'en', 'ar', 'so', 'so']);
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((i) => chapterOf(chapters, i)),
    [0, 0, 1, 2, 2]
  );
});

test('a book outside every chapter has none', () => {
  const chapters = chaptersOf(['en', 'ar']);
  assert.equal(chapterOf(chapters, -1), -1);
  assert.equal(chapterOf(chapters, 2), -1);
});
