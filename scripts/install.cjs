#!/usr/bin/env node
// Explicit local installation only. Never edits community-plugins.json.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2),i=args.indexOf('--vault');
if(i<0||!args[i+1])throw new Error('Usage: node scripts/install.cjs --vault "/test/vault" [--dry-run | --confirm] [--replace]');
const vault=fs.realpathSync(args[i+1]);if(!fs.statSync(path.join(vault,'.obsidian')).isDirectory())throw new Error('Open this test Vault in Obsidian once before installation.');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));if(!/^[a-z0-9-]+$/.test(manifest.id))throw new Error('Invalid plugin ID');
const dest=path.join(vault,'.obsidian','plugins',manifest.id);const names=['main.js','manifest.json','styles.css'];
for(const name of names)if(!fs.existsSync(path.join(root,name)))throw new Error('Build first: missing '+name);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const changed=names.filter(n=>fs.existsSync(path.join(dest,n))&&sha(path.join(dest,n))!==sha(path.join(root,n)));
console.log('Install target:',dest);for(const name of names)console.log('  ',name,sha(path.join(root,name)));
if(args.includes('--dry-run')||!args.includes('--confirm')){console.log('Dry run only. Re-run with --confirm to write.');process.exit(0);}
if(changed.length&&!args.includes('--replace'))throw new Error('Existing build differs. Back up your Vault, then add --replace for a backed-up update.');
if(fs.existsSync(dest)&&fs.lstatSync(dest).isSymbolicLink())throw new Error('Refusing a symlinked plugin installation');
if(changed.length){const backup=path.join(vault,'.obsidian','sourcebook-install-backups',String(Date.now()));fs.mkdirSync(backup,{recursive:true});for(const name of names)if(fs.existsSync(path.join(dest,name)))fs.copyFileSync(path.join(dest,name),path.join(backup,name));console.log('Backup:',backup);}
fs.mkdirSync(dest,{recursive:true});for(const name of names)fs.copyFileSync(path.join(root,name),path.join(dest,name));
console.log('Installed. Enable Sourcebook manually in the test Vault. Existing plugin data.json was not changed.');
