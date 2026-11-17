import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('async function api('),source.indexOf('function notify('))+source.slice(source.indexOf('function editorSnapshot('),source.indexOf('function canLeave('))+source.slice(source.indexOf('async function saveCurrent('),source.indexOf('function offerRecovery('));
function fixture(){
 const nodes=new Map(),recovery=new Map([['draft','Forty-five minutes of writing.']]);
 function element(){return {open:false,textContent:'',disabled:false,setAttribute(key,value){this[key]=value;},prepend(child){nodes.set('#'+child.id,child);this.child=child;},remove(){nodes.delete('#'+this.id);}};}
 for(const id of ['#work','#modal','#save','#save-state','#draft'])nodes.set(id,element());
 let signedIn=false, releaseResponse;
 let waitForResponse=null;
 const draft={id:'in-progress',kind:'posts',title:'In progress',body:'Forty-five minutes of writing.',draft:true,revision:'before'};
 let context;context=vm.createContext({document:{createElement:element},$:key=>nodes.get(key),window:{location:{assign(){throw Error('The editor must not navigate.');}}},editor:{getMarkdown:()=>draft.body},localStorage:{removeItem:key=>recovery.delete(key),setItem:(key,value)=>recovery.set(key,value)},storageKey:()=> 'draft',notify(){},values:()=>({...vm.runInContext('current',context),...Object.fromEntries(Object.entries(draft).filter(([key])=>key!=='revision'))}),fetch:async(url,options={})=>{const saved=options.body?JSON.parse(options.body):draft;if(waitForResponse)await waitForResponse;return new Response(JSON.stringify(signedIn?{...saved,revision:'after'}:{error:'Sign in'}),{status:signedIn?200:401});}});
 nodes.get('#draft').value='true';
 vm.runInContext(`let savedSnapshot='',savedMarkdown=${JSON.stringify(draft.body)};let saving=false,section='posts',current=${JSON.stringify(draft)},dirty=true,bodyChanged=true;const data={publishing:'github',posts:[current]};`+functions+'savedSnapshot=editorSnapshot(values());',context);
 return {context,nodes,recovery,signIn(){signedIn=true;},edit(values){Object.assign(draft,values);if('draft' in values)nodes.get('#draft').value=String(values.draft);},hold(){waitForResponse=new Promise(resolve=>{releaseResponse=resolve;});},release(){releaseResponse();},removeWork(){nodes.delete('#work');}};
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

test('save button follows publication status, disables when clean, and skips unchanged saves',async()=>{
 const f=fixture();f.signIn();vm.runInContext('dirty=false;updateSaveButton()',f.context);
 assert.equal(f.nodes.get('#save').disabled,true);assert.equal(f.nodes.get('#save').textContent,'Save draft');
 f.edit({draft:false});vm.runInContext('markDirty()',f.context);
 assert.equal(f.nodes.get('#save').disabled,false);assert.equal(f.nodes.get('#save').textContent,'Publish');
 assert.equal(await vm.runInContext('saveCurrent()',f.context),true);
 assert.equal(f.nodes.get('#save').textContent,'Save changes');assert.equal(f.nodes.get('#save').disabled,true);
 assert.equal(await vm.runInContext('saveCurrent()',f.context),true);
 f.edit({draft:true});vm.runInContext('markDirty()',f.context);assert.equal(f.nodes.get('#save').textContent,'Save draft');assert.equal(f.nodes.get('#save').disabled,false);
 f.edit({draft:false});vm.runInContext('markDirty()',f.context);assert.equal(f.nodes.get('#save').disabled,true);
});
test('edits typed during a save keep recovery and the save button enabled after the request finishes',async()=>{
 const f=fixture();f.signIn();f.hold();
 const pending=vm.runInContext('saveCurrent()',f.context);
 assert.equal(f.nodes.get('#save').disabled,true);assert.equal(f.nodes.get('#save').textContent,'Saving…');
 f.edit({body:'More writing typed while saving.'});vm.runInContext('bodyChanged=true;markDirty()',f.context);f.release();
 assert.equal(await pending,false);assert.equal(vm.runInContext('current.revision',f.context),'after');
 assert.equal(vm.runInContext('dirty && bodyChanged',f.context),true);assert.equal(f.nodes.get('#save').disabled,false);
 assert.equal(JSON.parse(f.recovery.get('draft')).body,'More writing typed while saving.');
 assert.equal(JSON.parse(f.recovery.get('draft')).revision,'after');
});
