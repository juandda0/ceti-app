/**
 * El único botón principal de la Bitácora: a dónde lleva cada `siguientePaso`
 * del dominio, y a qué clase. Puro.
 */
import type { Bitacora, CursoBitacora } from '@/functions/src/educadores/dominio';

export interface CursoDeBitacora {
  id: string;
  nombre: string;
  curso: CursoBitacora;
}

export interface Destino {
  paso: Bitacora['siguientePaso'];
  ruta: string;
  /** Clase a la que lleva, si aplica (para el texto del botón). */
  cursoNombre: string | null;
}

function tablero(c: CursoDeBitacora, vista: 'resumen' | 'estudiantes' | 'tareas'): string {
  return `/(staff)/curso/${c.id}?nombre=${encodeURIComponent(c.nombre)}&vista=${vista}`;
}

function conEstudiantes(c: CursoDeBitacora): boolean {
  return c.curso.estudiantes.some((e) => e.activo);
}

export function destinoSiguientePaso(bitacora: Bitacora, cursos: CursoDeBitacora[]): Destino {
  const paso = bitacora.siguientePaso;
  const destino = (ruta: string, c: CursoDeBitacora | undefined): Destino => ({
    paso,
    ruta,
    cursoNombre: c?.nombre ?? null,
  });
  // Bitácora del servidor sin las clases a mano: a la lista de clases.
  if (paso !== 'crear_clase' && cursos.length === 0) return destino('/(staff)/clases', undefined);

  switch (paso) {
    case 'crear_clase':
      return destino('/(staff)/crear-clase', undefined);
    case 'invitar': {
      const c = cursos.find((x) => !conEstudiantes(x)) ?? cursos[0];
      return destino(`/(staff)/gestionar/${c.id}?nombre=${encodeURIComponent(c.nombre)}`, c);
    }
    case 'revisar_alertas': {
      const porCurso = new Map<string, number>();
      for (const a of bitacora.alertas) porCurso.set(a.cursoId, (porCurso.get(a.cursoId) ?? 0) + 1);
      const c = [...cursos].sort(
        (a, b) => (porCurso.get(b.id) ?? 0) - (porCurso.get(a.id) ?? 0)
      )[0];
      return destino(tablero(c, 'estudiantes'), c);
    }
    case 'reforzar_mundo': {
      const conMundo = cursos.filter((x) => x.curso.mundoMasDificil !== null);
      const c =
        conMundo.sort(
          (a, b) =>
            (a.curso.mundoMasDificil?.maestria ?? 1) - (b.curso.mundoMasDificil?.maestria ?? 1)
        )[0] ?? cursos[0];
      return destino(tablero(c, 'tareas'), c);
    }
    case 'asignar':
    default: {
      const c =
        cursos.find((x) => conEstudiantes(x) && x.curso.asignacionesActivas === 0) ??
        cursos.find(conEstudiantes) ??
        cursos[0];
      return destino(tablero(c, 'tareas'), c);
    }
  }
}
