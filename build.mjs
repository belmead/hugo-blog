import fs from 'node:fs';
import path from 'node:path';
import { home, list, published } from './lib/content.mjs';
import { homepage, documentPage, url, esc } from './lib/render.mjs';
export function build(output = path.resolve('site')) {
  // Only generated output lives here; rebuilds exclude old drafts and unpublished pages.
  const staging = `${output}.building`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  fs.cpSync('public', staging, { recursive: true });
  const settings = home(), posts = list('posts'), pages = list('pages');
  fs.writeFileSync(path.join(staging, 'index.html'), homepage(settings, posts, pages));
  for (const doc of [...published(posts), ...published(pages)]) {
    const dir = path.join(staging, url(doc));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), documentPage(settings, doc, pages));
  }
  const origin=new URL(process.env.SHIRO_PUBLIC_ORIGIN || 'https://www.omya.games').origin;
  const documents=[...published(posts),...published(pages)];
  fs.writeFileSync(path.join(staging,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/',...documents.map(url)].map(route=>`<url><loc>${esc(origin+route)}</loc></url>`).join('')}</urlset>`);
  fs.writeFileSync(path.join(staging,'index.xml'),`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(settings.siteTitle)}</title><link>${esc(origin)}</link><description>${esc(settings.subtitle)}</description>${published(posts).map(doc=>`<item><title>${esc(doc.title)}</title><link>${esc(origin+url(doc))}</link><guid isPermaLink="false">${esc(url(doc))}</guid><pubDate>${new Date(doc.date).toUTCString()}</pubDate><description>${esc(doc.description || '')}</description></item>`).join('')}</channel></rss>`);
  fs.writeFileSync(path.join(staging, '.nojekyll'), '');
  fs.writeFileSync(path.join(staging, '404.html'), '<!doctype html><title>Page not found</title><h1>Page not found</h1><a href="/">Back home</a>');
  fs.rmSync(output, { recursive: true, force: true });
  fs.renameSync(staging, output);
  return { posts: published(posts).length, pages: published(pages).length, directory: output };
}
if (process.argv[1] === new URL(import.meta.url).pathname) console.log(build());
