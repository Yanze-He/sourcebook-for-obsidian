// Test-only replacements for secure-context APIs unavailable in about:blank.
if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = () => '10000000-1000-4000-8000-'+String(++window.__uuidCounter).padStart(12,'0');
if (!globalThis.crypto.subtle) Object.defineProperty(globalThis.crypto,'subtle',{configurable:true,value:{digest:async(_name,data)=>{const bytes=new Uint8Array(data);const out=new Uint8Array(32);for(let i=0;i<bytes.length;i++)out[i%32]=(out[i%32]+bytes[i]+i)%256;return out.buffer;}}});
window.__uuidCounter=0;
let copiedText='';
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copiedText=text;},readText:async()=>copiedText}});
/* Browser-only integration harness. This is NOT the Obsidian application. */
const fileMap=new Map(),folderMap=new Map(),events=new Map();
class TAbstractFile{constructor(path){this.path=path;this.name=path.split('/').pop();}}
class TFile extends TAbstractFile{constructor(path,bytes){super(path);this.extension=this.name.split('.').pop();this.basename=this.name.replace(/\.[^.]+$/,'');this.stat={size:bytes.length,mtime:Date.now(),ctime:Date.now()};this.bytes=bytes;}}
class TFolder extends TAbstractFile{}
const emit=(event,...args)=>(events.get(event)||[]).forEach(fn=>fn(...args));
const encode=s=>new TextEncoder().encode(s),decode=b=>new TextDecoder().decode(b);
function parseYaml(text){const result={};for(const line of text.split('\n')){if(!line.trim())continue;const colon=line.indexOf(':');result[line.slice(0,colon)]=JSON.parse(line.slice(colon+1));}return result;}
class FileSystemAdapter{getFullPath(path){return '/test-vault/'+path;}}
const vault={adapter:new FileSystemAdapter(),
 getAbstractFileByPath:p=>fileMap.get(p)||folderMap.get(p)||null,
 getFiles:()=>[...fileMap.values()],getMarkdownFiles:()=>[...fileMap.values()].filter(f=>f.extension==='md'),
 createFolder:async p=>{if(fileMap.has(p))throw Error('File conflict');const f=new TFolder(p);folderMap.set(p,f);return f;},
 read:async f=>{if(!fileMap.has(f.path))throw Error('Missing');return decode(fileMap.get(f.path).bytes);},
 readBinary:async f=>{if(!fileMap.has(f.path))throw Error('Missing');return fileMap.get(f.path).bytes.slice().buffer;},
 create:async(p,s)=>{if(fileMap.has(p))throw Error('Already exists');const f=new TFile(p,encode(s));fileMap.set(p,f);emit('create',f);return f;},
 createBinary:async(p,b)=>{if(fileMap.has(p))throw Error('Already exists');const f=new TFile(p,new Uint8Array(b));fileMap.set(p,f);emit('create',f);return f;},
 delete:async f=>{if(!fileMap.has(f.path))throw Error('Missing');fileMap.delete(f.path);emit('delete',f);},
 process:async(f,fn)=>{const next=fn(decode(f.bytes));f.bytes=encode(next);f.stat.size=f.bytes.length;emit('modify',f);return next;},
 getResourcePath:f=>URL.createObjectURL(new Blob([f.bytes],{type:({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',pdf:'application/pdf'}[f.extension]||'application/octet-stream')})),
 on:(event,fn)=>{if(!events.has(event))events.set(event,[]);events.get(event).push(fn);return {event,fn};}
};
const registry=new Map(),leaves=[];let opened=[];
class WorkspaceLeaf{constructor(app){this.app=app;}async setViewState(state){this.type=state.type;this.view=registry.get(state.type)(this);document.getElementById('workspace').append(this.view.contentEl);await this.view.onOpen();}async openFile(f){opened.push(f.path);}}
const app={vault,metadataCache:{getFirstLinkpathDest:(target,from)=>fileMap.get(target)||null},fileManager:{
 processFrontMatter:async(f,fn)=>{const text=decode(f.bytes),m=text.match(/^---\n([\s\S]*?)\n---\n/),meta=m?parseYaml(m[1]):{};fn(meta);const body=m?text.slice(m[0].length):text;const next='---\n'+Object.entries(meta).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\n'+body;f.bytes=encode(next);f.stat.size=f.bytes.length;emit('modify',f);},
 renameFile:async(f,newPath)=>{if(fileMap.has(newPath))throw Error('Already exists');const old=f.path;fileMap.delete(old);f.path=newPath;f.name=newPath.split('/').pop();f.basename=f.name.replace(/\.[^.]+$/,'');f.extension=f.name.split('.').pop();fileMap.set(newPath,f);emit('rename',f,old);},
 generateMarkdownLink:(f,from,subpath,alias)=>`[[${f.path}${subpath||''}${alias?'|'+alias.replace(/[\[\]|]/g,'-'):''}]]`
},workspace:{getLeavesOfType:t=>leaves.filter(l=>l.type===t),getActiveViewOfType:t=>leaves.map(l=>l.view).find(view=>view instanceof t)||null,getLeaf:()=>{const l=new WorkspaceLeaf(app);leaves.push(l);return l;},revealLeaf:async()=>{}}};
class ItemView{constructor(leaf){this.app=leaf.app;this.contentEl=document.createElement('div');}}
class Modal{constructor(app){this.app=app;this.contentEl=document.createElement('section');this.contentEl.classList.add('modal');this.overlay=document.createElement('div');this.overlay.className='harness-overlay';this.overlay.append(this.contentEl);}open(){document.body.append(this.overlay);this.onOpen();const close=document.createElement('button');close.className='harness-close';close.setAttribute('aria-label','Close modal');close.innerHTML='<svg aria-hidden="true" fill="none" height="16" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="16"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';close.onclick=()=>this.close();this.contentEl.prepend(close);}close(){this.onClose();this.overlay.remove();}onOpen(){}onClose(){}}
class FuzzySuggestModal extends Modal{onOpen(){const input=document.createElement('input');input.placeholder='Select a file';this.contentEl.append(input);const list=document.createElement('div');this.contentEl.append(list);const draw=()=>{list.replaceChildren();for(const item of this.getItems().filter(i=>this.getItemText(i).includes(input.value))){const b=document.createElement('button');b.textContent=this.getItemText(item);b.onclick=()=>{this.onChooseItem(item);this.close();};list.append(b);}};input.oninput=draw;draw();}}
const notices=[];
class Notice{constructor(m){notices.push(m);const d=document.getElementById('notices');d.textContent=m;}}
const applyElementOptions=(el,options)=>{if(typeof options==='string')el.className=options;else if(options){if(options.text)el.textContent=options.text;if(options.cls)el.className=Array.isArray(options.cls)?options.cls.join(' '):options.cls;}return el;};
window.createEl=(tag,options)=>applyElementOptions(document.createElement(tag),options);
window.createSvg=(tag,options)=>applyElementOptions(document.createElementNS('http://www.w3.org/2000/svg',tag),options);
Element.prototype.createEl=function(tag,options){const el=window.createEl(tag,options);this.append(el);return el;};
Element.prototype.createSvg=function(tag,options){const el=window.createSvg(tag,options);this.append(el);return el;};
const setIcon=(el,name)=>{const icon=window.createSvg('svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');const path=window.createSvg('path');path.setAttribute('d',name==='refresh-cw'?'M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2':'M3 12h18');icon.append(path);el.replaceChildren(icon);};
class Setting{constructor(){}setName(){return this;}setDesc(){return this;}addDropdown(fn){const c={addOption(){return this;},setValue(){return this;},onChange(){return this;}};fn(c);return this;}addToggle(fn){fn({setValue(){return this;},onChange(){return this;}});return this;}addButton(fn){fn({setButtonText(){return this;},onClick(){return this;}});return this;}}
class PluginSettingTab{constructor(app,plugin){this.app=app;this.plugin=plugin;this.containerEl=document.createElement('div');}}
class Plugin{constructor(app){this.app=app;this.cleanups=[];}async loadData(){return {language:'en',bookId:'',nativeClipboard:false,favoriteEntries:[]};}async saveData(d){this.saved=d;}registerView(type,fn){registry.set(type,fn);}addRibbonIcon(){}addCommand(){}addSettingTab(){}registerEvent(ref){this.cleanups.push(()=>{events.set(ref.event,events.get(ref.event).filter(fn=>fn!==ref.fn));});}register(fn){this.cleanups.push(fn);}}
const host={TAbstractFile,TFile,TFolder,FileSystemAdapter,parseYaml,ItemView,Modal,FuzzySuggestModal,Notice,Setting,PluginSettingTab,Plugin,setIcon};
const revealedPaths=[];
const electron={shell:{openPath:async path=>{revealedPaths.push(path);return '';},showItemInFolder:path=>{revealedPaths.push('select:'+path);}}};
window.require=spec=>{if(spec==='obsidian')return host;if(spec==='electron')return electron;throw Error('Unexpected host require '+spec);};
window.module={exports:{}};
const copiedFiles=[];
window.__sourcebookCopyFiles=async(paths,texts)=>{copiedFiles.splice(0,copiedFiles.length,...paths,...texts.map(file=>`virtual://${file.name}`));};
window.__host={app,fileMap,folderMap,leaves,notices,opened,events,copiedFiles,revealedPaths};
