/**
 * Gate del contenido por defecto (Fase 7): todo content/bancos y
 * content/microteoria pasa validarContenido, existe cada archivo que el runtime
 * pide (7 grados con banco × 6 mundos) y cada mundo trabaja todos los
 * desempeños del MEN de sus ámbitos para el grupo de grados del banco.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALINEACION_MEN,
  desempenosDe,
  grupoGradoMen,
  type AmbitoMen,
} from '@/functions/src/educadores/dominio';
import {
  COMPETENCIA_DE_MUNDO,
  MUNDOS_CONTENIDO,
  TIPOS_CONTENIDO,
  archivosEsperados,
  validarArchivo,
} from './validarContenido';
import { SEEDED_GRADOS, gradoDeBanco } from './quiz.types';

const RAIZ = join(__dirname, '../../../../content');
const leer = (carpeta: string, f: string) => JSON.parse(readFileSync(join(RAIZ, carpeta, f), 'utf8'));
const lista = (carpeta: string) => readdirSync(join(RAIZ, carpeta)).filter((f) => f.endsWith('.json'));

describe('contenido por defecto', () => {
  it.each(['bancos', 'microteoria'] as const)('todo content/%s es válido', (carpeta) => {
    const errores = lista(carpeta).flatMap((f) => validarArchivo(f, leer(carpeta, f), carpeta));
    expect(errores).toEqual([]);
  });

  it('están todos los archivos que pide el runtime', () => {
    const esperados = archivosEsperados();
    const bancos = new Set(lista('bancos'));
    const micro = new Set(lista('microteoria'));
    expect(esperados.bancos.filter((f) => !bancos.has(f))).toEqual([]);
    expect(esperados.microteoria.filter((f) => !micro.has(f))).toEqual([]);
  });

  it('cada mundo trabaja todos los desempeños de sus ámbitos en su grupo de grados', () => {
    const faltan: string[] = [];
    for (const g of SEEDED_GRADOS) {
      const grupo = grupoGradoMen(g)!;
      for (const w of MUNDOS_CONTENIDO) {
        const usados = new Set(
          TIPOS_CONTENIDO.flatMap((t) => (leer('bancos', `${g}_${w}_${t}.json`).items as { desempeno: string }[]).map((i) => i.desempeno))
        );
        for (const a of ALINEACION_MEN[COMPETENCIA_DE_MUNDO[w]].ambitos as readonly AmbitoMen[]) {
          for (const d of desempenosDe(grupo, a)) if (!usados.has(d.id)) faltan.push(`${g}_${w}: ${d.id}`);
        }
      }
    }
    expect(faltan).toEqual([]);
  });

  it('cada grado de 1° a 11° juega el banco de su grupo', () => {
    expect(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].map(gradoDeBanco)).toEqual([
      '1', '1', '1', '4', '4', '6', '6', '8', '9', '10', '11',
    ]);
    expect(gradoDeBanco('12')).toBe('9');
  });
});
