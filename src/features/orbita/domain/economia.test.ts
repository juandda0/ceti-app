import {
  BOVEDA_INICIAL,
  abrirCdt,
  depositar,
  liquidar,
  pagoCdt,
  retirar,
  romperCdt,
  type EstadoBoveda,
} from './boveda';
import { ajustado, diasParaInflacion, indicePrecios, temporadaDe } from './economia';
import { factorRendimiento, sumarLeccion, xpRespuesta, xpSemana, PROGRESO_INICIAL } from './progreso';
import { comprarEscudo, completarPractica, estadoInicial, alAbrir } from './orbita';
import { planearAvisos } from './avisos';

const NOW = 1_700_000_000_000;

describe('inflación de Saturno', () => {
  it('sube 5 % por temporada de 8 semanas', () => {
    expect(temporadaDe('2026-10-22')).toBe(0);
    expect(temporadaDe('2026-12-28')).toBe(1);
    expect(indicePrecios('2026-12-28')).toBeCloseTo(1.05);
    expect(ajustado(60, '2026-12-28')).toBe(63);
    expect(diasParaInflacion('2026-11-02')).toBe(56);
    expect(diasParaInflacion('2026-10-26')).toBe(63); // antes de la época: espera la primera subida real
  });
});

describe('bóveda', () => {
  const con = (p: Partial<EstadoBoveda>): EstadoBoveda => ({ ...BOVEDA_INICIAL, ...p });

  it('paga interés compuesto por cada lunes pendiente', () => {
    const e = con({ boveda: 1000, ultimoLunes: '2026-10-05' });
    const l = liquidar(e, '2026-10-22'); // lunes 12 y 19
    expect(l.interes).toBe(30 + 31);
    expect(l.estado.boveda).toBe(1061);
    expect(liquidar(l.estado, '2026-10-23').interes).toBe(0);
  });

  it('el interés solo corre hasta el tope', () => {
    const l = liquidar(con({ boveda: 5000, ultimoLunes: '2026-10-12' }), '2026-10-19');
    expect(l.interes).toBe(60);
  });

  it('mueve plata entre bolsillo y bóveda sin crear Cetis', () => {
    const d = depositar(con({ bolsillo: 100 }), 80);
    expect(d.ok && d.estado).toMatchObject({ bolsillo: 20, boveda: 80 });
    expect(depositar(con({ bolsillo: 10 }), 80)).toEqual({ ok: false, error: 'sin_fondos' });
    const r = retirar(con({ boveda: 50 }), 50);
    expect(r.ok && r.estado.bolsillo).toBe(50);
  });

  it('el CDT paga al vencer y romperlo devuelve solo lo puesto', () => {
    const a = abrirCdt(con({ boveda: 500 }), 400, 4, '2026-10-22', 'c1');
    if (!a.ok) throw new Error('no abrió');
    expect(a.estado.boveda).toBe(100);
    const vencido = liquidar({ ...a.estado, ultimoLunes: '2026-11-16' }, '2026-11-19');
    expect(vencido.cdtsVencidos).toHaveLength(1);
    expect(vencido.estado.boveda).toBe(100 + pagoCdt({ monto: 400, semanas: 4 }));
    const roto = romperCdt(a.estado, 'c1');
    expect(roto.ok && roto.estado.boveda).toBe(500);
  });
});

describe('progreso', () => {
  it('suma combo desde el quinto acierto seguido', () => {
    expect(xpRespuesta(true, 0)).toBe(2);
    expect(xpRespuesta(true, 4)).toBe(3);
    expect(xpRespuesta(false, 9)).toBe(0);
  });

  it('rinde la mitad pasado el doble de la meta', () => {
    expect(factorRendimiento(1, 'crucero')).toBe(1);
    expect(factorRendimiento(2, 'crucero')).toBe(0.5);
  });

  it('cuenta el XP de la semana desde el lunes', () => {
    let p = sumarLeccion(PROGRESO_INICIAL, '2026-10-18', 10); // domingo anterior
    p = sumarLeccion(p, '2026-10-20', 15);
    expect(xpSemana(p, '2026-10-22')).toBe(15);
  });
});

describe('orbita', () => {
  it('el primer vuelo regala un escudo y prende la racha', () => {
    const r = completarPractica(
      estadoInicial(NOW),
      { tipo: 'primer_vuelo', xpRespuestas: 6, perfecta: true },
      '2026-10-22',
      NOW
    );
    expect(r.escudoRegalado).toBe(true);
    expect(r.estado.racha.escudos).toBe(1);
    expect(r.racha).toBe(1);
    expect(r.metaCumplida).toBe(true);
    expect(r.estado.boveda.bolsillo).toBe(20 + 10);
  });

  it('una lección avanza el mapa solo si es la siguiente', () => {
    const base = estadoInicial(NOW);
    const r = completarPractica(
      base,
      { tipo: 'leccion', worldId: 'world_1', nivel: 0, xpRespuestas: 10, perfecta: false },
      '2026-10-22',
      NOW
    );
    expect(r.estado.niveles.world_1).toBe(1);
    const repetida = completarPractica(
      r.estado,
      { tipo: 'leccion', worldId: 'world_1', nivel: 0, xpRespuestas: 10, perfecta: false },
      '2026-10-22',
      NOW
    );
    expect(repetida.estado.niveles.world_1).toBe(1);
  });

  it('migra los días de la racha anterior', () => {
    const e = estadoInicial(NOW, ['2026-10-20', '2026-10-21']);
    const { estado } = alAbrir(e, '2026-10-22', NOW);
    expect(estado.racha.dias).toHaveLength(2);
  });

  it('comprar escudo cobra del bolsillo y respeta el tope', () => {
    const e = { ...estadoInicial(NOW), boveda: { ...BOVEDA_INICIAL, bolsillo: 200 } };
    const c = comprarEscudo(e, '2026-10-22', NOW);
    expect(c.ok && c.estado.boveda.bolsillo).toBe(140);
    const mixto = comprarEscudo(
      { ...estadoInicial(NOW), boveda: { ...BOVEDA_INICIAL, bolsillo: 20, boveda: 100 } },
      '2026-10-22',
      NOW
    );
    expect(mixto.ok && mixto.estado.boveda).toMatchObject({ bolsillo: 0, boveda: 60 });
    const pobre = comprarEscudo(estadoInicial(NOW), '2026-10-22', NOW);
    expect(pobre).toMatchObject({ ok: false, error: 'sin_cetis' });
  });
});

describe('avisos', () => {
  it('no avisa hoy si ya practicó y el último es la despedida', () => {
    const plan = planearAvisos({ hoy: '2026-10-22', horaActual: 9, hora: 18, practicoHoy: true, racha: 4 });
    expect(plan.map((a) => a.dia)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25']);
    expect(plan[0].mensaje).toBe('orbita.avisos.rachaEnRiesgo');
    expect(plan[plan.length - 1].mensaje).toBe('orbita.avisos.despedida');
  });

  it('nunca programa fuera de 7 a. m. a 8 p. m.', () => {
    const plan = planearAvisos({ hoy: '2026-10-22', horaActual: 6, hora: 23, practicoHoy: false, racha: 0 });
    expect(plan.every((a) => a.hora === 20)).toBe(true);
    expect(plan).toHaveLength(4);
  });
});

describe('sincronización: qué estado gana', () => {
  const { elegirEstado } = jest.requireActual('./orbita');
  const conActividad = (actualizadoEn: number) =>
    completarPractica(
      estadoInicial(NOW),
      { tipo: 'leccion', worldId: 'world_1', nivel: 0, xpRespuestas: 8, perfecta: false },
      '2026-10-22',
      actualizadoEn
    ).estado;

  it('un estado recién creado en otro teléfono nunca pisa al remoto', () => {
    const fresco = { ...estadoInicial(NOW + 1000), actualizadoEn: 0 };
    expect(elegirEstado(fresco, conActividad(NOW))).toBe('remoto');
    // Aunque traiga un actualizadoEn nuevo, sin actividad tampoco gana.
    expect(elegirEstado(estadoInicial(NOW + 1000), conActividad(NOW))).toBe('remoto');
  });

  it('gana el más nuevo cuando los dos tienen actividad', () => {
    expect(elegirEstado(conActividad(NOW + 5), conActividad(NOW))).toBe('local');
    expect(elegirEstado(conActividad(NOW), conActividad(NOW + 5))).toBe('remoto');
  });

  it('ignora un remoto inválido', () => {
    expect(elegirEstado(conActividad(NOW), { version: 2 })).toBe('local');
    expect(elegirEstado(undefined, null)).toBe('ninguno');
  });

  it('abrir la app sin eventos no marca el estado como nuevo', () => {
    const fresco = { ...estadoInicial(NOW), actualizadoEn: 0 };
    const { estado } = alAbrir(fresco, '2026-10-22', NOW + 99);
    expect(estado.actualizadoEn).toBe(0);
  });
});
