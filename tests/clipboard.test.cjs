const {test}=require('node:test');const a=require('node:assert/strict');const {nativeCommand}=require('../.build/clipboard.js');
test('macOS mirrors Desktop’s JSON-safe inline AppKit path list',()=>{
 const paths=[`/tmp/a'\"; touch hacked.png`,'/tmp/中文.png'];const c=nativeCommand('darwin',paths);a.equal(c.args.slice(0,3).join(' '),'-l JavaScript -e');const match=/const paths = (\[[\s\S]*?\]); const pasteboard/.exec(c.args[3]);a.ok(match);a.deepEqual(JSON.parse(match[1]),paths);
});
test('Windows mirrors Desktop’s STA file-drop-list clipboard write',()=>{const paths=[`C:\\my files\\x';bad.png`];const c=nativeCommand('win32',paths);a.equal(c.args.slice(0,4).join(' '),'-NoProfile -NonInteractive -STA -Command');a.match(c.args.at(-1),/SetFileDropList/);a.match(c.args.at(-1),/x'';bad\.png/);});
test('unsupported platform and invalid input fail explicitly',()=>{a.throws(()=>nativeCommand('linux',['/a']));a.throws(()=>nativeCommand('darwin',[]));a.throws(()=>nativeCommand('darwin',['/a\n/b']));});
