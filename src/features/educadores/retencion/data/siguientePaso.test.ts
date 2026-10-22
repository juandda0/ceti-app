import { construirBitacora, DIA_MS, type CursoBitacora } from '@/functions/src/educadores/dominio';
import { destinoSiguientePaso, type CursoDeBitacora } from './siguientePaso';

const AHORA = Date.parse('2026-10-22T15:00:00.000Z');

function curso(
  id: string,
  estudiantes: { activo: boolean; ultima: number | null }[],
  extra: Partial<CursoBitacora> = {}
): CursoDeBitacora {
  return {
    id,
    nombre: `Clase ${id}`,
    curso: {
      cursoId: id,
      nombre: `Clase ${id}`,
      estudiantes: estudiantes.map((e, i) => ({
        nombre: `${id}-${i}`,
        activo: e.activo,
        ultimaActividad: e.ultima,
        maestria: 0.7,
      })),
      quicesSemana: 0,
      mundoMasDificil: null,
      asignacionesActivas: 0,
      ...extra,
    },
  };
}

function destino(cursos: CursoDeBitacora[]) {
  return destinoSiguientePaso(
    construirBitacora(
      cursos.map((c) => c.curso),
      '2026-W43',
      AHORA
    ),
    cursos
  );
}

const reciente = { activo: true, ultima: AHORA - DIA_MS };
const perdido = { activo: true, ultima: null };

describe('destinoSiguientePaso', () => {
  it('sin clases lleva a crear una', () => {
    expect(destino([])).toEqual({
      paso: 'crear_clase',
      ruta: '/(staff)/crear-clase',
      cursoNombre: null,
    });
  });

  it('sin tripulantes lleva a invitar en la clase vacía', () => {
    const d = destino([curso('a', [])]);
    expect(d.paso).toBe('invitar');
    expect(d.ruta).toBe('/(staff)/gestionar/a?nombre=Clase%20a');
  });

  it('con muchas alertas lleva a los estudiantes de la clase con más alertas', () => {
    const d = destino([
      curso('a', [reciente, reciente, perdido]),
      curso('b', [perdido, perdido, reciente]),
    ]);
    expect(d.paso).toBe('revisar_alertas');
    expect(d.ruta).toBe('/(staff)/curso/b?nombre=Clase%20b&vista=estudiantes');
    expect(d.cursoNombre).toBe('Clase b');
  });

  it('con un mundo flojo lleva a las tareas de esa clase', () => {
    const d = destino([
      curso('a', [reciente], { mundoMasDificil: { nombre: 'Ahorro', maestria: 0.7 } }),
      curso('b', [reciente], { mundoMasDificil: { nombre: 'Crédito', maestria: 0.4 } }),
    ]);
    expect(d.paso).toBe('reforzar_mundo');
    expect(d.ruta).toBe('/(staff)/curso/b?nombre=Clase%20b&vista=tareas');
  });

  it('si todo va bien, asignar en la clase que no tiene tareas vigentes', () => {
    const d = destino([curso('a', [reciente], { asignacionesActivas: 2 }), curso('b', [reciente])]);
    expect(d.paso).toBe('asignar');
    expect(d.ruta).toBe('/(staff)/curso/b?nombre=Clase%20b&vista=tareas');
  });

  it('una bitácora del servidor sin clases cargadas va a la lista de clases', () => {
    const b = construirBitacora([curso('a', [reciente]).curso], '2026-W43', AHORA);
    expect(destinoSiguientePaso(b, []).ruta).toBe('/(staff)/clases');
  });
});
