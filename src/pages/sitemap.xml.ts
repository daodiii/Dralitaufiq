import type { APIRoute } from 'astro';
import { allBooks } from '../lib/books';

/* Every page, and every book's own page (pages/books/[id]). */
export const GET: APIRoute = async ({ site }) => {
  const books = await allBooks();
  const paths = ['/', '/books', '/lectures', '/contact', '/privacy', '/terms', ...books.map((b) => `/books/${b.id}`)];
  const urls = paths.map((p) => `  <url><loc>${new URL(p, site).href}</loc></url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
