import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GitHubContent} from '../lib/github-content.mjs';
import {parseSource,published} from '../lib/content.mjs';
import {githubFixture} from './helpers/github.mjs';
const settings={SHIRO_GITHUB_REPOSITORY:'test/blog',SHIRO_GITHUB_BRANCH:'main',SHIRO_GITHUB_TOKEN:'test-secret'};
const input={title:'A post',date:'2026-01-01T10:00:00.000Z',draft:true,body:'**Markdown**\n\n![alt](/uploads/example.png)',image:'',description:'Snippet',imageAlt:''};
const home=fs.readFileSync('content/home.md','utf8');
test('GitHub publishes Markdown documents, pages, homepage and images; new instances read the saved state',async()=>{
  const fixture=githubFixture({'content/home.md':home,'public/img/original image.png':Buffer.from('original')}),previous=globalThis.fetch;globalThis.fetch=fixture.fetch;
  try{
    const store=new GitHubContent(settings);
    const created=await store.save('posts','example',input);assert.equal(created.body,input.body);assert.equal(created.draft,true);
    assert.match(fixture.text('content/posts/example.md'),/\*\*Markdown\*\*/);assert.doesNotMatch(fixture.text('content/posts/example.md'),/revision:|kind:|id:/);
    assert.equal(published((await store.snapshot()).posts).length,0);
    const saved=await store.save('posts','example',{...created,title:'Published title',draft:false});
    assert.equal(saved.draft,false);assert.equal(published((await store.snapshot()).posts).length,1);
    await store.save('pages','about',{...input,draft:false,nav:true});
    const initial=(await store.snapshot()).home;
    await store.saveHome({...initial,subtitle:'the smartest dumb guy in the room'});
    const uploaded=await store.upload('image-abc.png',Buffer.from([137,80,78,71,13,10,26,10]));
    assert.equal(uploaded.url,'/uploads/image-abc.png');
    assert.equal((await store.image(uploaded.name)).status,200);
    const fresh=await new GitHubContent(settings).snapshot();assert.equal(fresh.posts[0].title,'Published title');assert.equal(fresh.pages[0].nav,true);
    assert.equal(fresh.home.subtitle,'the smartest dumb guy in the room');
    assert.ok((await store.media()).some(img=>img.url==='/img/original%20image.png'));
    assert.ok((await store.media()).some(img=>img.url===uploaded.url));
    await store.rebuild();assert.equal(fixture.calls.at(-1).body.force,false);
    assert.ok(fixture.calls.filter(c=>c.method==='PUT').every(c=>c.body.branch==='main'));
  }finally{globalThis.fetch=previous;}
});
test('GitHub rejects stale writes, protects new-file collisions, retries branch races and reconciles lost save responses',async()=>{
  const fixture=githubFixture({'content/home.md':home}),previous=globalThis.fetch;globalThis.fetch=fixture.fetch;
  try{
    const store=new GitHubContent(settings),original=await store.save('posts','example',input);
    await assert.rejects(()=>store.save('posts','example',{...input,title:'Collision'}),{status:409});
    fixture.put('content/posts/example.md',fixture.text('content/posts/example.md').replace('A post','External title'));
    await assert.rejects(()=>store.save('posts','example',{...original,title:'Stale title'}),{status:409});assert.match(fixture.text('content/posts/example.md'),/External title/);
    fixture.busy=1;const updated=await store.save('posts','example',{...(await store.snapshot()).posts[0],title:'After branch race'});assert.equal(updated.title,'After branch race');
    const count=fixture.commits;fixture.lost=true;
    const recovered=await store.save('posts','example',{...updated,title:'Lost response'});assert.equal(recovered.title,'Lost response');assert.equal(fixture.commits,count+1);
    await store.save('posts','example',{...updated,title:'Lost response'});assert.equal(fixture.commits,count+1);
  }finally{globalThis.fetch=previous;}
});
test('GitHub validates paths and inputs and never returns upstream secrets',async()=>{
  assert.throws(()=>new GitHubContent({}),/Configure/);
  assert.throws(()=>new GitHubContent({...settings,SHIRO_GITHUB_BRANCH:'../main'}),/Configure/);
  const fixture=githubFixture({'content/home.md':home}),previous=globalThis.fetch;globalThis.fetch=fixture.fetch;
  try{
    const store=new GitHubContent(settings);
    await assert.rejects(()=>store.save('pages','admin',input),{status:400});
    await assert.rejects(()=>store.save('posts','../escape',input),{status:400});
    await assert.rejects(()=>store.save('posts','example',{...input,date:'bad'}),{status:400});
    await assert.rejects(()=>store.write('.github/workflows/main.yml',Buffer.from('bad'),null,'bad'),{status:400});
    assert.equal(fixture.commits,0);
    fixture.outage=true;await assert.rejects(()=>store.snapshot(),error=>error.status===503&&!error.message.includes('secret'));
    assert.equal(parseSource(home).title,'Old Man Yells at Games');
  }finally{globalThis.fetch=previous;}
});
