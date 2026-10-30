import {
  DIA_MS,
  ahorroCiclo,
  aplicarPagoAprobado,
  ALINEACION_MEN,
  AMBITOS_MEN,
  NORMAS_EEF,
  normasPara,
  DESEMPENOS_MEN,
  alineacionDeMundosPropios,
  desempenosDeCurso,
  filasDesempeno,
  dominiosDeCurso,
  armarPublicacion,
  dominioPor,
  grupoGradoMen,
  calcularPanelEntidad,
  cambiarCoDocente,
  cicloDiario,
  configConMundo,
  cotizarEntidad,
  cupoProfes,
  digitoVerificacionNit,
  evaluacionDesdeDoc,
  evaluacionPorDefecto,
  itemFacturaEntidad,
  leerDatosFacturacion,
  leerEvaluacion,
  licenciaDesdePago,
  MESES_POR_CICLO,
  nuevaCotizacion,
  nuevaSuscripcion,
  numeroCotizacion,
  pausar,
  periodoActualDe,
  periodosDelAnio,
  piezasDeMundo,
  piezasParaMundoNuevo,
  planDeLicencia,
  precioPlan,
  profesTrasSalida,
  puedeInvitar,
  registrarOrden,
  topeEstudiantesDe,
  validarCambioRol,
  validarSalida,
  type CursoPanel,
} from './index';

const T = (fecha: string, hora = '12:00') => Date.parse(`${fecha}T${hora}:00.000-05:00`);
const AHORA = T('2026-10-30');

describe('ciclo semestral de los planes individuales', () => {
  it('cuesta $129.000 Piloto y $259.000 Comandante y cubre 6 meses', () => {
    expect(precioPlan('piloto', 'semestral')).toBe(129_000);
    expect(precioPlan('comandante', 'semestral')).toBe(259_000);
    expect(MESES_POR_CICLO.semestral).toBe(6);
    // La tarifa fundador es solo del Piloto mensual.
    expect(precioPlan('piloto', 'semestral', true)).toBe(129_000);
  });

  it('ahorra cerca del 14 % frente a 6 mensualidades', () => {
    expect(ahorroCiclo('piloto', 'semestral')).toBe(14);
    expect(ahorroCiclo('comandante', 'semestral')).toBe(13);
    expect(ahorroCiclo('piloto', 'anioEscolar')).toBe(33);
  });

  it('un pago semestral abre un periodo de 6 meses', () => {
    const sub = aplicarPagoAprobado(nuevaSuscripcion('u', AHORA), {
      plan: 'piloto',
      ciclo: 'semestral',
      montoCop: 129_000,
      fundador: false,
      fuentePagoId: 'tok',
      metodo: 'tarjeta',
      ahora: AHORA,
    });
    expect(sub.finPeriodo).toBe(T('2027-04-30'));
  });

  it('avisa 7 días antes de renovar y no se pausa', () => {
    const sub = aplicarPagoAprobado(nuevaSuscripcion('u', AHORA), {
      plan: 'comandante',
      ciclo: 'semestral',
      montoCop: 259_000,
      fundador: false,
      fuentePagoId: 'tok',
      metodo: 'tarjeta',
      ahora: AHORA,
    });
    const r = cicloDiario(sub, (sub.finPeriodo ?? 0) - 5 * DIA_MS);
    expect(r.acciones).toEqual([expect.objectContaining({ tipo: 'aviso', plantilla: 'renovacion_anual_pronto' })]);
    expect(() => pausar(sub, AHORA + 10 * DIA_MS, AHORA + DIA_MS)).toThrow('semestral');
  });
});

describe('precios de los planes de entidad', () => {
  it('Equipo: $21.900 por profe al mes, mínimo 3, + IVA', () => {
    const c = cotizarEntidad('equipo', 'semestral', 2);
    expect(c).toMatchObject({ cantidad: 3, solicitada: 2, unitario: 131_400, base: 394_200, unidad: 'profe' });
    expect(c.iva).toBe(Math.round(394_200 * 0.19));
    expect(cotizarEntidad('equipo', 'anual', 5).base).toBe(5 * 21_900 * 12);
  });

  it('Colegio: $35.000 por estudiante al año, mínimo 150; semestral es la mitad', () => {
    expect(cotizarEntidad('colegio', 'anual', 450).base).toBe(15_750_000);
    expect(cotizarEntidad('colegio', 'semestral', 100)).toMatchObject({ cantidad: 150, unitario: 17_500 });
    expect(cotizarEntidad('colegio', 'anual', 80, true)).toMatchObject({ cantidad: 80, unitario: 18_000, padrinazgo: true });
  });

  it('Universidad: $19.000 por estudiante activo al semestre, mínimo 300', () => {
    expect(cotizarEntidad('universidad', 'semestral', 120)).toMatchObject({ cantidad: 300, base: 5_700_000, unidad: 'estudianteActivo' });
    expect(cotizarEntidad('universidad', 'anual', 1000).unitario).toBe(38_000);
  });
});

describe('licencia de la entidad', () => {
  const hasta = AHORA + 30 * DIA_MS;

  it('Equipo da Comandante a cada profe; Colegio, Universidad y la Nave de antes dan Nave', () => {
    expect(planDeLicencia({ plan: 'equipo', hasta }, AHORA)).toBe('comandante');
    expect(planDeLicencia({ plan: 'colegio', hasta }, AHORA)).toBe('nave');
    expect(planDeLicencia({ plan: 'universidad', hasta }, AHORA)).toBe('nave');
    expect(planDeLicencia({ plan: 'nave', hasta }, AHORA)).toBe('nave');
    expect(planDeLicencia({ plan: 'nave', hasta: AHORA - 1 }, AHORA)).toBe('cadete');
    expect(planDeLicencia({ plan: 'otro', hasta }, AHORA)).toBe('cadete');
    expect(planDeLicencia(null, AHORA)).toBe('cadete');
  });

  it('cupo de profes: 3 sin licencia, el pagado en Equipo, ilimitado en Colegio', () => {
    expect(cupoProfes(null, AHORA)).toBe(3);
    expect(cupoProfes({ plan: 'equipo', hasta, cupo: 8 }, AHORA)).toBe(8);
    expect(cupoProfes({ plan: 'colegio', hasta, cupo: 450 }, AHORA)).toBe(Number.POSITIVE_INFINITY);
    expect(cupoProfes({ plan: 'equipo', hasta: AHORA - 1, cupo: 8 }, AHORA)).toBe(3);
  });

  it('tope de estudiantes solo en Colegio y Universidad', () => {
    expect(topeEstudiantesDe({ plan: 'nave', hasta, estudiantes: 150 })).toBe(150);
    expect(topeEstudiantesDe({ plan: 'universidad', hasta, cupo: 300 })).toBe(300);
    expect(topeEstudiantesDe({ plan: 'equipo', hasta, cupo: 5 })).toBeNull();
  });
});

describe('miembros de la entidad', () => {
  const profes = [
    { uid: 'a', rol: 'admin' as const, correo: 'a@x.co' },
    { uid: 'b', rol: 'profe' as const, correo: 'b@x.co' },
  ];

  it('invita si hay cupo, contando las invitaciones pendientes', () => {
    expect(puedeInvitar(' C@X.co ', profes, [], null, AHORA)).toEqual({ ok: true, valor: 'c@x.co' });
    expect(puedeInvitar('c@x.co', profes, [{ correo: 'd@x.co' }], null, AHORA)).toEqual({ ok: false, error: 'sin_cupo' });
    expect(puedeInvitar('B@x.co', profes, [], null, AHORA)).toEqual({ ok: false, error: 'ya_es_miembro' });
    expect(puedeInvitar('d@x.co', profes, [{ correo: 'd@x.co' }], { plan: 'colegio', hasta: AHORA + 1 }, AHORA)).toEqual({
      ok: false,
      error: 'ya_invitado',
    });
    expect(puedeInvitar('no-es-correo', profes, [], null, AHORA)).toEqual({ ok: false, error: 'correo_invalido' });
  });

  it('nunca deja la entidad sin admin', () => {
    expect(validarCambioRol(profes, 'a', 'profe')).toEqual({ ok: false, error: 'ultimo_admin' });
    expect(validarCambioRol(profes, 'b', 'admin').ok).toBe(true);
    expect(validarSalida(profes, 'a')).toEqual({ ok: false, error: 'ultimo_admin' });
    expect(validarSalida(profes, 'b').ok).toBe(true);
    expect(validarSalida([{ uid: 'a', rol: 'admin' }], 'a').ok).toBe(true);
    expect(validarSalida(profes, 'z')).toEqual({ ok: false, error: 'no_es_miembro' });
  });

  it('las clases se quedan en la entidad cuando un profe sale', () => {
    expect(profesTrasSalida(['a', 'b'], 'a', 'c')).toEqual(['b']);
    expect(profesTrasSalida(['a'], 'a', 'c')).toEqual(['c']);
    expect(profesTrasSalida(['a'], 'a', null)).toEqual([]);
  });

  it('co-docentes: solo miembros, sin repetir y nunca deja la clase sin profe', () => {
    const miembros = new Set(['a', 'b', 'c']);
    expect(cambiarCoDocente(['a'], miembros, 'b', 'agregar')).toEqual({ ok: true, profesorUids: ['a', 'b'] });
    expect(cambiarCoDocente(['a'], miembros, 'x', 'agregar')).toEqual({ ok: false, error: 'no_es_miembro' });
    expect(cambiarCoDocente(['a', 'b'], miembros, 'b', 'agregar')).toEqual({ ok: false, error: 'ya_esta' });
    expect(cambiarCoDocente(['a', 'b'], miembros, 'a', 'quitar')).toEqual({ ok: true, profesorUids: ['b'] });
    expect(cambiarCoDocente(['a'], miembros, 'a', 'quitar')).toEqual({ ok: false, error: 'ultimo_profe' });
  });
});

describe('escala y periodos de la entidad', () => {
  const siee = {
    calendario: 'periodos',
    escala: {
      notaMin: 1,
      notaMax: 10,
      rangos: [
        { desempeno: 'bajo', min: 1 },
        { desempeno: 'basico', min: 6 },
        { desempeno: 'alto', min: 8 },
        { desempeno: 'superior', min: 9.5 },
      ],
    },
    periodos: [
      { nombre: 'Primer periodo', desde: '01-26', hasta: '04-10' },
      { nombre: 'Segundo periodo', desde: '04-13', hasta: '06-19' },
      { nombre: 'Tercer periodo', desde: '07-13', hasta: '11-20' },
    ],
  };

  it('acepta un SIEE propio', () => {
    const r = leerEvaluacion(siee);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.escala.notaMax).toBe(10);
  });

  it('rechaza escalas y periodos inválidos', () => {
    expect(leerEvaluacion({ ...siee, escala: { ...siee.escala, notaMin: 5, notaMax: 5 } })).toEqual({ ok: false, error: 'escala_invalida' });
    const desordenados = [...siee.escala.rangos].reverse();
    expect(leerEvaluacion({ ...siee, escala: { ...siee.escala, rangos: desordenados } })).toEqual({ ok: false, error: 'rangos_invalidos' });
    expect(leerEvaluacion({ ...siee, periodos: [] })).toEqual({ ok: false, error: 'sin_periodos' });
    expect(leerEvaluacion({ ...siee, periodos: [{ nombre: 'X', desde: '02-30', hasta: '03-01' }] })).toEqual({ ok: false, error: 'periodo_invalido' });
    expect(
      leerEvaluacion({ ...siee, periodos: [{ nombre: 'A', desde: '02-01', hasta: '05-01' }, { nombre: 'B', desde: '04-01', hasta: '06-01' }] })
    ).toEqual({ ok: false, error: 'periodos_cruzados' });
  });

  it('sin configuración rigen los 4 periodos del calendario A', () => {
    expect(periodosDelAnio(null, 2026)).toHaveLength(4);
    expect(evaluacionDesdeDoc(undefined)).toEqual(evaluacionPorDefecto());
    expect(evaluacionDesdeDoc({ basura: true })).toEqual(evaluacionPorDefecto());
    expect(evaluacionPorDefecto('semestres').periodos).toHaveLength(2);
  });

  it('periodo actual con los periodos propios', () => {
    const r = leerEvaluacion(siee);
    if (!r.ok) throw new Error('config');
    expect(periodoActualDe(r.config, T('2026-05-02'))).toMatchObject({ numero: 2, nombre: 'Segundo periodo', desde: '2026-04-13' });
    // En vacaciones de mitad de año: el último que terminó.
    expect(periodoActualDe(r.config, T('2026-07-01')).numero).toBe(2);
    // Antes del primero: el último del año anterior.
    expect(periodoActualDe(r.config, T('2026-01-10'))).toMatchObject({ numero: 3, desde: '2025-07-13' });
  });
});

describe('panel de la entidad', () => {
  const curso = (p: Partial<CursoPanel> & Pick<CursoPanel, 'id' | 'grado' | 'profesorUids'>): CursoPanel => ({
    nombre: p.id,
    estudiantes: 30,
    estudiantesActivos: 20,
    ultimaActividad: AHORA - DIA_MS,
    porCompetencia: {},
    comunicados7d: 0,
    familiasConResumen: 0,
    ...p,
  });
  const profes = [
    { uid: 'a', nombre: 'Laura', rol: 'admin' as const },
    { uid: 'b', nombre: 'Jorge', rol: 'profe' as const },
    { uid: 'c', nombre: 'Ana', rol: 'profe' as const },
  ];

  it('adopción por profe, por clase y dominio por grado, sin nombres de estudiantes', () => {
    const panel = calcularPanelEntidad(
      [
        curso({ id: '10a', grado: '10', profesorUids: ['a'], estudiantesActivos: 27, comunicados7d: 3, porCompetencia: { ahorro: { masteryPromedio: 0.8, estudiantes: 20 } } }),
        curso({ id: '10b', grado: '10', profesorUids: ['a', 'b'], estudiantesActivos: 10, porCompetencia: { ahorro: { masteryPromedio: 0.5, estudiantes: 10 }, credito: { masteryPromedio: 0.3, estudiantes: 10 } } }),
        curso({ id: 'cont', grado: '11', programa: 'Contaduría', profesorUids: [], estudiantes: 4, estudiantesActivos: 4, porCompetencia: { ahorro: { masteryPromedio: 0.9, estudiantes: 4 } }, familiasConResumen: 2 }),
        curso({ id: 'vieja', grado: '9', profesorUids: ['b'], archivada: true }),
      ],
      profes,
      AHORA
    );
    expect(panel.resumen).toMatchObject({ profes: 3, profesActivos: 2, clases: 3, estudiantes: 64, estudiantesActivos: 41 });
    expect(panel.profes.map((p) => [p.nombre, p.estado])).toEqual([
      ['Laura', 'activo'],
      ['Jorge', 'bajo'],
      ['Ana', 'sinEmpezar'],
    ]);
    expect(panel.clases.find((c) => c.id === 'cont')).toMatchObject({ grupo: 'Contaduría', sinProfe: true, profes: [] });
    expect(panel.clases.find((c) => c.id === '10b')?.profes).toEqual(['Laura', 'Jorge']);
    const diez = panel.grupos.find((g) => g.clave === 'g:10');
    expect(diez?.competencias.ahorro).toBeCloseTo((0.8 * 20 + 0.5 * 10) / 30);
    expect(diez?.masDebil).toBe('credito');
    // 4 estudiantes con datos: no se muestra el dominio del grupo.
    expect(panel.grupos.find((g) => g.clave === 'p:Contaduría')?.dominio).toBeNull();
    expect(panel.comunicacion).toEqual({ comunicados7d: 3, familiasConResumen: 2, clasesQueEscriben: 1 });
    expect(JSON.stringify(panel)).not.toMatch(/uid":"est/);
  });
});

describe('facturación a la entidad', () => {
  it('dígito de verificación del NIT (DIAN)', () => {
    expect(digitoVerificacionNit('890903938')).toBe('8');
    expect(digitoVerificacionNit('860002964')).toBe('4');
    expect(digitoVerificacionNit('899999063')).toBe('3');
  });

  it('valida los datos de la factura electrónica', () => {
    const base = {
      razonSocial: 'Colegio San Mateo S.A.S.',
      nit: '890.903.938',
      dv: '8',
      direccion: 'Calle 10 # 20-30',
      ciudad: 'Medellín',
      correoFactura: 'Facturas@SanMateo.edu.co',
      responsabilidad: 'R-99-PN',
    };
    const r = leerDatosFacturacion(base);
    expect(r).toMatchObject({ ok: true, datos: { nit: '890903938', correoFactura: 'facturas@sanmateo.edu.co', telefono: null } });
    expect(leerDatosFacturacion({ ...base, dv: '1' })).toEqual({ ok: false, error: 'dv' });
    expect(leerDatosFacturacion({ ...base, responsabilidad: 'X' })).toEqual({ ok: false, error: 'responsabilidad' });
  });

  it('cotización → orden de compra → licencia', () => {
    const c = nuevaCotizacion('q1', numeroCotizacion(2026, 7), 'colegio', 'anual', 450, 'a', AHORA);
    expect(c).toMatchObject({ numero: 'COT-2026-0007', estado: 'cotizada', total: 18_742_500 });
    expect(registrarOrden(c, 'x', AHORA)).toEqual({ ok: false, error: 'orden_invalida' });
    expect(registrarOrden(c, 'OC-118', AHORA + 31 * DIA_MS)).toEqual({ ok: false, error: 'vencida' });
    const r = registrarOrden(c, ' OC-2026-118 ', AHORA + DIA_MS);
    expect(r).toMatchObject({ ok: true, cotizacion: { estado: 'orden_recibida', ordenCompra: 'OC-2026-118' } });

    const nueva = licenciaDesdePago(c, null, AHORA);
    expect(nueva).toMatchObject({ plan: 'colegio', ciclo: 'anual', cupo: 450, hasta: T('2027-10-30') });
    // Renovación del mismo plan: empieza donde termina la vigente.
    const renovada = licenciaDesdePago(c, { plan: 'nave', hasta: T('2027-01-31') }, AHORA);
    expect(renovada.hasta).toBe(T('2028-01-31'));
    expect(itemFacturaEntidad(c)).toBe('Ceti Colegio anual · 450 estudiantes');
  });
});

describe('biblioteca de la entidad', () => {
  const piezas = [
    { id: 'banco_cw_a_multiple_choice', data: { worldId: 'cw_a', items: [{ id: 'cw_a_mc_1' }, { id: 'cw_a_mc_2' }] } },
    { id: 'microteoria_cw_a', data: { worldId: 'cw_a', cards: [{}] } },
    { id: 'mapa_cw_a', data: { worldId: 'cw_a', lecciones: [{}, {}, {}], jefe: [] } },
    { id: 'banco_world_1_true_false', data: { worldId: 'world_1', items: [{}] } },
    { id: 'banco_cw_ab_true_false', data: { worldId: 'cw_ab', items: [{}] } },
  ];

  it('publica solo las piezas del mundo y cuenta lecciones y preguntas', () => {
    const delMundo = piezasDeMundo(piezas, 'cw_a');
    expect(delMundo.map((p) => p.id)).toEqual(['banco_cw_a_multiple_choice', 'microteoria_cw_a', 'mapa_cw_a']);
    const pub = armarPublicacion({
      entrada: { worldId: 'cw_a', activo: true, nombre: ' La tienda ', competencia: 'presupuesto' },
      piezas: delMundo,
      overrides: { mc: true, teoria: true },
      grado: '10',
      cursoId: 'k1',
      autorUid: 'ana',
      autorNombre: 'Ana',
      ahora: AHORA,
    });
    expect(pub).toMatchObject({ titulo: 'La tienda', lecciones: 3, preguntas: 2, usos: 0, origen: { worldId: 'cw_a' } });
  });

  it('la copia es un mundo nuevo en borrador, con las preguntas intactas', () => {
    const pub = {
      titulo: 'La tienda',
      subtitulo: null,
      descripcion: 'Casos',
      competencia: 'presupuesto',
      overrides: { mc: true },
      origen: { cursoId: 'k1', worldId: 'cw_a' },
      piezas: { banco_cw_a_multiple_choice: { worldId: 'cw_a', items: [{ id: 'cw_a_mc_1' }] } },
    };
    expect(piezasParaMundoNuevo(pub, 'cw_z')).toEqual([
      { id: 'banco_cw_z_multiple_choice', data: { worldId: 'cw_z', items: [{ id: 'cw_a_mc_1' }] } },
    ]);
    const sinConfig = configConMundo(null, pub, 'cw_z', 'beto', AHORA);
    expect(sinConfig?.mundos).toHaveLength(7);
    expect(sinConfig?.mundos[6]).toEqual({
      worldId: 'cw_z',
      activo: false,
      nombre: 'La tienda',
      descripcion: 'Casos',
      competencia: 'presupuesto',
    });
    expect(sinConfig).toMatchObject({ overrides: { cw_z: { mc: true } }, version: 1, updatedByUid: 'beto' });
    const llena = { mundos: Array.from({ length: 30 }, (_, i) => ({ worldId: `w${i}`, activo: true })), version: 3 };
    expect(configConMundo(llena, pub, 'cw_z', 'beto', AHORA)).toBeNull();
  });
});

describe('marco normativo y alineación con el MEN', () => {
  it('los 9 ámbitos conceptuales y las 4 competencias de las orientaciones', () => {
    expect(AMBITOS_MEN.map((a) => a.nombre)).toEqual([
      'Contextualización económica',
      'Desarrollo económico',
      'Política económica',
      'Contextualización financiera',
      'Presupuesto',
      'Ahorro e inversión',
      'Manejo de deudas',
      'Sistema financiero',
      'Análisis de riesgos',
    ]);
    expect(NORMAS_EEF.map((n) => n.id)).toEqual(['ley1450', 'doc26', 'decreto457', 'decreto1517', 'conpes4005']);
  });

  it('el Decreto 457 va como antecedente y la universidad no cita las normas de la básica', () => {
    const d457 = NORMAS_EEF.find((n) => n.id === 'decreto457');
    expect(d457?.vigencia).toMatch(/Decreto 1517 de 2021/);
    expect(normasPara('universidad').map((n) => n.id)).toEqual(['decreto457', 'decreto1517', 'conpes4005']);
    expect(normasPara('colegio')).toBe(NORMAS_EEF);
  });

  it('cada competencia de Ceti (id estable) tiene alineación', () => {
    expect(Object.keys(ALINEACION_MEN).sort()).toEqual(['ahorro', 'credito', 'deuda', 'economia', 'ingreso', 'presupuesto']);
  });

  it('grupos de grados de los Estándares Básicos', () => {
    expect(['1', '3', '4', '6', '9', '10', '11'].map(grupoGradoMen)).toEqual(['1-3', '1-3', '4-5', '6-7', '8-9', '10-11', '10-11']);
    expect(grupoGradoMen('12')).toBeNull();
    expect(grupoGradoMen(null)).toBeNull();
  });

  it('dominio por ámbito cuenta estudiantes distintos', () => {
    const enLista = new Set(['a', 'b']);
    const r = dominioPor(
      [
        { uid: 'a', competencia: 'credito', mastery: 1, updatedAt: 1 },
        { uid: 'a', competencia: 'deuda', mastery: 0.5, updatedAt: 1 },
        { uid: 'b', competencia: 'deuda', mastery: 0, updatedAt: 1 },
        { uid: 'x', competencia: 'deuda', mastery: 1, updatedAt: 1 },
      ],
      enLista,
      (p) => ALINEACION_MEN[p.competencia]?.ambitos ?? []
    );
    expect(r.manejoDeudas).toEqual({ masteryPromedio: 0.5, estudiantes: 2 });
    expect(r.sistemaFinanciero).toEqual({ masteryPromedio: 1, estudiantes: 1 });
  });

  it('un mundo propio con ámbitos del MEN suma en la cobertura (Fase 7)', () => {
    const propios = alineacionDeMundosPropios([
      { worldId: 'cw_pais', competencia: 'personalizada', ambitosMen: ['politicaEconomica', 'inventado'] },
      { worldId: 'cw_sin', ambitosMen: [] },
      { worldId: 'world_1' },
    ]);
    expect(propios).toEqual({ cw_pais: { ambitos: ['politicaEconomica'], competencias: ['decidir'] } });
    const d = dominiosDeCurso(
      [
        { uid: 'a', worldId: 'cw_pais', competencia: 'personalizada', mastery: 0.8, updatedAt: 1 },
        { uid: 'a', worldId: 'world_2', competencia: 'presupuesto', mastery: 0.4, updatedAt: 1 },
      ],
      new Set(['a']),
      null,
      propios
    );
    expect(d.porAmbitoMen?.politicaEconomica).toEqual({ masteryPromedio: 0.8, estudiantes: 1 });
    expect(d.porAmbitoMen?.presupuesto).toEqual({ masteryPromedio: 0.4, estudiantes: 1 });
    expect(d.porCompetencia.personalizada).toBeDefined();
  });

  it('desempeños: logra con 60 % y al menos 2 respuestas; el grupo chico no muestra porcentaje', () => {
    const resumenes: { uid: string; porDesempeno: Record<string, { respuestas: number; aciertos: number }> }[] = [
      { uid: 'a', porDesempeno: { 'PR-45-1': { respuestas: 5, aciertos: 4 }, 'XX-1-1': { respuestas: 9, aciertos: 9 } } },
      { uid: 'b', porDesempeno: { 'PR-45-1': { respuestas: 3, aciertos: 1 } } },
      { uid: 'c', porDesempeno: { 'PR-45-1': { respuestas: 1, aciertos: 1 } } },
      { uid: 'fuera', porDesempeno: { 'PR-45-1': { respuestas: 5, aciertos: 5 } } },
    ];
    const conteo = desempenosDeCurso(resumenes, new Set(['a', 'b', 'c']));
    expect(conteo).toEqual({ 'PR-45-1': { estudiantes: 2, logran: 1 } });
    const filas = filasDesempeno([{ porDesempeno: conteo }, { porDesempeno: { 'PR-45-1': { estudiantes: 4, logran: 3 }, 'PR-1011-1': { estudiantes: 9, logran: 9 } } }], '4-5');
    expect(filas).toEqual([
      expect.objectContaining({ id: 'PR-45-1', ambito: 'presupuesto', estudiantes: 6, logran: 4, logro: 4 / 6 }),
    ]);
    expect(filasDesempeno([{ porDesempeno: conteo }], '4-5')[0].logro).toBeNull();
    expect(DESEMPENOS_MEN).toHaveLength(101);
    expect(new Set(DESEMPENOS_MEN.map((x) => x.id)).size).toBe(101);
  });
});
