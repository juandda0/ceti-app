/**
 * Importar la lista del curso (E2) pegándola desde Excel o subiendo un CSV.
 * Acepta coma, punto y coma o tabulador; detecta encabezado; deduplica por
 * correo. Cada fila necesita un correo válido (el estudiante entra con él y
 * queda unido a la clase automáticamente). Puro.
 */

export interface InvitadoLista {
  nombre: string;
  correo: string;
}

export interface ResultadoLista {
  invitados: InvitadoLista[];
  /** Filas que no se pudieron leer, con su número (1 = primera línea). */
  errores: { linea: number; texto: string; motivo: 'sin_correo' | 'correo_invalido' }[];
  duplicados: number;
}

export const MAX_INVITADOS = 200;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function esCorreo(v: string): boolean {
  return CORREO.test(v.trim());
}

function separador(linea: string): RegExp {
  if (linea.includes('\t')) return /\t/;
  if (linea.includes(';')) return /;/;
  return /,/;
}

function limpiar(v: string): string {
  return v.trim().replace(/^"(.*)"$/, '$1').trim();
}

const PALABRAS_ENCABEZADO = /^(nombre|nombres|estudiante|alumno|correo|email|e-mail|apellidos?)$/i;

export function leerLista(texto: string): ResultadoLista {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  const invitados: InvitadoLista[] = [];
  const errores: ResultadoLista['errores'] = [];
  const vistos = new Set<string>();
  let duplicados = 0;

  lineas.forEach((cruda, i) => {
    const linea = cruda.trim();
    if (!linea) return;
    const celdas = linea.split(separador(linea)).map(limpiar).filter((c) => c.length > 0);
    if (i === 0 && celdas.length > 0 && celdas.every((c) => PALABRAS_ENCABEZADO.test(c))) return;
    const correo = celdas.find((c) => c.includes('@'));
    if (!correo) {
      errores.push({ linea: i + 1, texto: linea, motivo: 'sin_correo' });
      return;
    }
    if (!esCorreo(correo)) {
      errores.push({ linea: i + 1, texto: linea, motivo: 'correo_invalido' });
      return;
    }
    const clave = correo.toLowerCase();
    if (vistos.has(clave)) {
      duplicados += 1;
      return;
    }
    vistos.add(clave);
    const nombre = celdas.filter((c) => c !== correo).join(' ').replace(/\s+/g, ' ').trim();
    invitados.push({ nombre: nombre || clave.split('@')[0], correo: clave });
  });

  return { invitados: invitados.slice(0, MAX_INVITADOS), errores, duplicados };
}
