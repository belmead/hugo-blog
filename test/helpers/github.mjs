import {createHash} from 'node:crypto';
export function githubFixture(files={}) {
  const blobs=new Map(),entries=new Map(),calls=[];let commits=0,busy=0,lost=false,outage=false;
  function put(file,source){const bytes=Buffer.from(source),sha=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');blobs.set(sha,bytes);entries.set(file,sha);return sha;}
  for(const [file,source] of Object.entries(files))put(file,source);
  const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  return {calls,entries,put,get commits(){return commits;},set busy(n){busy=n;},set lost(value){lost=value;},set outage(value){outage=value;},
    text:file=>blobs.get(entries.get(file))?.toString(),
    async fetch(url,options={}) {
      const path=new URL(url).pathname.replace('/repos/test/blog',''),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
      calls.push({path,method,body,headers:options.headers});
      if(outage)return response({message:'secret echoed by upstream'},403);
      if(path.startsWith('/git/trees/'))return response({truncated:false,tree:[...entries].map(([path,sha])=>({path,sha,type:'blob',mode:'100644'}))});
      if(path.startsWith('/git/blobs/')){const bytes=blobs.get(path.split('/').at(-1));return bytes?response({content:bytes.toString('base64'),encoding:'base64'}):response({},404);}
      if(path.startsWith('/contents/')){
        const file=decodeURIComponent(path.slice('/contents/'.length)),sha=entries.get(file);
        if(method==='GET'){
          if(!sha)return response({},404);
          if(options.headers.Accept.includes('raw'))return new Response(blobs.get(sha));
          return response({sha,type:'file',content:blobs.get(sha).toString('base64'),encoding:'base64'});
        }
        if(busy-->0)return response({},409);
        if((body.sha??null)!==(sha??null))return response({},409);
        const next=put(file,Buffer.from(body.content,'base64'));commits++;
        if(lost){lost=false;throw new Error('Lost response after commit');}
        return response({content:{sha:next}},201);
      }
      if(path==='/git/ref/heads/main')return response({object:{sha:'head'}});
      if(path==='/git/commits/head')return response({tree:{sha:'tree'}});
      if(path==='/git/commits'&&method==='POST')return response({sha:'rebuilt'});
      if(path==='/git/refs/heads/main'&&method==='PATCH'){commits++;return response({});}
      throw new Error(`Unexpected GitHub call: ${method} ${path}`);
    }
  };
}
