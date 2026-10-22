/**
 * Invitar la lista del curso (E2): el profe pega la lista desde Excel o sube un
 * CSV y cada estudiante queda unido a la clase la primera vez que entra con ese
 * correo (resolveMyAccess). Solo servidor: el cliente lee `invitados` de su
 * clase y nunca escribe aquí.
 *
 * - `colegios/{cid}/cursos/{cursoId}/invitados/{correo}`:
 *   `{correo, nombre, estado: 'pendiente' | 'unido', invitadoPor, creadoAt}`.
 * - `invitacionesPorCorreo/{correo}`: `{colegioId, cursoId, creadoAt}`, para
 *   encontrar la invitación al iniciar sesión. Un estudiante está en una sola
 *   clase, así que la invitación más reciente reemplaza a la anterior.
 *
 * Las invitaciones pendientes ocupan cupo: no se invita a más estudiantes de los
 * que caben en el plan de la clase (el del dueño, igual que en joinByCode) ni,
 * si el colegio tiene Nave vigente, de los que caben en su licencia con margen.
 *
 * Cada invitación nueva le manda al estudiante un correo ('invitacion_clase')
 * una sola vez: `correoEnviadoAt` en el doc del invitado se escribe en la misma
 * transacción que el correo.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { leerLista, type InvitadoLista, type ResultadoLista } from './dominio';
import { COL_MAIL, construirCorreo } from './correo';
import {
  avisarCupoNave,
  contarEstudiantesColegio,
  contarRoster,
  cupoNave,
  cuposLibres,
  naveDeColegio,
  pasaLicencia,
  planDeCurso,
} from './limites';

export const COL_INVITACIONES_POR_CORREO = 'invitacionesPorCorreo';
/** Tope del texto pegado (200 filas holgadas). */
export const TEXTO_LISTA_MAX = 100_000;

export type EstadoInvitado = 'pendiente' | 'unido';

const URL_APP_POR_DEFECTO = 'https://ceti-d3769.web.app';
/** Enlace de la app que lleva el correo de invitación. */
export const URL_APP = defineString('URL_APP', { default: URL_APP_POR_DEFECTO });

export interface ResultadoInvitarLista {
  /** Los que quedaron invitados en esta llamada. */
  invitados: InvitadoLista[];
  /** Filas que no se pudieron leer. */
  errores: ResultadoLista['errores'];
  /** Repetidos en la lista, ya invitados a esta clase o ya en el roster. */
  duplicados: number;
  /** Los que no se invitaron porque la clase no tiene más cupo en el plan. */
  sinCupo: InvitadoLista[];
  /**
   * Qué tope dejó a alguien en `sinCupo`: el plan de la clase o la licencia Nave
   * del colegio (con su margen). Solo cuando `sinCupo` no está vacío.
   */
  sinCupoPor?: 'clase' | 'colegio';
  /** Correos de invitación encolados en esta llamada. */
  correosEnviados?: number;
}

export function refInvitado(db: Firestore, colegioId: string, cursoId: string, correo: string) {
  return db.doc(`colegios/${colegioId}/cursos/${cursoId}/invitados/${correo}`);
}

export function refInvitacionPorCorreo(db: Firestore, correo: string) {
  return db.collection(COL_INVITACIONES_POR_CORREO).doc(correo);
}

/**
 * Reparte la lista leída entre nuevos, duplicados y sin cupo. Puro.
 * `yaEnClase` son los correos (en minúscula) ya invitados o ya en el roster.
 */
export function repartirInvitados(
  lista: ResultadoLista,
  yaEnClase: ReadonlySet<string>,
  cupos: number
): ResultadoInvitarLista {
  // El correo es id de documento: una '/' lo partiría en otra ruta.
  const validos = lista.invitados.filter((i) => !i.correo.includes('/'));
  const errores = [
    ...lista.errores,
    ...lista.invitados
      .filter((i) => i.correo.includes('/'))
      .map((i) => ({ linea: 0, texto: i.correo, motivo: 'correo_invalido' as const })),
  ];
  const nuevos = validos.filter((i) => !yaEnClase.has(i.correo));
  const n = Math.max(0, Math.min(cupos, nuevos.length));
  return {
    invitados: nuevos.slice(0, n),
    errores,
    duplicados: lista.duplicados + (validos.length - nuevos.length),
    sinCupo: nuevos.slice(n),
  };
}

/** invitarLista({colegioId, cursoId, texto}) → ResultadoInvitarLista. Solo un profe de la clase. */
export const invitarLista = onCall(async (request): Promise<ResultadoInvitarLista> => {
  const caller = request.auth;
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (caller.token.role !== 'profesor') {
    throw new HttpsError('permission-denied', 'Solo un profesor invita a su clase.');
  }
  const colegioId = texto(request.data?.colegioId, 'colegioId');
  const cursoId = texto(request.data?.cursoId, 'cursoId');
  const lista = request.data?.texto;
  if (typeof lista !== 'string' || lista.trim().length === 0) {
    throw new HttpsError('invalid-argument', "Missing or invalid 'texto'.");
  }
  if (lista.length > TEXTO_LISTA_MAX) {
    throw new HttpsError('invalid-argument', 'La lista es demasiado larga.');
  }
  if (caller.token.colegioId !== colegioId) {
    throw new HttpsError('permission-denied', 'Outside your colegio.');
  }

  const db = getFirestore();
  const cursoRef = db.doc(`colegios/${colegioId}/cursos/${cursoId}`);
  const curso = await cursoRef.get();
  const profesorUids = (curso.data()?.profesorUids ?? []) as string[];
  if (!curso.exists || !profesorUids.includes(caller.uid)) {
    throw new HttpsError('permission-denied', 'Not a teacher of this course.');
  }

  const leida = leerLista(lista);
  const [{ plan }, roster, pendientes, correosRoster, yaInvitados, nave] = await Promise.all([
    planDeCurso(colegioId, cursoId, db),
    contarRoster(colegioId, cursoId, db),
    cursoRef
      .collection('invitados')
      .where('estado', '==', 'pendiente')
      .count()
      .get()
      .then((s) => s.data().count),
    cursoRef
      .collection('estudiantes')
      .select('email', 'estado')
      .get()
      .then((s) =>
        s.docs
          .filter((d) => d.get('estado') !== 'suprimido')
          .map((d) => d.get('email'))
          .filter((e): e is string => typeof e === 'string')
          .map((e) => e.toLowerCase())
      ),
    leida.invitados.length === 0
      ? Promise.resolve([])
      : db
          .getAll(...leida.invitados.map((i) => refInvitado(db, colegioId, cursoId, i.correo)))
          .then((snaps) => snaps.filter((s) => s.exists)),
    naveDeColegio(colegioId, Date.now(), db),
  ]);

  const libresClase = cuposLibres(plan, roster + pendientes);
  // Con Nave, las invitaciones pendientes de todo el colegio también reservan cupo.
  const cupoColegio = nave
    ? cupoNave(
        nave.estudiantes,
        await contarEstudiantesColegio(colegioId, db, { conPendientes: true })
      )
    : null;
  const cupos = cupoColegio ? Math.min(libresClase, cupoColegio.libres) : libresClase;

  const yaEnClase = new Set([...correosRoster, ...yaInvitados.map((s) => s.id)]);
  const resultado = repartirInvitados(leida, yaEnClase, cupos);
  if (resultado.sinCupo.length > 0) {
    resultado.sinCupoPor = cupoColegio && cupoColegio.libres < libresClase ? 'colegio' : 'clase';
  }

  if (resultado.invitados.length > 0) {
    // ≤ MAX_INVITADOS (200) × 2 escrituras: cabe en un batch de 500.
    const ahora = Date.now();
    const batch = db.batch();
    for (const i of resultado.invitados) {
      batch.set(refInvitado(db, colegioId, cursoId, i.correo), {
        correo: i.correo,
        nombre: i.nombre,
        estado: 'pendiente' satisfies EstadoInvitado,
        invitadoPor: caller.uid,
        creadoAt: ahora,
      });
      batch.set(refInvitacionPorCorreo(db, i.correo), { colegioId, cursoId, creadoAt: ahora });
    }
    await batch.commit();
  }

  if (nave && cupoColegio && pasaLicencia(cupoColegio, resultado.invitados.length)) {
    await avisarCupoNave(colegioId, nave, cupoColegio, resultado.invitados.length, db);
  }

  // Correo a los nuevos y a los pendientes que repitieron en la lista sin haberlo
  // recibido (invitados antes de que existiera el correo, o un envío fallido).
  const porCorreo = [
    ...resultado.invitados.map((i) => i.correo),
    ...yaInvitados.filter((s) => debeEnviarInvitacion(s.data())).map((s) => s.id),
  ];
  if (porCorreo.length > 0) {
    const datos = {
      clase: typeof curso.get('nombre') === 'string' ? (curso.get('nombre') as string) : null,
      profe: typeof caller.token.name === 'string' ? caller.token.name : null,
      enlace: URL_APP.value() || URL_APP_POR_DEFECTO,
    };
    const enviados = await Promise.all(
      porCorreo.map((correo) => enviarInvitacion(db, colegioId, cursoId, correo, datos))
    );
    resultado.correosEnviados = enviados.filter(Boolean).length;
  } else {
    resultado.correosEnviados = 0;
  }

  return resultado;
});

/** Si a este invitado le falta el correo de invitación. Puro. */
export function debeEnviarInvitacion(invitado: Record<string, unknown> | undefined): boolean {
  return !!invitado && invitado.estado === 'pendiente' && invitado.correoEnviadoAt == null;
}

/**
 * Encola 'invitacion_clase' para un invitado pendiente que aún no lo recibió y
 * marca `correoEnviadoAt` en la misma transacción, así nunca sale dos veces.
 * Nunca lanza: la invitación ya quedó hecha aunque el correo falle.
 */
export async function enviarInvitacion(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  correo: string,
  datos: { clase: string | null; profe: string | null; enlace: string }
): Promise<boolean> {
  const ref = refInvitado(db, colegioId, cursoId, correo);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!debeEnviarInvitacion(snap.data())) return false;
      tx.set(db.collection(COL_MAIL).doc(), {
        to: correo,
        message: construirCorreo('invitacion_clase', { ...datos, correoInvitado: correo }),
      });
      tx.set(ref, { correoEnviadoAt: Date.now() }, { merge: true });
      return true;
    });
  } catch (e) {
    console.error('invitarLista: no se pudo encolar la invitación', {
      colegioId,
      cursoId,
      error: String(e),
    });
    return false;
  }
}

function texto(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `Missing or invalid '${field}'.`);
  }
  return value.trim();
}

// ---------------------------------------------------------------------------
// Unión por invitación (la usa resolveMyAccess).
// ---------------------------------------------------------------------------

export interface InvitacionVigente {
  correo: string;
  colegioId: string;
  cursoId: string;
  /** Nombre que escribió el profe en la lista. */
  nombre: string | null;
}

/**
 * Invitación pendiente para este correo, o null. Si el doc de búsqueda apunta a
 * una invitación que ya no está pendiente (o a una clase borrada), lo limpia.
 */
export async function invitacionDeCorreo(
  correo: string | null | undefined,
  db: Firestore = getFirestore()
): Promise<InvitacionVigente | null> {
  const clave = correo?.trim().toLowerCase();
  if (!clave) return null;
  const busqueda = await refInvitacionPorCorreo(db, clave).get();
  if (!busqueda.exists) return null;
  const { colegioId, cursoId } = (busqueda.data() ?? {}) as {
    colegioId?: string;
    cursoId?: string;
  };
  if (typeof colegioId === 'string' && typeof cursoId === 'string') {
    const [invitado, curso] = await db.getAll(
      refInvitado(db, colegioId, cursoId, clave),
      db.doc(`colegios/${colegioId}/cursos/${cursoId}`)
    );
    if (invitado.exists && curso.exists && invitado.get('estado') === 'pendiente') {
      const nombre = invitado.get('nombre');
      return {
        correo: clave,
        colegioId,
        cursoId,
        nombre: typeof nombre === 'string' && nombre ? nombre : null,
      };
    }
  }
  await busqueda.ref.delete().catch(() => undefined);
  return null;
}

/** Marca al invitado como unido y borra el doc de búsqueda. */
export async function cerrarInvitacion(
  inv: InvitacionVigente,
  uid: string,
  db: Firestore = getFirestore()
): Promise<void> {
  const batch = db.batch();
  batch.set(
    refInvitado(db, inv.colegioId, inv.cursoId, inv.correo),
    { estado: 'unido' satisfies EstadoInvitado, uid, unidoAt: Date.now() },
    { merge: true }
  );
  batch.delete(refInvitacionPorCorreo(db, inv.correo));
  await batch.commit();
}
