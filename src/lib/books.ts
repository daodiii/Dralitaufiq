/**
 * Shared book data: the books in order, the languages' names and caption text.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export type Book = CollectionEntry<'books'>;

export const languageLabel = { en: 'English', ar: 'Arabic', so: 'Somali' } as const;
/* Each language in its own words, as the books page titles its chapters. */
export const languageName = { en: 'English', ar: 'العربية', so: 'Soomaali' } as const;

export function shortRole(role: string) {
  if (role.startsWith('Translated, edited')) return 'Translated, edited and annotated';
  if (role.startsWith('Translated')) return 'Translated';
  if (role.startsWith('Lectures')) return 'Lectures, compiled';
  if (role.startsWith('Critical')) return 'Critical edition';
  return role;
}

export async function allBooks(): Promise<Book[]> {
  const all = await getCollection('books');
  return all.sort((a, b) => a.data.order - b.data.order);
}

export function caption(b: Book) {
  return {
    secondary: b.data.language === 'ar' ? b.data.titleEn : b.data.subtitle || b.data.titleEn,
    meta: [shortRole(b.data.role), languageLabel[b.data.language], b.data.year]
      .filter(Boolean)
      .join(' · '),
    /* The books page opens on this book. */
    href: `/books?book=${b.id}`,
    label: b.data.titleLatin || b.data.title,
  };
}
