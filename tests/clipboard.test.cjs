const {test}=require('node:test');const a=require('node:assert/strict');const {fileUri,macFileClipboardInvocation,windowsFileClipboardInvocation}=require('../.build/clipboard.js');
test('native file clipboard URIs encode unsafe characters without shell execution',()=>{
 a.equal(fileUri('/tmp/a\'\";#?.png'),'file:///tmp/a\'%22;%23%3F.png');
 a.equal(fileUri('C:\\my files\\中文.png'),'file:///C:/my%20files/%E4%B8%AD%E6%96%87.png');
});
test('macOS file clipboard fallback writes NSURL objects with a fixed script and separate path arguments',()=>{
 const path='/tmp/中文 ; do shell script "bad".png',invocation=macFileClipboardInvocation([path]);
 a.equal(invocation.command,'/usr/bin/osascript');a.equal(invocation.args[0],'-e');a.match(invocation.args[1],/NSPasteboard/);a.match(invocation.args[1],/fileURLWithPath/);a.doesNotMatch(invocation.args[1],/bad/);a.deepEqual(invocation.args.slice(2),[path]);
});
test('Windows file clipboard fallback writes a native file-drop list without putting paths in script arguments',()=>{
 const paths=['C:\\Vault\\图片 与 文档\\brief.pdf','D:\\Vault\\a, b.png'],invocation=windowsFileClipboardInvocation(paths);
 a.equal(invocation.command,'powershell.exe');a.deepEqual(invocation.args.slice(0,4),['-NoProfile','-NonInteractive','-Sta','-Command']);a.match(invocation.args[4],/SetFileDropList/);a.equal(invocation.args.includes(paths[0]),false);a.deepEqual(JSON.parse(Buffer.from(invocation.encodedPaths,'base64').toString('utf16le')),paths);
});
