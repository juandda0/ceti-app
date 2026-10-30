import {
  armarPrueba,
  cambiarFase,
  faseAbierta,
  impactoDe,
  resultadoPrueba,
  sumarImpactos,
  sumasImpacto,
} from './pruebaEntradaSalida';

const AHORA = 1_000_000;

describe('abrir y cerrar la prueba', () => {
  it('la salida necesita la entrada, y al abrirla se cierra la entrada', () => {
    expect(cambiarFase(null, 'post', true, 'p', AHORA)).toEqual({ ok: false, error: 'salida_sin_entrada' });
    const a = cambiarFase(null, 'pre', true, 'p', AHORA);
    expect(a.ok && faseAbierta(a.config, 'pre')).toBe(true);
    if (!a.ok) return;
    expect(cambiarFase(a.config, 'pre', true, 'p', AHORA)).toEqual({ ok: false, error: 'ya_abierta' });
    const b = cambiarFase(a.config, 'post', true, 'p', AHORA + 5);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(faseAbierta(b.config, 'pre')).toBe(false);
    expect(b.config.pre?.cerradaAt).toBe(AHORA + 5);
    expect(faseAbierta(b.config, 'post')).toBe(true);
    const c = cambiarFase(b.config, 'post', false, 'p', AHORA + 9);
    expect(c.ok && faseAbierta(c.config, 'post')).toBe(false);
    expect(cambiarFase(c.ok ? c.config : null, 'post', false, 'p', AHORA)).toEqual({ ok: false, error: 'no_abierta' });
  });
});

describe('preguntas y resultado', () => {
  it('arma la prueba en el orden de los mundos y por id', () => {
    const p = armarPrueba(['world_2', 'world_1'], {
      world_1: [{ id: '1_world_1_multiple_choice_10' }, { id: '1_world_1_multiple_choice_9' }],
      world_2: [{ id: 'b' }],
    });
    expect(p.map((x) => x.id)).toEqual(['b', '1_world_1_multiple_choice_9', '1_world_1_multiple_choice_10']);
  });

  it('cuenta aciertos totales y por ámbito', () => {
    const r = resultadoPrueba(
      [
        { ambito: 'presupuesto', ok: true },
        { ambito: 'presupuesto', ok: false },
        { ambito: 'inventado', ok: true },
      ],
      AHORA
    );
    expect(r).toEqual({ score: 2, total: 3, takenAt: AHORA, breakdown: { presupuesto: 1, otro: 1 }, totales: { presupuesto: 2, otro: 1 } });
  });
});

describe('impacto', () => {
  const res = (score: number, total = 10, pres = score) => ({
    score,
    total,
    takenAt: AHORA,
    breakdown: { presupuesto: pres },
    totales: { presupuesto: total },
  });

  it('solo cuenta pares de la lista y oculta promedios con menos de 5', () => {
    const lista = [
      { uid: 'a', pre: res(4), post: res(8) },
      { uid: 'b', pre: res(5), post: res(5) },
      { uid: 'c', pre: res(6) },
      { uid: 'fuera', pre: res(1), post: res(10) },
    ];
    const s = sumasImpacto(lista, new Set(['a', 'b', 'c']));
    expect(s).toMatchObject({ conEntrada: 3, pares: 2, mejoran: 1 });
    expect(s.sumaPre).toBeCloseTo(0.9);
    expect(impactoDe(s, 5)).toMatchObject({ conEntrada: 3, pares: 2, pre: null, post: null, cambio: null });
    const i = impactoDe(s, 2);
    expect(i.pre).toBeCloseTo(0.45);
    expect(i.post).toBeCloseTo(0.65);
    expect(i.cambio).toBeCloseTo(0.2);
    expect(i.mejoran).toBe(0.5);
    expect(i.porAmbito).toEqual([{ ambito: 'presupuesto', n: 2, pre: expect.any(Number), post: expect.any(Number) }]);
  });

  it('suma clases sin perder los ámbitos', () => {
    const a = sumasImpacto([{ uid: 'a', pre: res(2), post: res(6) }], new Set(['a']));
    const b = sumasImpacto([{ uid: 'b', pre: res(4), post: res(4) }], new Set(['b']));
    const s = sumarImpactos([a, b, null]);
    expect(s).toMatchObject({ conEntrada: 2, pares: 2, mejoran: 1 });
    expect(s.porAmbito.presupuesto?.n).toBe(2);
  });
});
