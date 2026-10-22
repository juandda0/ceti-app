/**
 * Expo web del Salón demo, conectado a los emuladores (EXPO_PUBLIC_USE_EMULATORS=1).
 *
 *   npm run salon:web                    # puerto 8085, con recarga al guardar
 *   npm run salon:web -- --sin-watchers  # CI=1: sin file watchers (evita ENOSPC)
 *   SALON_PUERTO=8090 npm run salon:web
 *
 * Usa un puerto propio (no el 8081 de siempre) para que la sesión de Auth del
 * emulador no se mezcle en el navegador con la de producción: cada origen
 * (host:puerto) guarda su propia sesión.
 */
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const sinWatchers = args.includes('--sin-watchers');
const resto = args.filter((a) => a !== '--sin-watchers');
const puerto = process.env.SALON_PUERTO || '8085';

const env = { ...process.env, EXPO_PUBLIC_USE_EMULATORS: '1' };
if (sinWatchers) env.CI = '1';

console.log(`· Expo web con emuladores en http://localhost:${puerto}`);
console.log(
  `  Salón: http://localhost:${puerto}/dev/salon   ·   Cuentas: http://localhost:${puerto}/dev/entrar`
);
if (sinWatchers)
  console.log('  Sin watchers (CI=1): reinicia el servidor después de cada cambio de código.');

const hijo = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['expo', 'start', '--web', '--port', puerto, ...resto],
  { stdio: 'inherit', env }
);
hijo.on('exit', (code) => process.exit(code ?? 0));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => hijo.kill(s));
