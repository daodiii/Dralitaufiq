import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.alimohamedsalah.com',
  output: 'static',
  /* One address per page, without a trailing slash (/books/wacyi): pages are built as files, and
     vercel.json sends /books/wacyi/ on to /books/wacyi, so search engines see each page once. */
  trailingSlash: 'never',
  build: { inlineStylesheets: 'auto', format: 'file' },
  devToolbar: { enabled: false },
});
