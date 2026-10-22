import {
  DIA_MS,
  aplicarPagoAprobado,
  aplicarPagoRechazado,
  calcularAdopcion,
  cancelar,
  cicloDiario,
  clasesEditables,
  construirBitacora,
  construirNotas,
  cotizarNave,
  desempenoDeNota,
  desgloseIvaIncluido,
  domingoDePascua,
  enRetracto,
  esDiaHabil,
  fechaBogota,
  festivosColombia,
  finRetracto,
  formatoCop,
  formatoMinutosCorto,
  inicioDiaBogota,
  leerLista,
  notaDesdeMaestria,
  notasCsv,
  nuevaSuscripcion,
  pausar,
  periodoActual,
  planEfectivo,
  planMinimoPara,
  precioPlan,
  puede,
  puedeCrearClase,
  reanudar,
  regresoAClases,
  semanaIso,
  sumarMeses,
  type Suscripcion,
} from './index';

const T = (fecha: string, hora = '12:00') => Date.parse(`${fecha}T${hora}:00.000-05:00`);

function pagado(desde: string, ciclo: 'mensual' | 'anioEscolar' = 'mensual'): Suscripcion {
  return aplicarPagoAprobado(nuevaSuscripcion('u1', T(desde)), {
    plan: 'piloto',
    ciclo,
    montoCop: ciclo === 'mensual' ? 24_900 : 199_000,
    fundador: false,
    fuentePagoId: 'src_1',
    metodo: 'tarjeta',
    ahora: T(desde),
  });
}

describe('planes', () => {
  it('Cadete enseña pero no edita; Piloto sí', () => {
    expect(puede('cadete', 'editarContenido')).toBe(false);
    expect(puede('piloto', 'editarContenido')).toBe(true);
    expect(puede('piloto', 'bibliotecaPublicar')).toBe(false);
    expect(puede('comandante', 'bibliotecaPublicar')).toBe(true);
    expect(planMinimoPara('alertasTempranas')).toBe('piloto');
    expect(planMinimoPara('panelCapitan')).toBe('nave');
  });
  it('Cadete tiene una clase; Piloto ilimitadas', () => {
    expect(puedeCrearClase('cadete', 0)).toBe(true);
    expect(puedeCrearClase('cadete', 1)).toBe(false);
    expect(puedeCrearClase('piloto', 40)).toBe(true);
  });
  it('al bajar de plan, quedan editables las clases más recientes', () => {
    const ed = clasesEditables('cadete', [
      { id: 'vieja', creadaAt: 1 },
      { id: 'nueva', creadaAt: 2 },
    ]);
    expect([...ed]).toEqual(['nueva']);
  });
});

describe('precios', () => {
  it('desglosa el IVA incluido', () => {
    expect(desgloseIvaIncluido(24_900)).toEqual({ total: 24_900, base: 20_924, iva: 3_976 });
  });
  it('tarifa fundador solo en Piloto mensual', () => {
    expect(precioPlan('piloto', 'mensual', true)).toBe(19_900);
    expect(precioPlan('piloto', 'anioEscolar', true)).toBe(199_000);
  });
  it('Nave respeta el mínimo de estudiantes', () => {
    expect(cotizarNave(100).estudiantes).toBe(150);
    expect(cotizarNave(400).base).toBe(14_000_000);
  });
  it('formatea en pesos', () => {
    expect(formatoCop(1_234_567)).toBe('$1.234.567');
  });
});

describe('calendario', () => {
  it('Pascua y festivos de 2027', () => {
    expect(domingoDePascua(2027).toISOString().slice(0, 10)).toBe('2027-03-28');
    const f = festivosColombia(2027);
    expect(f.has('2027-03-25')).toBe(true); // Jueves Santo
    expect(f.has('2027-01-11')).toBe(true); // Reyes trasladado al lunes
    expect(f.has('2027-07-20')).toBe(true);
  });
  it('día hábil excluye fines de semana y festivos', () => {
    expect(esDiaHabil('2026-10-22')).toBe(true);
    expect(esDiaHabil('2026-10-24')).toBe(false);
    expect(esDiaHabil('2026-11-02')).toBe(false); // Todos los Santos trasladado
  });
  it('retracto: 5 días hábiles tras la compra', () => {
    // Compra jueves 22 oct 2026 → vie 23, mar 27 (lun 26 hábil), …
    const fin = finRetracto(T('2026-10-22'));
    expect(fechaBogota(fin)).toBe('2026-10-29');
  });
  it('fechas en hora de Bogotá', () => {
    expect(fechaBogota(Date.parse('2026-10-23T03:00:00Z'))).toBe('2026-10-22');
    expect(fechaBogota(inicioDiaBogota('2027-02-01'))).toBe('2027-02-01');
  });
  it('suma meses ajustando fin de mes', () => {
    expect(new Date(sumarMeses(Date.parse('2027-01-31T12:00:00Z'), 1)).toISOString().slice(0, 10)).toBe(
      '2027-02-28'
    );
  });
  it('regreso a clases en vacaciones', () => {
    expect(fechaBogota(regresoAClases(T('2026-12-10'))!)).toBe('2027-02-01');
    expect(regresoAClases(T('2027-05-10'))).toBeNull();
  });
  it('semana ISO y periodo', () => {
    expect(semanaIso(T('2026-10-22'))).toBe('2026-W43');
    expect(periodoActual(T('2027-05-02')).numero).toBe(2);
    expect(periodoActual(T('2027-01-10')).numero).toBe(4);
  });
});

describe('suscripción', () => {
  it('la prueba vale Piloto 14 días y luego baja a Cadete con aviso', () => {
    const s = nuevaSuscripcion('u1', T('2026-10-22'));
    expect(planEfectivo(s, T('2026-10-30'))).toBe('piloto');
    const aviso = cicloDiario(s, T('2026-11-03'));
    expect(aviso.acciones.map((a) => a.tipo)).toEqual(['aviso']);
    const fin = cicloDiario(aviso.sub, T('2026-11-06'));
    expect(fin.sub.estado).toBe('gratis');
    expect(planEfectivo(fin.sub, T('2026-11-06'))).toBe('cadete');
  });
  it('renovación mensual: cobra al vencer y encadena el periodo', () => {
    const s = pagado('2027-02-10');
    expect(planEfectivo(s, T('2027-03-01'))).toBe('piloto');
    const { acciones } = cicloDiario(s, T('2027-03-10', '13:00'));
    expect(acciones[0]).toMatchObject({ tipo: 'cobrar', montoCop: 24_900 });
    const renovada = aplicarPagoAprobado(s, {
      plan: 'piloto',
      ciclo: 'mensual',
      montoCop: 24_900,
      fundador: false,
      fuentePagoId: null,
      metodo: 'tarjeta',
      ahora: T('2027-03-09'),
    });
    expect(fechaBogota(renovada.finPeriodo!)).toBe('2027-04-10');
    expect(renovada.primerPagoAt).toBe(s.primerPagoAt);
  });
  it('mora: reintenta y tras la gracia baja a Cadete', () => {
    let s = aplicarPagoRechazado(pagado('2027-02-10'), T('2027-03-10'));
    expect(s.estado).toBe('en_mora');
    expect(planEfectivo(s, T('2027-03-12'))).toBe('piloto');
    s = aplicarPagoRechazado(s, T('2027-03-11'));
    s = aplicarPagoRechazado(s, T('2027-03-13'));
    const fin = cicloDiario(s, T('2027-03-18'));
    expect(fin.sub.estado).toBe('gratis');
    expect(fin.acciones.some((a) => a.tipo === 'degradado')).toBe(true);
  });
  it('cancelar dentro del retracto devuelve el pago', () => {
    const s = pagado('2026-10-22');
    expect(enRetracto(s, T('2026-10-28'))).toBe(true);
    const r = cancelar(s, T('2026-10-28'));
    expect(r.reembolsar).toBe(true);
    expect(r.sub.estado).toBe('gratis');
  });
  it('cancelar después conserva el plan hasta el fin del periodo', () => {
    const s = pagado('2027-02-10');
    const r = cancelar(s, T('2027-03-01'));
    expect(r.reembolsar).toBe(false);
    expect(planEfectivo(r.sub, T('2027-03-05'))).toBe('piloto');
    expect(cicloDiario(r.sub, T('2027-03-11')).sub.estado).toBe('gratis');
  });
  it('pausa en vacaciones congela los días pagados', () => {
    const s = pagado('2026-11-20');
    const p = pausar(s, inicioDiaBogota('2027-02-01'), T('2026-12-05'));
    expect(p.estado).toBe('pausada');
    expect(p.diasCongelados).toBe(15);
    expect(planEfectivo(p, T('2026-12-20'))).toBe('cadete');
    const { sub, cobrarAhora } = reanudar(p, T('2027-02-01'));
    expect(cobrarAhora).toBe(false);
    expect(Math.round((sub.finPeriodo! - T('2027-02-01')) / DIA_MS)).toBe(15);
  });
  it('el Año escolar no se pausa y avisa 7 días antes de renovar', () => {
    const s = pagado('2027-02-01', 'anioEscolar');
    expect(() => pausar(s, T('2027-03-01'), T('2027-02-10'))).toThrow();
    const { acciones } = cicloDiario(s, T('2028-01-27'));
    expect(acciones[0]).toMatchObject({ tipo: 'aviso', plantilla: 'renovacion_anual_pronto' });
    expect(cicloDiario(cicloDiario(s, T('2028-01-27')).sub, T('2028-01-28')).acciones).toEqual([]);
  });
});

describe('notas 1290', () => {
  it('convierte maestría en nota y desempeño', () => {
    expect(notaDesdeMaestria(0.8)).toBe(4.2);
    expect(desempenoDeNota(4.2)).toBe('alto');
    expect(desempenoDeNota(4.6)).toBe('superior');
    expect(desempenoDeNota(2.9)).toBe('bajo');
  });
  it('arma el CSV con observación', () => {
    const filas = construirNotas(
      [
        { nombre: 'Ana', maestriaPorCompetencia: { ahorro: 0.9, credito: 0.4 }, mundosCompletados: 2 },
        { nombre: 'Luis', maestriaPorCompetencia: {}, mundosCompletados: 0 },
      ],
      { etiquetaCompetencia: (id) => (id === 'ahorro' ? 'Ahorro' : 'Crédito') }
    );
    expect(filas[0].nota).toBe(3.6);
    expect(filas[0].observacion).toContain('refuerzo en Crédito');
    expect(filas[1].nota).toBeNull();
    const csv = notasCsv(filas, [{ id: 'ahorro', etiqueta: 'Ahorro' }], 2);
    expect(csv.split('\n')[1]).toBe('Ana;3,6;Básico;2;4,6;"Avanza en Ahorro; necesita refuerzo en Crédito."');
  });
});

describe('bitácora', () => {
  it('cuenta activos, alertas y tiempo ahorrado', () => {
    const ahora = T('2026-10-25', '19:00');
    const b = construirBitacora(
      [
        {
          cursoId: 'c1',
          nombre: '9A',
          quicesSemana: 20,
          asignacionesActivas: 1,
          mundoMasDificil: { nombre: 'Deudas', maestria: 0.55 },
          estudiantes: [
            { nombre: 'Ana', activo: true, ultimaActividad: ahora - DIA_MS, maestria: 0.8 },
            { nombre: 'Luis', activo: true, ultimaActividad: null, maestria: 0 },
            { nombre: 'Eva', activo: false, ultimaActividad: null, maestria: 0 },
          ],
        },
      ],
      '2026-W43',
      ahora
    );
    expect(b.estudiantes).toBe(2);
    expect(b.activosSemana).toBe(1);
    expect(b.alertas.map((a) => a.nombre)).toEqual(['Luis']);
    expect(b.minutosAhorrados).toBe(80);
    expect(b.siguientePaso).toBe('revisar_alertas');
  });
});

describe('lista CSV', () => {
  it('lee Excel pegado con encabezado y deduplica', () => {
    const r = leerLista('Nombre\tCorreo\nAna Pérez\tana@colegio.edu.co\nAna\tANA@colegio.edu.co\nLuis\tsin-correo\n');
    expect(r.invitados).toEqual([{ nombre: 'Ana Pérez', correo: 'ana@colegio.edu.co' }]);
    expect(r.duplicados).toBe(1);
    expect(r.errores).toHaveLength(1);
  });
});

describe('adopción', () => {
  it('señal de colegio con 3 profes activos', () => {
    const ahora = T('2027-05-01');
    const a = calcularAdopcion(
      ['p1', 'p2', 'p3'].map((p) => ({
        profesorUids: [p],
        estudiantes: 30,
        estudiantesActivos: 24,
        ultimaActividad: ahora - DIA_MS,
      })),
      ahora
    );
    expect(a.senalNave).toBe(true);
    expect(a.adopcion).toBeCloseTo(0.8);
    expect(a.cumpleMeta).toBe(true);
  });
});

describe('formato corto de minutos', () => {
  it('usa horas con coma decimal en mosaicos', () => {
    expect(formatoMinutosCorto(35)).toBe('35 min');
    expect(formatoMinutosCorto(166)).toBe('2,8 h');
    expect(formatoMinutosCorto(180)).toBe('3 h');
  });
});
