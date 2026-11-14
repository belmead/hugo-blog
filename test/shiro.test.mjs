import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'shiro-test-'));
process.env.SHIRO_CONTENT = path.join(temporary,'content');
const content = await import('../lib/content.mjs');
const render = await import('../lib/render.mjs');
const { build } = await import('../build.mjs');
const { createApp } = await import('../server.mjs');
const { parseHugo } = await import('../import-hugo.mjs');
fs.mkdirSync(content.root,{recursive:true});
fs.writeFileSync(path.join(content.root,'home.md'), fs.readFileSync('content/home.md'));
const input = {title:'A real post',date:'2026-01-15T14:30:00.000Z',draft:true,description:'A snippet',image:'/images/placeholder.svg',imageAlt:'Arcade',body:'## A heading\n\n**Bold** and [a link](https://example.com).\n\n![A picture](/images/placeholder.svg)\n\n```js\nconst n = 1;\n```'};
let post;
test('Hugo YAML and TOML front matter preserve the original post body',()=>{
  const body='## A heading\n\nOriginal **Markdown**.';
  for(const source of [`---\ntitle: Original\ndate: 2025-01-22\ndraft: true\n---\n${body}`,`+++\ntitle = "Original"\ndate = "2025-01-22T09:50:13-06:00"\ndraft = true\n+++\n${body}`]){
    const parsed=parseHugo(source);assert.equal(parsed.data.title,'Original');assert.equal(parsed.data.draft,true);assert.equal(parsed.content.trim(),body);
  }
});
test('Markdown persists, round-trips metadata, and detects competing edits',()=>{
  post=content.save('posts','a-real-post',input);
  assert.equal(post.body,input.body);
  assert.equal(post.imageAlt,'Arcade');
  assert.throws(()=>content.save('posts','a-real-post',input),{status:409});
  const updated=content.save('posts','a-real-post',{...post,title:'Updated title',draft:false});
  assert.equal(updated.draft,false);
  assert.ok(fs.readdirSync(path.join(content.root,'.history')).length);
  assert.throws(()=>content.save('posts','a-real-post',{...post,body:'A stale write'}),{status:409});
  post=updated;
});
test('invalid paths, metadata, and image URLs never write files',()=>{
  assert.throws(()=>content.save('posts','../escape',input),{status:400});
  assert.throws(()=>content.save('pages','studio',input),{status:400});
  assert.throws(()=>content.save('posts','bad-date',{...input,date:'broken'}),{status:400});
  assert.throws(()=>content.save('posts','bad-image',{...input,image:'javascript:alert(1)'}),{status:400});
  assert.throws(()=>content.saveHome({...content.home(),buttonURL:'javascript:alert(1)'}),{status:400});
});
test('public HTML renders rich Markdown and strips executable markup',()=>{
  const html=render.markdown(input.body+'\n\n<script>alert(1)</script><img src="x" onerror="alert(2)">\n\n[bad](javascript:alert(3))');
  assert.match(html,/<strong>Bold<\/strong>/);
  assert.match(html,/<h2>A heading<\/h2>/);
  assert.match(html,/<pre><code/);
  assert.match(html,/<img[^>]*loading="lazy"[^>]*decoding="async"/);
  assert.doesNotMatch(html,/<script|onerror|href="javascript:/);
});
test('date-only imports retain their calendar day without inventing a display time',()=>{
  assert.equal(render.dateLabel('2025-12-28T12:00:00.000Z','America/Chicago','day'),'December 28, 2025');
  assert.match(render.dateLabel('2025-12-28T12:00:00.000Z','America/Chicago'),/6:00 AM/);
});
test('static builds include pages and images, exclude drafts and future posts, and remove stale output',()=>{
  content.save('pages','about',{...input,title:'About',draft:false,nav:true});
  content.save('posts','draft-post',input);
  content.save('posts','future-post',{...input,draft:false,date:'2099-01-01T12:00:00.000Z'});
  const output=path.join(temporary,'site');
  const result=build(output);
  assert.equal(result.posts,1);assert.equal(result.pages,1);
  assert.ok(fs.existsSync(path.join(output,'posts/a-real-post/index.html')));
  assert.ok(fs.existsSync(path.join(output,'about/index.html')));
  assert.ok(fs.existsSync(path.join(output,'images/placeholder.svg')));
  assert.ok(!fs.existsSync(path.join(output,'posts/draft-post')));
  assert.ok(!fs.existsSync(path.join(output,'posts/future-post')));
  for(const file of ['sitemap.xml','index.xml']){const xml=fs.readFileSync(path.join(output,file),'utf8');assert.match(xml,/a-real-post/);assert.doesNotMatch(xml,/draft-post|future-post/);}
  const html=fs.readFileSync(path.join(output,'index.html'),'utf8');
  assert.doesNotMatch(html,/class="site-header"/);assert.match(html,/favicon-32x32.png/);assert.match(html,/Continue reading/);assert.match(html,/datetime=/);assert.match(html,/\/about\//);
  assert.doesNotMatch(html,/\/studio\/|\/api\/|future-post|draft-post/);
  content.save('posts','a-real-post',{...post,draft:true});build(output);
  assert.ok(!fs.existsSync(path.join(output,'posts/a-real-post')));
});
test('local HTTP flow saves and reloads documents and images, rejects cross-origin writes and draft URLs',async()=>{
  const {app}=await createApp({studio:false,adminDirectory:path.join(temporary,'admin')});
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const headers={'Content-Type':'application/json',Origin:base};
  try {
    assert.equal((await fetch(base+'/api/content')).status,401);
    const guard=await fetch(base+'/studio/',{redirect:'manual'});assert.equal(guard.status,302);assert.equal(guard.headers.get('location'),'/admin/');
    const setup=await fetch(base+'/admin/setup',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:base},body:new URLSearchParams({password:'local test password for Shiro'}),redirect:'manual'});
    assert.equal(setup.status,303);
    assert.match(setup.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
    headers.Cookie=setup.headers.get('set-cookie').split(';')[0];
    assert.ok(!fs.readFileSync(path.join(temporary,'admin/admin.json'),'utf8').includes('local test password for Shiro'));
    assert.equal((await fetch(base+'/admin/setup',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:base},body:new URLSearchParams({password:'a different test password'}),redirect:'manual'})).status,409);
    assert.equal((await fetch(base+'/api/content',{headers})).status,200);
    assert.equal((await fetch(base+'/api/content/posts/http-post',{method:'PUT',headers:{...headers,Origin:'https://evil.example'},body:JSON.stringify(input)})).status,403);
    const saved=await fetch(base+'/api/content/posts/http-post',{method:'PUT',headers,body:JSON.stringify(input)});
    assert.equal(saved.status,200);const doc=await saved.json();assert.equal(doc.body,input.body);
    assert.equal((await fetch(base+'/posts/http-post/')).status,404);
    assert.equal((await fetch(base+'/preview/posts/http-post/',{headers})).status,200);
    const fake=await fetch(base+'/api/media',{method:'POST',headers,body:JSON.stringify({name:'bad.png',data:Buffer.from('<script>bad</script>').toString('base64')})});
    assert.equal(fake.status,400);
    const uploaded=await fetch(base+'/api/media',{method:'POST',headers,body:JSON.stringify({name:'test.png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8L8AAAAASUVORK5CYII='})});
    assert.equal(uploaded.status,201);const image=await uploaded.json();
    assert.equal((await fetch(base+image.url)).status,200);
    fs.unlinkSync(path.join('public',image.url));
    const home=content.home();
    const updated=await fetch(base+'/api/home',{method:'PUT',headers,body:JSON.stringify({...home,title:'A new home',body:'A **custom** block.'})});
    assert.equal(updated.status,200);
    const html=await (await fetch(base+'/')).text();assert.match(html,/A new home/);assert.match(html,/<strong>custom<\/strong>/);
    const file=matter(fs.readFileSync(path.join(content.root,'posts/http-post.md'),'utf8'));assert.equal(file.data.title,input.title);
    await fetch(base+'/admin/logout',{method:'POST',headers,redirect:'manual'});
    assert.equal((await fetch(base+'/api/content',{headers})).status,401);
    const wrong=await fetch(base+'/admin/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:base},body:new URLSearchParams({password:'incorrect test password'}),redirect:'manual'});assert.equal(wrong.status,401);
    const login=await fetch(base+'/admin/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:base},body:new URLSearchParams({password:'local test password for Shiro'}),redirect:'manual'});assert.equal(login.status,303);
    assert.equal((await fetch(base+'/api/content',{headers:{Cookie:login.headers.get('set-cookie').split(';')[0]}})).status,200);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
