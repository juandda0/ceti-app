/**
 * Fase 8b — certificados e insignias, lado cliente (ver
 * functions/src/educadores/dominio/certificados.ts). Los certificados los emite
 * y revoca el servidor; las insignias las da y quita cualquier profe de la clase.
 */
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { callFunction } from '@shared/lib/firebase/functions';
import type { CertificadoPublico, InsigniaDada } from '@/functions/src/educadores/dominio';
import { enlaceDeAcudiente } from '@features/dashboard/data/acudienteRepository';

function db() {
  const c = getFirebaseClients();
  if (!c?.firestore) throw new Error('Sin conexión con Firebase.');
  return c.firestore;
}

const est = (cid: string, k: string, uid: string, sub: string) =>
  collection(db(), 'colegios', cid, 'cursos', k, 'estudiantes', uid, sub);

export type InsigniaGuardada = InsigniaDada & { id: string };

export interface ResultadoEmision {
  emitidos: { uid: string; codigo: string }[];
  omitidos: { uid: string; motivo: 'no_activo' | 'faltan_mundos' | 'ya_tiene'; faltan?: string[]; codigo?: string }[];
}

export const certificadosRepository = {
  async deEstudiante(cid: string, k: string, uid: string): Promise<CertificadoPublico[]> {
    const s = await getDocs(query(est(cid, k, uid, 'certificados'), orderBy('emitidoAt', 'desc')));
    return s.docs.map((d) => d.data() as CertificadoPublico);
  },

  emitir: (cursoId: string, uids: string[], mundos: string[], nombresMundos: Record<string, string>) =>
    callFunction<ResultadoEmision>('emitirCertificados', { cursoId, uids, mundos, nombresMundos }),

  revocar: (cursoId: string, codigo: string) => callFunction<{ ok: true }>('revocarCertificado', { cursoId, codigo }),

  /** Sin cuenta: la verificación pública. */
  verificar: (codigo: string) => callFunction<CertificadoPublico>('verCertificado', { codigo }),

  async insignias(cid: string, k: string, uid: string): Promise<InsigniaGuardada[]> {
    const s = await getDocs(query(est(cid, k, uid, 'insignias'), orderBy('dadaAt', 'desc')));
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as InsigniaDada) }));
  },

  async darInsignia(cid: string, k: string, uid: string, i: InsigniaDada) {
    await addDoc(est(cid, k, uid, 'insignias'), i);
  },

  async quitarInsignia(cid: string, k: string, uid: string, id: string) {
    await deleteDoc(doc(db(), 'colegios', cid, 'cursos', k, 'estudiantes', uid, 'insignias', id));
  },
};

/** El enlace público para verificar un certificado (como el del acudiente). */
export function enlaceDeCertificado(codigo: string): string {
  return enlaceDeAcudiente('x').replace(/\/acudiente\/x$/, `/certificado/${codigo}`);
}
