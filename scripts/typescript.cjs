const path = require('node:path');
const { execFileSync } = require('node:child_process');
module.exports = function resolveTypeScript() {
 try { return require('typescript'); } catch {}
 try { const root = execFileSync('npm', ['root', '-g'], { encoding:'utf8' }).trim(); return require(path.join(root,'typescript')); }
 catch { throw new Error('TypeScript is required. Run npm install, then retry.'); }
};
