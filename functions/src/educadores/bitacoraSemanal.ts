/**
 * Bitácora del domingo (E5): cada domingo a las 19:00 (Bogotá) arma el resumen
 * semanal de cada profe, lo guarda en `bitacoras/{uid}/semanas/{semanaIso}` (la
 * app lo muestra) y lo encola por correo salvo que el profe lo haya apagado
 * (`suscripciones/{uid}.correoBitacora === false`).
 *
 * Solo lee datos de curso que el profe ya ve en su tablero: roster, progreso y
 * el agregado `agregados/resumen`. Nunca el juego individual del estudiante
 * (contrato B).
 *
 * Trabajo acotado por corrida (páginas de profes, concurrencia y presupuesto de
 * tiempo) e idempotente: si la Bitácora de la semana ya existe, se salta, así
 * que una nueva corrida continúa donde quedó la anterior. Un error con un profe
 * no detiene a los demás.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getAuth } from 'firebase-admin/auth';
import { FieldPath, getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  construirBitacora,
  semanaIso,
  DIA_MS,
  type CursoBitacora,
  type EstudianteBitacora,
} from './dominio';
import { asegurarSuscripcion, refSuscripcion } from './plan';
import { encolarCorreo } from './correo';

export const PROFES_POR_PAGINA = 100;
export const MAX_PROFES_POR_CORRIDA = 2000;
export const MAX_CURSOS_POR_PROFE = 30;
export const CONCURRENCIA = 8;
/** La función tiene 540 s; se deja margen para terminar lo que esté en curso. */
export const PRESUPUESTO_MS = 420_000;

/**
 * Nombres de los mundos por defecto (copia de WORLD_DEFS en
 * src/features/learning/data/worldMeta.ts, que el servidor no puede importar).
 * La configuración de la clase (`config/mundos`) los reemplaza si los renombró.
 */
export const NOMBRES_MUNDOS_POR_DEFECTO: Record<string, string> = {
  world_1: 'Planeta Origen',
  world_2: 'Luna del Presupuesto',
  world_3: 'Estrella del Ahorro',
  world_4: 'Nebulosa del Crédito',
  world_5: 'Agujero Negro de las Deudas',
};

// ---------------------------------------------------------------------------
// Transformación pura: datos de Firestore → CursoBitacora.
// ---------------------------------------------------------------------------

export interface DatosCurso {
  cursoId: string;
  nombre: string;
  roster: { uid: string; nombre?: unknown; estado?: unknown }[];
  /** Docs de `estudiantes/{uid}/progress/*` de la clase. */
  progreso: { uid?: unknown; mastery?: unknown; updatedAt?: unknown }[];
  /** `agregados/resumen.porMundo`, si existe. */
  porMundo?: Record<string, { masteryPromedio?: unknown; estudiantes?: unknown }> | null;
  /** Entradas de `config/mundos.mundos`, si existe. */
  mundosConfig?: { worldId?: unknown; nombre?: unknown }[] | null;
  asignaciones: { fechaInicio?: unknown; deadline?: unknown }[];
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function nombreDeMundo(worldId: string, mundosConfig?: DatosCurso['mundosConfig']): string {
  const propio = mundosConfig?.find((m) => m.worldId === worldId)?.nombre;
  if (typeof propio === 'string' && propio.trim()) return propio.trim();
  return NOMBRES_MUNDOS_POR_DEFECTO[worldId] ?? worldId;
}

/**
 * Arma el curso para `construirBitacora`. Quices de la semana: progreso del
 * mundo actualizado en los últimos 7 días (cada quiz terminado reescribe el doc
 * del mundo; dos quices del mismo mundo en la semana cuentan como uno, así que
 * es una cota inferior). Los estudiantes suprimidos no aparecen.
 */
export function cursoParaBitacora(d: DatosCurso, ahora: number): CursoBitacora {
  const desde = ahora - 7 * DIA_MS;
  const roster = d.roster.filter((e) => e.estado !== 'suprimido');
  const enRoster = new Set(roster.map((e) => e.uid));

  const porUid = new Map<string, { ultima: number | null; masteries: number[] }>();
  let quicesSemana = 0;
  for (const p of d.progreso) {
    if (typeof p.uid !== 'string' || !enRoster.has(p.uid)) continue;
    const acc = porUid.get(p.uid) ?? { ultima: null, masteries: [] };
    const actualizado = num(p.updatedAt);
    if (actualizado !== null) {
      acc.ultima = acc.ultima === null ? actualizado : Math.max(acc.ultima, actualizado);
      if (actualizado >= desde && actualizado <= ahora) quicesSemana += 1;
    }
    const m = num(p.mastery);
    if (m !== null) acc.masteries.push(m);
    porUid.set(p.uid, acc);
  }

  const estudiantes: EstudianteBitacora[] = roster.map((e) => {
    const acc = porUid.get(e.uid);
    const masteries = acc?.masteries ?? [];
    return {
      nombre: typeof e.nombre === 'string' && e.nombre ? e.nombre : 'Estudiante',
      activo: e.estado === 'activo',
      ultimaActividad: acc?.ultima ?? null,
      maestria:
        masteries.length === 0 ? 0 : masteries.reduce((a, b) => a + b, 0) / masteries.length,
    };
  });

  let mundoMasDificil: CursoBitacora['mundoMasDificil'] = null;
  for (const [worldId, m] of Object.entries(d.porMundo ?? {})) {
    const maestria = num(m?.masteryPromedio);
    if (maestria === null || (num(m?.estudiantes) ?? 0) <= 0) continue;
    if (mundoMasDificil === null || maestria < mundoMasDificil.maestria) {
      mundoMasDificil = { nombre: nombreDeMundo(worldId, d.mundosConfig), maestria };
    }
  }

  const asignacionesActivas = d.asignaciones.filter((a) => {
    const inicio = num(a.fechaInicio);
    const fin = num(a.deadline);
    return inicio !== null && fin !== null && inicio <= ahora && ahora < fin;
  }).length;

  return {
    cursoId: d.cursoId,
    nombre: d.nombre,
    estudiantes,
    quicesSemana,
    mundoMasDificil,
    asignacionesActivas,
  };
}

// ---------------------------------------------------------------------------
// Lectura y escritura.
// ---------------------------------------------------------------------------

async function datosDeCurso(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  nombre: string
): Promise<DatosCurso> {
  const base = `colegios/${colegioId}/cursos/${cursoId}`;
  const [roster, progreso, resumen, config, asignaciones] = await Promise.all([
    db.collection(`${base}/estudiantes`).select('nombre', 'estado').get(),
    db
      .collectionGroup('progress')
      .where('colegioId', '==', colegioId)
      .where('cursoId', '==', cursoId)
      .select('uid', 'mastery', 'updatedAt')
      .get(),
    db.doc(`${base}/agregados/resumen`).get(),
    db.doc(`${base}/config/mundos`).get(),
    db
      .collection(`colegios/${colegioId}/asignaciones`)
      .where('target.cursoId', '==', cursoId)
      .select('fechaInicio', 'deadline')
      .get(),
  ]);
  return {
    cursoId,
    nombre,
    roster: roster.docs.map((s) => ({
      uid: s.id,
      nombre: s.get('nombre'),
      estado: s.get('estado'),
    })),
    progreso: progreso.docs.map((s) => ({
      uid: s.get('uid') ?? s.ref.parent.parent?.id,
      mastery: s.get('mastery'),
      updatedAt: s.get('updatedAt'),
    })),
    porMundo: resumen.exists ? (resumen.get('porMundo') ?? null) : null,
    mundosConfig: config.exists ? (config.get('mundos') ?? null) : null,
    asignaciones: asignaciones.docs.map((s) => ({
      fechaInicio: s.get('fechaInicio'),
      deadline: s.get('deadline'),
    })),
  };
}

export type ResultadoProfe = 'escrita' | 'ya_existia' | 'sin_colegio';

/** Genera, guarda y encola la Bitácora de un profe. */
export async function bitacoraDeProfe(
  db: Firestore,
  profe: { uid: string; colegioId: string | null; email: string | null; nombre: string | null },
  ahora: number
): Promise<ResultadoProfe> {
  if (!profe.colegioId) return 'sin_colegio';
  const semana = semanaIso(ahora);
  const ref = db.doc(`bitacoras/${profe.uid}/semanas/${semana}`);
  const [existente, sub] = await Promise.all([ref.get(), refSuscripcion(profe.uid, db).get()]);
  if (existente.exists) return 'ya_existia';
  // Red de seguridad: un profe de antes del cobro recibe aquí su prueba si aún
  // no inició sesión desde entonces.
  if (!sub.exists) await asegurarSuscripcion(profe.uid, db);

  const cursos = await db
    .collection(`colegios/${profe.colegioId}/cursos`)
    .where('profesorUids', 'array-contains', profe.uid)
    .limit(MAX_CURSOS_POR_PROFE)
    .get();
  const datos = await Promise.all(
    cursos.docs.map((c) =>
      datosDeCurso(db, profe.colegioId!, c.id, (c.get('nombre') as string) || 'Mi clase')
    )
  );
  const bitacora = construirBitacora(
    datos.map((d) => cursoParaBitacora(d, ahora)),
    semana,
    ahora
  );

  const quiereCorreo = sub.get('correoBitacora') !== false;
  const correo = !quiereCorreo ? 'apagado' : profe.email ? 'encolado' : 'sin_correo';
  await ref.set({ ...bitacora, correo });
  if (correo === 'encolado') {
    await encolarCorreo(db, {
      to: profe.email!,
      plantilla: 'bitacora',
      datos: { nombre: profe.nombre, bitacora },
    });
  }
  return 'escrita';
}

/** Corre la tarea sobre lotes con concurrencia acotada. */
async function enLotes<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += n) {
    await Promise.all(items.slice(i, i + n).map(fn));
  }
}

export async function correrBitacoraSemanal(ahora = Date.now(), db: Firestore = getFirestore()) {
  const inicio = Date.now();
  const cuenta = { escritas: 0, yaExistian: 0, omitidas: 0, errores: 0, profes: 0 };
  let ultimo: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (cuenta.profes < MAX_PROFES_POR_CORRIDA && Date.now() - inicio < PRESUPUESTO_MS) {
    let q = db
      .collection('membership')
      .where('role', '==', 'profesor')
      .orderBy(FieldPath.documentId())
      .limit(PROFES_POR_PAGINA);
    if (ultimo) q = q.startAfter(ultimo);
    const pagina = await q.get();
    if (pagina.empty) break;
    ultimo = pagina.docs[pagina.docs.length - 1];
    cuenta.profes += pagina.size;

    const usuarios = new Map<string, { email: string | null; nombre: string | null }>();
    try {
      const r = await getAuth().getUsers(pagina.docs.map((d) => ({ uid: d.id })));
      r.users.forEach((u) =>
        usuarios.set(u.uid, { email: u.email ?? null, nombre: u.displayName ?? null })
      );
    } catch (e) {
      console.error('bitacoraSemanal: no se pudieron leer los usuarios de la página', e);
    }

    await enLotes(pagina.docs, CONCURRENCIA, async (m) => {
      const colegioId =
        typeof m.get('colegioId') === 'string' ? (m.get('colegioId') as string) : null;
      const u = usuarios.get(m.id) ?? { email: null, nombre: null };
      try {
        const r = await bitacoraDeProfe(db, { uid: m.id, colegioId, ...u }, ahora);
        if (r === 'escrita') cuenta.escritas += 1;
        else if (r === 'ya_existia') cuenta.yaExistian += 1;
        else cuenta.omitidas += 1;
      } catch (e) {
        cuenta.errores += 1;
        console.error('bitacoraSemanal: falló un profe', { uid: m.id, error: String(e) });
      }
    });
    if (pagina.size < PROFES_POR_PAGINA) break;
  }

  console.log('bitacoraSemanal: corrida', cuenta);
  return cuenta;
}

export const bitacoraSemanal = onSchedule(
  {
    schedule: 'every sunday 19:00',
    timeZone: 'America/Bogota',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    await correrBitacoraSemanal();
  }
);
