/**
 * Fase 5 — lee y envía la comunicación del profe con su clase. Enviar va por el
 * callable `enviarComunicado` (revisa el plan y escribe con el Admin SDK); el
 * cliente solo lee, marca "visto" y el profe puede borrar un anuncio. Ver
 * `comunicacion.ts` y firestore.rules (comunicados, buzon, vistos).
 */
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { callFunction } from '@shared/lib/firebase/functions';
import type {
  ContextoComunicado,
  TipoComunicado,
} from '@/functions/src/educadores/dominio';
import type { Comunicado, MensajeBuzon } from '@features/dashboard/data/comunicacion';

const LIMITE = 30;

/** `config/comunicacion` de la clase, tal como está guardado. */
export interface ConfigComunicacionGuardada {
  alertas?: unknown;
  acudientes?: unknown;
}

function cursoPath(colegioId: string, cursoId: string): [string, ...string[]] {
  return ['colegios', colegioId, 'cursos', cursoId];
}

function comunicadosRef(db: Firestore, colegioId: string, cursoId: string) {
  return collection(db, ...cursoPath(colegioId, cursoId), 'comunicados');
}

function buzonRef(db: Firestore, colegioId: string, cursoId: string, uid: string) {
  return collection(db, ...cursoPath(colegioId, cursoId), 'estudiantes', uid, 'buzon');
}

export interface PedidoEnvio {
  colegioId: string;
  cursoId: string;
  tipo: TipoComunicado;
  texto: string;
  para?: string[];
  contexto?: ContextoComunicado | null;
}

export interface ResultadoEnvio {
  id: string;
  enviados: number;
  omitidos: number;
}

export const comunicacionRepository = {
  enviar(pedido: PedidoEnvio): Promise<ResultadoEnvio> {
    return callFunction<ResultadoEnvio>('enviarComunicado', pedido);
  },

  // ── Profe ──────────────────────────────────────────────────────────────────

  /** Lo último que el profe mandó a la clase (anuncios, mensajes y comentarios). */
  async enviados(colegioId: string, cursoId: string): Promise<Comunicado[]> {
    const db = getFirebaseClients()?.firestore;
    if (!db) return [];
    const snap = await getDocs(
      query(comunicadosRef(db, colegioId, cursoId), orderBy('creadoAt', 'desc'), limit(LIMITE))
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comunicado, 'id'>) }));
  },

  /** Cuántos estudiantes abrieron un anuncio. */
  async vistosDeAnuncio(colegioId: string, cursoId: string, id: string): Promise<number> {
    const db = getFirebaseClients()?.firestore;
    if (!db) return 0;
    const snap = await getCountFromServer(
      collection(db, ...cursoPath(colegioId, cursoId), 'comunicados', id, 'vistos')
    );
    return snap.data().count;
  },

  async borrarAnuncio(colegioId: string, cursoId: string, id: string): Promise<void> {
    const db = getFirebaseClients()?.firestore;
    if (!db) return;
    await deleteDoc(doc(db, ...cursoPath(colegioId, cursoId), 'comunicados', id));
  },

  async config(colegioId: string, cursoId: string): Promise<ConfigComunicacionGuardada> {
    const db = getFirebaseClients()?.firestore;
    if (!db) return {};
    const snap = await getDoc(doc(db, ...cursoPath(colegioId, cursoId), 'config', 'comunicacion'));
    return (snap.data() as ConfigComunicacionGuardada | undefined) ?? {};
  },

  /** Cambia una parte (alertas o acudientes) sin tocar la otra. */
  async guardarConfig(
    colegioId: string,
    cursoId: string,
    profeUid: string,
    parte: { alertas: object } | { acudientes: object }
  ): Promise<void> {
    const db = getFirebaseClients()?.firestore;
    if (!db) return;
    await setDoc(
      doc(db, ...cursoPath(colegioId, cursoId), 'config', 'comunicacion'),
      { ...parte, actualizadoAt: Date.now(), actualizadoPor: profeUid },
      { merge: true }
    );
  },

  // ── Estudiante (y el profe en la ficha) ────────────────────────────────────

  async anuncios(colegioId: string, cursoId: string): Promise<Comunicado[]> {
    const db = getFirebaseClients()?.firestore;
    if (!db) return [];
    const snap = await getDocs(
      query(
        comunicadosRef(db, colegioId, cursoId),
        where('tipo', '==', 'anuncio'),
        orderBy('creadoAt', 'desc'),
        limit(LIMITE)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comunicado, 'id'>) }));
  },

  async buzon(colegioId: string, cursoId: string, uid: string): Promise<MensajeBuzon[]> {
    const db = getFirebaseClients()?.firestore;
    if (!db) return [];
    const snap = await getDocs(
      query(buzonRef(db, colegioId, cursoId, uid), orderBy('creadoAt', 'desc'), limit(LIMITE))
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MensajeBuzon, 'id'>) }));
  },

  async marcarLeido(colegioId: string, cursoId: string, uid: string, id: string): Promise<void> {
    const db = getFirebaseClients()?.firestore;
    if (!db) return;
    await updateDoc(doc(buzonRef(db, colegioId, cursoId, uid), id), { leidoAt: Date.now() });
  },

  /** Deja la marca de "visto" en un anuncio (una vez; si ya estaba, las reglas lo niegan). */
  async marcarAnuncioVisto(
    colegioId: string,
    cursoId: string,
    uid: string,
    id: string
  ): Promise<void> {
    const db = getFirebaseClients()?.firestore;
    if (!db) return;
    await setDoc(doc(db, ...cursoPath(colegioId, cursoId), 'comunicados', id, 'vistos', uid), {
      vistoAt: Date.now(),
    });
  },
};
