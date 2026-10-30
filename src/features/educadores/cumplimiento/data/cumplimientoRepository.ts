/**
 * Fase 7 — cumplimiento y evidencia, lado cliente: la prueba de entrada y
 * salida (config de la clase y resultados), el informe de cobertura de una
 * clase (profe con Piloto) y los cierres de periodo de la entidad.
 */
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { callFunction } from '@shared/lib/firebase/functions';
import { estudianteImpactTestDocRef } from '@shared/lib/firebase/paths';
import type {
  ConfigPrueba,
  FasePrueba,
  PanelEntidad,
  ResultadoPrueba,
} from '@/functions/src/educadores/dominio';

export interface CierrePeriodo {
  id: string;
  anio: number;
  periodo: { numero: number; nombre: string; desde: string; hasta: string };
  entidad: { nombre: string; tipo: string };
  panel: PanelEntidad;
  huella: string;
  cerradoAt: number;
  cerradoPorNombre: string;
}

export interface ResultadoEstudiante {
  uid: string;
  nombre: string;
  pre: ResultadoPrueba | null;
  post: ResultadoPrueba | null;
}

function db() {
  const c = getFirebaseClients();
  if (!c?.firestore) throw new Error('Sin conexión con Firebase.');
  return c.firestore;
}

const refConfig = (cid: string, k: string) => doc(db(), 'colegios', cid, 'cursos', k, 'config', 'prueba');

export const cumplimientoRepository = {
  async configPrueba(cid: string, cursoId: string): Promise<ConfigPrueba | null> {
    const s = await getDoc(refConfig(cid, cursoId));
    return s.exists() ? (s.data() as ConfigPrueba) : null;
  },

  cambiarPrueba: (cursoId: string, fase: FasePrueba, abrir: boolean) =>
    callFunction<{ ok: true; config: ConfigPrueba }>('gestionarPrueba', { cursoId, fase, abrir }),

  /** El estudiante: su resultado de una fase (null si no la ha hecho). */
  async miResultado(cid: string, cursoId: string, uid: string, fase: FasePrueba): Promise<ResultadoPrueba | null> {
    const s = await getDoc(estudianteImpactTestDocRef(db(), cid, cursoId, uid, fase));
    return s.exists() ? (s.data() as ResultadoPrueba) : null;
  },

  async guardarResultado(cid: string, cursoId: string, uid: string, fase: FasePrueba, r: ResultadoPrueba) {
    await setDoc(estudianteImpactTestDocRef(db(), cid, cursoId, uid, fase), r);
  },

  /** El profe: los resultados de la clase, por estudiante en lista. */
  async resultadosClase(cid: string, cursoId: string, estudiantes: readonly { uid: string; nombre: string }[]): Promise<ResultadoEstudiante[]> {
    return Promise.all(
      estudiantes.map(async (e) => {
        const [pre, post] = await Promise.all(
          (['pre', 'post'] as const).map((f) =>
            getDoc(estudianteImpactTestDocRef(db(), cid, cursoId, e.uid, f)).then((s) =>
              s.exists() ? (s.data() as ResultadoPrueba) : null
            )
          )
        );
        return { ...e, pre, post };
      })
    );
  },

  coberturaClase: (cursoId: string, rango?: { desde: number; hasta: number }) =>
    callFunction<PanelEntidad>('verCoberturaClase', { cursoId, ...(rango ?? {}) }),

  cerrarPeriodo: (anio: number, periodo: number) =>
    callFunction<Omit<CierrePeriodo, 'id'>>('cerrarPeriodoEntidad', { anio, periodo }),

  async cierres(cid: string): Promise<CierrePeriodo[]> {
    const s = await getDocs(query(collection(db(), 'colegios', cid, 'cierres'), orderBy('cerradoAt', 'desc')));
    return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CierrePeriodo, 'id'>) }));
  },
};
