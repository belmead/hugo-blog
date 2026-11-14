import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scryptSync, randomBytes } from 'node:crypto';
import express from 'express';
import { adminAuth } from '../lib/auth.mjs';

const directories = [];
const password = 'a password used only by security tests';
function directory() { const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shiro-auth-')); directories.push(dir); return dir; }
async function server(dir) {
  const app=express();adminAuth(app,dir);
  app.get('/api/private',(req,res)=>res.send('private'));
  app.use((error,req,res,next)=>res.status(500).send('Authentication unavailable.'));
  const listener=app.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
  const origin=`http://127.0.0.1:${listener.address().port}`;
  const post=(route,value=password,cookie,extra={})=>fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...(cookie?{Cookie:cookie}:{}),...extra},body:new URLSearchParams({password:value}),redirect:'manual'});
  return {origin,post,close:()=>new Promise(resolve=>listener.close(resolve))};
}
const cookie = response => response.headers.get('set-cookie').split(';')[0];
test('legacy password remains valid and upgrades to strong scrypt without storing plaintext',async()=>{
  const dir=directory(),salt=randomBytes(32).toString('hex');
  fs.writeFileSync(path.join(dir,'admin.json'),JSON.stringify({salt,hash:scryptSync(password,salt,64).toString('hex')}),{mode:0o600});
  const app=await server(dir);
  try {
    const response=await app.post('/admin/login');assert.equal(response.status,303);
    const source=fs.readFileSync(path.join(dir,'admin.json'),'utf8'),record=JSON.parse(source);
    assert.equal(record.version,2);assert.notEqual(record.salt,salt);assert.ok(!source.includes(password));
    assert.equal(fs.statSync(path.join(dir,'admin.json')).mode & 0o777,0o600);
    assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict; Path=\//);
    assert.equal((await fetch(app.origin+'/api/private',{headers:{Cookie:cookie(response)}})).status,200);
    assert.equal((await app.post('/admin/setup','another long test password')).status,409);
  } finally { await app.close(); }
});
test('failed and malformed logins are throttled across restarts, then recover after the window',async()=>{
  const dir=directory();let app=await server(dir);
  try {
    assert.equal((await app.post('/admin/setup')).status,303);
    for(let i=0;i<5;i++)assert.equal((await app.post('/admin/login',i%2?'wrong password':'')).status,401);
  } finally { await app.close(); }
  app=await server(dir);
  try {
    const blocked=await app.post('/admin/login');assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);
    fs.writeFileSync(path.join(dir,'login-attempts.json'),JSON.stringify({count:5,resetAt:Date.now()-1}),{mode:0o600});
    assert.equal((await app.post('/admin/login')).status,303);
  } finally { await app.close(); }
});
test('cross-origin requests, proxy exposure, forged cookies, and revoked sessions are rejected',async()=>{
  const app=await server(directory());
  try {
    assert.equal((await app.post('/admin/setup',password,undefined,{Origin:'https://attacker.example'})).status,403);
    assert.equal((await fetch(app.origin+'/admin/',{headers:{'X-Forwarded-Proto':'https'}})).status,403);
    const setup=await app.post('/admin/setup'),first=cookie(setup);
    assert.equal((await fetch(app.origin+'/api/private',{headers:{Cookie:first+'=garbage'}})).status,401);
    const login=await app.post('/admin/login',password,first),second=cookie(login);assert.notEqual(first,second);
    assert.equal((await fetch(app.origin+'/api/private',{headers:{Cookie:first}})).status,401);
    assert.equal((await fetch(app.origin+'/api/private',{headers:{Cookie:second}})).status,200);
    const logout=await app.post('/admin/logout',password,second);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
    assert.equal((await fetch(app.origin+'/api/private',{headers:{Cookie:second}})).status,401);
    const form=await fetch(app.origin+'/admin/');assert.equal(form.headers.get('cache-control'),'no-store');
    assert.equal(form.headers.get('x-frame-options'),'DENY');assert.match(form.headers.get('content-security-policy'),/form-action 'self'/);
    const html=await form.text();assert.match(html,/<input[^>]*type="password"[^>]*autocomplete="current-password"/);assert.ok(!html.includes(password));
  } finally { await app.close(); }
});
test('parallel password hashing is bounded',async()=>{
  const app=await server(directory());
  try {
    assert.equal((await app.post('/admin/setup')).status,303);
    const results=await Promise.all(Array.from({length:6},()=>app.post('/admin/login','wrong password')));
    assert.ok(results.some(response=>response.status===429));
    assert.ok(results.every(response=>[401,429].includes(response.status)));
    assert.equal((await app.post('/admin/login')).status,303);
  } finally { await app.close(); }
});
test('sessions expire after 30 idle minutes and after eight absolute hours',async t=>{
  const app=await server(directory());
  try {
    const setup=await app.post('/admin/setup'),session=cookie(setup);
    const start=Date.now();t.mock.timers.enable({apis:['Date'],now:start});
    t.mock.timers.setTime(start+30*60*1000+1);
    assert.equal((await fetch(app.origin+'/api/private',{headers:{Cookie:session}})).status,401);
    const login=await app.post('/admin/login'),next=cookie(login);
    const loginTime=Date.now();
    for(let i=1;i<=16;i++){
      t.mock.timers.setTime(loginTime+i*29*60*1000);
      assert.equal((await fetch(app.origin+'/api/private',{headers:{Cookie:next}})).status,200);
    }
    t.mock.timers.setTime(loginTime+8*60*60*1000+1);
    assert.equal((await fetch(app.origin+'/api/private',{headers:{Cookie:next}})).status,401);
  } finally { t.mock.timers.reset();await app.close(); }
});
test('local admin refuses production startup',()=>{
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
  try { assert.throws(()=>adminAuth(express(),directory()),/local-only/); }
  finally { if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous; }
});
after(()=>directories.forEach(dir=>fs.rmSync(dir,{recursive:true,force:true})));
