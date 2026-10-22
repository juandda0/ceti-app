/**
 * Control de calidad del departamento de animación: si algo de aquí falla, la animación
 * no entra. Arreglos típicos: `npm run anim:optimize` (peso) o añadir la ficha al catálogo.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { animationIds, animations, categoryOf } from './catalog';

const ROOT = join(__dirname, '../../../assets/animations');
const MAX_KB = 150;

function animationFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? animationFiles(path) : [path];
  });
}

const files = animationFiles(ROOT).map((file) => relative(ROOT, file).replace(/\\/g, '/'));
const idFromFile = (file: string) => file.replace(/\.json$/, '').replace('/', '.');

describe('catálogo de animaciones', () => {
  it.each(animationIds)('%s sigue el formato categoria.nombre en kebab-case', (id) => {
    expect(id).toMatch(/^[a-z]+\.[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(animationIds)('%s apunta a assets/animations/<categoria>/<nombre>.json', (id) => {
    const [, name] = id.split('.');
    const expected = require(join(ROOT, categoryOf(id), `${name}.json`));
    expect(animations[id].source).toBe(expected);
  });

  it.each(files)('%s es un .json registrado en el catálogo', (file) => {
    expect(file).toMatch(/\.json$/);
    expect(animationIds).toContain(idFromFile(file));
  });

  it.each(files)(`%s pesa como máximo ${MAX_KB} KB (o su pesoMaxKb)`, (file) => {
    const id = idFromFile(file) as keyof typeof animations;
    const max = animations[id]?.pesoMaxKb ?? MAX_KB;
    expect(statSync(join(ROOT, file)).size / 1024).toBeLessThanOrEqual(max);
  });

  it.each(animationIds)('%s es un Lottie válido', (id) => {
    const { source } = animations[id];
    expect(source.fr).toBeGreaterThan(0);
    expect(source.op).toBeGreaterThan(source.ip);
    expect(source.w).toBeGreaterThan(0);
    expect(source.h).toBeGreaterThan(0);
    expect(Array.isArray(source.layers)).toBe(true);
  });

  it.each(animationIds)('%s: shipped declara dónde se usa y draft no se usa', (id) => {
    const { status, usedIn } = animations[id];
    if (status === 'shipped') expect(usedIn.length).toBeGreaterThan(0);
    if (status === 'draft') expect(usedIn).toHaveLength(0);
  });
});
