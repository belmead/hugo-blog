import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash,randomBytes,scryptSync} from 'node:crypto';
import express from 'express';
import {productionAdminAuth,productionAuthConfig} from '../lib/production-auth.mjs';
import {RedisAuthStore} from '../lib/redis-auth-store.mjs';
import {githubFixture} from './helpers/github.mjs';
import {ImageUploads,chunkSize,maxImageSize} from '../lib/media.mjs';
import {passwordRecord} from '../lib/password.mjs';

test('production configuration refuses missing credentials and non-HTTPS origins',()=>{
  assert.throws(()=>productionAuthConfig({}),/SHIRO_PUBLIC_ORIGIN/);
  assert.throws(()=>productionAuthConfig({SHIRO_PUBLIC_ORIGIN:'http://example.com'}),/HTTPS/);
  assert.throws(()=>productionAuthConfig({SHIRO_PUBLIC_ORIGIN:'https://example.com/admin/'}),/HTTPS/);
  assert.throws(()=>productionAuthConfig({SHIRO_PUBLIC_ORIGIN:'https://example.com'}),/Redis|REDIS/);
  const configured={SHIRO_PUBLIC_ORIGIN:'https://example.com',UPSTASH_REDIS_REST_URL:'https://test.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test',VERCEL:'1',VERCEL_URL:'shiro-check.vercel.app'};
  assert.equal(productionAuthConfig(configured).deploymentHost,'shiro-check.vercel.app');
  assert.equal(productionAuthConfig({...configured,VERCEL_URL:'attacker.example'}).deploymentHost,null);
  assert.throws(()=>new RedisAuthStore({url:'http://example.com',token:'test'}),/HTTPS/);
});

const configFile=process.env.SHIRO_REDIS_TEST_CONFIG;
const origin='https://shiro-test.example';
const password='synthetic password only for the production integration test';
let temporary,certificate,key,promise;
const stores=[];
function tlsMaterial(){
  if(certificate)return;
  temporary=fs.mkdtempSync(path.join(os.tmpdir(),'shiro-tls-'));
  const certPath=path.join(temporary,'cert.pem'),keyPath=path.join(temporary,'key.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certPath,'-days','1','-subj','/CN=shiro-test.example','-addext','subjectAltName=DNS:shiro-test.example,IP:127.0.0.1'],{stdio:'ignore'});
  certificate=fs.readFileSync(certPath);key=fs.readFileSync(keyPath);
}
function store(){
  const credentials=JSON.parse(fs.readFileSync(configFile,'utf8'));
  const result=new RedisAuthStore({...credentials,namespace:`shiro:test:${randomUUID()}`});stores.push(result);return result;
}
async function instance(shared,{plain=false,trustProxy=false,application}={}){
  const app=application || express();
  if(!application){
    productionAdminAuth(app,{origin,host:'shiro-test.example',trustProxy,store:shared});
    app.get('/api/private',(req,res)=>res.json({private:true}));
    app.get('/studio/',(req,res)=>res.send('studio'));
    app.use((error,req,res,next)=>res.status(error.status||500).json({error:'Authentication unavailable.'}));
  }
  tlsMaterial();
  const listener=plain?http.createServer(app):https.createServer({cert:certificate,key},app);
  listener.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
  const request=(route,{method='GET',body='',cookie,headers={}}={})=>new Promise((resolve,reject)=>{
    const client=plain?http:https;
    const req=client.request({hostname:'127.0.0.1',port:listener.address().port,path:route,method,ca:certificate,servername:'shiro-test.example',headers:{Host:'shiro-test.example',Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...(cookie?{Cookie:cookie}:{}),...headers}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));
    });req.on('error',reject);req.end(body);
  });
  const login=(value=password,cookie)=>request('/admin/login',{method:'POST',body:new URLSearchParams({password:value}).toString(),cookie});
  return{request,login,close:()=>new Promise(resolve=>listener.close(resolve))};
}
const cookie=response=>response.headers.get('set-cookie').split(';')[0];
const hash=cookie=>createHash('sha256').update(cookie.split('=')[1]).digest('hex');
const provision=async shared=>{promise ||=passwordRecord(password);await shared.initialize(await promise);};
test('live Redis: sessions survive another instance and restart, rotate, revoke, and expire',{skip:!configFile},async()=>{
  const shared=store();await provision(shared);
  let first=await instance(shared),second=await instance(new RedisAuthStore({...JSON.parse(fs.readFileSync(configFile,'utf8')),namespace:shared.prefix.slice(1,-1)}));
  try{
    const response=await first.login();assert.equal(response.status,303);
    assert.match(response.headers.get('set-cookie'),/^__Host-shiro_session=/);
    assert.match(response.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Strict; Path=\//);
    assert.ok(!response.headers.get('set-cookie').includes('Domain='));
    const initial=cookie(response);
    assert.equal((await second.request('/api/private',{cookie:initial})).status,200);
    await first.close();first=await instance(shared);
    assert.equal((await first.request('/api/private',{cookie:initial})).status,200);
    const rotation=await second.login(password,initial);assert.equal(rotation.status,303);const next=cookie(rotation);
    assert.notEqual(next,initial);assert.equal((await first.request('/api/private',{cookie:initial})).status,401);
    assert.equal((await first.request('/api/private',{cookie:next})).status,200);
    await first.request('/admin/logout',{method:'POST',cookie:next});
    assert.equal((await second.request('/api/private',{cookie:next})).status,401);
    const idle=cookie(await first.login());
    const idleKey=`${shared.prefix}:session:${hash(idle)}`;
    assert.ok(await shared.command('PTTL',idleKey)<=1800000);
    await shared.command('PEXPIRE',idleKey,1);await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal((await second.request('/api/private',{cookie:idle})).status,401);
    const absolute=cookie(await first.login()),absoluteKey=`${shared.prefix}:session:${hash(absolute)}`;
    await shared.command('SET',absoluteKey,JSON.stringify({expires:1}),'EX',60);
    assert.equal((await second.request('/api/private',{cookie:absolute})).status,401);
  }finally{await first.close();await second.close();}
});
test('live Redis: limits are shared, parallel hashing is leased, and provisioning cannot replace the password',{skip:!configFile},async()=>{
  const shared=store();await provision(shared);
  await assert.rejects(()=>shared.initialize(awaitRecord()),/already exists/);
  function awaitRecord(){return {version:2,salt:'a'.repeat(64),hash:'b'.repeat(128)};}
  const first=await instance(shared),second=await instance(shared);
  try{
    const lease=await shared.beginAttempt();assert.ok(lease.lease);
    const blocked=await second.login();assert.equal(blocked.status,429);
    await shared.finishAttempt(lease.lease,false);
    for(let i=0;i<4;i++)assert.equal((await (i%2?first:second).login('wrong password')).status,401);
    assert.equal((await first.login()).status,429);
    await shared.command('DEL',`${shared.prefix}:attempts`);
    assert.equal((await second.login()).status,303);
  }finally{await first.close();await second.close();}
});
test('live Redis: HTTPS and exact-origin enforcement, no public bootstrap, legacy migration, fail-closed outages',{skip:!configFile},async()=>{
  const shared=store(),salt=randomBytes(32).toString('hex');
  await shared.initialize({salt,hash:scryptSync(password,salt,64).toString('hex')});
  const app=await instance(shared),plain=await instance(shared,{plain:true});
  try{
    assert.equal((await plain.request('/admin/',{headers:{'X-Forwarded-Proto':'https'}})).status,403);
    assert.equal((await app.request('/admin/',{headers:{Host:'attacker.example'}})).status,403);
    assert.equal((await app.request('/admin/login',{method:'POST',headers:{Origin:'https://attacker.example'}})).status,403);
    assert.equal((await app.request('/admin/setup',{method:'POST'})).status,404);
    const form=await app.request('/admin/');assert.equal(form.status,200);assert.match(form.headers.get('strict-transport-security'),/max-age/);assert.equal(form.headers.get('cache-control'),'no-store');assert.equal(form.headers.get('referrer-policy'),'same-origin');
    assert.ok(!(await form.text()).includes('Set your admin password'));
    const login=await app.login();assert.equal(login.status,303);assert.equal((await shared.credential()).version,2);
    const session=cookie(login),realFetch=globalThis.fetch;
    try{
      globalThis.fetch=(url,options)=>url===shared.url?Promise.resolve(new Response('{}',{status:503})):realFetch(url,options);
      const failed=await app.login();assert.equal(failed.status,503);assert.equal(failed.headers.get('set-cookie'),null);
      assert.equal((await app.request('/api/private',{cookie:session})).status,503);
      const logout=await app.request('/admin/logout',{method:'POST',cookie:session});assert.equal(logout.status,503);
    }finally{globalThis.fetch=realFetch;}
  }finally{await app.close();await plain.close();}
});
test('live Redis: deployment entry authenticates the studio and publishes documents, homepage, and chunked images to GitHub',{skip:!configFile},async()=>{
  const shared=store();await provision(shared);
  const settings={SHIRO_GITHUB_REPOSITORY:'test/blog',SHIRO_GITHUB_BRANCH:'main',SHIRO_GITHUB_TOKEN:'synthetic-test-token',NODE_ENV:'production',VERCEL:'1',SHIRO_PUBLIC_ORIGIN:origin,UPSTASH_REDIS_REST_URL:shared.url,UPSTASH_REDIS_REST_TOKEN:shared.token,SHIRO_AUTH_NAMESPACE:shared.prefix.slice(1,-1)};
  const previous=Object.fromEntries(Object.keys(settings).map(key=>[key,process.env[key]]));
  Object.assign(process.env,settings);
  let app;
  const realFetch=globalThis.fetch,fixture=githubFixture({'content/home.md':fs.readFileSync('content/home.md','utf8')});
  globalThis.fetch=(url,options)=>String(url).startsWith('https://api.github.com/')?fixture.fetch(url,options):realFetch(url,options);
  try{
    const {default:handler}=await import(`../api/shiro.mjs?test=${randomUUID()}`);
    const application=express();application.use(handler);app=await instance(shared,{application});
    const protectedPage=await app.request('/studio/');assert.equal(protectedPage.status,302);assert.equal(protectedPage.headers.get('location'),'/admin/');
    const login=await app.login();assert.equal(login.status,303);const session=cookie(login);
    const studio=await app.request('/studio/',{cookie:session});assert.equal(studio.status,200);
    const html=await studio.text();assert.match(html,/Shiro/);assert.ok(!html.includes('@vite/client'));
    const json={'Content-Type':'application/json'},send=(route,body,method='PUT')=>app.request(route,{method,cookie:session,headers:json,body:JSON.stringify(body)});
    const content=await (await app.request('/api/content',{cookie:session})).json();assert.equal(content.publishing,'github');
    const draft={title:'GitHub draft',body:'## A real Markdown body',date:'2026-01-01T10:00:00.000Z',draft:true,image:''};
    assert.equal((await app.request('/api/content/posts/example',{method:'PUT',headers:json,body:JSON.stringify(draft)})).status,401);
    let saved=await send('/api/content/posts/example',draft);assert.equal(saved.status,200);const first=await saved.json();
    saved=await send('/api/content/posts/example',{...first,title:'Published from editor',draft:false});assert.equal(saved.status,200);
    assert.equal((await send('/api/content/posts/example',{...first,title:'Stale save'})).status,409);
    assert.equal((await send('/api/content/pages/about',{...draft,title:'About',draft:false,nav:true})).status,200);
    assert.equal((await send('/api/home',{...content.home,subtitle:'Edited homepage'})).status,200);
    const preview=await app.request('/preview/home/',{cookie:session});assert.equal(preview.status,200);assert.equal(preview.headers.get('x-frame-options'),'SAMEORIGIN');assert.match(await preview.text(),/Edited homepage/);
    const postPreview=await app.request('/preview/posts/example/',{cookie:session});assert.match(await postPreview.text(),/Published from editor/);
    assert.equal((await app.request('/preview/home/')).status,302);
    const bytes=Buffer.alloc(chunkSize+9,7);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
    const begin=await send('/api/media/uploads',{name:'Cover image.png',size:bytes.length},'POST');assert.equal(begin.status,201);const upload=await begin.json();
    assert.equal((await send(`/api/media/uploads/${upload.id}/complete`,{},'POST')).status,400);
    for(let i=0;i<2;i++)assert.equal((await app.request(`/api/media/uploads/${upload.id}/${i}`,{method:'PUT',cookie:session,headers:{'Content-Type':'application/octet-stream'},body:bytes.subarray(i*chunkSize,(i+1)*chunkSize)})).status,200);
    const complete=await send(`/api/media/uploads/${upload.id}/complete`,{},'POST');assert.equal(complete.status,201);const image=await complete.json();
    assert.match(image.url,/^\/uploads\/cover-image-[a-f0-9-]+\.png$/);
    const publicImage=await app.request(image.url);assert.equal(publicImage.status,200);assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()),bytes);
    assert.ok((await (await app.request('/api/media',{cookie:session})).json()).some(item=>item.url===image.url));
    assert.equal((await send('/api/build',{},'POST')).status,200);
    await send(`/api/media/uploads/${upload.id}`,{},'DELETE');
    assert.equal((await app.request('/.shiro/admin.json')).status,404);
  }finally{
    globalThis.fetch=realFetch;
    if(app)await app.close();
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});
test('live Redis: image staging enforces limits, deduplicates retries, and stores a complete 10 MB image once',{skip:!configFile},async()=>{
  const shared=store(),commits=[];
  const uploads=new ImageUploads(shared,{upload:async(name,bytes)=>{commits.push({name,bytes});return{name,url:`/uploads/${name}`};}});
  await assert.rejects(()=>uploads.begin({size:maxImageSize+1}),{status:400});
  const pending=await uploads.begin({name:'Large image.png',size:maxImageSize});
  await assert.rejects(()=>uploads.begin({size:8}),{status:409});
  await assert.rejects(()=>uploads.chunk(pending.id,0,Buffer.alloc(1)),{status:400});
  const bytes=Buffer.alloc(maxImageSize,7);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
  for(let i=0;i<maxImageSize/chunkSize;i++)await uploads.chunk(pending.id,i,bytes.subarray(i*chunkSize,(i+1)*chunkSize));
  await uploads.chunk(pending.id,0,bytes.subarray(0,chunkSize));
  await assert.rejects(()=>uploads.chunk(pending.id,0,Buffer.alloc(chunkSize)),{status:409});
  const result=await uploads.complete(pending.id);assert.deepEqual(commits[0].bytes,bytes);
  assert.deepEqual(await uploads.complete(pending.id),result);assert.equal(commits.length,1);
  await uploads.cancel(pending.id);assert.equal(await shared.command('GET',`${uploads.key(pending.id)}:0`),null);
  const invalid=await uploads.begin({size:8,name:'fake.png'});await uploads.chunk(invalid.id,0,Buffer.alloc(8));
  await assert.rejects(()=>uploads.complete(invalid.id),{status:400});await uploads.cancel(invalid.id);
  const expired=await uploads.begin({size:8});await shared.command('DEL',uploads.key(expired.id));
  await assert.rejects(()=>uploads.metadata(expired.id),{status:410});
});
after(async()=>{
  for(const shared of stores){
    const keys=await shared.command('KEYS',`${shared.prefix}:*`);
    if(keys.length)await shared.command('DEL',...keys);
  }
  if(temporary)fs.rmSync(temporary,{recursive:true,force:true});
});
