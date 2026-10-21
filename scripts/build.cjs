const fs = require('node:fs');
const path = require('node:path');
const ts = require('./typescript.cjs')();
const root = path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'.build'),{recursive:true});
const modules = [];
for (const name of fs.readdirSync(path.join(root,'src')).filter(n=>/\.tsx?$/.test(n) && !n.endsWith('.d.ts')).sort()) {
 const result = ts.transpileModule(fs.readFileSync(path.join(root,'src',name),'utf8'), {
  compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,esModuleInterop:true,removeComments:false,jsx:ts.JsxEmit.React,jsxFactory:'h',jsxFragmentFactory:'Fragment'},
  fileName:name,reportDiagnostics:true
 });
 const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 if(errors.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
 fs.writeFileSync(path.join(root,'.build',name.replace(/\.tsx?$/,'.js')),result.outputText);
 const key='./'+name.replace(/\.tsx?$/,'');
 modules.push(`${JSON.stringify(key)}: function(require,module,exports) {\n${result.outputText}\n}`);
}
// Small deterministic CommonJS bundler. All local runtime modules are in src/.
// External host imports (obsidian, node:*) are resolved only by the host.
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).version;
const bundle=`/* Sourcebook ${version} - MIT. See LICENSE and THIRD_PARTY_NOTICES.md. */\n(function(nativeRequire) {\nconst modules={${modules.join(',\n')}};\nconst cache=Object.create(null);\nfunction load(id){if(!modules[id])return nativeRequire(id);if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](load,m,m.exports);return m.exports;}\nmodule.exports=load('./main').default;\n})(require);\n`;
fs.writeFileSync(path.join(root,'main.js'),bundle);
console.log(`Built main.js (${Buffer.byteLength(bundle)} bytes). No runtime packages bundled beyond project source.`);
