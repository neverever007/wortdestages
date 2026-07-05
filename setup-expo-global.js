#!/usr/bin/env node
// EAS Build: expo global verfügbar machen, da der Bundle-Schritt
// eine frische Shell ohne nvm-PATH und ohne node_modules/.bin/ benutzt.
//
// Strategie: Schreibe ein echtes Shell-Skript mit absoluten Pfaden
// in ALLE möglichen Verzeichnisse (kein break bei erstem Erfolg).

const path = require('path');
const fs   = require('fs');
const { execSync } = require('child_process');

const projectRoot = process.cwd();
const nodeBin = process.execPath;

// --- Expo CLI Entry Point finden ---
let expoCliJs = '';
const cliCandidates = [
  path.join(projectRoot, 'node_modules', 'expo', 'bin', 'cli.js'),
  path.join(projectRoot, 'node_modules', '@expo', 'cli', 'build', 'index.js'),
];
for (const c of cliCandidates) {
  if (fs.existsSync(c)) { expoCliJs = c; break; }
}
if (!expoCliJs) {
  try { expoCliJs = require.resolve('expo/bin/cli.js'); } catch {}
}

console.log('[expo-setup] node    :', nodeBin);
console.log('[expo-setup] expo CLI:', expoCliJs || 'NICHT GEFUNDEN');
console.log('[expo-setup] PATH    :', process.env.PATH);

if (!expoCliJs) {
  console.log('[expo-setup] expo CLI nicht gefunden – überspringe.');
  process.exit(0);
}

// --- Script-Inhalt mit absoluten Pfaden (kein PATH-Lookup nötig) ---
const scriptContent = `#!/bin/sh
exec "${nodeBin}" "${expoCliJs}" "$@"
`;

// --- Alle Zielverzeichnisse (wichtig: KEIN break, alle probieren) ---
const home = process.env.HOME || '/root';
const targetDirs = [
  '/usr/local/bin',          // IMMER im PATH jeder Linux-Shell (auch frisch)
  '/usr/bin',                // IMMER im PATH
  path.dirname(nodeBin),     // nvm bin-Verzeichnis (im PATH für npm-Scripts)
  path.join(home, '.local', 'bin'),
  path.join(home, 'bin'),
];

for (const dir of targetDirs) {
  const dst = path.join(dir, 'expo');
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    try { fs.unlinkSync(dst); } catch {}
    fs.writeFileSync(dst, scriptContent);
    fs.chmodSync(dst, 0o755);
    console.log('[expo-setup] ✓ Script geschrieben:', dst);
  } catch (writeErr) {
    // Fallback: Symlink auf lokale binary
    try {
      const localBin = path.join(projectRoot, 'node_modules', '.bin', 'expo');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      try { fs.unlinkSync(dst); } catch {}
      fs.symlinkSync(localBin, dst);
      console.log('[expo-setup] ✓ Symlink erstellt:', dst, '->', localBin);
    } catch (symlinkErr) {
      console.log('[expo-setup]   Übersprungen:', dir, '(' + (writeErr.code || writeErr.message) + ')');
    }
  }
}

// --- Letzter Ausweg: npm link ---
try {
  const expoDir = path.join(projectRoot, 'node_modules', 'expo');
  execSync(`cd "${expoDir}" && npm link`, { stdio: 'pipe', timeout: 30000 });
  console.log('[expo-setup] ✓ npm link ausgeführt (expo global verlinkt)');
} catch (e) {
  console.log('[expo-setup]   npm link fehlgeschlagen:', e.message.split('\n')[0]);
}

// --- Diagnose ---
try {
  const w = execSync('which expo 2>/dev/null || echo "NOT_IN_PATH"', { encoding: 'utf8', shell: true }).trim();
  console.log('[expo-setup] which expo:', w);
} catch {}
