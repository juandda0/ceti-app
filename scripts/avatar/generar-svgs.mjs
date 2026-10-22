// Copia el arte del avatar (assets/brand/<personaje>/<personaje>-<prenda>.svg) a un
// módulo TS con el SVG como texto, porque la app lo recolorea en tiempo de
// ejecución (react-native-svg-transformer convierte los .svg en componentes y
// no deja leer el texto). Uso: npm run avatar:svgs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const PERSONAJES = ['juan', 'santiago', 'sofi', 'vale'];
// prenda → sufijo del archivo en assets/brand
const PRENDAS = { traje: 'frente', sudadera: 'sudadera' };
const SALIDA = 'src/features/avatar/assets/svgs.generated.ts';

const lineas = [
  '// Generado por scripts/avatar/generar-svgs.mjs: no editar a mano.',
  "import type { PersonajeId, PrendaId } from '../domain/catalogo';",
  '',
  'export const SVGS: Record<PersonajeId, Partial<Record<PrendaId, string>>> = {',
];
for (const p of PERSONAJES) {
  lineas.push(`  ${p}: {`);
  for (const [prenda, sufijo] of Object.entries(PRENDAS)) {
    const ruta = `assets/brand/${p}/${p}-${sufijo}.svg`;
    if (!existsSync(ruta)) continue;
    // Los data-* (centro, pivote, radio) son pistas para animar en Lottie; react-native-svg
    // en web los pasa al DOM y React avisa por cada uno.
    const svg = readFileSync(ruta, 'utf8')
      .replace(/\s+data-[a-z-]+="[^"]*"/g, '')
      .replace(/\s*\n\s*/g, ' ')
      .trim();
    lineas.push(`    ${prenda}: ${JSON.stringify(svg)},`);
  }
  lineas.push('  },');
}
lineas.push('};', '');
writeFileSync(SALIDA, lineas.join('\n'));
console.log(`${SALIDA}: ${(Buffer.byteLength(lineas.join('\n')) / 1024).toFixed(0)} KB`);
