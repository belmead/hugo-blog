import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import matter from 'gray-matter';

export const root = path.resolve(process.env.SHIRO_CONTENT || 'content');
export const revision = text => createHash('sha256').update(text).digest('hex');
export function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export function slug(value) {
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 160) fail('Use a URL name with lowercase letters, numbers, and hyphens.');
  return value;
}
export function filePath(kind, id) {
  if (!['posts', 'pages'].includes(kind)) fail('Unknown content type.');
  if (kind === 'pages' && ['admin', 'api', 'preview', 'posts', 'studio', 'uploads', 'images', 'img', 'assets'].includes(id)) fail('This URL is reserved.');
  return path.join(root, kind, `${slug(id)}.md`);
}
export function parseSource(source, version = revision(source)) {
  const { data, content } = matter(source);
  if (data.date instanceof Date) data.date = data.date.toISOString();
  return { ...data, body: content.trim(), revision: version };
}
const parse = file => parseSource(fs.readFileSync(file, 'utf8'));
export function read(kind, id) {
  const file = filePath(kind, id);
  if (!fs.existsSync(file)) fail('This document was not found.', 404);
  return { ...parse(file), id, kind };
}
export function list(kind) {
  const dir = path.join(root, kind);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => read(kind, f.slice(0, -3))).sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
}
export function atomicWrite(file, source, expected) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if ((previous === null ? null : revision(previous)) !== expected) fail('This file changed elsewhere. Copy your changes, then reload before saving.', 409);
  if (previous !== null) {
    const backup = path.join(root, '.history', `${Date.now()}-${randomUUID()}-${path.basename(file)}`);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.writeFileSync(backup, previous);
  }
  const temp = `${file}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(temp, source); fs.renameSync(temp, file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
export function imageURL(value) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 2048 || !(/^(\/[^/]|https:\/\/)/.test(value)) || /[<>"\s]/.test(value)) fail('Choose a local image or an HTTPS image URL.');
  return value;
}
export function save(kind, id, input) {
  const file = filePath(kind, id);
  const current = fs.existsSync(file) ? parse(file) : {};
  const source = documentSource(input, current);
  atomicWrite(file, source, input.revision ?? null);
  return read(kind, id);
}
export function documentSource(input, current = {}) {
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 300) fail('Add a title (up to 300 characters).');
  if (typeof input.body !== 'string' || input.body.length > 1_000_000) fail('The document is too large.');
  if (typeof input.draft !== 'boolean') fail('Choose draft or published.');
  if (typeof input.date !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(input.date) || !Number.isFinite(Date.parse(input.date))) fail('Choose a valid date and time.');
  const data = { ...current, title: input.title.trim(), date: input.date, description: String(input.description || '').slice(0, 2000), image: imageURL(input.image), imageAlt: String(input.imageAlt || '').slice(0,500), draft: input.draft, nav: input.nav === true };
  if (input.date !== current.date) delete data.datePrecision;
  delete data.body; delete data.revision;
  delete data.id; delete data.kind;
  return matter.stringify(input.body, data);
}
export function home() { return parse(path.join(root, 'home.md')); }
export function saveHome(input) {
  atomicWrite(path.join(root, 'home.md'), homeSource(input, home()), input.revision);
  return home();
}
export function homeSource(input, current) {
  if (input.body !== undefined && (typeof input.body !== 'string' || input.body.length > 1_000_000)) fail('The document is too large.');
  for (const key of ['siteTitle','title','subtitle','imageAlt','buttonText','buttonURL','postsTitle','timezone']) if (typeof input[key] !== 'string' || input[key].length > 1000) fail(`Check ${key}.`);
  if (!input.siteTitle.trim() || !input.title.trim()) fail('Site name and headline are required.');
  if (!/^(\/[^/]*|#[\w-]+|https:\/\/[^\s]+)$/.test(input.buttonURL)) fail('Use a local path, #anchor, or HTTPS link.');
  try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); } catch { fail('Choose a valid time zone.'); }
  const data = { ...current, ...input, image: imageURL(input.image) };
  delete data.body; delete data.revision;
  return matter.stringify(input.body || '', data);
}
export const published = docs => docs.filter(d => !d.draft && (!d.date || Date.parse(d.date) <= Date.now()));
