/**
 * E1 — hook-postedit. Feedback al agente tras Edit|Write sobre *.ts(x).
 *
 * Lo dispara el hook PostToolUse de .claude/settings.json. Recibe el evento del
 * hook como JSON por stdin (tool_input.file_path). Corre lint (rápido) sobre el
 * archivo editado y, opcionalmente, typecheck del proyecto (CETI_HOOK_TSC=1 —
 * apagado por defecto porque tsc completo en cada edición es caro).
 *
 * No bloquea el commit (eso es husky / E11). Si encuentra problemas imprime a
 * stderr y sale con código 2 para que el feedback llegue al agente; si está
 * limpio sale 0.
 */
import { execSync } from 'node:child_process';
import { extname } from 'node:path';

// Leer stdin de forma robusta (el harness pasa JSON del evento).
let raw = '';
try {
  const chunks = [];
  const fd = 0;
  const buf = Buffer.alloc(65536);
  const fs = await import('node:fs');
  let bytes;
  try { while ((bytes = fs.readSync(fd, buf, 0, buf.length)) > 0) chunks.push(Buffer.from(buf.subarray(0, bytes))); }
  catch { /* sin stdin */ }
  raw = Buffer.concat(chunks).toString('utf8');
} catch { raw = ''; }

let file = '';
try {
  const evt = JSON.parse(raw);
  file = evt?.tool_input?.file_path || evt?.tool_input?.path || '';
} catch { /* sin JSON: nada que hacer */ }

if (!file || !['.ts', '.tsx'].includes(extname(file))) process.exit(0);

const problems = [];

// 1) ESLint sobre el archivo (rápido).
try {
  execSync(`npx --no-install eslint "${file}"`, { stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  const out = `${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? ''}`.trim();
  if (out) problems.push(`ESLint:\n${out}`);
}

// 2) Typecheck del proyecto (opt-in por costo).
if (process.env.CETI_HOOK_TSC === '1') {
  try {
    execSync('npx --no-install tsc --noEmit', { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const out = `${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? ''}`;
    const rel = file.replace(/\\/g, '/');
    const lines = out.split(/\r?\n/).filter((l) => l.replace(/\\/g, '/').includes(rel));
    if (lines.length) problems.push(`tsc:\n${lines.join('\n')}`);
  }
}

if (problems.length) {
  process.stderr.write(`[E1 post-edit] ${file}\n${problems.join('\n')}\n`);
  process.exit(2);
}
process.exit(0);
