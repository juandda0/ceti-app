/**
 * Fase 8c — adaptaciones por estudiante y accesibilidad de la clase (ver
 * functions/src/educadores/dominio/adaptaciones.ts). Las escribe cualquier profe
 * de la clase; el estudiante las lee en el espacio de la clase.
 */
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import {
  adaptacionesDesdeDoc,
  type ConfigAccesibilidad,
  type MapaAdaptaciones,
} from '@/functions/src/educadores/dominio';

function db() {
  const c = getFirebaseClients();
  if (!c?.firestore) throw new Error('Sin conexión con Firebase.');
  return c.firestore;
}

const refEst = (cid: string, k: string, uid: string) =>
  doc(db(), 'colegios', cid, 'cursos', k, 'estudiantes', uid, 'adaptaciones', 'actual');
const refClase = (cid: string, k: string) => doc(db(), 'colegios', cid, 'cursos', k, 'config', 'accesibilidad');

export const adaptacionesRepository = {
  async de(cid: string, k: string, uid: string): Promise<MapaAdaptaciones | null> {
    const s = await getDoc(refEst(cid, k, uid));
    return s.exists() ? adaptacionesDesdeDoc(s.data()) : null;
  },

  /** Las de varios estudiantes (las que no existen no vienen). */
  async deVarios(cid: string, k: string, uids: readonly string[]): Promise<Record<string, MapaAdaptaciones>> {
    const pares = await Promise.all(
      uids.filter(Boolean).map(async (u) => [u, await this.de(cid, k, u).catch(() => null)] as const)
    );
    return Object.fromEntries(pares.filter((p): p is readonly [string, MapaAdaptaciones] => !!p[1]));
  },

  async guardar(cid: string, k: string, uid: string, a: MapaAdaptaciones, autor: string) {
    await setDoc(refEst(cid, k, uid), { ...a, actualizadoAt: Date.now(), actualizadoPor: autor });
  },

  /** El estudiante: las suyas en vivo (null si no tiene). */
  escuchar(cid: string, k: string, uid: string, cb: (a: MapaAdaptaciones | null) => void): () => void {
    return onSnapshot(
      refEst(cid, k, uid),
      (s) => cb(s.exists() ? adaptacionesDesdeDoc(s.data()) : null),
      () => cb(null)
    );
  },

  async clase(cid: string, k: string): Promise<ConfigAccesibilidad | null> {
    const s = await getDoc(refClase(cid, k));
    return s.exists() ? (s.data() as ConfigAccesibilidad) : null;
  },

  escucharClase(cid: string, k: string, cb: (c: ConfigAccesibilidad | null) => void): () => void {
    return onSnapshot(
      refClase(cid, k),
      (s) => cb(s.exists() ? (s.data() as ConfigAccesibilidad) : null),
      () => cb(null)
    );
  },

  async guardarClase(cid: string, k: string, leerEnVozAlta: boolean, autor: string) {
    await setDoc(refClase(cid, k), { leerEnVozAlta, actualizadoAt: Date.now(), actualizadoPor: autor });
  },
};
