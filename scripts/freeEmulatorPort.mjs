/**
 * E7 (hardening del runner) — libera el puerto del emulador de Firestore antes de
 * test:rules. En Windows un java zombie suele dejar el puerto 8099 ocupado y el
 * runner se cuelga / da exit-0 engañoso (quirk conocido del entorno local).
 *
 * Cross-platform: lee el puerto de firebase.json (emulators.firestore.port,
 * fallback 8099) y mata el proceso que lo escucha. No falla si no hay nada.
 *
 *   node scripts/freeEmulatorPort.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

function port() {
  try {
    const fb = JSON.parse(readFileSync(join(process.cwd(), 'firebase.json'), 'utf8'));
    return fb?.emulators?.firestore?.port ?? 8099;
  } catch { return 8099; }
}

const P = port();
const isWin = process.platform === 'win32';

try {
  if (isWin) {
    const out = execSync(`netstat -ano -p tcp | findstr ":${P} "`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/LISTENING\s+(\d+)\s*$/);
      if (m) pids.add(m[1]);
    }
    for (const pid of pids) {
      try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); console.log(`✓ liberado puerto ${P} (PID ${pid})`); }
      catch { /* ya no existe */ }
    }
    if (!pids.size) console.log(`✓ puerto ${P} libre.`);
  } else {
    const out = execSync(`lsof -ti tcp:${P} || true`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const pids = out.split(/\s+/).filter(Boolean);
    for (const pid of pids) {
      try { execSync(`kill -9 ${pid}`, { stdio: 'ignore' }); console.log(`✓ liberado puerto ${P} (PID ${pid})`); }
      catch { /* ya no existe */ }
    }
    if (!pids.length) console.log(`✓ puerto ${P} libre.`);
  }
} catch {
  // findstr/lsof sin coincidencias devuelve exit≠0 — significa puerto libre.
  console.log(`✓ puerto ${P} libre.`);
}
process.exit(0);
