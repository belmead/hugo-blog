import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import './studio.css';
import { imageMarkdown } from './image-markdown.js';

const $ = selector => document.querySelector(selector);
const e = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data, section = 'posts', current, editor, dirty = false, bodyChanged = false, search = '', filter = 'all', saving = false;
let noticeTimer, savedSnapshot='', savedMarkdown=null;
async function api(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { 'Content-Type':'application/json', ...options.headers } });
  const result = await res.json();
  if (res.status === 401) {
    const target=$('#modal')?.open ? $('#modal') : $('#work');
    if(target){
      const banner=$('#session-expired') || document.createElement('div');
      banner.id='session-expired';banner.className='recovery';banner.setAttribute('role','alert');
      banner.innerHTML='Your session expired. Your writing is still here. <a href="/admin/" target="_blank" rel="noopener">Sign in in another tab</a>, then retry saving or uploading.';
      target.prepend(banner);
    }
    throw Object.assign(new Error('Your session expired. Sign in in another tab, then retry. Your writing is still here.'),{status:401});
  }
  if (!res.ok) throw new Error(result.error || 'Could not connect to Shiro.');
  $('#session-expired')?.remove();
  return result;
}
function notify(message, error = false) {
  clearTimeout(noticeTimer);
  $('#notice').textContent = message; $('#notice').classList.toggle('error',error); $('#notice').hidden = false;
  noticeTimer = setTimeout(()=>{ $('#notice').hidden = true; },error ? 8000 : 4000);
}
const storageKey = () => `shiro:${section}:${current?.id || 'home'}`;
function editorSnapshot(input) {
  const fields=section==='home'?['siteTitle','title','subtitle','image','imageAlt','buttonText','buttonURL','postsTitle','timezone','body']:['title','description','date','draft','image','imageAlt','nav','body'];
  return JSON.stringify(fields.map(key=>input[key] ?? ''));
}
function updateSaveButton() {
  const button=$('#save');if(!button)return;
  const draft=$('#draft')?.value==='true';
  button.textContent=saving?'Saving…':section==='home'?'Save homepage':draft?'Save draft':current?.draft?'Publish':'Save changes';
  button.disabled=saving || !dirty;
}
function markDirty() {
  dirty=editorSnapshot(values())!==savedSnapshot;
  $('#save-state').textContent=dirty?'Unsaved changes':data.publishing==='github'?'Saved to GitHub':'Saved to Markdown';
  $('#save-state').className=dirty?'unsaved':'';
  updateSaveButton();
  try { if(dirty)localStorage.setItem(storageKey(), JSON.stringify(values()));else localStorage.removeItem(storageKey()); } catch { /* Disk save remains available when browser storage is full. */ }
}
function canLeave() { if(saving){notify('Wait for the save to finish.');return false;}return !dirty || confirm('Leave this editor? Your unsaved changes are kept in this browser for recovery.'); }
function destroyEditor() { savedMarkdown=null;editor?.destroy(); editor = null; }
function layout() {
  $('#app').innerHTML = `<div class="studio"><aside class="sidebar"><a class="shiro" href="/studio/">shiro<span>白</span></a><div class="site-label">YOUR SPACE</div><div class="site-name">${e(data.home.siteTitle)}</div><nav aria-label="Studio"><button data-section="posts">Writing <span>${data.posts.length}</span></button><button data-section="pages">Pages <span>${data.pages.length}</span></button><button data-section="home">Homepage</button><button data-section="media">Images</button></nav><div class="sidebar-bottom"><a href="/" target="_blank" rel="noopener">View your site <span>↗</span></a><button id="build">Build static site <span>↗</span></button><form method="post" action="/admin/logout"><button type="submit">Sign out</button></form></div></aside><div class="workspace"><header class="studio-top"><span id="breadcrumb">Your space / Writing</span><div><span class="local-label">${data.publishing==='github'?'GitHub workspace':'Local workspace'}</span><a href="/" target="_blank" rel="noopener">Open preview ↗</a></div></header><main id="work"></main><div id="notice" role="status" hidden></div></div></div><dialog id="modal"></dialog><input id="file-picker" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>`;
  document.querySelectorAll('[data-section]').forEach(btn=>btn.onclick=()=>{ if(canLeave()) { section=btn.dataset.section; dirty=false; current=null; render(); } });
  $('#build').onclick=async()=> { const btn=$('#build'); btn.disabled=true; try { const r=await api('/api/build',{method:'POST',body:'{}'}); notify(r.publishing==='github'?'Rebuild requested in GitHub. The public site updates after deployment.':`Built ${r.posts} posts and ${r.pages} pages. Static files are in ${r.directory}.`); } catch(err){notify(err.message,true);} finally{btn.disabled=false;} };
  render();
}
function render() {
  destroyEditor();
  document.querySelectorAll('[data-section]').forEach(btn=>btn.classList.toggle('active',btn.dataset.section===section));
  $('#breadcrumb').textContent=`Your space / ${{posts:'Writing',pages:'Pages',home:'Homepage',media:'Images'}[section]}`;
  if (section==='home') return renderHome();
  if (section==='media') return renderMedia();
  renderList();
}
function renderList() {
  const docs=data[section];
  $('#work').innerHTML=`<div class="work-inner"><div class="page-heading"><div>${section==='posts'?'<h1>admin panel</h1>':'<h1>Pages</h1>'}</div><button class="primary" id="new">+ New ${section==='posts'?'post':'page'}</button></div><div class="list-tools"><div class="filters">${['all','published','drafts'].map(f=>`<button data-filter="${f}" class="${filter===f?'selected':''}">${f[0].toUpperCase()+f.slice(1)} <span>${f==='all'?docs.length:docs.filter(d=>f==='drafts'?d.draft:!d.draft).length}</span></button>`).join('')}</div><input id="search" type="search" aria-label="Search writing" placeholder="Search your ${section==='posts'?'writing':'pages'}…" value="${e(search)}"></div><div id="documents"></div><p class="file-note">Your words live in <code>content/${section}/</code> as Markdown files.</p></div>`;
  $('#new').onclick=newDocument;
  $('#search').oninput=ev=>{search=ev.target.value;rows();};
  document.querySelectorAll('[data-filter]').forEach(btn=>btn.onclick=()=>{filter=btn.dataset.filter;renderList();});
  rows();
}
function rows() {
  const docs=data[section].filter(d=>(filter==='all'||(filter==='drafts'?d.draft:!d.draft))&&`${d.title} ${d.description}`.toLowerCase().includes(search.toLowerCase()));
  $('#documents').innerHTML=docs.length?docs.map(d=>`<button class="document-row" data-id="${e(d.id)}">${d.image?`<img src="${e(d.image)}" alt="" loading="lazy" decoding="async" width="98" height="92">`:'<div class="document-placeholder" aria-hidden="true"></div>'}<div class="document-copy"><div class="document-meta"><span class="status ${d.draft?'draft':''}">${d.draft?'Draft':Date.parse(d.date)>Date.now()?'Scheduled':'Published'}</span><span>${d.date?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:data.home.timezone}).format(new Date(d.date)):''}</span></div><h2>${e(d.title)}</h2><p>${e(d.description||d.body.replace(/[#*\[\]`]/g,'').slice(0,130))}</p></div><span class="row-arrow" aria-hidden="true">↗</span></button>`).join(''):`<div class="empty"><h2>${search?'Nothing found.':'A fresh page awaits.'}</h2><p>${search?'Try a different search.':'Write something worth keeping.'}</p></div>`;
  document.querySelectorAll('[data-id]').forEach(btn=>btn.onclick=()=>openDocument(data[section].find(d=>d.id===btn.dataset.id)));
}
function showModal(html) { const modal=$('#modal'); modal.innerHTML=html; modal.showModal(); modal.querySelector('[data-close]')?.addEventListener('click',()=>modal.close()); }
function newDocument() {
  showModal(`<form id="new-form"><div class="dialog-heading"><h2>A new ${section==='posts'?'post':'page'}</h2><button type="button" data-close aria-label="Close">×</button></div><label>Title<input name="title" required maxlength="300" placeholder="What’s on your mind?" autofocus></label><label>URL name<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="a-thought-worth-keeping"></label><p class="hint">The URL stays the same when you change the title.</p><button class="primary" type="submit">Start writing ↗</button><p class="form-error" role="alert"></p></form>`);
  const form=$('#new-form');
  form.elements.title.oninput=()=>{form.elements.slug.value=form.elements.title.value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,160);};
  form.onsubmit=async ev=>{ev.preventDefault();const id=form.elements.slug.value;if(data[section].some(d=>d.id===id)){form.querySelector('.form-error').textContent='That URL is already in use.';return;}const doc={id,kind:section,title:form.elements.title.value,body:'',description:'',date:new Date().toISOString(),draft:true,image:'',imageAlt:'',revision:null};const submit=form.querySelector('[type=submit]');submit.disabled=true;try{const saved=await api(`/api/content/${section}/${id}`,{method:'PUT',body:JSON.stringify(doc)});data[section].unshift(saved);$('#modal').close();openDocument(saved);}catch(err){form.querySelector('.form-error').textContent=err.message;}finally{submit.disabled=false;}};
}
function localDate(value) { const d=new Date(value || Date.now());return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); }
function mountEditor(body) {
  savedMarkdown=null;
  editor = new Editor({ el:$('#editor'), height:'auto', minHeight:'430px', initialEditType:'wysiwyg', previewStyle:'vertical', initialValue:body||'', usageStatistics:false, autofocus:false, placeholder:'Begin anywhere. Make it yours.', toolbarItems:[['heading','bold','italic','strike'],['hr','quote'],['ul','ol','task'],['table','link'],['code','codeblock']], hooks:{addImageBlobHook: async(blob,callback)=>{try { const image=await upload(blob); callback(image.url,blob.name||'Image'); }catch(err){notify(err.message,true);} }}, events:{change:()=>{if(editor && savedMarkdown!==null){bodyChanged=editor.getMarkdown()!==savedMarkdown;markDirty();}}} });
  savedMarkdown=editor.getMarkdown();
  savedSnapshot=editorSnapshot(values());updateSaveButton();
  document.querySelectorAll('#editor div.ProseMirror').forEach((editable,i)=>{editable.setAttribute('role','textbox');editable.setAttribute('aria-multiline','true');editable.setAttribute('aria-label',i===0?'Markdown body':'Rich text body');});
  document.querySelectorAll('#editor .toastui-editor-mode-switch .tab-item').forEach(tab=>{tab.setAttribute('role','button');tab.tabIndex=0;tab.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();tab.click();}});});
}
function openDocument(doc) {
  destroyEditor();current={...doc};bodyChanged=false;dirty=false;
  $('#breadcrumb').textContent=`${section==='posts'?'Writing':'Pages'} / ${doc.title}`;
  $('#work').innerHTML=`<div class="editor-header"><button class="text-button" id="back">← ${section==='posts'?'All writing':'All pages'}</button><div><span id="save-state">${doc.revision?(data.publishing==='github'?'Saved to GitHub':'Saved to Markdown'):'New draft'}</span><button class="secondary" id="preview">Preview ↗</button><button class="primary" id="save">Save ${doc.draft?'draft':'changes'}</button></div></div><div class="editor-layout"><div class="writing-pane"><label class="sr-only" for="title">Title</label><textarea id="title" rows="2" placeholder="Give it a title">${e(doc.title)}</textarea><div class="body-label"><span>THE STORY</span><button class="text-button" id="insert-image">+ Insert image</button></div><div id="editor"></div><p class="editor-hint">Drop or paste images into your writing. Switch to Markdown whenever you like.</p></div><aside class="details-pane"><h2>${section==='posts'?'Post':'Page'} details</h2><label>Status<select id="draft"><option value="true" ${doc.draft?'selected':''}>Draft</option><option value="false" ${!doc.draft?'selected':''}>Published</option></select></label><label>Date & time<input type="datetime-local" id="date" value="${localDate(doc.date)}" required></label><p class="hint">Editor time: ${e(Intl.DateTimeFormat().resolvedOptions().timeZone)}. Dates in the future are scheduled.</p><label>Snippet<textarea id="description" rows="4" placeholder="A few words to draw your reader in…">${e(doc.description)}</textarea></label><p class="hint">Shown on your homepage, below the title.</p><label>Cover image</label><button class="cover-picker" id="cover">${doc.image?`<img src="${e(doc.image)}" alt="${e(doc.imageAlt)}"><span>Change image</span>`:'<span>+ Choose an image</span>'}</button><input type="hidden" id="image" value="${e(doc.image)}"><label>Image description<input id="imageAlt" value="${e(doc.imageAlt)}" placeholder="Describe the image for readers"></label><button class="text-button" id="remove-cover" ${doc.image?'':'hidden'}>Remove cover image</button><label>URL<input readonly value="${section==='posts'?'/posts/':'/'}${e(doc.id)}/"></label>${section==='pages'?`<label class="checkbox"><input id="nav" type="checkbox" ${doc.nav?'checked':''}> Show in navigation</label>`:''}<div class="markdown-note"><strong>Markdown, always.</strong><p>Saved as <code>content/${section}/${e(doc.id)}.md</code>. Yours to keep, edit, or move.</p></div></aside></div>`;
  mountEditor(doc.body);
  $('#back').onclick=()=>{if(canLeave()){dirty=false;current=null;render();}};
  $('#save').onclick=()=>saveCurrent();
  $('#preview').onclick=async()=>{const tab=window.open('about:blank','_blank');if(await saveCurrent()) {if(tab)tab.location.href=`/preview/${section}/${current.id}/`;else notify('Allow popups to open the preview.');}else tab?.close();};
  $('#insert-image').onclick=()=>chooseImage(image=>{editor.exec('addImage',{imageUrl:image.url,altText:image.alt||image.name});editor.focus();});
  $('#cover').onclick=()=>chooseImage(setCover);
  $('#remove-cover').onclick=()=>setCover({url:'',alt:''});
  document.querySelectorAll('.details-pane input:not([readonly]),.details-pane textarea,.details-pane select,#title').forEach(field=>field.addEventListener('input',markDirty));
  offerRecovery();
}
function setCover(image) {
  $('#image').value=image.url;$('#imageAlt').value=image.alt||image.name||'';
  $('#cover').innerHTML=image.url?`<img src="${e(image.url)}" alt="${e(image.alt||image.name)}"><span>Change image</span>`:'<span>+ Choose an image</span>';
  $('#remove-cover').hidden=!image.url;markDirty();
}
function values() {
  if(section==='home') return { ...data.home, ...Object.fromEntries(new FormData($('#home-form'))), body:bodyChanged?editor.getMarkdown():data.home.body };
  if(!current) return {};
  return { ...current, title:$('#title').value, description:$('#description').value, date:$('#date').value?new Date($('#date').value).toISOString():'', draft:$('#draft').value==='true',image:$('#image').value,imageAlt:$('#imageAlt').value,nav:$('#nav')?.checked||false,body:bodyChanged?editor.getMarkdown():current.body };
}
async function saveCurrent() {
  if(saving)return false;if(!dirty)return true;saving=true;updateSaveButton();
  try {
    const payload=values(),snapshot=editorSnapshot(payload),markdown=editor.getMarkdown();
    const result=await api(section==='home'?'/api/home':`/api/content/${section}/${current.id}`,{method:'PUT',body:JSON.stringify(payload)});
    if(section==='home'){data.home=result;$('#home-preview').contentWindow.location.reload();}
    else {current=result;const index=data[section].findIndex(d=>d.id===result.id);if(index<0)data[section].unshift(result);else data[section][index]=result;}
    savedSnapshot=snapshot;savedMarkdown=markdown;bodyChanged=editor.getMarkdown()!==savedMarkdown;markDirty();
    notify(dirty?'Saved. Newer edits are still unsaved.':data.publishing==='github'?'Saved to GitHub. The public site updates after deployment.':'Saved. Your Markdown file is up to date.');return !dirty;
  }catch(err){$('#save-state').textContent='Not saved. Your changes are still in this tab.';$('#save-state').className='unsaved';notify(err.message,true);return false;}finally{saving=false;updateSaveButton();}
}
function offerRecovery() {
  let recovery;try{recovery=JSON.parse(localStorage.getItem(storageKey()));}catch{}
  if(!recovery)return;
  const banner=document.createElement('div');banner.className='recovery';banner.innerHTML='Unsaved writing was found in this browser. <button>Restore changes</button>';
  $('#work').prepend(banner);banner.querySelector('button').onclick=()=>{
    if(section==='home'){for(const [key,value] of Object.entries(recovery)){const field=$('#home-form').elements.namedItem(key);if(field)field.value=value;}}
    else{for(const key of ['title','description','image','imageAlt'])$('#'+key).value=recovery[key]||'';$('#draft').value=String(recovery.draft);$('#date').value=localDate(recovery.date);if($('#nav'))$('#nav').checked=recovery.nav;}
    editor.setMarkdown(recovery.body||'');bodyChanged=true;markDirty();banner.remove();
  };
}
function renderHome() {
  const h=data.home;bodyChanged=false;dirty=false;
  const field=(key,label,large=false)=>`<label>${label}${large?`<textarea name="${key}" rows="3">${e(h[key])}</textarea>`:`<input name="${key}" value="${e(h[key])}">`}</label>`;
  $('#work').innerHTML=`<div class="editor-header"><div><h1 class="small-title">Make yourself at home.</h1><p class="hint">A few words. One big image. Your writing below.</p></div><div><span id="save-state">${data.publishing==='github'?'Saved to GitHub':'Saved to Markdown'}</span><button class="primary" id="save">Save homepage</button></div></div><div class="home-layout"><form id="home-form"><h2>The introduction</h2>${field('siteTitle','Site name')}${field('title','Hero headline',true)}${field('subtitle','Subtext',true)}<label>Wide hero image</label><button class="cover-picker" id="home-image" type="button">${h.image?`<img src="${e(h.image)}" alt="${e(h.imageAlt)}">`:'Choose an image'}<span>Change image</span></button><input type="hidden" name="image" value="${e(h.image)}">${field('imageAlt','Image description')}<button class="text-button" type="button" id="remove-home-image">Remove hero image</button><div class="field-pair">${field('buttonText','Link text')}${field('buttonURL','Link destination')}</div><h2>The writing</h2>${field('postsTitle','List heading')}${field('timezone','Display time zone')}<h2>A little extra</h2><p class="hint">Optional content between your hero image and posts.</p><div id="editor"></div></form><section class="home-preview-panel" aria-label="Homepage preview"><div class="preview-bar"><span>YOUR HOMEPAGE</span><div><button id="desktop-preview" class="selected">Desktop</button><button id="mobile-preview">Mobile</button><a href="/preview/home/" target="_blank" rel="noopener" aria-label="Open homepage preview">↗</a></div></div><div class="frame-wrap"><iframe id="home-preview" title="Saved homepage preview" src="/preview/home/"></iframe></div><p>Preview updates when you save.</p></section></div>`;
  mountEditor(h.body);
  $('#home-form').onsubmit=ev=>ev.preventDefault();
  $('#home-form').addEventListener('input',markDirty);
  $('#save').onclick=()=>saveCurrent();
  $('#home-image').onclick=()=>chooseImage(img=>{const f=$('#home-form');f.elements.image.value=img.url;f.elements.imageAlt.value=img.alt||img.name;$('#home-image').innerHTML=`<img src="${e(img.url)}" alt="${e(img.alt||img.name)}"><span>Change image</span>`;markDirty();});
  $('#remove-home-image').onclick=()=>{$('#home-form').elements.image.value='';$('#home-image').innerHTML='<span>Choose an image</span>';markDirty();};
  $('#mobile-preview').onclick=()=>{$('#home-preview').classList.add('mobile');$('#mobile-preview').classList.add('selected');$('#desktop-preview').classList.remove('selected');};
  $('#desktop-preview').onclick=()=>{$('#home-preview').classList.remove('mobile');$('#desktop-preview').classList.add('selected');$('#mobile-preview').classList.remove('selected');};
  offerRecovery();
}
async function upload(file) {
  if(file.size>10*1024*1024)throw new Error('Images can be up to 10 MB.');
  if(data.publishing==='github'){
    const pending=await api('/api/media/uploads',{method:'POST',body:JSON.stringify({name:file.name||'pasted-image',size:file.size})});
    try{
      for(let offset=0,index=0;offset<file.size;offset+=pending.chunkSize,index++)await api(`/api/media/uploads/${pending.id}/${index}`,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:file.slice(offset,offset+pending.chunkSize)});
      return await api(`/api/media/uploads/${pending.id}/complete`,{method:'POST',body:'{}'});
    }finally{await api(`/api/media/uploads/${pending.id}`,{method:'DELETE'}).catch(()=>{});}
  }
  const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Could not read the image.'));reader.readAsDataURL(file);});
  return api('/api/media',{method:'POST',body:JSON.stringify({name:file.name||'pasted-image',data:encoded})});
}
function pickFile(callback) {const picker=$('#file-picker');picker.value='';picker.onchange=async()=>{if(!picker.files[0])return;try{const image=await upload(picker.files[0]);await callback(image);}catch(err){notify(err.message,true);}};picker.click();}
async function chooseImage(callback) {
  showModal(`<div class="dialog-heading"><div><h2>A picture belongs here.</h2><p class="hint">Upload an image or choose one from your library.</p></div><button data-close aria-label="Close">×</button></div><button class="primary" id="upload-image">+ Upload image</button><label class="image-alt">Image description<input id="chosen-alt" placeholder="What does the image show?"></label><div class="image-grid" id="image-options">Loading images…</div><p class="hint">PNG, JPEG, WebP, or GIF. Up to 10 MB. Paste and drag images directly into the post editor, too.</p>`);
  const select=img=>{const alt=$('#chosen-alt').value;$('#modal').close();callback({...img,alt:alt||img.name});};
  $('#upload-image').onclick=()=>pickFile(select);
  try{const images=await api('/api/media');$('#image-options').innerHTML=images.map((img,i)=>`<button data-image="${i}" title="${e(img.name)}"><img src="${e(img.url)}" alt="${e(img.name)}" loading="lazy" decoding="async"></button>`).join('')||'<p>No images yet. Upload your first one.</p>';document.querySelectorAll('[data-image]').forEach(btn=>btn.onclick=()=>select(images[Number(btn.dataset.image)]));}catch(err){$('#image-options').textContent=err.message;}
}
async function renderMedia() {
  $('#work').innerHTML=`<div class="work-inner"><div class="page-heading"><div><h1>img</h1></div><button class="primary" id="media-upload">+ Upload image</button></div><div id="media-library" class="media-library">Loading your library…</div><p class="file-note">Images are kept in your project. No external image service needed.</p></div>`;
  $('#media-upload').onclick=()=>pickFile(()=>renderMedia());
  try{
    const images=await api('/api/media');
    $('#media-library').innerHTML=images.map((img,i)=>`<div class="media-item"><button class="media-open" data-media="${i}"><img src="${e(img.url)}" alt="${e(img.name)}" loading="lazy" decoding="async"><span>${e(img.name)}</span></button><button class="copy-markdown" data-copy="${i}" title="Copy Markdown" aria-label="Copy Markdown for ${e(img.name)}"><img src="/copy.svg" alt="" width="18" height="18"></button></div>`).join('')||'<div class="empty"><h2>No images yet.</h2><p>Upload an image to get started.</p></div>';
    document.querySelectorAll('[data-copy]').forEach(btn=>btn.onclick=async()=>{
      try{await navigator.clipboard.writeText(imageMarkdown(images[Number(btn.dataset.copy)]));notify('Markdown copied.');}catch{notify('Could not copy. Open the image and select its Markdown to copy manually.',true);}
    });
    document.querySelectorAll('[data-media]').forEach(btn=>btn.onclick=()=>{
      const img=images[Number(btn.dataset.media)];
      showModal(`<div class="dialog-heading"><h2>Image details</h2><button data-close aria-label="Close">×</button></div><img class="image-detail" src="${e(img.url)}" alt="${e(img.name)}"><label>Markdown image<textarea readonly rows="3">${e(imageMarkdown(img))}</textarea></label><p class="hint">Choose this image from any post or page editor.</p>`);
    });
  }catch(err){notify(err.message,true);}
}
window.addEventListener('beforeunload',ev=>{if(dirty){ev.preventDefault();ev.returnValue='';}});
window.addEventListener('keydown',ev=>{if((ev.metaKey||ev.ctrlKey)&&ev.key==='s'&&$('#save')){ev.preventDefault();saveCurrent();}});
try { data=await api('/api/content');layout(); } catch(err) { $('#app').innerHTML=`<div class="startup-error"><h1>Shiro couldn’t open your writing.</h1><p>${e(err.message)}</p>${err.status===401?'<a href="/admin/">Sign in</a>':''}<button onclick="location.reload()">Try again</button></div>`; }
