import { createHash } from 'node:crypto';
import { filePath, parseSource, documentSource, homeSource, fail } from './content.mjs';

const conflict = () => fail('This file changed elsewhere. Copy your changes, then reload before saving.',409);
const blobSHA = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const encoded = value => value.split('/').map(encodeURIComponent).join('/');
export class GitHubContent {
  constructor(env=process.env) {
    const {SHIRO_GITHUB_REPOSITORY:repo,SHIRO_GITHUB_BRANCH:branch,SHIRO_GITHUB_TOKEN:token}=env;
    if(!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !branch || /[\s~^:?*[\\]|\.\.|\/\/|^\/|\/$|@\{|\.$|\.lock$/.test(branch) || !token || /\s/.test(token)) throw new Error('Configure SHIRO_GITHUB_REPOSITORY, SHIRO_GITHUB_BRANCH, and a scoped SHIRO_GITHUB_TOKEN.');
    this.base=`https://api.github.com/repos/${repo}`;this.branch=branch;this.token=token;
  }
  async request(route,{method='GET',body,raw=false,missing=false}={}) {
    let response;
    try { response=await fetch(this.base+route,{method,headers:{Authorization:`Bearer ${this.token}`,Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2026-03-10','User-Agent':'Shiro'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)}); }
    catch { fail('GitHub did not respond. Reload to check whether your save completed before retrying.',503); }
    if(response.status===404 && missing)return null;
    if(!response.ok) {
      if([409,422].includes(response.status))fail('GitHub is busy or the branch disallows this commit. Reload and try again.',409);
      fail(response.status===401 || response.status===403?'GitHub access was refused. Check the server token and repository permissions.':'GitHub is unavailable or the configured branch is missing. Try again later.',503);
    }
    return raw?response:response.json();
  }
  async tree() {
    const result=await this.request(`/git/trees/${encodeURIComponent(this.branch)}?recursive=1`);
    if(result.truncated)fail('The repository is too large to list safely.',503);
    return result.tree.filter(entry=>entry.type==='blob' && entry.mode==='100644');
  }
  async source(entry) {
    const result=await this.request(`/git/blobs/${entry.sha}`);
    return parseSource(Buffer.from(result.content.replace(/\s/g,''),'base64').toString('utf8'),entry.sha);
  }
  async snapshot() {
    const tree=await this.tree(),entries=tree.filter(e=>/^content\/(home\.md|(?:posts|pages)\/[a-z0-9]+(?:-[a-z0-9]+)*\.md)$/.test(e.path));
    const docs=[];
    // Bound GitHub requests even as the blog grows.
    let cursor=0;
    await Promise.all(Array.from({length:Math.min(6,entries.length)},async()=>{while(cursor<entries.length){const entry=entries[cursor++];docs.push({path:entry.path,doc:await this.source(entry)});}}));
    const home=docs.find(e=>e.path==='content/home.md')?.doc;
    if(!home)fail('The GitHub branch does not contain the Shiro project yet (content/home.md is missing).',503);
    const list=kind=>docs.filter(e=>e.path.startsWith(`content/${kind}/`)).map(e=>({...e.doc,id:e.path.split('/').at(-1).slice(0,-3),kind})).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    return {home,posts:list('posts'),pages:list('pages'),publishing:'github'};
  }
  async file(file) {
    return this.request(`/contents/${encoded(file)}?ref=${encodeURIComponent(this.branch)}`,{missing:true});
  }
  async write(file,bytes,expected,message) {
    if(!/^content\/(home\.md|(?:posts|pages)\/[a-z0-9]+(?:-[a-z0-9]+)*\.md)$/.test(file) && !/^public\/uploads\/[a-z0-9-]+\.(png|jpg|gif|webp)$/.test(file))fail('Invalid publishing path.');
    const desired=blobSHA(bytes);
    for(let attempt=0;attempt<3;attempt++) {
      const before=await this.file(file);
      // A retried request after a lost response must not create a duplicate commit.
      if(before?.sha===desired)return desired;
      if((before?.sha ?? null)!==expected)conflict();
      try {
        const result=await this.request(`/contents/${encoded(file)}`,{method:'PUT',body:{branch:this.branch,message,content:bytes.toString('base64'),...(before?{sha:before.sha}:{})}});
        return result.content.sha;
      } catch(error) {
        if(error.status!==409 && error.status!==503)throw error;
        const after=await this.file(file);
        if(after?.sha===desired)return desired;
        if((after?.sha ?? null)!==expected)conflict();
        if(error.status!==409 || attempt===2)throw error;
      }
    }
  }
  async save(kind,id,input) {
    filePath(kind,id);
    const file=`content/${kind}/${id}.md`,entry=await this.file(file);
    const current=entry?await this.source(entry):{};
    const source=documentSource(input,current),sha=await this.write(file,Buffer.from(source),input.revision??null,`Shiro: save ${kind}/${id}`);
    return {...parseSource(source,sha),id,kind};
  }
  async saveHome(input) {
    const entry=await this.file('content/home.md');
    if(!entry)fail('The GitHub branch is missing the Shiro homepage.',503);
    const source=homeSource(input,await this.source(entry));
    return parseSource(source,await this.write('content/home.md',Buffer.from(source),input.revision??null,'Shiro: save homepage'));
  }
  async media() {
    return (await this.tree()).filter(e=>/^public\/(uploads|images|img)\/.+\.(png|jpe?g|gif|webp)$/i.test(e.path)).map(e=>({name:e.path.split('/').at(-1),url:'/'+encoded(e.path.slice(7))}));
  }
  async upload(name,bytes) {
    await this.write(`public/uploads/${name}`,bytes,null,`Shiro: upload ${name}`);
    return {name,url:`/uploads/${name}`};
  }
  async image(name) {
    if(!/^[a-z0-9-]+\.(png|jpg|gif|webp)$/.test(name))fail('Image not found.',404);
    const response=await this.request(`/contents/public/uploads/${name}?ref=${encodeURIComponent(this.branch)}`,{raw:true,missing:true});
    if(!response)fail('Image not found.',404);
    return response;
  }
  async rebuild() {
    const head=await this.request(`/git/ref/heads/${encoded(this.branch)}`),commit=await this.request(`/git/commits/${head.object.sha}`);
    const next=await this.request('/git/commits',{method:'POST',body:{message:'Shiro: rebuild static site',tree:commit.tree.sha,parents:[head.object.sha]}});
    await this.request(`/git/refs/heads/${encoded(this.branch)}`,{method:'PATCH',body:{sha:next.sha,force:false}});
    return {publishing:'github'};
  }
}
