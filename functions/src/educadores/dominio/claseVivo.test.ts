import {
  abrirSiguiente,
  crearSesion,
  elegirPreguntasVivo,
  intentosDeSesion,
  nombreCorto,
  opcionAEsconder,
  puntosDe,
  rankingVivo,
  resumenSesion,
  revelarPregunta,
  terminarSesion,
  validarPreguntasVivo,
  type PreguntaVivo,
} from './claseVivo';
import { limites } from './planes';

const AHORA = 1_000_000;
const MC: PreguntaVivo = { id: 'q1', tipo: 'multiple_choice', enunciado: '¿Qué ahorras primero?', opciones: ['a', 'b', 'c', 'd'], correcta: 1, d: 'AI-89-1' };
const VF: PreguntaVivo = { id: 'q2', tipo: 'true_false', enunciado: 'El interés suma', opciones: ['Verdadero', 'Falso'], correcta: 0 };
const MC2: PreguntaVivo = { ...MC, id: 'q3' };

function sesionCon(preguntas = [MC, VF, MC2]) {
  const r = crearSesion({ id: 's1', worldId: 'world_2', titulo: 'Ahorro', preguntas, segundos: 20, uid: 'p', ahora: AHORA });
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('validar y elegir preguntas', () => {
  it('descarta las de prueba, las mal formadas y las repetidas', () => {
    const out = validarPreguntasVivo([
      MC,
      { ...MC, id: 'p1', prueba: true },
      { ...MC },
      { id: 'x', tipo: 'ordenar', enunciado: 'o' },
      { id: 'y', tipo: 'multiple_choice', enunciado: 'e', opciones: ['a'], correcta: 0 },
      { id: 'z', tipo: 'multiple_choice', enunciado: 'e', opciones: ['a', 'b'], correcta: 2 },
      { id: 'v', tipo: 'true_false', enunciado: 'v', correcta: 1 },
    ]);
    expect(out.map((p) => p.id)).toEqual(['q1', 'v']);
    expect(out[1].opciones).toEqual(['Verdadero', 'Falso']);
  });

  it('elige del banco sin las de prueba, intercalando V/F, y lleva el desempeño', () => {
    const items = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `mc${i}`, tipo: 'multiple_choice', enunciado: `m${i}`, opciones: ['a', 'b', 'c', 'd'], correctIndex: 2, desempeno: 'PR-45-1' })),
      { id: 'mcP', tipo: 'multiple_choice', enunciado: 'prueba', opciones: ['a', 'b'], correctIndex: 0, prueba: true },
      ...Array.from({ length: 3 }, (_, i) => ({ id: `vf${i}`, tipo: 'true_false', enunciado: `v${i}`, respuesta: i === 0 })),
      { id: 'o1', tipo: 'ordenar', enunciado: 'o' },
    ];
    const elegidas = elegirPreguntasVivo(items, 9, 'semilla');
    expect(elegidas).toHaveLength(9);
    expect(elegidas.some((p) => p.id === 'mcP' || p.id === 'o1')).toBe(false);
    expect(elegidas[2].tipo).toBe('true_false');
    expect(elegidas[0].d).toBe('PR-45-1');
    expect(mismaEleccion(items)).toEqual(elegidas.map((p) => p.id));
    const vf0 = elegidas.find((p) => p.id === 'vf0');
    expect(vf0?.correcta).toBe(0);
  });

  function mismaEleccion(items: Parameters<typeof elegirPreguntasVivo>[0]) {
    return elegirPreguntasVivo(items, 9, 'semilla').map((p) => p.id);
  }

  it('esconde siempre la misma errada y nunca la correcta', () => {
    const i = opcionAEsconder(MC);
    expect(i).not.toBeNull();
    expect(i).not.toBe(MC.correcta);
    expect(opcionAEsconder(MC)).toBe(i);
    expect(opcionAEsconder(VF)).toBeNull();
  });
});

describe('plan', () => {
  it('Cadete abre 3 clases en vivo al mes; Piloto, sin límite', () => {
    expect(limites('cadete').clasesVivoMes).toBe(3);
    expect(limites('piloto').clasesVivoMes).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('puntos y nombres', () => {
  it('acertar da 500 y la rapidez hasta 500 más', () => {
    expect(puntosDe(false, 100, 20000)).toBe(0);
    expect(puntosDe(true, 0, 20000)).toBe(1000);
    expect(puntosDe(true, 10000, 20000)).toBe(750);
    expect(puntosDe(true, 99999, 20000)).toBe(500);
  });
  it('nombre corto', () => {
    expect(nombreCorto('Mariana  López Díaz')).toBe('Mariana L.');
    expect(nombreCorto('Ana')).toBe('Ana');
    expect(nombreCorto('  ')).toBe('Estudiante');
  });
});

describe('una sesión de principio a fin', () => {
  it('pide al menos 3 preguntas y un tiempo válido', () => {
    expect(crearSesion({ id: 's', worldId: 'w', titulo: 't', preguntas: [MC], segundos: 20, uid: 'p', ahora: 0 })).toEqual({ ok: false, error: 'muy_pocas' });
    expect(crearSesion({ id: 's', worldId: 'w', titulo: 't', preguntas: [MC, VF, MC2], segundos: 15, uid: 'p', ahora: 0 })).toEqual({ ok: false, error: 'segundos_invalidos' });
  });

  it('abre, revela con puntos y grupos, y deja intentos con el desempeño', () => {
    const { sesion, clave } = sesionCon();
    expect(sesion.estado).toBe('lobby');
    const a = abrirSiguiente(sesion, clave, AHORA + 10);
    if (!a.ok) throw new Error(a.error);
    expect(a.sesion.pregunta).toMatchObject({ n: 0, tipo: 'multiple_choice', abiertaAt: AHORA + 10 });
    expect(a.sesion.pregunta).not.toHaveProperty('correcta');
    expect(abrirSiguiente(a.sesion, clave, AHORA)).toEqual({ ok: false, error: 'estado_invalido' });

    const r = revelarPregunta({
      sesion: a.sesion,
      clave,
      respuestas: [
        { uid: 'e1', r: 1, ms: 0 },
        { uid: 'e2', r: 0, ms: 3000 },
        { uid: 'e1', r: 0, ms: 4000 }, // repetida: no cuenta
        { uid: 'e3', r: 1, ms: 25000 }, // tarde para 20 s
        { uid: 'e4', r: 1, ms: 25000 }, // con más tiempo (30 s) sí cuenta
        { uid: 'intruso', r: 1, ms: 0 }, // no está activo
      ],
      nombres: { e1: 'Mariana López', e2: 'Samuel Ruiz', e3: 'Tomás Peña', e4: 'Isabela Mora' },
      factores: { e4: 1.5 },
      grupos: [
        { id: 'g1', nombre: 'Halcones', color: '#2F7BE5', uids: ['e1', 'e2'] },
        { id: 'g2', nombre: 'Cóndores', color: '#2F9E5B', uids: ['e3'] },
      ],
      ahora: AHORA + 30000,
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.sesion.revelada).toMatchObject({ n: 0, correcta: 1, conteo: [1, 2, 0, 0], respondieron: 3, aciertos: 2 });
    expect(r.sesion.puntajes.e1).toMatchObject({ nombre: 'Mariana L.', puntos: 1000, aciertos: 1, ultimo: 1000 });
    expect(r.sesion.puntajes.e2).toMatchObject({ puntos: 0, ultimo: 0 });
    expect(r.sesion.puntajes.e3).toBeUndefined();
    expect(r.sesion.puntajes.e4.puntos).toBe(583);
    expect(r.sesion.grupos).toEqual([{ id: 'g1', nombre: 'Halcones', color: '#2F7BE5', puntos: 500, miembros: 2 }]);
    expect(r.clave.registro.e1).toEqual([{ p: 'q1', t: 'multiple_choice', ok: true, r: '1', ms: 0, d: 'AI-89-1' }]);
    expect(rankingVivo(r.sesion.puntajes).map((x) => [x.uid, x.puesto])).toEqual([['e1', 1], ['e4', 2], ['e2', 3]]);

    // V/F: la respuesta queda como 'true'/'false', igual que en las lecciones.
    const b = abrirSiguiente(r.sesion, r.clave, AHORA + 40000);
    if (!b.ok) throw new Error(b.error);
    const r2 = revelarPregunta({
      sesion: b.sesion,
      clave: r.clave,
      respuestas: [{ uid: 'e1', r: 0, ms: 1000 }],
      nombres: { e1: 'Mariana López' },
      factores: {},
      grupos: [],
      ahora: AHORA + 50000,
    });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.sesion.puntajes.e2.ultimo).toBeNull();
    expect(r2.clave.registro.e1[1]).toMatchObject({ p: 'q2', t: 'true_false', ok: true, r: 'true' });

    const fin = terminarSesion(r2.sesion, AHORA + 60000);
    expect(fin.estado).toBe('terminada');
    const intentos = intentosDeSesion(fin, r2.clave, AHORA + 60000);
    expect(intentos.e1).toMatchObject({ tipo: 'vivo', worldId: 'world_2', total: 2, aciertos: 2, nivel: null, resultado: 'completado' });
    expect(intentos.e3).toBeUndefined();
    const resumen = resumenSesion(fin, r2.clave);
    expect(resumen).toMatchObject({ participantes: 3, preguntas: 3, pctAciertos: 75 });
    expect(JSON.stringify(resumen)).not.toContain('Mariana');
  });

  it('no abre más allá de la última pregunta', () => {
    const { sesion, clave } = sesionCon();
    let s = sesion;
    for (let i = 0; i < 3; i++) {
      const a = abrirSiguiente(s, clave, AHORA);
      if (!a.ok) throw new Error(a.error);
      s = { ...a.sesion, estado: 'revelada' };
    }
    expect(abrirSiguiente(s, clave, AHORA)).toEqual({ ok: false, error: 'sin_mas_preguntas' });
  });
});
