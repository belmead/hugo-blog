import { randomUUID } from 'node:crypto';
import { fail } from './content.mjs';
export const maxImageSize=10*1024*1024;
export const chunkSize=512*1024;
export function imageType(bytes) {
  if(!bytes.length || bytes.length>maxImageSize)fail('Images must be between 1 byte and 10 MB.');
  const type=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpg':/^GIF8[79]a$/.test(bytes.toString('ascii',0,6))?'gif':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;
  if(!type)fail('Choose a PNG, JPEG, GIF, or WebP image.');
  return type;
}
export const imageBase=name=>String(name||'image').replace(/\.[^.]+$/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,60)||'image';
export class ImageUploads {
  constructor(store,github){this.store=store;this.github=github;this.prefix=`${store.prefix}:upload`;}
  key(id){if(!/^[a-f0-9-]{36}$/.test(id))fail('Invalid upload.');return `${this.prefix}:${id}`;}
  async begin({name,size}) {
    if(!Number.isInteger(size)||size<1||size>maxImageSize)fail('Images must be between 1 byte and 10 MB.');
    const id=randomUUID(),key=this.key(id);
    if(await this.store.command('SET',`${this.prefix}:active`,id,'NX','EX',600)!=='OK')fail('Another image is uploading. Finish it first or try again in ten minutes.',409);
    try{await this.store.command('SET',key,JSON.stringify({name:imageBase(name),size}),'EX',600);}
    catch(error){await this.release(id);throw error;}
    return {id,chunkSize};
  }
  async metadata(id) {
    const value=await this.store.command('GET',this.key(id));
    if(!value)fail('This upload expired. Choose the image again.',410);
    return JSON.parse(value);
  }
  async chunk(id,index,bytes) {
    const meta=await this.metadata(id);
    if(!Number.isInteger(index)||index<0||index>=Math.ceil(meta.size/chunkSize)||!Buffer.isBuffer(bytes)||bytes.length!==Math.min(chunkSize,meta.size-index*chunkSize))fail('Invalid image chunk.');
    const key=`${this.key(id)}:${index}`,value=bytes.toString('base64');
    if(await this.store.command('SET',key,value,'NX','EX',600)!=='OK' && await this.store.command('GET',key)!==value)fail('The uploaded chunk changed. Choose the image again.',409);
  }
  async complete(id) {
    const meta=await this.metadata(id);
    if(meta.result)return meta.result;
    const chunks=[];
    for(let i=0;i<Math.ceil(meta.size/chunkSize);i++) {
      const value=await this.store.command('GET',`${this.key(id)}:${i}`);
      if(!value)fail('The image upload is incomplete. Choose the image again.');
      const bytes=Buffer.from(value,'base64');
      if(bytes.length!==Math.min(chunkSize,meta.size-i*chunkSize))fail('Invalid image chunk.');
      chunks.push(bytes);
    }
    const bytes=Buffer.concat(chunks),name=`${meta.name}-${id}.${imageType(bytes)}`;
    const result=await this.github.upload(name,bytes);
    await this.store.command('SET',this.key(id),JSON.stringify({...meta,result}),'EX',600);
    await this.release(id);
    return result;
  }
  async release(id) {
    this.key(id);
    await this.store.command('EVAL',`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0`,1,`${this.prefix}:active`,id);
  }
  async cancel(id) {
    const meta=await this.metadata(id);
    await this.store.command('DEL',...Array.from({length:Math.ceil(meta.size/chunkSize)},(_,i)=>`${this.key(id)}:${i}`));
    await this.release(id);
  }
}
