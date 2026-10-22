const {test}=require('node:test');const a=require('node:assert/strict');const {fileUri}=require('../.build/clipboard.js');
test('native file clipboard URIs encode unsafe characters without shell execution',()=>{
 a.equal(fileUri('/tmp/a\'\";#?.png'),'file:///tmp/a\'%22;%23%3F.png');
 a.equal(fileUri('C:\\my files\\中文.png'),'file:///C:/my%20files/%E4%B8%AD%E6%96%87.png');
});
