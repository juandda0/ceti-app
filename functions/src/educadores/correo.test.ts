import { construirBitacora, inicioDiaBogota, type PlantillaAviso } from './dominio';
import { construirCorreo, DONDE_GESTIONAR, encolarCorreo, fechaLarga, type PlantillaCorreo } from './correo';

const AVISOS: PlantillaAviso[] = [
  'fin_prueba_pronto',
  'renovacion_anual_pronto',
  'renovacion_manual_pronto',
  'pago_rechazado',
  'pausa_termina_pronto',
  'bajo_a_cadete',
];
const TODAS: PlantillaCorreo[] = [...AVISOS, 'recibo', 'reembolso_ops', 'bitacora'];

const FECHA = inicioDiaBogota('2026-11-03') + 10 * 60 * 60 * 1000;

test('fechaLarga en hora de Bogotá', () => {
  expect(fechaLarga(FECHA)).toBe('3 de noviembre de 2026');
  // 23:30 de Bogotá sigue siendo el mismo día aunque en UTC ya sea el siguiente.
  expect(fechaLarga(inicioDiaBogota('2026-11-03') + 23.5 * 60 * 60 * 1000)).toBe('3 de noviembre de 2026');
});

test.each(TODAS)('%s tiene asunto, texto, html y dice dónde gestionar el plan', (plantilla) => {
  const m = construirCorreo(plantilla, { fecha: FECHA, plan: 'piloto', ciclo: 'mensual', montoCop: 24_900 });
  expect(m.subject.length).toBeGreaterThan(5);
  expect(m.text).toContain(DONDE_GESTIONAR);
  expect(m.html).toContain('Perfil → Tu plan');
  expect(m.html.startsWith('<div')).toBe(true);
  // Sin urgencia falsa.
  expect(m.text).not.toMatch(/última oportunidad|urgente|perderás/i);
});

test('fin de prueba: la voz de Ceti', () => {
  const m = construirCorreo('fin_prueba_pronto', { fecha: FECHA, nombre: 'Marta' });
  expect(m.subject).toBe('Tu prueba de Piloto termina el 3 de noviembre de 2026');
  expect(m.text).toContain('Hola, Marta:');
  expect(m.text).toContain(
    'Tu prueba de Piloto termina el 3 de noviembre de 2026. Si no haces nada, sigues gratis con tu clase y no perdemos nada'
  );
});

test('renovación anual dice el precio con IVA y que se cancela en un toque', () => {
  const m = construirCorreo('renovacion_anual_pronto', {
    fecha: FECHA,
    plan: 'comandante',
    ciclo: 'anioEscolar',
    montoCop: 399_000,
  });
  expect(m.text).toContain('$399.000 con IVA incluido');
  expect(m.text).toContain('en un toque');
});

test('recibo con referencia, periodo y retracto', () => {
  const m = construirCorreo('recibo', {
    plan: 'piloto',
    ciclo: 'anioEscolar',
    montoCop: 199_000,
    referencia: 'ceti_abc_1',
    fecha: FECHA,
    finPeriodo: inicioDiaBogota('2027-11-03'),
  });
  expect(m.subject).toBe('Recibo de tu pago: Ceti Piloto Año escolar');
  expect(m.text).toContain('Referencia: ceti_abc_1');
  expect(m.text).toContain('3 de noviembre de 2027');
  expect(m.text).toContain('5 días hábiles');
});

test('reembolso a operaciones lleva lo necesario para devolver', () => {
  const m = construirCorreo('reembolso_ops', {
    uid: 'u1',
    email: 'profe@example.com',
    pagoId: 'dev_ceti_u1_1',
    referencia: 'ceti_u1_1',
    wompiTxId: 'tx_9',
    montoCop: 19_900,
    plan: 'piloto',
    ciclo: 'mensual',
    metodo: 'tarjeta',
  });
  expect(m.subject).toBe('Retracto: devolver $19.900 (ceti_u1_1)');
  for (const t of ['tx_9', 'profe@example.com', 'dev_ceti_u1_1', 'Ley 1480']) expect(m.text).toContain(t);
});

test('bitácora con alertas, minutos y tono', () => {
  const ahora = FECHA;
  const b = construirBitacora(
    [
      {
        cursoId: 'c1',
        nombre: '9A',
        quicesSemana: 10,
        asignacionesActivas: 1,
        mundoMasDificil: { nombre: 'Ahorro', maestria: 0.4 },
        estudiantes: [
          { nombre: 'Ana', activo: true, ultimaActividad: ahora - 1000, maestria: 0.8 },
          { nombre: '<Luis>', activo: true, ultimaActividad: null, maestria: 0 },
        ],
      },
    ],
    '2026-W45',
    ahora
  );
  const m = construirCorreo('bitacora', { bitacora: b });
  expect(m.text).toContain('1 de 2 estudiantes');
  expect(m.text).toContain('<Luis> (9A): aún no ha entrado');
  expect(m.text).toContain('Ahorro');
  // Escapa HTML de nombres.
  expect(m.html).toContain('&lt;Luis&gt;');
  expect(m.html).not.toContain('<Luis>');
});

test('encolarCorreo escribe en mail con el formato de Trigger Email', async () => {
  const add = jest.fn().mockResolvedValue({ id: 'm1' });
  const db = { collection: jest.fn(() => ({ add })) };
  const id = await encolarCorreo(db as never, { to: 'p@x.co', plantilla: 'bajo_a_cadete' });
  expect(id).toBe('m1');
  expect(db.collection).toHaveBeenCalledWith('mail');
  const doc = add.mock.calls[0][0];
  expect(Object.keys(doc).sort()).toEqual(['message', 'to']);
  expect(doc.to).toBe('p@x.co');
  expect(Object.keys(doc.message).sort()).toEqual(['html', 'subject', 'text']);
});

describe('invitacion_clase', () => {
  const datos = {
    clase: 'Finanzas 9A',
    profe: 'Profe Marta',
    enlace: 'https://ceti-d3769.web.app',
    correoInvitado: 'ana@colegio.edu.co',
  };

  it('le habla al estudiante con la clase, el profe, el enlace y el correo con el que entra', () => {
    const m = construirCorreo('invitacion_clase', datos);
    expect(m.subject).toBe('Profe Marta te invitó a Finanzas 9A en Ceti');
    expect(m.text).toContain('¡Hola!');
    expect(m.text).toContain('https://ceti-d3769.web.app');
    expect(m.text).toContain('inicia sesión con este mismo correo (ana@colegio.edu.co)');
    expect(m.html.startsWith('<div')).toBe(true);
  });

  it('no pide datos, no apura y no habla del plan del profe', () => {
    const m = construirCorreo('invitacion_clase', datos);
    expect(m.text).not.toMatch(/última oportunidad|urgente|perderás|ya mismo|hoy mismo/i);
    expect(m.text).not.toMatch(/contraseña|teléfono|celular|dirección|documento|edad|tarjeta|cédula/i);
    expect(m.text).not.toContain(DONDE_GESTIONAR);
    expect(m.text).toContain('No tienes que llenar nada más ni pagar nada.');
  });

  it('sin datos opcionales sigue siendo un correo completo', () => {
    const m = construirCorreo('invitacion_clase', {});
    expect(m.subject).toBe('Tu profe te invitó a su clase en Ceti');
    expect(m.text).toContain('inicia sesión con este mismo correo.');
  });

  it('escapa el HTML del nombre de la clase', () => {
    const m = construirCorreo('invitacion_clase', { ...datos, clase: '<9A>' });
    expect(m.html).toContain('&lt;9A&gt;');
    expect(m.html).not.toContain('<9A>');
  });
});

test('nave_cupo_ops lleva lo necesario para renovar o ampliar', () => {
  const m = construirCorreo('nave_cupo_ops', {
    colegioId: 'col1',
    colegio: 'Colegio Sol',
    licenciados: 300,
    ocupados: 301,
    tope: 330,
    fecha: FECHA,
    padrino: 'Banco',
  });
  expect(m.subject).toBe('Nave: Colegio Sol llegó a su cupo (301 de 300)');
  for (const t of ['col1', 'Tope con margen: 330', '3 de noviembre de 2026', 'Banco', 'activarLicenciaNave'])
    expect(m.text).toContain(t);
  expect(m.text).not.toContain(DONDE_GESTIONAR);
});
