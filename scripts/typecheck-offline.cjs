const ts=require('./typescript.cjs')();
const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const roots=[path.join(root,'node_modules/@types'),path.join(globalRoot,'@types'),path.join(globalRoot,'ts-node/node_modules/@types')].filter(fs.existsSync);
const files=fs.readdirSync(path.join(root,'src')).filter(f=>/\.tsx?$/.test(f) && !f.endsWith('.d.ts')).map(f=>path.join(root,'src',f));
files.push(path.join(root,'tests/host-contract.d.ts'));
const program=ts.createProgram(files,{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.Node10,strict:true,noUncheckedIndexedAccess:true,skipLibCheck:true,noEmit:true,types:['node'],typeRoots:roots,jsx:ts.JsxEmit.React,jsxFactory:'h',jsxFragmentFactory:'Fragment'});
const errors=ts.getPreEmitDiagnostics(program);
if(errors.length){console.error(ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));process.exit(1);}
console.log('Offline static check passed against the documented host subset. Official Obsidian package check and real host test are still required.');
