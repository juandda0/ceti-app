/**
 * Fase 5 — el profe le escribe a su clase (ver dominio/comunicacion.ts). Solo
 * este callable escribe, con el Admin SDK:
 *
 * - `cursos/{k}/comunicados/{id}`: el registro de lo que mandó. Los anuncios los
 *   leen los estudiantes activos; los mensajes y comentarios (con `para`), solo
 *   el profe.
 * - `cursos/{k}/estudiantes/{uid}/buzon/{id}`: la copia de cada mensaje o
 *   comentario para su destinatario. Así nadie ve a quién más le escribieron. El
 *   estudiante solo puede marcarla como vista.
 * - `notificaciones/{uid}/items` + push (notificaciones.ts).
 *
 * Solo reciben los estudiantes activos (autorización confirmada): los pendientes
 * no pueden leer nada de la clase todavía.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  MENSAJES_ERROR_COMUNICADO,
  TOPE_COMUNICADOS_DIA,
  funcionDeComunicado,
  leerPedidoComunicado,
  puede,
  tituloParaEstudiante,
  vistaPrevia,
  type PedidoComunicado,
  type PlanId,
} from './dominio';
import { planDeProfe } from './plan';
import { enviadorPorDefecto, notificar, type Enviador } from './notificaciones';

const DIA_MS = 24 * 60 * 60 * 1000;

export interface ResultadoComunicado {
  id: string;
  /** Estudiantes que lo recibieron. */
  enviados: number;
  /** Pedidos que no lo recibieron (pendientes de autorización o fuera de la clase). */
  omitidos: number;
}

export interface DepsComunicado {
  plan: PlanId;
  profeNombre: string | null;
  enviador?: Enviador;
  ahora?: number;
}

/** Ruta de la app del estudiante que abre los mensajes de esa clase. */
export function rutaMensajes(colegioId: string, cursoId: string): string {
  return `/(app)/mensajes?colegioId=${encodeURIComponent(colegioId)}&cursoId=${encodeURIComponent(cursoId)}`;
}

export async function enviarComunicadoEnClase(
  db: Firestore,
  profeUid: string,
  colegioId: string,
  cursoId: string,
  pedido: PedidoComunicado,
  deps: DepsComunicado
): Promise<ResultadoComunicado> {
  const ahora = deps.ahora ?? Date.now();
  const base = `colegios/${colegioId}/cursos/${cursoId}`;
  const curso = await db.doc(base).get();
  const profesorUids = (curso.get('profesorUids') ?? []) as string[];
  if (!curso.exists || !profesorUids.includes(profeUid)) {
    throw new HttpsError('permission-denied', 'Not a teacher of this course.');
  }

  const funcion = funcionDeComunicado(pedido.tipo);
  if (funcion && !puede(deps.plan, funcion)) {
    throw new HttpsError('failed-precondition', 'Los mensajes a estudiantes vienen con el plan Piloto.', {
      codigo: 'requiere_plan',
      funcion,
      plan: deps.plan,
    });
  }

  const recientes = await db
    .collection(`${base}/comunicados`)
    .where('creadoAt', '>=', ahora - DIA_MS)
    .count()
    .get();
  if (recientes.data().count >= TOPE_COMUNICADOS_DIA) {
    throw new HttpsError(
      'resource-exhausted',
      `Ya enviaste ${TOPE_COMUNICADOS_DIA} mensajes a esta clase hoy. Mañana puedes seguir.`
    );
  }

  const activos = await db.collection(`${base}/estudiantes`).where('estado', '==', 'activo').get();
  const nombres = new Map(
    activos.docs.map((s) => [s.id, typeof s.get('nombre') === 'string' ? (s.get('nombre') as string) : ''])
  );
  const destino =
    pedido.tipo === 'anuncio' ? [...nombres.keys()] : pedido.para.filter((uid) => nombres.has(uid));
  if (pedido.tipo !== 'anuncio' && destino.length === 0) {
    throw new HttpsError(
      'failed-precondition',
      'Ninguno de esos estudiantes puede recibir mensajes todavía (falta su autorización).'
    );
  }

  const ref = db.collection(`${base}/comunicados`).doc();
  const profeNombre = deps.profeNombre?.trim() || null;
  const comun = {
    tipo: pedido.tipo,
    texto: pedido.texto,
    contexto: pedido.contexto,
    profeUid,
    profeNombre,
    creadoAt: ahora,
  };
  const batch = db.batch();
  batch.set(
    ref,
    pedido.tipo === 'anuncio'
      ? { ...comun, destinatarios: destino.length }
      : {
          ...comun,
          para: destino,
          nombres: destino.map((uid) => nombres.get(uid) || 'Estudiante'),
          destinatarios: destino.length,
        }
  );
  if (pedido.tipo !== 'anuncio') {
    for (const uid of destino) {
      batch.set(db.doc(`${base}/estudiantes/${uid}/buzon/${ref.id}`), {
        ...comun,
        comunicadoId: ref.id,
        leidoAt: null,
      });
    }
  }
  await batch.commit();

  const clase = typeof curso.get('nombre') === 'string' ? (curso.get('nombre') as string) : '';
  try {
    await notificar(
      db,
      destino,
      {
        tipo: pedido.tipo,
        titulo: tituloParaEstudiante(pedido.tipo, clase, pedido.contexto),
        cuerpo: vistaPrevia(pedido.texto),
        ruta: rutaMensajes(colegioId, cursoId),
        colegioId,
        cursoId,
        datos: { comunicadoId: ref.id },
      },
      deps.enviador ?? enviadorPorDefecto(),
      ahora
    );
  } catch (e) {
    // El mensaje ya quedó en su buzón; el aviso es lo de menos.
    console.error('enviarComunicado: falló la notificación', String(e));
  }

  const pedidos = pedido.tipo === 'anuncio' ? destino.length : pedido.para.length;
  return { id: ref.id, enviados: destino.length, omitidos: pedidos - destino.length };
}

async function nombreDe(uid: string): Promise<string | null> {
  try {
    return (await getAuth().getUser(uid)).displayName ?? null;
  } catch {
    return null;
  }
}

/** Anuncio, mensaje o comentario del profe. */
export const enviarComunicado = onCall(async (request): Promise<ResultadoComunicado> => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (caller.token.role !== 'profesor') {
    throw new HttpsError('permission-denied', 'Solo el profe escribe a su clase.');
  }
  const colegioId = request.data?.colegioId;
  const cursoId = request.data?.cursoId;
  if (typeof colegioId !== 'string' || !colegioId || typeof cursoId !== 'string' || !cursoId) {
    throw new HttpsError('invalid-argument', 'Falta la clase.');
  }
  if (caller.token.colegioId !== colegioId) {
    throw new HttpsError('permission-denied', 'Outside your colegio.');
  }
  const leido = leerPedidoComunicado(request.data);
  if (!leido.ok) throw new HttpsError('invalid-argument', MENSAJES_ERROR_COMUNICADO[leido.error]);

  const db = getFirestore();
  const [plan, profeNombre] = await Promise.all([
    planDeProfe(caller.uid, colegioId, Date.now(), db),
    nombreDe(caller.uid),
  ]);
  return enviarComunicadoEnClase(db, caller.uid, colegioId, cursoId, leido.pedido, {
    plan,
    profeNombre,
  });
});
