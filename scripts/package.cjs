const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');const root=path.resolve(__dirname,'..');
execFileSync(process.execPath,[path.join(__dirname,'build.cjs')],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(__dirname,'check-release.cjs')],{stdio:'inherit'});
const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));const out=path.join(root,'artifacts',`sourcebook-${m.version}`,m.id);fs.mkdirSync(out,{recursive:true});
const names=['main.js','manifest.json','styles.css'];for(const n of names)fs.copyFileSync(path.join(root,n),path.join(out,n));
const sums=names.map(n=>`${crypto.createHash('sha256').update(fs.readFileSync(path.join(out,n))).digest('hex')}  ${n}`).join('\n')+'\n';fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),sums);
console.log('Plugin folder:',out);console.log('Copy this sourcebook directory into a disposable Vault .obsidian/plugins/.');
