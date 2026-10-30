jest.mock('firebase-functions/v2/https', () => ({
  onCall: (_options: unknown, handler?: unknown) => handler ?? _options,
  HttpsError: class HttpsError extends Error {
    code: string;
    details: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));
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
  construirResumenAcudiente,
  correoValido,
  fechaBogota,
  primerNombre,
  type PlanId,
} from './dominio';
// eslint-disable-next-line import/first
import {
  bajaDeEnlace,
  correrResumenAcudientes,
  enlaceAcudiente,
  gestionarAcudienteEnClase,
  generarToken,
  resumenDeEnlace,
  tokenConForma,
} from './acudientes';
// eslint-disable-next-line import/first
import { construirCorreo } from './correo';
// eslint-disable-next-line import/first
import { FirestoreFalso } from './firestoreFalso.test';

const DIA = 24 * 3600 * 1000;
// Miércoles 2027-01-13 15:00 Bogotá.
const AHORA = Date.UTC(2027, 0, 13, 20, 0, 0);
const CURSO = 'colegios/c1/cursos/k1';
const TOKEN = 'TokenDePrueba_123456789';

describe('dominio de acudientes', () => {
  test('primer nombre y correo', () => {
    expect(primerNombre('  Mariana López ')).toBe('Mariana');
    expect(primerNombre('')).toBe('Tu estudiante');
    expect(correoValido('papa@correo.co')).toBe(true);
    expect(correoValido('papa@correo')).toBe(false);
    expect(correoValido('a b@c.co')).toBe(false);
  });

  test('resumen sin notas: días, minutos, lecciones, mundos y constancia', () => {
    const r = construirResumenAcudiente({
      nombre: 'Mariana López',
      clase: '9°A',
      profe: 'Prof. Pérez',
      intentos: [
        { finAt: AHORA - DIA, duracionMs: 10 * 60000, tipo: 'leccion', resultado: 'completado' },
        { finAt: AHORA - DIA, duracionMs: 5 * 60000, tipo: 'jefe', resultado: 'completado' },
        { finAt: AHORA - 3 * DIA, duracionMs: 6 * 60000, tipo: 'leccion', resultado: 'perdido' },
        { finAt: AHORA - 10 * DIA, duracionMs: 60 * 60000, tipo: 'leccion', resultado: 'completado' },
      ],
      diasConVisita: [fechaBogota(AHORA), fechaBogota(AHORA - DIA), fechaBogota(AHORA - 15 * DIA)],
      mundos: [
        { nombre: 'Origen', empezado: true, conquistado: true },
        { nombre: 'Luna', empezado: true, conquistado: false },
        { nombre: 'Sol', empezado: false, conquistado: false },
      ],
      ahora: AHORA,
    });
    expect(r.nombre).toBe('Mariana');
    expect(r.semana).toMatchObject({ diasActivos: 3, minutos: 21, lecciones: 1, jefesGanados: 1 });
    expect(r.constancia.map((c) => c.dias)).toEqual([0, 1, 1, 3]);
    expect(r.mundos.map((m) => m.estado)).toEqual(['conquistado', 'en_curso', 'sin_empezar']);
    expect(r.conquistados).toBe(1);
    expect(JSON.stringify(r)).not.toMatch(/acierto|nota/i);
  });

  test('el correo dice por qué llega y cómo darse de baja', () => {
    const r = construirResumenAcudiente({
      nombre: 'Mariana López',
      clase: '9°A',
      profe: null,
      intentos: [],
      diasConVisita: [],
      mundos: [],
      ahora: AHORA,
    });
    const m = construirCorreo('resumen_acudiente', {
      resumen: r,
      enlace: 'https://x/acudiente/t',
      enlaceBaja: 'https://x/acudiente/t?baja=1',
    });
    expect(m.subject).toBe('Así va Mariana en Ceti esta semana');
    expect(m.text).toContain('no entró a 9°A');
    expect(m.text).toContain('https://x/acudiente/t?baja=1');
    expect(m.text).toContain('lo autorizaste');
    expect(m.text).not.toContain('Gestiona tu plan');
  });

  test('tokens aleatorios con forma de URL', () => {
    const t = generarToken();
    expect(tokenConForma(t)).toBe(true);
    expect(generarToken()).not.toBe(t);
    expect(tokenConForma('../x')).toBe(false);
    expect(enlaceAcudiente('https://app/', 'abc', true)).toBe('https://app/acudiente/abc?baja=1');
  });
});

function base(extra: Record<string, Record<string, unknown>> = {}): FirestoreFalso {
  return new FirestoreFalso({
    [CURSO]: { nombre: '9°A', profesorUids: ['profe'] },
    [`${CURSO}/config/comunicacion`]: { acudientes: { activo: true } },
    [`${CURSO}/estudiantes/ana`]: { nombre: 'Ana Ruiz', estado: 'activo' },
    [`${CURSO}/estudiantes/caro`]: { nombre: 'Caro Paz', estado: 'pendiente_atestacion' },
    ...extra,
  });
}

const comandante = { plan: 'comandante' as PlanId, ahora: AHORA, token: () => TOKEN };
const pedido = (accion: 'enlace' | 'revocar' | 'correo' | 'quitarCorreo', extra = {}) => ({
  colegioId: 'c1',
  cursoId: 'k1',
  uid: 'ana',
  accion,
  ...extra,
});
const deps = (plan: PlanId = 'comandante') => ({
  plan: async () => plan,
  nombreProfe: async () => 'Prof. Pérez',
});

describe('gestionarAcudienteEnClase', () => {
  test('crea el enlace una vez y lo reutiliza', async () => {
    const db = base();
    const r = await gestionarAcudienteEnClase(db as unknown as Firestore, 'profe', pedido('enlace'), comandante);
    expect(r).toEqual({ token: TOKEN, correo: null, correoActivo: false });
    expect(db.datos(`enlacesAcudiente/${TOKEN}`)).toMatchObject({ colegioId: 'c1', cursoId: 'k1', uid: 'ana', revocado: false });
    const otra = await gestionarAcudienteEnClase(db as unknown as Firestore, 'profe', pedido('enlace'), {
      ...comandante,
      token: () => 'OtroTokenQueNoDebeUsarse_1',
    });
    expect(otra.token).toBe(TOKEN);
  });

  test('guarda el correo solo con la autorización del acudiente', async () => {
    const db = base();
    await expect(
      gestionarAcudienteEnClase(db as unknown as Firestore, 'profe', pedido('correo', { correo: 'Papa@Correo.co' }), comandante)
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(
      gestionarAcudienteEnClase(db as unknown as Firestore, 'profe', pedido('correo', { correo: 'malo', autorizado: true }), comandante)
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await gestionarAcudienteEnClase(
      db as unknown as Firestore,
      'profe',
      pedido('correo', { correo: ' Papa@Correo.co ', autorizado: true }),
      comandante
    );
    expect(r).toEqual({ token: TOKEN, correo: 'papa@correo.co', correoActivo: true });
    expect(db.datos(`${CURSO}/estudiantes/ana/acudiente/datos`)).toMatchObject({
      correo: 'papa@correo.co',
      correoActivo: true,
      correoAutorizadoPor: 'profe',
      politicaVersion: 'acudiente-correo-2026-10',
    });
  });

  test('pide plan, autorización del estudiante y la clase activada', async () => {
    await expect(
      gestionarAcudienteEnClase(base() as unknown as Firestore, 'profe', pedido('enlace'), { ...comandante, plan: 'piloto' })
    ).rejects.toMatchObject({ details: { codigo: 'requiere_plan', funcion: 'resumenAcudientes' } });
    await expect(
      gestionarAcudienteEnClase(base() as unknown as Firestore, 'profe', { ...pedido('enlace'), uid: 'caro' }, comandante)
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    const apagada = base({ [`${CURSO}/config/comunicacion`]: { acudientes: { activo: false } } });
    await expect(
      gestionarAcudienteEnClase(apagada as unknown as Firestore, 'profe', pedido('enlace'), comandante)
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(
      gestionarAcudienteEnClase(base() as unknown as Firestore, 'otro', pedido('enlace'), comandante)
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('revocar corta el enlace y el correo, aun sin plan', async () => {
    const db = base();
    await gestionarAcudienteEnClase(db as unknown as Firestore, 'profe', pedido('correo', { correo: 'p@c.co', autorizado: true }), comandante);
    const r = await gestionarAcudienteEnClase(db as unknown as Firestore, 'profe', pedido('revocar'), {
      ...comandante,
      plan: 'cadete',
    });
    expect(r).toEqual({ token: null, correo: null, correoActivo: false });
    expect(db.datos(`enlacesAcudiente/${TOKEN}`)).toMatchObject({ revocado: true });
    await expect(resumenDeEnlace(db as unknown as Firestore, TOKEN, deps(), AHORA)).rejects.toMatchObject({
      code: 'not-found',
    });
  });
});

describe('resumen por enlace', () => {
  async function conEnlace(extra: Record<string, Record<string, unknown>> = {}) {
    const db = base({
      [`${CURSO}/estudiantes/ana/intentos/i1`]: {
        finAt: AHORA - DIA,
        duracionMs: 12 * 60000,
        tipo: 'leccion',
        resultado: 'completado',
      },
      [`${CURSO}/estudiantes/ana/visitas/${fechaBogota(AHORA)}`]: { visitas: 2, ultimaAt: AHORA },
      [`${CURSO}/estudiantes/ana/progress/world_1`]: { completed: true },
      [`${CURSO}/estudiantes/ana/resumen/clase`]: { porMundo: { world_2: { intentos: 3, conquistadoAt: null } } },
      ...extra,
    });
    await gestionarAcudienteEnClase(db as unknown as Firestore, 'profe', pedido('enlace'), comandante);
    return db;
  }

  test('muestra avance y constancia con los mundos por defecto', async () => {
    const db = await conEnlace();
    const r = await resumenDeEnlace(db as unknown as Firestore, TOKEN, deps(), AHORA);
    expect(r.nombre).toBe('Ana');
    expect(r.profe).toBe('Prof. Pérez');
    expect(r.semana).toMatchObject({ diasActivos: 2, minutos: 12, lecciones: 1 });
    expect(r.mundos.slice(0, 3)).toEqual([
      { nombre: 'Planeta Origen', estado: 'conquistado' },
      { nombre: 'Luna del Presupuesto', estado: 'en_curso' },
      { nombre: 'Estrella del Ahorro', estado: 'sin_empezar' },
    ]);
  });

  test('deja de funcionar si el estudiante sale, la clase lo apaga o el plan baja', async () => {
    const db = await conEnlace();
    await expect(resumenDeEnlace(db as unknown as Firestore, TOKEN, deps('piloto'), AHORA)).rejects.toMatchObject({ code: 'not-found' });
    db.docs.set(`${CURSO}/config/comunicacion`, { acudientes: { activo: false } });
    await expect(resumenDeEnlace(db as unknown as Firestore, TOKEN, deps(), AHORA)).rejects.toMatchObject({ code: 'not-found' });
    db.docs.set(`${CURSO}/config/comunicacion`, { acudientes: { activo: true } });
    db.docs.set(`${CURSO}/estudiantes/ana`, { nombre: 'Ana Ruiz', estado: 'retirado' });
    await expect(resumenDeEnlace(db as unknown as Firestore, TOKEN, deps(), AHORA)).rejects.toMatchObject({ code: 'not-found' });
    await expect(resumenDeEnlace(db as unknown as Firestore, 'no-existe-este-token-xx', deps(), AHORA)).rejects.toMatchObject({ code: 'not-found' });
  });

  test('el domingo encola un correo por acudiente, una vez por semana, y respeta la baja', async () => {
    const db = await conEnlace();
    await gestionarAcudienteEnClase(db as unknown as Firestore, 'profe', pedido('correo', { correo: 'p@c.co', autorizado: true }), comandante);
    const c1 = await correrResumenAcudientes(AHORA, db as unknown as Firestore, deps(), 'https://app');
    expect(c1).toEqual({ enviados: 1, yaEnviados: 0, inactivos: 0 });
    const mails = [...db.docs.entries()].filter(([p]) => p.startsWith('mail/'));
    expect(mails).toHaveLength(1);
    const mail = mails[0][1] as { to: string; message: { subject: string; text: string } };
    expect(mail.to).toBe('p@c.co');
    expect(mail.message.subject).toBe('Así va Ana en Ceti esta semana');
    expect(mail.message.text).toContain(`https://app/acudiente/${TOKEN}?baja=1`);

    const c2 = await correrResumenAcudientes(AHORA + 3600_000, db as unknown as Firestore, deps(), 'https://app');
    expect(c2.enviados).toBe(0);

    await bajaDeEnlace(db as unknown as Firestore, TOKEN, AHORA);
    const c3 = await correrResumenAcudientes(AHORA + 7 * DIA, db as unknown as Firestore, deps(), 'https://app');
    expect(c3).toEqual({ enviados: 0, yaEnviados: 0, inactivos: 0 });
  });
});
