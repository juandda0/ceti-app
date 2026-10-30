/**
 * Gestión de la clase (Fase 0 del módulo profesor): salir o sacar a un
 * estudiante sin borrar sus datos, y editar, archivar o borrar una clase.
 * Solo servidor; las callables de index.ts validan quién llama y fijan los
 * claims. Aquí va lo que toca Firestore, con la base inyectable para probarlo.
 *
 * - Retirar ≠ suprimir. `retirado` deja de ocupar cupo y el estudiante pierde
 *   el acceso a la clase, pero su avance se conserva (el profe lo ve en
 *   "Retirados"). Suprimir (Ley 1581) sigue siendo el borrado irreversible.
 * - Una clase archivada no recibe estudiantes (su código se desactiva), no
 *   cuenta para el límite de clases del plan y se puede desarchivar.
 * - Borrar solo se permite si nadie sigue en la clase.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

/** Estados del roster que siguen en la clase y ocupan cupo. */
export const ESTADOS_EN_CLASE = ['activo', 'pendiente_atestacion'] as const;

export function sigueEnClase(estado: unknown): boolean {
  return (ESTADOS_EN_CLASE as readonly unknown[]).includes(estado);
}

export const NOMBRE_CLASE_MAX = 60;
export const PROGRAMA_MAX = 60;

// Grados válidos para un curso: 1° a 11°. (El contenido default sembrado solo
// cubre 9–11; los grados menores reutilizan el banco de 9° hasta que el profesor
// autore contenido propio — ver QuestionBankRepository.)
const GRADOS_VALIDOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] as const;

export function isGradoValido(grado: string): boolean {
  return (GRADOS_VALIDOS as readonly string[]).includes(grado);
}

function refEstudiante(db: Firestore, colegioId: string, cursoId: string, uid: string) {
  return db.doc(`colegios/${colegioId}/cursos/${cursoId}/estudiantes/${uid}`);
}

/**
 * Marca al estudiante como retirado de la clase. Devuelve false si no estaba
 * (o ya se había ido o lo suprimieron), para que la llamada sea idempotente.
 */
export async function retirarDeClase(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  uid: string,
  por: { quien: 'estudiante' | 'profesor'; uid: string },
  ahora = Date.now()
): Promise<boolean> {
  const ref = refEstudiante(db, colegioId, cursoId, uid);
  const snap = await ref.get();
  if (!snap.exists || !sigueEnClase(snap.data()?.estado)) return false;
  await ref.set(
    { estado: 'retirado', retiradoAt: ahora, retiradoPor: por.quien, retiradoPorUid: por.uid },
    { merge: true }
  );
  return true;
}

/**
 * Estado con el que vuelve un estudiante retirado: si su acudiente ya estaba
 * autorizado, vuelve activo; si no, queda pendiente como cualquier nuevo.
 */
export function estadoAlVolver(atestado: unknown): 'activo' | 'pendiente_atestacion' {
  return atestado === true ? 'activo' : 'pendiente_atestacion';
}

export interface CambiosClase {
  nombre?: string;
  grado?: string;
  /** Fase 6: programa o facultad (universidades); '' lo quita. Agrupa el panel de la entidad. */
  programa?: string;
  archivada?: boolean;
  codigoActivo?: boolean;
}

/** Lee y valida los cambios que manda el cliente. Lanza invalid-argument. */
export function leerCambiosClase(data: unknown): CambiosClase {
  const d = (data ?? {}) as Record<string, unknown>;
  const cambios: CambiosClase = {};
  if (d.nombre !== undefined) {
    const nombre = typeof d.nombre === 'string' ? d.nombre.trim() : '';
    if (!nombre || nombre.length > NOMBRE_CLASE_MAX) {
      throw new HttpsError(
        'invalid-argument',
        `El nombre de la clase debe tener entre 1 y ${NOMBRE_CLASE_MAX} caracteres.`
      );
    }
    cambios.nombre = nombre;
  }
  if (d.grado !== undefined) {
    if (typeof d.grado !== 'string' || !isGradoValido(d.grado)) {
      throw new HttpsError('invalid-argument', 'El grado debe ir de 1 a 11.');
    }
    cambios.grado = d.grado;
  }
  if (d.programa !== undefined) {
    const programa = typeof d.programa === 'string' ? d.programa.replace(/\s+/g, ' ').trim() : null;
    if (programa === null || programa.length > PROGRAMA_MAX) {
      throw new HttpsError('invalid-argument', `El programa tiene hasta ${PROGRAMA_MAX} caracteres.`);
    }
    cambios.programa = programa;
  }
  for (const k of ['archivada', 'codigoActivo'] as const) {
    if (d[k] === undefined) continue;
    if (typeof d[k] !== 'boolean')
      throw new HttpsError('invalid-argument', `'${k}' debe ser sí o no.`);
    cambios[k] = d[k] as boolean;
  }
  if (Object.keys(cambios).length === 0) {
    throw new HttpsError('invalid-argument', 'No hay cambios.');
  }
  return cambios;
}

/**
 * Aplica los cambios a la clase. El código de unión vive en `classCodes/{code}`:
 * se borra al archivar o desactivar, y se vuelve a crear al reactivar (con uno
 * nuevo si alguien más tomó el anterior). `nuevoCodigo` lo pone index.ts.
 */
export async function editarClase(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  cambios: CambiosClase,
  nuevoCodigo: () => Promise<string>,
  ahora = Date.now()
): Promise<{ codigo: string | null }> {
  const cursoRef = db.doc(`colegios/${colegioId}/cursos/${cursoId}`);
  const snap = await cursoRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'La clase no existe.');
  const actual = snap.data() ?? {};

  const archivada = cambios.archivada ?? actual.archivada === true;
  const codigoActivo = cambios.codigoActivo ?? actual.codigoActivo !== false;
  let codigo = typeof actual.codigo === 'string' ? actual.codigo : null;

  const update: Record<string, unknown> = { actualizadaAt: ahora };
  if (cambios.nombre !== undefined) update.nombre = cambios.nombre;
  if (cambios.grado !== undefined) update.grado = cambios.grado;
  if (cambios.programa !== undefined) update.programa = cambios.programa || null;
  if (cambios.archivada !== undefined) {
    update.archivada = cambios.archivada;
    update.archivadaAt = cambios.archivada ? ahora : null;
  }
  if (cambios.codigoActivo !== undefined) update.codigoActivo = cambios.codigoActivo;

  const debeUnir = !archivada && codigoActivo;
  if (codigo) {
    const codeRef = db.doc(`classCodes/${codigo}`);
    const codeSnap = await codeRef.get();
    const esDeEsta = codeSnap.exists && codeSnap.get('cursoId') === cursoId;
    if (!debeUnir && esDeEsta) {
      await codeRef.delete();
    } else if (debeUnir && !esDeEsta) {
      if (codeSnap.exists) codigo = await nuevoCodigo();
      await db.doc(`classCodes/${codigo}`).set({ colegioId, cursoId, createdAt: ahora });
      update.codigo = codigo;
    }
  }

  await cursoRef.set(update, { merge: true });
  return { codigo };
}

/**
 * Borra la clase con todo lo que cuelga de ella (roster de retirados,
 * configuración, contenido, invitados), su código y sus tareas. Solo si nadie
 * sigue en la clase: con estudiantes, el profe la archiva.
 */
export async function borrarClase(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  borrarArbol: (ref: DocumentReference) => Promise<void> = (ref) => db.recursiveDelete(ref)
): Promise<void> {
  const cursoRef = db.doc(`colegios/${colegioId}/cursos/${cursoId}`);
  const [snap, roster] = await Promise.all([
    cursoRef.get(),
    cursoRef.collection('estudiantes').select('estado').get(),
  ]);
  if (!snap.exists) return;
  if (roster.docs.some((d) => sigueEnClase(d.get('estado')))) {
    throw new HttpsError(
      'failed-precondition',
      'La clase todavía tiene estudiantes. Sácalos o archiva la clase.',
      { codigo: 'clase_con_estudiantes' }
    );
  }

  const codigo = snap.get('codigo');
  if (typeof codigo === 'string') {
    const codeRef = db.doc(`classCodes/${codigo}`);
    const codeSnap = await codeRef.get();
    if (codeSnap.exists && codeSnap.get('cursoId') === cursoId) await codeRef.delete();
  }
  const tareas = await db
    .collection(`colegios/${colegioId}/asignaciones`)
    .where('target.cursoId', '==', cursoId)
    .get();
  await Promise.all(tareas.docs.map((d) => d.ref.delete()));
  await borrarArbol(cursoRef);
}

/**
 * Clases activas (sin archivar) del profe en su colegio. Lee solo el campo
 * `archivada`: un profe tiene pocas clases y así no hace falta un índice.
 */
export async function contarClasesActivas(
  db: Firestore,
  uid: string,
  colegioId: string
): Promise<number> {
  const snap = await db
    .collection(`colegios/${colegioId}/cursos`)
    .where('profesorUids', 'array-contains', uid)
    .select('archivada')
    .get();
  return snap.docs.filter((d) => d.get('archivada') !== true).length;
}
