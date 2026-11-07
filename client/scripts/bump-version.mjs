import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

const currentVersion = tauriConf.version || pkg.version || '0.1.0';

const arg = process.argv[2] || 'patch';

let newVersion;
if (arg === 'patch' || arg === 'minor' || arg === 'major') {
  const parts = currentVersion.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid semver in config: ${currentVersion}`);
  }
  if (arg === 'patch') {
    parts[2] += 1;
  } else if (arg === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else if (arg === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  }
  newVersion = parts.join('.');
} else {
  newVersion = arg.replace(/^v/, '').trim();
}

pkg.version = newVersion;
tauriConf.version = newVersion;

fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');

console.log(`\n========================================`);
console.log(`Exam Guard Client Version Bump`);
console.log(`Old version: ${currentVersion}`);
console.log(`New version: ${newVersion}`);
console.log(`✓ Updated client/package.json`);
console.log(`✓ Updated client/src-tauri/tauri.conf.json`);
console.log(`========================================\n`);
console.log(`Để phát hành bản này, hãy commit và push lên nhánh main:`);
console.log(`  git commit -am "chore(release): bump client to v${newVersion}"`);
console.log(`  git push origin main\n`);
