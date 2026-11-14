import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GitHubContent } from './lib/github-content.mjs';
import { ImageUploads, imageType, imageBase } from './lib/media.mjs';
import { randomUUID } from 'node:crypto';
import { home, saveHome, list, read, save, published, fail, filePath } from './lib/content.mjs';
import { homepage, documentPage } from './lib/render.mjs';
import { build } from './build.mjs';
import { adminAuth } from './lib/auth.mjs';
import { productionAuthConfig, productionAdminAuth } from './lib/production-auth.mjs';

export async function createApp({ studio = true, adminDirectory, production=process.env.NODE_ENV==='production' } = {}) {
  const app = express();
  const authConfig=production?productionAuthConfig():null;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (!production && (!['127.0.0.1', 'localhost'].includes(req.hostname) || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))) return res.status(403).send('Shiro is a local editor.');
    res.set('X-Content-Type-Options', 'nosniff');
    if (req.path.startsWith('/api')) {
      res.set('Cache-Control', 'no-store');
      if (!production && !['GET','HEAD'].includes(req.method) && req.get('origin') !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Open Shiro locally to save changes.' });
    }
    next();
  });
  if(production)productionAdminAuth(app,authConfig);
  else adminAuth(app, adminDirectory);
  const github=production?new GitHubContent():null;
  const uploads=github?new ImageUploads(authConfig.store,github):null;
  app.use('/api', express.json({ limit: '15mb' }));
  app.get('/api/content', async(req,res) => res.json(github?await github.snapshot():{ home: home(), posts: list('posts'), pages: list('pages') }));
  app.put('/api/home', async(req,res) => res.json(github?await github.saveHome(req.body):saveHome(req.body)));
  app.put('/api/content/:kind/:id', async(req,res) => res.json(github?await github.save(req.params.kind,req.params.id,req.body):save(req.params.kind, req.params.id, req.body)));
  app.post('/api/build', async(req,res) => res.json(github?await github.rebuild():build()));
  if(uploads){
    app.post('/api/media/uploads',async(req,res)=>res.status(201).json(await uploads.begin(req.body)));
    app.put('/api/media/uploads/:id/:index',express.raw({type:'application/octet-stream',limit:'512kb'}),async(req,res)=>{await uploads.chunk(req.params.id,Number(req.params.index),req.body);res.json({ok:true});});
    app.post('/api/media/uploads/:id/complete',async(req,res)=>res.status(201).json(await uploads.complete(req.params.id)));
    app.delete('/api/media/uploads/:id',async(req,res)=>{await uploads.cancel(req.params.id);res.json({ok:true});});
  }
  app.get('/api/media', async(req,res) => {
    if(github)return res.json(await github.media());
    const files = [];
    function visit(dir) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (/\.(png|jpg|jpeg|webp|gif)$/i.test(entry.name)) files.push({ name: entry.name, url: '/' + path.relative('public',file).split(path.sep).map(encodeURIComponent).join('/') });
      }
    }
    for (const dir of ['public/uploads','public/images','public/img']) visit(dir);
    res.json(files);
  });
  app.post('/api/media', (req,res) => {
    if(github)return res.status(400).json({error:'Use the chunked image upload.'});
    const { name, data } = req.body;
    if (typeof data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) fail('Choose a PNG, JPEG, GIF, or WebP image.');
    const bytes = Buffer.from(data,'base64');
    const type=imageType(bytes),base=imageBase(name);
    const filename = `${base}-${randomUUID().slice(0,8)}.${type}`;
    fs.mkdirSync('public/uploads',{recursive:true});
    fs.writeFileSync(path.join('public/uploads', filename), bytes, { flag:'wx' });
    res.status(201).json({ name:filename, url:`/uploads/${filename}` });
  });
  app.use('/api', (req,res)=>res.status(404).json({error:'Unknown editor action.'}));
  if(github)app.get('/uploads/:name',async(req,res,next)=>{
    const response=await github.image(req.params.name);
    const type=req.params.name.split('.').at(-1);
    res.set({'Content-Type':`image/${type==='jpg'?'jpeg':type}`,'Cache-Control':'public, max-age=60'});
    try{await pipeline(Readable.fromWeb(response.body),res);}catch(error){if(res.headersSent)res.destroy();else next(error);}
  });
  app.get('/preview/home/',async(req,res)=>{
    const snapshot=github?await github.snapshot():{home:home(),posts:list('posts'),pages:list('pages')};
    res.set('X-Frame-Options','SAMEORIGIN').type('html').send(homepage(snapshot.home,snapshot.posts,snapshot.pages));
  });
  app.use(express.static('public', { index:false, dotfiles:'deny' }));
  app.get('/', (req,res)=>res.type('html').send(homepage(home(),list('posts'),list('pages'))));
  app.get('/preview/:kind/:id/', async(req,res)=>{
    if(!github)return res.type('html').send(documentPage(home(),read(req.params.kind,req.params.id),list('pages')));
    filePath(req.params.kind,req.params.id);
    const snapshot=await github.snapshot(),doc=snapshot[req.params.kind].find(doc=>doc.id===req.params.id);
    if(!doc)fail('Document not found.',404);
    res.type('html').send(documentPage(snapshot.home,doc,snapshot.pages));
  });
  app.get('/posts/:id/', (req,res)=> {
    const doc = read('posts',req.params.id);
    if (!published([doc]).length) fail('Post not found.',404);
    res.type('html').send(documentPage(home(),doc,list('pages')));
  });
  app.get('/:id/', (req,res,next)=> {
    if (req.params.id === 'studio') return next();
    const doc = read('pages',req.params.id);
    if (!published([doc]).length) fail('Page not found.',404);
    res.type('html').send(documentPage(home(),doc,list('pages')));
  });
  let vite;
  if(studio && production)app.use('/studio',express.static('dist/studio',{dotfiles:'deny'}));
  if (studio && !production) { const {createServer}=await import('vite');vite = await createServer({ server:{middlewareMode:true}, appType:'spa' }); app.use(vite.middlewares); }
  app.use((error,req,res,next)=> {
    const status = error.status || 500;
    if (status === 500) console.error(error);
    res.status(status).json({error: status === 500 ? 'Shiro could not complete this action. Your saved files are intact.' : error.message });
  });
  return { app, vite };
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { app } = await createApp();
  const port = Number(process.env.PORT || 4317);
  const production=process.env.NODE_ENV==='production';
  app.listen(port, production?'0.0.0.0':'127.0.0.1', ()=>console.log(production?'Shiro production server listening.':`Shiro admin: http://127.0.0.1:${port}/admin/\nBlog preview: http://127.0.0.1:${port}/`));
}
