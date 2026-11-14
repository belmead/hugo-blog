import MarkdownIt from 'markdown-it';
import sanitize from 'sanitize-html';
import { published } from './content.mjs';
const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
export const faviconLinks = '<link rel="icon" href="/favicon.ico"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"><link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function markdown(text) {
  return sanitize(md.render(text || ''), { allowedTags: [...sanitize.defaults.allowedTags, 'img'], allowedAttributes: { ...sanitize.defaults.allowedAttributes, img: ['src','alt','title','width','height','loading','decoding'], a: ['href','title','rel'] }, transformTags: { img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy', decoding: 'async' } }) }, allowedSchemes: ['https','http','mailto'], allowProtocolRelative: false });
}
export const url = doc => doc.kind === 'posts' ? `/posts/${doc.id}/` : `/${doc.id}/`;
export function dateLabel(date, timezone, precision) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', ...(precision === 'day' ? {} : { timeStyle: 'short' }), timeZone: timezone }).format(new Date(date));
}
function shell(settings, pages, title, description, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | ${esc(settings.siteTitle)}</title><meta name="description" content="${esc(description)}"><meta name="generator" content="Shiro">${faviconLinks}<link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/site.css"></head><body><a class="skip" href="#main">Skip to content</a>${body}<footer class="site-footer"><a href="/">${esc(settings.siteTitle)}</a><nav aria-label="Pages">${published(pages).filter(p => p.nav).map(p=>`<a href="${url(p)}">${esc(p.title)}</a>`).join('')}</nav><span>Made with Shiro</span></footer></body></html>`;
}
export function homepage(settings, posts, pages) {
  const rows = published(posts).map(p=>`<article class="post-row">${p.image ? `<a href="${url(p)}" tabindex="-1" aria-hidden="true"><img class="post-thumbnail" src="${esc(p.image)}" alt="${esc(p.imageAlt)}" loading="lazy" decoding="async" width="176" height="176"></a>` : '<div class="no-thumbnail" aria-hidden="true"></div>'}<div><time datetime="${esc(p.date)}">${esc(dateLabel(p.date, settings.timezone, p.datePrecision))}</time><h2><a href="${url(p)}">${esc(p.title)}</a></h2><p>${esc(p.description || p.body.replace(/[#*\[\]`]/g,'').slice(0, 220))}</p><a class="continue" href="${url(p)}">Continue reading <span aria-hidden="true">↗</span><span class="sr-only">: ${esc(p.title)}</span></a></div></article>`).join('');
  return shell(settings, pages, 'Home', settings.subtitle, `<main id="main"><section class="hero-copy"><h1>${esc(settings.title)}</h1><p>${esc(settings.subtitle)}</p>${settings.buttonText ? `<a class="outline-link" href="${esc(settings.buttonURL)}">${esc(settings.buttonText)} <span aria-hidden="true">↗</span></a>` : ''}</section>${settings.image ? `<div class="hero-image"><img src="${esc(settings.image)}" alt="${esc(settings.imageAlt)}" width="1600" height="550" fetchpriority="high"></div>` : ''}${settings.body ? `<section class="prose home-body">${markdown(settings.body)}</section>` : ''}<section class="post-list" id="posts"><div class="list-heading"><h2>${esc(settings.postsTitle)}</h2><span>${published(posts).length} posts</span></div>${rows || '<p>No posts yet. Come back soon.</p>'}</section></main>`);
}
export function documentPage(settings, doc, pages) {
  return shell(settings, pages, doc.title, doc.description, `<main id="main" class="article"><a class="back-link" href="/#posts">← All writing</a><header>${doc.kind === 'posts' ? `<time datetime="${esc(doc.date)}">${esc(dateLabel(doc.date, settings.timezone, doc.datePrecision))}</time>` : ''}<h1>${esc(doc.title)}</h1>${doc.description ? `<p class="standfirst">${esc(doc.description)}</p>` : ''}</header>${doc.image ? `<img class="article-cover" loading="lazy" decoding="async" src="${esc(doc.image)}" alt="${esc(doc.imageAlt)}">` : ''}<div class="prose">${markdown(doc.body)}</div></main>`);
}
