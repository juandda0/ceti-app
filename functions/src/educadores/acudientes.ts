/**
 * Fase 5 — resumen semanal para acudientes (dominio/acudientes.ts).
 *
 * - `enlacesAcudiente/{token}`: token aleatorio (144 bits) → estudiante y clase.
 *   Solo el servidor lo lee; el acudiente abre `/acudiente/{token}` sin cuenta.
 * - `cursos/{k}/estudiantes/{uid}/acudiente/datos`: el token vigente y, si el
 *   profe lo guardó con la autorización del acudiente, su correo. Lo lee solo el
 *   profe de la clase; lo escribe solo este módulo.
 *
 * El enlace solo muestra algo mientras: la clase tenga el resumen activado
 * (`config/comunicacion.acudientes.activo`), el profe tenga Comandante o Nave,
 * el estudiante siga activo (autorización confirmada) y el enlace no se haya
 * revocado. La supresión de datos (Ley 1581) borra todo esto.
 */
import { randomBytes } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  POLITICA_CORREO_ACUDIENTE,
  FUNCION_ACUDIENTES,
  construirResumenAcudiente,
  correoValido,
  fechaBogota,
  puede,
  semanaIso,
  type IntentoAcudiente,
  type PlanId,
  type ResumenAcudiente,
} from './dominio';
import { planDeProfe } from './plan';
import { NOMBRES_MUNDOS_POR_DEFECTO, nombreDeMundo } from './bitacoraSemanal';
import { encolarCorreo } from './correo';
import { URL_APP } from './invitaciones';

export const COL_ENLACES = 'enlacesAcudiente';
const DIA_MS = 24 * 60 * 60 * 1000;
const VENTANA_MS = 28 * DIA_MS;

export function generarToken(): string {
  return randomBytes(18).toString('base64url');
}

export function tokenConForma(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(v);
}

const rutaDatos = (colegioId: string, cursoId: string, uid: string) =>
  `colegios/${colegioId}/cursos/${cursoId}/estudiantes/${uid}/acudiente/datos`;

export function enlaceAcudiente(base: string, token: string, baja = false): string {
  return `${base.replace(/\/+$/, '')}/acudiente/${token}${baja ? '?baja=1' : ''}`;
}

/** ¿La clase tiene el resumen para acudientes encendido? */
async function claseConResumen(db: Firestore, colegioId: string, cursoId: string): Promise<boolean> {
  const c = await db.doc(`colegios/${colegioId}/cursos/${cursoId}/config/comunicacion`).get();
  const acudientes = c.exists ? (c.get('acudientes') as { activo?: unknown } | undefined) : undefined;
  return acudientes?.activo === true;
}

// ── Lo que hace el profe ─────────────────────────────────────────────────────

export type AccionAcudiente = 'enlace' | 'revocar' | 'correo' | 'quitarCorreo';

export interface EstadoAcudiente {
  token: string | null;
  correo: string | null;
  correoActivo: boolean;
}

export async function gestionarAcudienteEnClase(
  db: Firestore,
  profeUid: string,
  pedido: {
    colegioId: string;
    cursoId: string;
    uid: string;
    accion: AccionAcudiente;
    correo?: unknown;
    autorizado?: unknown;
  },
  deps: { plan: PlanId; ahora?: number; token?: () => string }
): Promise<EstadoAcudiente> {
  const { colegioId, cursoId, uid, accion } = pedido;
  const ahora = deps.ahora ?? Date.now();
  const base = `colegios/${colegioId}/cursos/${cursoId}`;
  const [curso, est, datosSnap] = await Promise.all([
    db.doc(base).get(),
    db.doc(`${base}/estudiantes/${uid}`).get(),
    db.doc(rutaDatos(colegioId, cursoId, uid)).get(),
  ]);
  if (!curso.exists || !((curso.get('profesorUids') ?? []) as string[]).includes(profeUid)) {
    throw new HttpsError('permission-denied', 'Not a teacher of this course.');
  }
  const datosRef = db.doc(rutaDatos(colegioId, cursoId, uid));
  const actual = {
    token: tokenConForma(datosSnap.get('token')) ? (datosSnap.get('token') as string) : null,
    correo: typeof datosSnap.get('correo') === 'string' ? (datosSnap.get('correo') as string) : null,
  };

  // Cortar es siempre posible, con cualquier plan y en cualquier estado.
  if (accion === 'revocar') {
    if (actual.token) await db.doc(`${COL_ENLACES}/${actual.token}`).set({ revocado: true, revocadoAt: ahora }, { merge: true });
    await datosRef.set({ token: null, correo: null, correoActivo: false, actualizadoAt: ahora }, { merge: true });
    return { token: null, correo: null, correoActivo: false };
  }
  if (accion === 'quitarCorreo') {
    await datosRef.set({ correo: null, correoActivo: false, actualizadoAt: ahora }, { merge: true });
    return { token: actual.token, correo: null, correoActivo: false };
  }

  if (!puede(deps.plan, FUNCION_ACUDIENTES)) {
    throw new HttpsError('failed-precondition', 'El resumen para acudientes viene con Comandante.', {
      codigo: 'requiere_plan',
      funcion: FUNCION_ACUDIENTES,
      plan: deps.plan,
    });
  }
  if (est.get('estado') !== 'activo') {
    throw new HttpsError(
      'failed-precondition',
      'Primero confirma la autorización de datos de este estudiante.'
    );
  }
  if (!(await claseConResumen(db, colegioId, cursoId))) {
    throw new HttpsError('failed-precondition', 'Activa el resumen para acudientes de esta clase.');
  }

  let token = actual.token;
  if (token) {
    const enlace = await db.doc(`${COL_ENLACES}/${token}`).get();
    if (!enlace.exists || enlace.get('revocado') === true) token = null;
  }
  if (!token) {
    token = (deps.token ?? generarToken)();
    await db.doc(`${COL_ENLACES}/${token}`).set({
      colegioId,
      cursoId,
      uid,
      profeUid,
      creadoAt: ahora,
      revocado: false,
    });
    await datosRef.set({ token, creadoAt: ahora, actualizadoAt: ahora }, { merge: true });
  }

  if (accion === 'correo') {
    if (!correoValido(pedido.correo)) {
      throw new HttpsError('invalid-argument', 'Ese correo no parece válido.');
    }
    if (pedido.autorizado !== true) {
      throw new HttpsError(
        'failed-precondition',
        'Confirma que el acudiente autorizó recibir el resumen en ese correo.'
      );
    }
    const correo = pedido.correo.trim().toLowerCase();
    await datosRef.set(
      {
        correo,
        correoActivo: true,
        correoAutorizadoAt: ahora,
        correoAutorizadoPor: profeUid,
        politicaVersion: POLITICA_CORREO_ACUDIENTE,
        bajaAt: null,
        actualizadoAt: ahora,
      },
      { merge: true }
    );
    return { token, correo, correoActivo: true };
  }
  return {
    token,
    correo: actual.correo,
    correoActivo: datosSnap.get('correoActivo') === true,
  };
}

// ── Lo que ve el acudiente ───────────────────────────────────────────────────

export interface DepsResumen {
  plan: (profeUid: string, colegioId: string) => Promise<PlanId>;
  nombreProfe: (profeUid: string) => Promise<string | null>;
}

interface EnlaceVigente {
  token: string;
  colegioId: string;
  cursoId: string;
  uid: string;
  profeUid: string;
}

const NO_ACTIVO = 'Este enlace ya no está activo. Pídele uno nuevo al profe.';

async function enlaceVigente(db: Firestore, token: unknown, deps: DepsResumen): Promise<EnlaceVigente> {
  if (!tokenConForma(token)) throw new HttpsError('not-found', NO_ACTIVO);
  const e = await db.doc(`${COL_ENLACES}/${token}`).get();
  if (!e.exists || e.get('revocado') === true) throw new HttpsError('not-found', NO_ACTIVO);
  const v = {
    token,
    colegioId: e.get('colegioId') as string,
    cursoId: e.get('cursoId') as string,
    uid: e.get('uid') as string,
    profeUid: e.get('profeUid') as string,
  };
  const base = `colegios/${v.colegioId}/cursos/${v.cursoId}`;
  const [curso, est] = await Promise.all([
    db.doc(base).get(),
    db.doc(`${base}/estudiantes/${v.uid}`).get(),
  ]);
  if (
    !curso.exists ||
    curso.get('archivada') === true ||
    est.get('estado') !== 'activo' ||
    !(await claseConResumen(db, v.colegioId, v.cursoId)) ||
    !puede(await deps.plan(v.profeUid, v.colegioId), FUNCION_ACUDIENTES)
  ) {
    throw new HttpsError('not-found', NO_ACTIVO);
  }
  return v;
}

export async function resumenDeEnlace(
  db: Firestore,
  token: unknown,
  deps: DepsResumen,
  ahora = Date.now()
): Promise<ResumenAcudiente> {
  const v = await enlaceVigente(db, token, deps);
  const base = `colegios/${v.colegioId}/cursos/${v.cursoId}`;
  const est = `${base}/estudiantes/${v.uid}`;
  const [curso, roster, config, resumen, intentos, visitas, progreso, profe] = await Promise.all([
    db.doc(base).get(),
    db.doc(est).get(),
    db.doc(`${base}/config/mundos`).get(),
    db.doc(`${est}/resumen/clase`).get(),
    db.collection(`${est}/intentos`).where('finAt', '>=', ahora - VENTANA_MS).get(),
    db.collection(`${est}/visitas`).get(),
    db.collection(`${est}/progress`).get(),
    deps.nombreProfe(v.profeUid),
  ]);

  const mundosConfig = config.exists
    ? ((config.get('mundos') as { worldId?: unknown; nombre?: unknown; activo?: unknown }[]) ?? null)
    : null;
  const visibles =
    Array.isArray(mundosConfig) && mundosConfig.length > 0
      ? mundosConfig
          .filter((m) => m?.activo === true && typeof m.worldId === 'string')
          .map((m) => m.worldId as string)
      : Object.keys(NOMBRES_MUNDOS_POR_DEFECTO);
  const porMundo = (resumen.exists ? resumen.get('porMundo') : null) as
    | Record<string, { intentos?: number; conquistadoAt?: number | null }>
    | null;
  const completados = new Set(progreso.docs.filter((p) => p.get('completed') === true).map((p) => p.id));
  const empezados = new Set(progreso.docs.map((p) => p.id));

  const desde = fechaBogota(ahora - VENTANA_MS);
  return construirResumenAcudiente({
    nombre: typeof roster.get('nombre') === 'string' ? (roster.get('nombre') as string) : '',
    clase: typeof curso.get('nombre') === 'string' ? (curso.get('nombre') as string) : '',
    profe,
    intentos: intentos.docs.map((s) => ({
      finAt: Number(s.get('finAt')) || 0,
      duracionMs: Number(s.get('duracionMs')) || 0,
      tipo: s.get('tipo') === 'jefe' ? 'jefe' : 'leccion',
      resultado: s.get('resultado') === 'completado' ? 'completado' : 'perdido',
    })) as IntentoAcudiente[],
    // Días con visita o con avance de un mundo (como el Análisis de la clase).
    diasConVisita: [
      ...visitas.docs.map((s) => s.id),
      ...progreso.docs
        .map((p) => p.get('updatedAt'))
        .filter((t): t is number => typeof t === 'number')
        .map((t) => fechaBogota(t)),
    ].filter((d) => d >= desde),
    mundos: visibles.map((w) => ({
      nombre: nombreDeMundo(w, mundosConfig),
      empezado: empezados.has(w) || (porMundo?.[w]?.intentos ?? 0) > 0,
      conquistado: completados.has(w) || typeof porMundo?.[w]?.conquistadoAt === 'number',
    })),
    ahora,
  });
}

/** "Dejar de recibir": apaga el correo de ese acudiente (el enlace sigue). */
export async function bajaDeEnlace(db: Firestore, token: unknown, ahora = Date.now()): Promise<void> {
  if (!tokenConForma(token)) throw new HttpsError('not-found', NO_ACTIVO);
  const e = await db.doc(`${COL_ENLACES}/${token}`).get();
  if (!e.exists) throw new HttpsError('not-found', NO_ACTIVO);
  await db
    .doc(rutaDatos(e.get('colegioId'), e.get('cursoId'), e.get('uid')))
    .set({ correoActivo: false, bajaAt: ahora, actualizadoAt: ahora }, { merge: true });
}

// ── Correo del domingo ───────────────────────────────────────────────────────

export async function correrResumenAcudientes(
  ahora = Date.now(),
  db: Firestore = getFirestore(),
  deps: DepsResumen = depsReales(db),
  urlApp = URL_APP.value()
) {
  const semana = semanaIso(ahora);
  const cuenta = { enviados: 0, yaEnviados: 0, inactivos: 0 };
  const pendientes = await db.collectionGroup('acudiente').where('correoActivo', '==', true).get();
  for (const d of pendientes.docs) {
    if (d.id !== 'datos') continue;
    if (d.get('semanaEnviada') === semana) {
      cuenta.yaEnviados += 1;
      continue;
    }
    const token = d.get('token');
    const correo = d.get('correo');
    if (!tokenConForma(token) || typeof correo !== 'string') continue;
    try {
      const resumen = await resumenDeEnlace(db, token, deps, ahora);
      await encolarCorreo(db, {
        to: correo,
        plantilla: 'resumen_acudiente',
        datos: {
          resumen,
          enlace: enlaceAcudiente(urlApp, token),
          enlaceBaja: enlaceAcudiente(urlApp, token, true),
        },
      });
      await d.ref.set({ semanaEnviada: semana, ultimoEnvioAt: ahora }, { merge: true });
      cuenta.enviados += 1;
    } catch (e) {
      // Clase apagada, plan vencido o estudiante retirado: este domingo no sale.
      cuenta.inactivos += 1;
      if (!(e instanceof HttpsError)) console.error('resumenAcudientes: falló uno', String(e));
    }
  }
  console.log('resumenAcudientes: corrida', cuenta);
  return cuenta;
}

function depsReales(db: Firestore): DepsResumen {
  return {
    plan: (profeUid, colegioId) => planDeProfe(profeUid, colegioId, Date.now(), db),
    nombreProfe: async (profeUid) => {
      try {
        return (await getAuth().getUser(profeUid)).displayName ?? null;
      } catch {
        return null;
      }
    },
  };
}

// ── Callables y programada ───────────────────────────────────────────────────

const ACCIONES: readonly AccionAcudiente[] = ['enlace', 'revocar', 'correo', 'quitarCorreo'];

/** El profe crea o corta el enlace del acudiente de un estudiante, o guarda su correo. */
export const gestionarAcudiente = onCall(async (request): Promise<EstadoAcudiente> => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (caller.token.role !== 'profesor') {
    throw new HttpsError('permission-denied', 'Solo el profe de la clase.');
  }
  const { colegioId, cursoId, uid, accion } = (request.data ?? {}) as Record<string, unknown>;
  if (
    typeof colegioId !== 'string' ||
    typeof cursoId !== 'string' ||
    typeof uid !== 'string' ||
    !ACCIONES.includes(accion as AccionAcudiente)
  ) {
    throw new HttpsError('invalid-argument', 'Faltan datos.');
  }
  if (caller.token.colegioId !== colegioId) {
    throw new HttpsError('permission-denied', 'Outside your colegio.');
  }
  const db = getFirestore();
  return gestionarAcudienteEnClase(
    db,
    caller.uid,
    {
      colegioId,
      cursoId,
      uid,
      accion: accion as AccionAcudiente,
      correo: request.data?.correo,
      autorizado: request.data?.autorizado,
    },
    { plan: await planDeProfe(caller.uid, colegioId, Date.now(), db) }
  );
});

/** Sin cuenta: lo que ve el acudiente con su enlace. */
export const verResumenAcudiente = onCall(async (request): Promise<ResumenAcudiente> => {
  const db = getFirestore();
  return resumenDeEnlace(db, request.data?.token, depsReales(db));
});

/** Sin cuenta: "dejar de recibir el correo". */
export const bajaAcudiente = onCall(async (request): Promise<{ ok: true }> => {
  await bajaDeEnlace(getFirestore(), request.data?.token);
  return { ok: true };
});

export const resumenAcudientesSemanal = onSchedule(
  { schedule: 'every sunday 18:00', timeZone: 'America/Bogota', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    await correrResumenAcudientes();
  }
);
