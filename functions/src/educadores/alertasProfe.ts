/**
 * Fase 5 — alertas al profe (dominio/alertas.ts). Cada día a las 7:00 (Bogotá)
 * revisa las clases de cada profe con plan Piloto o superior y le avisa, con
 * una notificación y un push (notificaciones.ts), quién no entra hace N días,
 * quién no hizo una tarea que ya venció y a quién le bajó el promedio.
 *
 * Lee lo que el profe ya ve de su clase: roster activo, `visitas` (la última de
 * cada estudiante), `resumen/clase`, `progress` y tareas. La configuración por
 * clase está en `config/comunicacion.alertas`; lo ya avisado, en
 * `notificaciones/{profe}/estadoAlertas/{cursoId}` (solo el servidor).
 *
 * Igual que la Bitácora: páginas de profes, concurrencia y presupuesto de tiempo
 * acotados, y un error con un profe no detiene a los demás.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldPath, getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  algunaAlertaActiva,
  calcularAlertas,
  leerConfigAlertas,
  leerEstadoAlertas,
  puede,
  textoAlerta,
  FUNCION_ALERTAS,
  type AlertaNueva,
  type EstudianteParaAlertas,
  type TareaParaAlertas,
} from './dominio';
import { planDeProfe } from './plan';
import { nombreDeMundo } from './bitacoraSemanal';
import { enviadorPorDefecto, notificar, type Enviador } from './notificaciones';

export const PROFES_POR_PAGINA = 100;
export const MAX_CURSOS_POR_PROFE = 30;
export const CONCURRENCIA = 8;
export const PRESUPUESTO_MS = 420_000;

const ms = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v && typeof v === 'object' && typeof (v as { toMillis?: unknown }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  return null;
};
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Ruta de la app del profe para una alerta. */
export function rutaAlerta(cursoId: string, a: AlertaNueva): string {
  if (a.estudiantes.length === 1) {
    const e = a.estudiantes[0];
    return `/(staff)/estudiante/${cursoId}/${e.uid}?nombre=${encodeURIComponent(e.nombre)}`;
  }
  return '/(staff)/avisos';
}

interface ProgresoLeido {
  uid: string;
  worldId: string;
  completed: boolean;
  updatedAt: number | null;
}

async function progresoDeCurso(
  db: Firestore,
  colegioId: string,
  cursoId: string
): Promise<ProgresoLeido[]> {
  const snap = await db
    .collectionGroup('progress')
    .where('colegioId', '==', colegioId)
    .where('cursoId', '==', cursoId)
    .select('uid', 'completed', 'updatedAt')
    .get();
  return snap.docs.flatMap((p) => {
    const uid = (p.get('uid') as string | undefined) ?? p.ref.parent.parent?.id;
    return uid
      ? [{ uid, worldId: p.id, completed: p.get('completed') === true, updatedAt: ms(p.get('updatedAt')) }]
      : [];
  });
}

/**
 * Última actividad = la más reciente entre su última visita, su último intento
 * y su último avance de mundo (como el Análisis de la clase, que también cuenta
 * el progreso de antes del registro por lección).
 */
async function estudiantesDeCurso(
  db: Firestore,
  base: string,
  progreso: readonly ProgresoLeido[]
): Promise<EstudianteParaAlertas[]> {
  const roster = await db.collection(`${base}/estudiantes`).where('estado', '==', 'activo').get();
  if (roster.empty) return [];
  const resumenes = await db.getAll(
    ...roster.docs.map((s) => db.doc(`${base}/estudiantes/${s.id}/resumen/clase`))
  );
  const visitas = await Promise.all(
    roster.docs.map((s) =>
      db
        .collection(`${base}/estudiantes/${s.id}/visitas`)
        .orderBy('ultimaAt', 'desc')
        .limit(1)
        .get()
    )
  );
  return roster.docs.map((s, i) => {
    const r = resumenes[i].exists ? resumenes[i].data() : undefined;
    const fechas = [
      visitas[i].docs[0] ? ms(visitas[i].docs[0].get('ultimaAt')) : null,
      ms(r?.ultimoIntentoAt),
      ...progreso.filter((p) => p.uid === s.id).map((p) => p.updatedAt),
    ].filter((f): f is number => f !== null);
    const ultima = fechas.length > 0 ? Math.max(...fechas) : null;
    return {
      uid: s.id,
      nombre: typeof s.get('nombre') === 'string' && s.get('nombre') ? (s.get('nombre') as string) : 'Estudiante',
      unidoAt: ms(s.get('joinedAt')),
      ultimaActividad: ultima,
      respuestas: num(r?.respuestas),
      aciertos: num(r?.aciertos),
    };
  });
}

async function tareasDeCurso(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  mundosConfig: { worldId?: unknown; nombre?: unknown }[] | null,
  progreso: readonly ProgresoLeido[],
  ahora: number
): Promise<TareaParaAlertas[]> {
  const asignaciones = await db
    .collection(`colegios/${colegioId}/asignaciones`)
    .where('target.cursoId', '==', cursoId)
    .get();
  const hechosPorMundo = new Map<string, string[]>();
  for (const p of progreso) {
    if (!p.completed) continue;
    hechosPorMundo.set(p.worldId, [...(hechosPorMundo.get(p.worldId) ?? []), p.uid]);
  }
  return asignaciones.docs
    .filter((a) => a.get('kind') !== 'reto' && typeof a.get('worldId') === 'string')
    .filter((a) => num(a.get('deadline')) <= ahora)
    .map((a) => {
      const worldId = a.get('worldId') as string;
      const target = (a.get('target') ?? {}) as { tipo?: string; uid?: string };
      return {
        id: a.id,
        worldId,
        nombreMundo: nombreDeMundo(worldId, mundosConfig),
        deadline: num(a.get('deadline')),
        uid: target.tipo === 'estudiante' && typeof target.uid === 'string' ? target.uid : null,
        hechos: hechosPorMundo.get(worldId) ?? [],
      };
    });
}

/** Revisa una clase y avisa al profe lo nuevo. Devuelve cuántas alertas mandó. */
export async function alertasDeCurso(
  db: Firestore,
  profeUid: string,
  colegioId: string,
  cursoId: string,
  ahora: number,
  enviador: Enviador = enviadorPorDefecto()
): Promise<number> {
  const base = `colegios/${colegioId}/cursos/${cursoId}`;
  const [curso, comunicacion, mundos, estadoSnap] = await Promise.all([
    db.doc(base).get(),
    db.doc(`${base}/config/comunicacion`).get(),
    db.doc(`${base}/config/mundos`).get(),
    db.doc(`notificaciones/${profeUid}/estadoAlertas/${cursoId}`).get(),
  ]);
  if (!curso.exists || curso.get('archivada') === true) return 0;
  const config = leerConfigAlertas(comunicacion.exists ? comunicacion.get('alertas') : null);
  if (!algunaAlertaActiva(config)) return 0;

  const mundosConfig = mundos.exists ? ((mundos.get('mundos') as { worldId?: unknown; nombre?: unknown }[]) ?? null) : null;
  const progreso = await progresoDeCurso(db, colegioId, cursoId);
  const [estudiantes, tareas] = await Promise.all([
    estudiantesDeCurso(db, base, progreso),
    tareasDeCurso(db, colegioId, cursoId, mundosConfig, progreso, ahora),
  ]);
  const { alertas, estado } = calcularAlertas({
    config,
    estudiantes,
    tareas,
    estado: leerEstadoAlertas(estadoSnap.exists ? estadoSnap.data() : null),
    ahora,
  });
  await db
    .doc(`notificaciones/${profeUid}/estadoAlertas/${cursoId}`)
    .set({ ...estado, actualizadoAt: ahora });

  const clase = typeof curso.get('nombre') === 'string' ? (curso.get('nombre') as string) : '';
  for (const a of alertas) {
    const { titulo, cuerpo } = textoAlerta(a, clase);
    await notificar(
      db,
      [profeUid],
      {
        tipo: 'alerta',
        titulo,
        cuerpo,
        ruta: rutaAlerta(cursoId, a),
        colegioId,
        cursoId,
        datos: {
          alerta: a.tipo,
          clase,
          estudiantes: a.estudiantes,
          ...(a.worldId ? { worldId: a.worldId } : null),
        },
      },
      enviador,
      ahora
    );
  }
  return alertas.length;
}

export type ResultadoProfeAlertas = 'revisado' | 'sin_plan' | 'sin_colegio';

export async function alertasDeProfe(
  db: Firestore,
  profe: { uid: string; colegioId: string | null },
  ahora: number,
  enviador?: Enviador
): Promise<{ resultado: ResultadoProfeAlertas; alertas: number }> {
  if (!profe.colegioId) return { resultado: 'sin_colegio', alertas: 0 };
  const plan = await planDeProfe(profe.uid, profe.colegioId, ahora, db);
  if (!puede(plan, FUNCION_ALERTAS)) return { resultado: 'sin_plan', alertas: 0 };
  const cursos = await db
    .collection(`colegios/${profe.colegioId}/cursos`)
    .where('profesorUids', 'array-contains', profe.uid)
    .limit(MAX_CURSOS_POR_PROFE)
    .get();
  let alertas = 0;
  for (const c of cursos.docs) {
    try {
      alertas += await alertasDeCurso(db, profe.uid, profe.colegioId, c.id, ahora, enviador);
    } catch (e) {
      console.error('alertasProfe: falló una clase', { uid: profe.uid, cursoId: c.id, error: String(e) });
    }
  }
  return { resultado: 'revisado', alertas };
}

export async function correrAlertasProfe(ahora = Date.now(), db: Firestore = getFirestore()) {
  const inicio = Date.now();
  const cuenta = { profes: 0, revisados: 0, sinPlan: 0, alertas: 0, errores: 0 };
  let ultimo: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (Date.now() - inicio < PRESUPUESTO_MS) {
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
    for (let i = 0; i < pagina.docs.length; i += CONCURRENCIA) {
      await Promise.all(
        pagina.docs.slice(i, i + CONCURRENCIA).map(async (m) => {
          const colegioId = typeof m.get('colegioId') === 'string' ? (m.get('colegioId') as string) : null;
          try {
            const r = await alertasDeProfe(db, { uid: m.id, colegioId }, ahora);
            if (r.resultado === 'revisado') cuenta.revisados += 1;
            if (r.resultado === 'sin_plan') cuenta.sinPlan += 1;
            cuenta.alertas += r.alertas;
          } catch (e) {
            cuenta.errores += 1;
            console.error('alertasProfe: falló un profe', { uid: m.id, error: String(e) });
          }
        })
      );
    }
    if (pagina.size < PROFES_POR_PAGINA) break;
  }
  console.log('alertasProfe: corrida', cuenta);
  return cuenta;
}

export const alertasProfe = onSchedule(
  { schedule: 'every day 07:00', timeZone: 'America/Bogota', timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    await correrAlertasProfe();
  }
);
