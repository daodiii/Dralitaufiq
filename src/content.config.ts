import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const books = defineCollection({
  loader: file('src/data/books.json'),
  schema: ({ image }) =>
    z.object({
      ean: z.string(),
      order: z.number(),
      title: z.string(),
      subtitle: z.string().nullable(),
      titleLatin: z.string().nullable(),
      titleEn: z.string().nullable(),
      language: z.enum(['en', 'ar', 'so']),
      role: z.string(),
      series: z.string().nullable(),
      publisher: z.string().nullable(),
      year: z.number().nullable(),
      badge: z.string().nullable(),
      cover: image(),
      coverWidth: z.number(),
      coverHeight: z.number(),
      description: z.array(z.string()),
      /* Amazon UK listings: one per format (Paperback, Hardcover) or volume. */
      amazon: z.array(z.object({ label: z.string(), url: z.string() })).min(1),
      pages: z.number(),
      /* The printed book in centimetres, from the Amazon listing: width, height, thickness. */
      size: z.object({ w: z.number(), h: z.number(), t: z.number() }),
      endorsements: z
        .array(z.object({ quote: z.string(), name: z.string(), title: z.string() }))
        .optional(),
    }),
});

export const collections = { books };
