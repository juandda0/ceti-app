/**
 * Levanta los emuladores del Salón demo (Auth 9098, Firestore 8099, Functions
 * 5001, UI 4000) con el proyecto demo-ceti: nada sale a producción.
 *
 *   npm run salon:emuladores
 *
 * Antes revisa los puertos (un java zombi de un emulador anterior suele quedarse
 * con el 8099) y compila functions/ para que el emulador cargue lib/.
 */
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROYECTO = 'demo-ceti';
const PUERTOS = { firestore: 8099, auth: 9098, functions: 5001, ui: 4000, hub: 4400 };
const win = process.platform === 'win32';

function ocupado(puerto) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(true));
    s.once('listening', () => s.close(() => resolve(false)));
    s.listen(puerto, '127.0.0.1');
  });
}

const tomados = [];
for (const [nombre, puerto] of Object.entries(PUERTOS)) {
  if (await ocupado(puerto)) tomados.push(`${nombre} (${puerto})`);
}
if (tomados.length) {
  console.error(`✗ Puertos ocupados: ${tomados.join(', ')}.`);
  console.error('  ¿Ya están arriba los emuladores en otra terminal? Entonces no hace falta.');
  console.error(
    '  Si no, suele ser un java zombi de un emulador anterior (sobre todo en el 8099):'
  );
  if (win) {
    console.error(
      '    Get-NetTCPConnection -LocalPort 8099 -State Listen | Select -Expand OwningProcess -Unique | % { Stop-Process -Id $_ -Force }'
    );
  } else {
    console.error('    fuser -k 8099/tcp   (o: lsof -ti :8099 | xargs kill)');
  }
  process.exit(1);
}

console.log('· Compilando functions/ …');
const build = spawnSync(win ? 'npm.cmd' : 'npm', ['--prefix', 'functions', 'run', 'build'], {
  cwd: raiz,
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);

console.log(
  `· Emuladores de ${PROYECTO}: Auth ${PUERTOS.auth}, Firestore ${PUERTOS.firestore}, Functions ${PUERTOS.functions}, UI http://localhost:${PUERTOS.ui}`
);
console.log('  Cuando digan "All emulators ready", corre: npm run salon:sembrar\n');
const hijo = spawn(
  win ? 'firebase.cmd' : 'firebase',
  ['emulators:start', '--project', PROYECTO, '--only', 'auth,firestore,functions'],
  { cwd: raiz, stdio: 'inherit' }
);
hijo.on('error', () => {
  console.error('✗ No encuentro la CLI de Firebase. Instálala con: npm i -g firebase-tools');
  process.exit(1);
});
hijo.on('exit', (code) => process.exit(code ?? 0));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => hijo.kill(s));
