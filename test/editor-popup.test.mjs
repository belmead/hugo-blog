import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import vm from 'node:vm';
const require=createRequire(import.meta.url),entry=require.resolve('@toast-ui/editor');
const source=fs.readFileSync(path.join(path.dirname(entry),'esm/index.js'),'utf8');
const begin=source.indexOf('LinkPopupBody.prototype.initialize = '),end=source.indexOf('LinkPopupBody.prototype.mounted',begin);
assert.ok(begin>=0 && end>begin);
const body=source.slice(begin,end).replace('LinkPopupBody.prototype.initialize = ','').trim().replace(/;$/,'');
function popup(){const pending=[],calls=[];const target={props:{show:true,initialValues:{linkUrl:'https://example.com',linkText:'Selected text'}},refs:{url:{isConnected:true,focus:options=>calls.push(['focus',options.preventScroll]),select:()=>calls.push(['select'])},text:{removeAttribute(){},setAttribute(){}}}};const initialize=vm.runInNewContext('('+body+')',{removeClass_1:()=>{},addClass_1:()=>{},queueMicrotask:callback=>pending.push(callback)});return{target,calls,pending,initialize};}
test('link popup focuses and selects the URL after opening without scrolling',()=>{const p=popup();p.initialize.call(p.target);assert.equal(p.calls.length,0);p.pending.shift()();assert.deepEqual(p.calls,[['focus',true],['select']]);assert.equal(p.target.refs.url.value,'https://example.com');});
test('link popup cannot steal focus after closing or editor destruction',()=>{for(const change of [p=>{p.target.props.show=false;},p=>{p.target.refs.url.isConnected=false;}]){const p=popup();p.initialize.call(p.target);change(p);p.pending.shift()();assert.equal(p.calls.length,0);}});
