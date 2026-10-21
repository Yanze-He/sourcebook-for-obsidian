const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))),pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
function check(ok,m){if(!ok)throw new Error(m);}
check(/^[a-z0-9-]+$/.test(manifest.id)&&!manifest.id.includes('obsidian'),'Invalid plugin ID');
check(/^\d+\.\d+\.\d+$/.test(manifest.version),'Version must be x.y.z');check(pkg.version===manifest.version,'Version mismatch');check(manifest.isDesktopOnly===true,'Desktop-only manifest is required');
for(const name of ['main.js','manifest.json','styles.css','README.md','LICENSE'])check(fs.statSync(path.join(root,name)).size>0,`Missing ${name}`);
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');check(!/(?:^|\n)\s*(?:body|html|:root|\*)\s*[,{]/.test(css),'Global styles are forbidden');
if(process.argv.includes('--tag')){const tag=process.argv[process.argv.indexOf('--tag')+1];check(tag===manifest.version,'Tag must equal manifest version');}
console.log('Release structure checks passed. This does not replace community review or real-app testing.');
