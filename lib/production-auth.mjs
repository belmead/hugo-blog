import { randomBytes, createHash } from 'node:crypto';
import express from 'express';
import { RedisAuthStore } from './redis-auth-store.mjs';
import { adminPage } from './auth-page.mjs';
import { passwordRecord, verifyPassword } from './password.mjs';

export function productionAuthConfig(env=process.env) {
  if(!env.SHIRO_PUBLIC_ORIGIN)throw new Error('Production admin requires SHIRO_PUBLIC_ORIGIN and shared Redis credentials.');
  const origin=new URL(env.SHIRO_PUBLIC_ORIGIN);
  if(origin.protocol!=='https:' || origin.pathname!=='/' || origin.search || origin.hash || origin.username || origin.password)throw new Error('SHIRO_PUBLIC_ORIGIN must be an HTTPS origin without a path.');
  if(!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN)throw new Error('Production admin requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  const trustProxy=env.VERCEL==='1'?1:(env.SHIRO_TRUST_PROXY ? env.SHIRO_TRUST_PROXY.split(',').map(value=>value.trim()) : false);
  const deploymentHost=env.VERCEL==='1' && /^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL || '')?env.VERCEL_URL:null;
  return {origin:origin.origin,host:origin.host,deploymentHost,trustProxy,store:new RedisAuthStore({url:env.UPSTASH_REDIS_REST_URL,token:env.UPSTASH_REDIS_REST_TOKEN,namespace:env.SHIRO_AUTH_NAMESPACE || `shiro:auth:${createHash('sha256').update(origin.origin).digest('hex').slice(0,16)}`})};
}
const cookieName='__Host-shiro_session';
const cookieFlags='Secure; HttpOnly; SameSite=Strict; Path=/';
const digest=token=>createHash('sha256').update(token).digest('hex');
const tokenKey=req=>{
  const token=/(?:^|;\s*)__Host-shiro_session=([a-zA-Z0-9_-]{43})(?:;|$)/.exec(req.get('cookie') || '')?.[1];
  return token ? digest(token) : undefined;
};
export function productionAdminAuth(app,config) {
  const {store,origin,host,deploymentHost,trustProxy}=config;
  const hosts=new Set([host,deploymentHost].filter(Boolean));
  app.set('trust proxy',trustProxy);
  app.use((req,res,next)=>{
    if(!hosts.has(req.get('host')) || !req.secure)return res.status(403).send('Use the configured HTTPS address for Shiro.');
    res.set('Strict-Transport-Security','max-age=31536000');
    next();
  });
  app.use(['/admin','/api','/studio','/preview'],(req,res,next)=>{
    res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff'});
    if(!['GET','HEAD'].includes(req.method) && req.get('origin')!==`https://${req.get('host')}`)return res.status(403).send('This action must come from your Shiro admin page.');
    next();
  });
  app.use('/admin',(req,res,next)=>{res.set('Content-Security-Policy',"default-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'");next();});
  app.use('/admin',express.urlencoded({extended:false,limit:'2kb'}));
  app.get('/admin/',async(req,res)=>{
    if(await store.session(tokenKey(req)))return res.redirect('/studio/');
    if(!(await store.credential()))return res.status(503).send('Admin sign-in has not been provisioned.');
    res.type('html').send(adminPage(false));
  });
  app.all('/admin/setup',(req,res)=>res.status(404).send('Not found.'));
  app.post('/admin/login',async(req,res)=>{
    const attempt=await store.beginAttempt();
    if(!attempt.lease){res.set('Retry-After',String(attempt.retryAfter));return res.status(429).type('html').send(adminPage(false,'Too many attempts. Please try again shortly.'));}
    let finished=false;
    const rejectLogin=async(status,message,html=false)=>{
      await store.finishAttempt(attempt.lease,false);finished=true;
      return html?res.status(status).type('html').send(adminPage(false,message)):res.status(status).send(message);
    };
    try {
      const password=req.body?.password;
      if(typeof password!=='string' || !password.length || password.length>256)return await rejectLogin(401,'That password does not match.',true);
      const record=await store.credential();
      if(!record) return await rejectLogin(503,'Admin sign-in has not been provisioned.');
      if(!(await verifyPassword(password,record)))return await rejectLogin(401,'That password does not match.',true);
      if(record.version!==2 && !(await store.upgradeCredential(record,await passwordRecord(password))))return await rejectLogin(409,'Admin credentials changed. Sign in again.');
      const token=randomBytes(32).toString('base64url');
      await store.createSession(digest(token),tokenKey(req));
      if(await store.finishAttempt(attempt.lease,true)!==1)throw Object.assign(new Error('Sign-in expired. Please try again.'),{status:503});
      finished=true;
      res.set('Set-Cookie',`${cookieName}=${token}; ${cookieFlags}; Max-Age=28800`);
      res.redirect(303,'/studio/');
    } finally { if(!finished)await store.finishAttempt(attempt.lease,false); }
  });
  app.post('/admin/logout',async(req,res)=>{
    await store.revokeSession(tokenKey(req));
    res.set('Set-Cookie',`${cookieName}=; ${cookieFlags}; Max-Age=0`);
    res.redirect(303,'/admin/');
  });
  app.use(['/api','/studio','/preview'],async(req,res,next)=>{
    if(await store.session(tokenKey(req)))return next();
    if(req.baseUrl==='/api')return res.status(401).json({error:'Sign in at /admin/ to edit your blog.'});
    res.redirect('/admin/');
  });
}
