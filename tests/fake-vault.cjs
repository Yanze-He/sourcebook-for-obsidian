const {serialize,safeRelative}=require('../.build/core.js');
class FakeVault {
 constructor(){this.files=new Map();this.folders=new Set();this.readCount=0;this.clock=1;}
 exists(path){return this.files.has(path)||this.folders.has(path);}
 async mkdir(path){safeRelative(path);if(this.files.has(path))throw new Error('Occupied');this.folders.add(path);}
 listMarkdown(){return [...this.files.keys()].filter(path=>path.endsWith('.md')).map(path=>this.getFile(path));}
 getFile(path){if(!this.files.has(path))return;const name=path.split('/').pop();return {path,name,extension:name.includes('.')?name.split('.').pop():'',size:this.files.get(path).bytes.byteLength,mtime:this.files.get(path).mtime};}
 async read(path){this.readCount++;if(!this.files.has(path))throw new Error('Missing '+path);return new TextDecoder().decode(this.files.get(path).bytes);}
 async readBinary(path){if(!this.files.has(path))throw new Error('Missing '+path);return this.files.get(path).bytes.slice().buffer;}
 async create(path,text){await this.createBinary(path,new TextEncoder().encode(text).buffer);}
 async createBinary(path,bytes){safeRelative(path);if(this.exists(path))throw new Error('Already exists '+path);this.files.set(path,{bytes:new Uint8Array(bytes).slice(),mtime:this.clock++});}
 async process(path,change){const current=await this.read(path);const next=change(current);this.files.set(path,{bytes:new TextEncoder().encode(next),mtime:this.clock++});}
 async rename(path,newPath){safeRelative(newPath);if(!this.files.has(path))throw new Error('Missing '+path);if(this.exists(newPath))throw new Error('Already exists '+newPath);const record=this.files.get(path);this.files.delete(path);this.files.set(newPath,{bytes:record.bytes.slice(),mtime:this.clock++});}
 async remove(path){if(!this.files.delete(path))throw new Error('Missing '+path);}
 parse(text){const match=text.match(/^---\n([\s\S]*?)\n---\n/);if(!match)return {meta:{},body:text};const meta={};for(const line of match[1].split('\n')){const index=line.indexOf(':');meta[line.slice(0,index)]=JSON.parse(line.slice(index+1));}return {meta,body:text.slice(match[0].length).trim()};}
 async updateMeta(path,change){const parsed=this.parse(await this.read(path));change(parsed.meta);await this.process(path,()=>serialize(parsed.meta,parsed.body));}
 resolveAttachment(link){const match=link.match(/^!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]*)?\]\]$/);return match&&this.files.has(match[1])?match[1]:undefined;}
 link(path,_from,embed=false,alias,subpath=''){if(!this.files.has(path))throw new Error('Missing '+path);return `${embed?'!':''}[[${path}${subpath||''}${alias?'|'+alias.replace(/[\[\]|]/g,'-'):''}]]`;}
}
module.exports={FakeVault};
