/**
 * Escribe (estudiante) y lee (profe) el registro de clase de la Fase 1: ver
 * `registroClase.ts`. Las escrituras nunca frenan al estudiante: si falla la
 * red o todavía no está autorizado, se pierde ese dato y el juego sigue.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import {
  diaDe,
  type IntentoClase,
  type ResumenOrbitaClase,
} from '@features/dashboard/data/registroClase';

function estudiantePath(colegioId: string, cursoId: string, uid: string): string[] {
  return ['colegios', colegioId, 'cursos', cursoId, 'estudiantes', uid];
}

function intentosRef(db: Firestore, colegioId: string, cursoId: string, uid: string) {
  const [c, ...resto] = estudiantePath(colegioId, cursoId, uid);
  return collection(db, c, ...resto, 'intentos');
}

function visitaRef(db: Firestore, colegioId: string, cursoId: string, uid: string, dia: string) {
  const [c, ...resto] = estudiantePath(colegioId, cursoId, uid);
  return doc(db, c, ...resto, 'visitas', dia);
}

function resumenRef(db: Firestore, colegioId: string, cursoId: string, uid: string, id: string) {
  const [c, ...resto] = estudiantePath(colegioId, cursoId, uid);
  return doc(db, c, ...resto, 'resumen', id);
}

export type IntentoGuardado = IntentoClase & { id: string; uid: string };

export interface VisitaDia {
  dia: string;
  visitas: number;
  ultimaAt: number;
}

/** Lo que el servidor resume de los intentos (functions/src/educadores/registroClase.ts). */
export interface ResumenClaseEstudiante {
  intentos: number;
  lecciones: number;
  jefes: number;
  jefesGanados: number;
  respuestas: number;
  aciertos: number;
  duracionMs: number;
  primerIntentoAt: number | null;
  ultimoIntentoAt: number | null;
  porMundo: Record<
    string,
    {
      intentos: number;
      respuestas: number;
      aciertos: number;
      jefesGanados: number;
      primerIntentoAt: number | null;
      ultimoIntentoAt: number | null;
      conquistadoAt: number | null;
    }
  >;
}

export const registroClaseRepository = {
  async registrarIntento(
    colegioId: string,
    cursoId: string,
    uid: string,
    intento: IntentoClase
  ): Promise<void> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return;
    await addDoc(intentosRef(clients.firestore, colegioId, cursoId, uid), {
      ...intento,
      uid,
      creadoAt: serverTimestamp(),
    });
  },

  /** Suma una visita del día. El llamador decide cada cuánto (cuentaComoVisita). */
  async registrarVisita(
    colegioId: string,
    cursoId: string,
    uid: string,
    ahora: number
  ): Promise<void> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return;
    const dia = diaDe(ahora);
    await setDoc(
      visitaRef(clients.firestore, colegioId, cursoId, uid, dia),
      { dia, visitas: increment(1), ultimaAt: ahora },
      { merge: true }
    );
  },

  async guardarResumenOrbita(
    colegioId: string,
    cursoId: string,
    uid: string,
    resumen: ResumenOrbitaClase
  ): Promise<void> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return;
    await setDoc(resumenRef(clients.firestore, colegioId, cursoId, uid, 'orbita'), resumen);
  },

  // ── Lecturas del profe ────────────────────────────────────────────────────

  async intentos(
    colegioId: string,
    cursoId: string,
    uid: string,
    desde = 0
  ): Promise<IntentoGuardado[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(
      query(
        intentosRef(clients.firestore, colegioId, cursoId, uid),
        where('finAt', '>=', desde),
        orderBy('finAt', 'desc')
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as IntentoClase & { uid: string }) }));
  },

  async visitas(colegioId: string, cursoId: string, uid: string): Promise<VisitaDia[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const [c, ...resto] = estudiantePath(colegioId, cursoId, uid);
    const snap = await getDocs(collection(clients.firestore, c, ...resto, 'visitas'));
    return snap.docs.map((d) => d.data() as VisitaDia);
  },

  async resumenOrbita(
    colegioId: string,
    cursoId: string,
    uid: string
  ): Promise<ResumenOrbitaClase | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(resumenRef(clients.firestore, colegioId, cursoId, uid, 'orbita'));
    return snap.exists() ? (snap.data() as ResumenOrbitaClase) : null;
  },

  /** Estadísticas por pregunta de un mundo en la clase (las arma la Function). */
  async preguntasDeMundo(
    colegioId: string,
    cursoId: string,
    worldId: string
  ): Promise<Record<string, { vistas?: number; aciertos?: number }>> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return {};
    const snap = await getDoc(
      doc(
        clients.firestore,
        'colegios',
        colegioId,
        'cursos',
        cursoId,
        'agregados',
        `preguntas_${worldId.replace(/\//g, '_')}`
      )
    );
    return (
      (snap.data()?.porPregunta as Record<string, { vistas?: number; aciertos?: number }>) ?? {}
    );
  },

  async resumenClase(
    colegioId: string,
    cursoId: string,
    uid: string
  ): Promise<ResumenClaseEstudiante | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(resumenRef(clients.firestore, colegioId, cursoId, uid, 'clase'));
    return snap.exists() ? (snap.data() as ResumenClaseEstudiante) : null;
  },
};
