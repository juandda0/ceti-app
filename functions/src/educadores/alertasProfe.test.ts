jest.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: () => () => undefined }));
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => {
    throw new Error('usa la base falsa');
  },
  FieldPath: { documentId: () => '__id__' },
  FieldValue: { serverTimestamp: () => 'ts' },
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));

// eslint-disable-next-line import/first
import type { Firestore } from 'firebase-admin/firestore';
// eslint-disable-next-line import/first
import {
  CONFIG_ALERTAS_POR_DEFECTO,
  ESTADO_ALERTAS_VACIO,
  calcularAlertas,
  leerConfigAlertas,
  quienes,
  textoAlerta,
  type EstudianteParaAlertas,
} from './dominio';
// eslint-disable-next-line import/first
import { alertasDeCurso, rutaAlerta } from './alertasProfe';
// eslint-disable-next-line import/first
import { FirestoreFalso } from './firestoreFalso.test';

const DIA = 24 * 3600 * 1000;
const AHORA = 1_800_000_000_000;

const est = (uid: string, extra: Partial<EstudianteParaAlertas> = {}): EstudianteParaAlertas => ({
  uid,
  nombre: `${uid[0].toUpperCase()}${uid.slice(1)} Pérez`,
  unidoAt: AHORA - 60 * DIA,
  ultimaActividad: AHORA - DIA,
  respuestas: 0,
  aciertos: 0,
  ...extra,
});

describe('leerConfigAlertas', () => {
  test('por defecto todo prendido a 7 días; recorta N', () => {
    expect(leerConfigAlertas(null)).toEqual(CONFIG_ALERTAS_POR_DEFECTO);
    expect(
      leerConfigAlertas({ inactividad: { activa: false, dias: 90 }, tarea: { activa: 'x' } })
    ).toEqual({
      inactividad: { activa: false, dias: 30 },
      tarea: { activa: true },
      promedio: { activa: true },
    });
    expect(leerConfigAlertas({ inactividad: { dias: 1 } }).inactividad.dias).toBe(2);
  });
});

describe('calcularAlertas', () => {
  const base = {
    config: CONFIG_ALERTAS_POR_DEFECTO,
    tareas: [],
    estado: ESTADO_ALERTAS_VACIO,
    ahora: AHORA,
  };

  test('inactividad: avisa una vez por cada racha sin entrar', () => {
    const estudiantes = [
      est('ana', { ultimaActividad: AHORA - 8 * DIA }),
      est('beto', { ultimaActividad: AHORA - 2 * DIA }),
      est('caro', { ultimaActividad: null, unidoAt: AHORA - 10 * DIA }),
      est('dani', { ultimaActividad: null, unidoAt: AHORA - DIA }),
    ];
    const r1 = calcularAlertas({ ...base, estudiantes });
    expect(r1.alertas).toEqual([
      {
        tipo: 'inactividad',
        dias: 7,
        estudiantes: [
          { uid: 'ana', nombre: 'Ana Pérez' },
          { uid: 'caro', nombre: 'Caro Pérez' },
        ],
      },
    ]);
    // Al día siguiente no repite.
    const r2 = calcularAlertas({ ...base, estudiantes, estado: r1.estado, ahora: AHORA + DIA });
    expect(r2.alertas).toEqual([]);
    // Ana volvió y luego se perdió otra vez: nueva alerta.
    const otraVez = [est('ana', { ultimaActividad: AHORA + 2 * DIA })];
    const r3 = calcularAlertas({ ...base, estudiantes: otraVez, estado: r2.estado, ahora: AHORA + 10 * DIA });
    expect(r3.alertas.map((a) => a.estudiantes.map((e) => e.uid))).toEqual([['ana']]);
    // Apagada, no avisa.
    const apagada = calcularAlertas({
      ...base,
      estudiantes,
      config: { ...CONFIG_ALERTAS_POR_DEFECTO, inactividad: { activa: false, dias: 7 } },
    });
    expect(apagada.alertas).toEqual([]);
  });

  test('tareas vencidas: solo los que debían, una vez, y solo las recientes', () => {
    const estudiantes = [
      est('ana'),
      est('beto'),
      est('caro', { unidoAt: AHORA - DIA }), // se unió después de la fecha
    ];
    const tareas = [
      { id: 't1', worldId: 'w1', nombreMundo: 'Luna', deadline: AHORA - 2 * DIA, uid: null, hechos: ['ana'] },
      { id: 't2', worldId: 'w2', nombreMundo: 'Sol', deadline: AHORA - 2 * DIA, uid: 'ana', hechos: [] },
      { id: 'vieja', worldId: 'w3', nombreMundo: 'X', deadline: AHORA - 30 * DIA, uid: null, hechos: [] },
      { id: 'futura', worldId: 'w4', nombreMundo: 'Y', deadline: AHORA + DIA, uid: null, hechos: [] },
    ];
    const r1 = calcularAlertas({ ...base, estudiantes, tareas });
    expect(r1.alertas.map((a) => [a.asignacionId, a.estudiantes.map((e) => e.uid)])).toEqual([
      ['t1', ['beto']],
      ['t2', ['ana']],
    ]);
    expect(r1.estado.tareas).toEqual({ t1: ['beto'], t2: ['ana'] });
    const r2 = calcularAlertas({ ...base, estudiantes, tareas, estado: r1.estado });
    expect(r2.alertas).toEqual([]);
  });

  test('promedio: compara las últimas ≥10 respuestas con el promedio anterior', () => {
    const r1 = calcularAlertas({ ...base, estudiantes: [est('ana', { respuestas: 20, aciertos: 16 })] });
    expect(r1.alertas).toEqual([]);
    expect(r1.estado.promedio.ana).toEqual({ respuestas: 20, aciertos: 16 });
    // 5 nuevas: todavía no mide.
    const r2 = calcularAlertas({
      ...base,
      estudiantes: [est('ana', { respuestas: 25, aciertos: 17 })],
      estado: r1.estado,
    });
    expect(r2.alertas).toEqual([]);
    expect(r2.estado.promedio.ana).toEqual({ respuestas: 20, aciertos: 16 });
    // 12 nuevas con 5 bien: de 80 % a 42 %.
    const r3 = calcularAlertas({
      ...base,
      estudiantes: [est('ana', { respuestas: 32, aciertos: 21 })],
      estado: r2.estado,
    });
    expect(r3.alertas).toEqual([
      {
        tipo: 'promedio',
        estudiantes: [{ uid: 'ana', nombre: 'Ana Pérez' }],
        antes: 0.8,
        despues: 5 / 12,
        respuestasRecientes: 12,
      },
    ]);
    expect(r3.estado.promedio.ana).toEqual({ respuestas: 32, aciertos: 21 });
    // Sube o se mantiene: nada.
    const r4 = calcularAlertas({
      ...base,
      estudiantes: [est('ana', { respuestas: 42, aciertos: 30 })],
      estado: r3.estado,
    });
    expect(r4.alertas).toEqual([]);
  });

  test('textos de la notificación', () => {
    expect(quienes([{ uid: 'a', nombre: 'Ana Ruiz' }])).toBe('Ana');
    expect(
      quienes(['Ana', 'Beto', 'Caro', 'Dani'].map((n) => ({ uid: n, nombre: n })))
    ).toBe('Ana, Beto y 2 más');
    expect(
      textoAlerta({ tipo: 'inactividad', dias: 7, estudiantes: [{ uid: 'a', nombre: 'Ana Ruiz' }] }, '9°A')
        .titulo
    ).toBe('Ana lleva 7 días o más sin entrar');
    expect(
      textoAlerta(
        {
          tipo: 'tarea',
          nombreMundo: 'Luna',
          estudiantes: [
            { uid: 'a', nombre: 'Ana' },
            { uid: 'b', nombre: 'Beto' },
          ],
        },
        '9°A'
      )
    ).toEqual({ titulo: '2 estudiantes no hicieron Luna', cuerpo: 'La tarea de 9°A ya venció: Ana y Beto.' });
    expect(
      textoAlerta(
        { tipo: 'promedio', antes: 0.78, despues: 0.56, respuestasRecientes: 12, estudiantes: [{ uid: 't', nombre: 'Tomás' }] },
        '9°A'
      ).titulo
    ).toBe('Tomás bajó de 78 % a 56 % de aciertos');
    expect(rutaAlerta('k1', { tipo: 'promedio', estudiantes: [{ uid: 't', nombre: 'Tomás R' }] })).toBe(
      '/(staff)/estudiante/k1/t?nombre=Tom%C3%A1s%20R'
    );
  });
});

describe('alertasDeCurso', () => {
  const CURSO = 'colegios/c1/cursos/k1';

  function db(): FirestoreFalso {
    return new FirestoreFalso({
      [CURSO]: { nombre: '9°A', profesorUids: ['profe'] },
      [`${CURSO}/estudiantes/ana`]: { nombre: 'Ana Ruiz', estado: 'activo', joinedAt: AHORA - 60 * DIA },
      [`${CURSO}/estudiantes/ana/visitas/d1`]: { ultimaAt: AHORA - 9 * DIA },
      [`${CURSO}/estudiantes/beto`]: { nombre: 'Beto Gil', estado: 'activo', joinedAt: AHORA - 60 * DIA },
      [`${CURSO}/estudiantes/beto/visitas/d1`]: { ultimaAt: AHORA - DIA },
      [`${CURSO}/estudiantes/beto/progress/world_2`]: {
        uid: 'beto',
        colegioId: 'c1',
        cursoId: 'k1',
        completed: true,
      },
      [`${CURSO}/estudiantes/caro`]: { nombre: 'Caro', estado: 'pendiente_atestacion' },
      // Sin visitas, pero avanzó un mundo ayer (dato de antes del registro por lección).
      [`${CURSO}/estudiantes/dani`]: { nombre: 'Dani Sol', estado: 'activo', joinedAt: AHORA - 60 * DIA },
      [`${CURSO}/estudiantes/dani/progress/world_1`]: {
        uid: 'dani',
        colegioId: 'c1',
        cursoId: 'k1',
        completed: false,
        updatedAt: AHORA - DIA,
      },
      'colegios/c1/asignaciones/t1': {
        worldId: 'world_2',
        target: { tipo: 'curso', cursoId: 'k1' },
        fechaInicio: AHORA - 9 * DIA,
        deadline: AHORA - DIA,
      },
    });
  }

  test('avisa al profe lo nuevo, guarda el estado y no repite', async () => {
    const f = db();
    const espia = { enviar: jest.fn(async () => undefined) };
    const n = await alertasDeCurso(f as unknown as Firestore, 'profe', 'c1', 'k1', AHORA, espia);
    expect(n).toBe(2);
    const avisos = [...f.docs.entries()].filter(([p]) => p.startsWith('notificaciones/profe/items/'));
    expect(avisos.map(([, d]) => d.titulo)).toEqual([
      'Ana lleva 7 días o más sin entrar',
      '2 estudiantes no hicieron Luna del Presupuesto',
    ]);
    expect(avisos[0][1]).toMatchObject({
      tipo: 'alerta',
      cursoId: 'k1',
      ruta: '/(staff)/estudiante/k1/ana?nombre=Ana%20Ruiz',
      datos: { alerta: 'inactividad', clase: '9°A', estudiantes: [{ uid: 'ana', nombre: 'Ana Ruiz' }] },
    });
    expect(f.datos('notificaciones/profe/estadoAlertas/k1')).toMatchObject({
      inactividad: { ana: AHORA - 9 * DIA },
      tareas: { t1: ['ana', 'dani'] },
    });
    expect(await alertasDeCurso(f as unknown as Firestore, 'profe', 'c1', 'k1', AHORA, espia)).toBe(0);
  });

  test('respeta la configuración de la clase', async () => {
    const f = db();
    f.docs.set(`${CURSO}/config/comunicacion`, {
      alertas: { inactividad: { activa: false, dias: 7 }, tarea: { activa: true }, promedio: { activa: true } },
    });
    expect(await alertasDeCurso(f as unknown as Firestore, 'profe', 'c1', 'k1', AHORA)).toBe(1);
    f.docs.set(`${CURSO}/config/comunicacion`, {
      alertas: { inactividad: { activa: false }, tarea: { activa: false }, promedio: { activa: false } },
    });
    expect(await alertasDeCurso(f as unknown as Firestore, 'profe', 'c1', 'k1', AHORA + DIA)).toBe(0);
  });
});
