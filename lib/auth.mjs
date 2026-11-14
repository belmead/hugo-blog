import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import express from 'express';
import { adminPage } from './auth-page.mjs';
import { passwordRecord, verifyPassword } from './password.mjs';

const absoluteLifetime = 8 * 60 * 60 * 1000;
const idleLifetime = 30 * 60 * 1000;
function privateJSON(file, data, createOnly = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomBytes(12).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(data), { flag: 'wx', mode: 0o600, flush: true });
    if (createOnly) fs.linkSync(temporary, file);
    else fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
export function adminAuth(app, directory = path.resolve('.shiro')) {
  if (process.env.NODE_ENV === 'production') throw new Error('Shiro admin is local-only. Deploy site/ as static files; remote admin needs an HTTPS deployment with durable authentication storage.');
  const file = path.join(directory, 'admin.json');
  const attemptsFile = path.join(directory, 'login-attempts.json');
  const sessions = new Map();
  let authenticating = false;
  const configured = () => fs.existsSync(file);
  const tokenKey = req => {
    const token = /(?:^|;\s*)shiro_session=([a-zA-Z0-9_-]{43})(?:;|$)/.exec(req.get('cookie') || '')?.[1];
    return token ? createHash('sha256').update(token).digest('hex') : undefined;
  };
  const signedIn = req => {
    const key = tokenKey(req), session = sessions.get(key), now = Date.now();
    if (!session || session.expires <= now || session.lastSeen + idleLifetime <= now) { sessions.delete(key); return false; }
    session.lastSeen = now; return true;
  };
  const cookie = req => `HttpOnly; SameSite=Strict; Path=/${req.secure ? '; Secure' : ''}`;
  function login(req, res) {
    const now = Date.now();
    for (const [key,session] of sessions) if (session.expires <= now || session.lastSeen + idleLifetime <= now) sessions.delete(key);
    sessions.delete(tokenKey(req));
    const token = randomBytes(32).toString('base64url');
    sessions.set(createHash('sha256').update(token).digest('hex'), { expires: now + absoluteLifetime, lastSeen: now });
    res.set('Set-Cookie', `shiro_session=${token}; ${cookie(req)}; Max-Age=28800`);
    res.redirect(303, '/studio/');
  }
  function form(res, error = '', status = 200) {
    const setup = !configured();
    res.status(status).type('html').send(adminPage(setup,error));
  }
  app.use(['/admin','/api','/studio','/preview'], (req,res,next)=>{
    res.set('Cache-Control','no-store');
    res.set('Referrer-Policy','same-origin');
    res.set('X-Frame-Options','DENY');
    // The development editor must never become a public login through a proxy.
    if (['forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto'].some(header=>req.get(header))) return res.status(403).send('Remote admin access is not configured.');
    next();
  });
  app.use('/admin', express.urlencoded({ extended: false, limit: '2kb' }));
  app.use('/admin', (req,res,next)=>{
    res.set('Content-Security-Policy', "default-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
    if (!['GET','HEAD'].includes(req.method) && req.get('origin') !== `${req.protocol}://${req.get('host')}`) return res.status(403).send('Open Shiro locally to sign in.');
    next();
  });
  app.get('/admin/', (req,res)=>signedIn(req) ? res.redirect('/studio/') : form(res));
  app.post(['/admin/setup','/admin/login'], async (req,res)=>{
    const setup = req.path.endsWith('/setup');
    if (setup && configured()) return form(res,'An admin password is already set. Sign in below.',409);
    if (!setup && !configured()) return res.redirect(303,'/admin/');
    const now = Date.now();
    let attempts = fs.existsSync(attemptsFile) ? JSON.parse(fs.readFileSync(attemptsFile,'utf8')) : { count: 0, resetAt: now + 60000 };
    if (!Number.isInteger(attempts.count) || attempts.count < 0 || !Number.isFinite(attempts.resetAt)) throw new Error('Invalid login attempt state.');
    if (attempts.resetAt <= now) attempts = { count: 0, resetAt: now + 60000 };
    if (authenticating || attempts.count >= 5) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((attempts.resetAt - now)/1000))));
      return form(res,'Too many attempts. Wait a minute and try again.',429);
    }
    attempts.count++;
    privateJSON(attemptsFile, attempts);
    const password = req.body?.password;
    if (typeof password !== 'string' || !password.length || password.length > 256 || (setup && [...password].length < 15)) return form(res,setup ? 'Use a password between 15 and 256 characters.' : 'That password does not match.',setup ? 400 : 401);
    authenticating = true;
    try {
      if (setup) {
        try { privateJSON(file, await passwordRecord(password), true); }
        catch (error) { if (error.code === 'EEXIST') return form(res,'An admin password is already set. Sign in below.',409); throw error; }
      } else {
        const source = fs.readFileSync(file,'utf8');
        const record = JSON.parse(source);
        if (!(await verifyPassword(password,record))) return form(res,'That password does not match.',401);
        if (record.version !== 2) {
          const upgraded = await passwordRecord(password);
          if (fs.readFileSync(file,'utf8') !== source) return form(res,'The admin credentials changed. Sign in again.',409);
          privateJSON(file,upgraded);
        }
      }
      privateJSON(attemptsFile,{ count: 0, resetAt: Date.now() + 60000 });
      login(req,res);
    } finally { authenticating = false; }
  });
  app.post('/admin/logout', (req,res)=>{
    sessions.delete(tokenKey(req));
    res.set('Set-Cookie',`shiro_session=; ${cookie(req)}; Max-Age=0`);
    res.redirect(303,'/admin/');
  });
  app.use(['/api','/studio','/preview'], (req,res,next)=>{
    if (signedIn(req)) return next();
    if (req.path.startsWith('/api') || req.baseUrl === '/api') return res.status(401).json({error:'Sign in at /admin/ to edit your blog.'});
    res.redirect('/admin/');
  });
}
