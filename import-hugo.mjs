import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import assert from 'node:assert/strict';
import { parse as toml } from 'smol-toml';
export function parseHugo(source) {
  return source.startsWith('+++') ? matter(source,{delimiters:'+++',language:'toml',engines:{toml}}) : matter(source);
}
export function importHugo(source = path.resolve('source-reference')) {
const report = { imported:[], skipped:[], notes:[] };
for (const name of fs.readdirSync(path.join(source,'content/posts')).filter(n=>n.endsWith('.md'))) {
  const file=path.join(source,'content/posts',name), original=fs.readFileSync(file,'utf8');
  const parsed=parseHugo(original), data={...parsed.data};
  const id=name.slice(0,-3).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const destination=path.join('content/posts',`${id}.md`);
  if(fs.existsSync(destination)){report.skipped.push(name);continue;}
  data.title=String(data.title || name.slice(0,-3));
  data.description=String(data.description||data.summary||'');
  data.draft=data.draft === true;
  const date=data.date;
  if(date && Number.isFinite(Date.parse(date))) {
    const iso=new Date(date).toISOString();
    if (/^date:\s*['"]?\d{4}-\d\d-\d\d['"]?\s*$/m.test(original)) {
      data.date=iso.slice(0,10)+'T12:00:00.000Z';data.datePrecision='day';
    }else data.date=iso;
  } else { data.date='';data.draft=true;report.notes.push(`${name}: no valid date; kept as a draft.`); }
  const image=parsed.content.match(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/) || null;
  if (!data.image && ['2025-08-29-noise-machine','2025-05-21-server'].includes(id) && image && /^(\/[^/]|https:\/\/)/.test(image[2])) { data.image=image[2];data.imageAlt=image[1]; }
  if(!data.image){data.image='/images/placeholder.svg';data.imageAlt='';}
  if (/\{\{[<%]/.test(parsed.content))report.notes.push(`${name}: contains Hugo shortcodes; review before deployment.`);
  if(id!==name.slice(0,-3))report.notes.push(`${name}: normalized filename to ${id}.md.`);
  fs.writeFileSync(destination,matter.stringify(parsed.content,data),{flag:'wx'});
  assert.equal(matter(fs.readFileSync(destination,'utf8')).content.trim(),parsed.content.trim(),`Content changed while importing ${name}`);
  report.imported.push({source:name,file:`${id}.md`,draft:data.draft});
}
if(fs.existsSync(path.join(source,'static')))fs.cpSync(path.join(source,'static'),'public',{recursive:true,force:false,errorOnExist:false,filter:file=>!['.DS_Store','.gitkeep'].includes(path.basename(file))});
fs.writeFileSync('docs/import-report.json',JSON.stringify(report,null,2)+'\n');
console.log(`Imported ${report.imported.length} posts; skipped ${report.skipped.length} existing files. ${report.notes.length} review notes in docs/import-report.json.`);
return report;
}
if (process.argv[1] === new URL(import.meta.url).pathname) importHugo(path.resolve(process.argv[2] || 'source-reference'));
