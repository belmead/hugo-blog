import { randomBytes } from 'node:crypto';
import { validatePasswordRecord } from './password.mjs';
const storageError = () => Object.assign(new Error('Authentication storage is unavailable. Please try again later.'),{status:503});
export class RedisAuthStore {
  constructor({url,token,namespace='shiro:auth'}) {
    let endpoint;
    try { endpoint=new URL(url); } catch { throw new Error('Configure a valid HTTPS Upstash Redis REST URL.'); }
    if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.upstash.io') || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/' || typeof token!=='string' || !token || /\s/.test(token) || !/^[a-zA-Z0-9:_-]{1,100}$/.test(namespace)) throw new Error('Configure an HTTPS Upstash Redis REST URL, token, and valid auth namespace.');
    this.url=endpoint.href;this.token=token;this.prefix=`{${namespace}}`;
  }
  async command(...args) {
    try {
      const response=await fetch(this.url,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify(args),redirect:'error',signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw storageError();
      const result=await response.json();
      if(result.error || !Object.hasOwn(result,'result'))throw storageError();
      return result.result;
    } catch { throw storageError(); }
  }
  async credential() {
    const source=await this.command('GET',`${this.prefix}:credential`);
    try { return source === null ? null : validatePasswordRecord(JSON.parse(source)); }
    catch { throw storageError(); }
  }
  async initialize(record) {
    validatePasswordRecord(record);
    if(await this.command('SET',`${this.prefix}:credential`,JSON.stringify(record),'NX') !== 'OK') throw new Error('An admin credential already exists. It was not overwritten.');
  }
  async upgradeCredential(before,after) {
    return await this.command('EVAL',`if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET',KEYS[1],ARGV[2]) return 1`,1,`${this.prefix}:credential`,JSON.stringify(before),JSON.stringify(after)) === 1;
  }
  async beginAttempt() {
    const lease=randomBytes(32).toString('hex');
    const result=await this.command('EVAL',`
      local count=tonumber(redis.call('GET',KEYS[1]) or '0')
      if count>=5 then return {0,math.max(1,redis.call('TTL',KEYS[1]))} end
      if redis.call('EXISTS',KEYS[2])==1 then return {0,1} end
      count=redis.call('INCR',KEYS[1])
      if count==1 then redis.call('EXPIRE',KEYS[1],60) end
      redis.call('SET',KEYS[2],ARGV[1],'EX',30)
      return {1,0}
    `,2,`${this.prefix}:attempts`,`${this.prefix}:lease`,lease);
    return result[0]===1 ? {lease,retryAfter:0} : {lease:null,retryAfter:result[1]};
  }
  async finishAttempt(lease,success) {
    return this.command('EVAL',`
      if redis.call('GET',KEYS[2])~=ARGV[1] then return 0 end
      if ARGV[2]=='1' then redis.call('DEL',KEYS[1]) end
      redis.call('DEL',KEYS[2]) return 1
    `,2,`${this.prefix}:attempts`,`${this.prefix}:lease`,lease,success?'1':'0');
  }
  async createSession(key,previous) {
    await this.command('EVAL',`
      local t=redis.call('TIME') local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
      if ARGV[1]=='1' then redis.call('DEL',KEYS[2]) end
      redis.call('SET',KEYS[1],cjson.encode({expires=now+28800000}),'PX',1800000)
      return 1
    `,2,`${this.prefix}:session:${key}`,`${this.prefix}:session:${previous || 'none'}`,previous?'1':'0');
  }
  async session(key) {
    if(!key)return false;
    return await this.command('EVAL',`
      local value=redis.call('GET',KEYS[1]) if not value then return 0 end
      local session=cjson.decode(value)
      local t=redis.call('TIME') local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
      if session.expires<=now then redis.call('DEL',KEYS[1]) return 0 end
      redis.call('PEXPIRE',KEYS[1],math.min(1800000,session.expires-now)) return 1
    `,1,`${this.prefix}:session:${key}`) === 1;
  }
  async revokeSession(key) { if(key)await this.command('DEL',`${this.prefix}:session:${key}`); }
}
