import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('async function api('),source.indexOf('function notify('))+source.slice(source.indexOf('async function saveCurrent('),source.indexOf('function offerRecovery('));
function fixture(){
 const nodes=new Map(),recovery=new Map([['draft','Forty-five minutes of writing.']]);
 function element(){return {open:false,textContent:'',disabled:false,setAttribute(key,value){this[key]=value;},prepend(child){nodes.set('#'+child.id,child);this.child=child;},remove(){nodes.delete('#'+this.id);}};}
 for(const id of ['#work','#modal','#save','#save-state'])nodes.set(id,element());
 let signedIn=false;
 const draft={id:'in-progress',kind:'posts',title:'In progress',body:'Forty-five minutes of writing.',draft:true,revision:'before'};
 const context=vm.createContext({document:{createElement:element},$:key=>nodes.get(key),window:{location:{assign(){throw Error('The editor must not navigate.');}}},localStorage:{removeItem:key=>recovery.delete(key)},storageKey:()=> 'draft',notify(){},values:()=>({...draft}),fetch:async()=>new Response(JSON.stringify(signedIn?{...draft,revision:'after'}:{error:'Sign in'}),{status:signedIn?200:401})});
 vm.runInContext(`let saving=false,section='posts',current=${JSON.stringify(draft)},dirty=true,bodyChanged=true;const data={publishing:'github',posts:[current]};`+functions,context);
 return {context,nodes,recovery,signIn(){signedIn=true;},removeWork(){nodes.delete('#work');}};
}
test('expired upload and save keep the editor, writing, and recovery; sign-in then allows retry',async()=>{
 const f=fixture();
 await assert.rejects(vm.runInContext("api('/api/media/uploads',{method:'POST'})",f.context),{status:401});
 assert.match(f.nodes.get('#session-expired').innerHTML,/target="_blank"/);
 assert.equal(await vm.runInContext('saveCurrent()',f.context),false);
 assert.equal(vm.runInContext('current.body',f.context),'Forty-five minutes of writing.');
 assert.equal(vm.runInContext('dirty && bodyChanged',f.context),true);
 assert.equal(f.recovery.get('draft'),'Forty-five minutes of writing.');
 assert.equal(f.nodes.get('#save').disabled,false);
 assert.match(f.nodes.get('#save-state').textContent,/Not saved/);
 assert.equal(f.nodes.get('#session-expired').role,'alert');
 f.signIn();assert.equal(await vm.runInContext('saveCurrent()',f.context),true);
 assert.equal(vm.runInContext('current.revision',f.context),'after');
 assert.equal(vm.runInContext('dirty || bodyChanged',f.context),false);
 assert.equal(f.recovery.has('draft'),false);assert.equal(f.nodes.has('#session-expired'),false);
});
test('expired requests show sign-in inside an open dialog without closing it or discarding form fields',async()=>{
 const f=fixture(),modal=f.nodes.get('#modal');modal.open=true;modal.unsavedTitle='A new post';
 await assert.rejects(vm.runInContext("api('/api/content/posts/new',{method:'PUT'})",f.context),{status:401});
 assert.equal(modal.child,f.nodes.get('#session-expired'));assert.equal(modal.open,true);assert.equal(modal.unsavedTitle,'A new post');
});
test('unauthenticated startup returns a sign-in error without attempting navigation',async()=>{
 const f=fixture();f.removeWork();
 await assert.rejects(vm.runInContext("api('/api/content')",f.context),{status:401});assert.equal(f.nodes.has('#session-expired'),false);
});
