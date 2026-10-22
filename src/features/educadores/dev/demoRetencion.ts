/**
 * Datos de ejemplo de la retención del profe (invitados por lista, Bitácora),
 * SOLO para desarrollo. Reemplaza en memoria los métodos de los repositorios
 * para probar "Importar lista" sin cuenta ni Cloud Functions, y simula el
 * agregado de adopción del colegio que calcula el servidor. Nunca escribe nada.
 * Se usa junto a `activarDemoProfe()` (src/features/dashboard/dev/demoProfe.ts).
 */
import {
  calcularAdopcion,
  leerLista,
  type CursoAdopcion,
  type InvitadoLista,
} from '@/functions/src/educadores/dominio';
import {
  invitadosRepository,
  type Invitado,
} from '@features/educadores/retencion/data/invitadosRepository';
import { bitacoraRepository } from '@features/educadores/retencion/data/bitacoraRepository';
import { adopcionRepository } from '@features/educadores/retencion/data/adopcionRepository';

const PROFE = 'demo-profe';
const DIA = 24 * 60 * 60 * 1000;
/** Cupo de ejemplo del plan de la clase. */
const CUPO = 45;
/** Estudiantes que ya están en la clase de la demo (rosterDe en demoProfe). */
const EN_CLASE = 8;

/**
 * El colegio entero como lo ve el servidor (`colegios/{cid}/agregados/adopcion`):
 * más cursos y profes que las clases del profe de la demo, que es justo lo que
 * el panel no podría calcular solo con lo que el profe ve.
 */
function adopcionDemo(ahora: number) {
  const curso = (
    profes: string[],
    estudiantes: number,
    activos: number,
    diasSinActividad: number | null
  ): CursoAdopcion => ({
    profesorUids: profes,
    estudiantes,
    estudiantesActivos: activos,
    ultimaActividad: diasSinActividad === null ? null : ahora - diasSinActividad * DIA,
  });
  const cursos = [
    curso([PROFE], 32, 27, 0),
    curso([PROFE], 30, 22, 1),
    curso(['profe-matematicas'], 35, 29, 2),
    curso(['profe-matematicas'], 33, 24, 3),
    curso(['profe-sociales', 'profe-etica'], 31, 21, 5),
    curso(['profe-emprendimiento'], 28, 9, 45),
    curso(['profe-nuevo'], 29, 0, null),
  ];
  // Calculado de madrugada por la tarea diaria.
  return { ...calcularAdopcion(cursos, ahora), actualizadoAt: ahora - 6 * 60 * 60 * 1000 };
}

/** Invitados por curso (clave `colegioId/cursoId`). */
const porCurso: Record<string, Invitado[]> = {};

function invitadosDe(colegioId: string, cursoId: string): Invitado[] {
  const clave = `${colegioId}/${cursoId}`;
  porCurso[clave] ??= [
    {
      correo: 'manuela.rojas@colegio.edu.co',
      nombre: 'Manuela Rojas',
      estado: 'unido',
      invitadoPor: PROFE,
      creadoAt: Date.now() - 6 * DIA,
    },
    {
      correo: 'david.herrera@colegio.edu.co',
      nombre: 'David Herrera',
      estado: 'pendiente',
      invitadoPor: PROFE,
      creadoAt: Date.now() - 6 * DIA,
    },
    {
      correo: 'laura.pineda@colegio.edu.co',
      nombre: 'Laura Pineda',
      estado: 'pendiente',
      invitadoPor: PROFE,
      creadoAt: Date.now() - 2 * DIA,
    },
  ];
  return porCurso[clave];
}

export function aplicarDemoRetencion(): void {
  invitadosRepository.listar = async (colegioId, cursoId) => {
    await new Promise((r) => setTimeout(r, 300));
    return [...invitadosDe(colegioId, cursoId)].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es')
    );
  };

  invitadosRepository.invitarLista = async ({ colegioId, cursoId, texto }) => {
    await new Promise((r) => setTimeout(r, 700));
    const actuales = invitadosDe(colegioId, cursoId);
    const lista = leerLista(texto);
    const ya = new Set(actuales.map((i) => i.correo));
    const nuevos = lista.invitados.filter((i) => !ya.has(i.correo));
    const pendientes = actuales.filter((i) => i.estado === 'pendiente').length;
    const cupos = Math.max(0, CUPO - EN_CLASE - pendientes);
    const entran: InvitadoLista[] = nuevos.slice(0, cupos);
    const ahora = Date.now();
    actuales.push(
      ...entran.map((i) => ({
        ...i,
        estado: 'pendiente' as const,
        invitadoPor: PROFE,
        creadoAt: ahora,
      }))
    );
    return {
      invitados: entran,
      errores: lista.errores,
      duplicados: lista.duplicados + (lista.invitados.length - nuevos.length),
      sinCupo: nuevos.slice(cupos),
    };
  };

  bitacoraRepository.leerSemana = async () => null;

  adopcionRepository.leerAgregado = async () => {
    await new Promise((r) => setTimeout(r, 300));
    return adopcionDemo(Date.now());
  };
}
