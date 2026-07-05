#!/usr/bin/env node
// EAS Build: macht 'expo' global verfügbar, da der "Bundle JavaScript"-Schritt
// node_modules/.bin/ nicht im PATH hat.

const path = require('path');
const fs   = require('fs');
const { execSync } = require('child_process');

const projectRoot = process.cwd();
const expoSrc = path.join(projectRoot, 'node_modules', '.bin', 'expo');

if (!fs.existsSync(expoSrc)) {
  console.log('WARN: expo binary nicht gefunden unter', expoSrc);
  const binDir = path.join(projectRoot, 'node_modules', '.bin');
  if (fs.existsSync(binDir)) {
    const expoFiles = fs.readdirSync(binDir).filter(f => f.includes('expo'));
    console.log('expo-bezogene Dateien in .bin/:', expoFiles);
  }
  process.exit(0);
}

// Sicherstellen, dass die Datei ausführbar ist
try { fs.chmodSync(expoSrc, 0o755); } catch {}

// Zielverzeichnisse in absteigender Priorität:
// 1. Dasselbe Verzeichnis wie node (garantiert im PATH, auch bei nvm)
// 2. /usr/local/bin (üblich auf Linux-Servern)
// 3. ~/.local/bin und ~/bin als Fallback
const home = process.env.HOME || '/root';
const candidateDirs = [
  path.dirname(process.execPath),
  '/usr/local/bin',
  '/usr/bin',
  path.join(home, '.local', 'bin'),
  path.join(home, 'bin'),
];

let linked = false;
for (const dir of candidateDirs) {
  try {
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch { continue; }
    }
    const dst = path.join(dir, 'expo');
    try { fs.unlinkSync(dst); } catch {}
    fs.symlinkSync(expoSrc, dst);
    fs.chmodSync(expoSrc, 0o755);

    // Prüfen ob das Verzeichnis im PATH liegt
    const pathDirs = (process.env.PATH || '').split(':');
    const inPath = pathDirs.some(p => p === dir || p === dir + '/');
    console.log(`✓ expo verlinkt: ${dst} (${inPath ? 'im PATH' : 'nicht im PATH'})`);
    if (inPath) { linked = true; break; }
  } catch (e) {
    // Nächstes Verzeichnis versuchen
  }
}

if (!linked) {
  console.log('Symlink fehlgeschlagen. Versuche npm install -g expo...');
  try {
    execSync('npm install -g expo', { stdio: 'inherit', timeout: 180000 });
    console.log('✓ expo global installiert');
    linked = true;
  } catch (e) {
    console.log('npm install -g expo fehlgeschlagen:', e.message);
  }
}

if (!linked) {
  console.log('Alle Methoden fehlgeschlagen. PATH:', process.env.PATH);
  console.log('node-Pfad:', process.execPath);
}
