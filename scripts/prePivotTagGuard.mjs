/**
 * E9 — pre-pivot-tag-guard. Verifica que existe el tag git `pre-pivot` (punto de
 * retorno único, D3-matiz) antes de cualquier demolición del refactor.
 *
 *   node scripts/prePivotTagGuard.mjs
 *
 * Sale 0 si el tag existe; 1 si falta (con la oferta de crearlo). Lo invoca
 * /iniciar-refactor y el flujo de RF; en CI puede correr si el diff borra un
 * archivo de la lista de demolición.
 */
import { execSync } from 'node:child_process';

try {
  const sha = execSync('git rev-parse -q --verify refs/tags/pre-pivot', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString().trim();
  console.log(`✓ tag pre-pivot presente (${sha.slice(0, 12)}). Refactor autorizado a proceder.`);
  process.exit(0);
} catch {
  console.error('✗ Falta el tag git `pre-pivot` (punto de retorno, E9/D3-matiz).');
  console.error('  Créalo antes de demoler nada:');
  console.error('    git tag -a pre-pivot -m "Punto de retorno pre-refactor del pivot"');
  process.exit(1);
}
