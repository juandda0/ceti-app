/**
 * Fase 5 — resumen para acudientes (functions/src/educadores/acudientes.ts).
 * El profe crea, comparte y corta el enlace de cada estudiante o guarda el
 * correo del acudiente (callable `gestionarAcudiente`); el acudiente abre
 * `/acudiente/{token}` sin cuenta (`verResumenAcudiente`, `bajaAcudiente`).
 */
import { Platform, Share } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { callFunction } from '@shared/lib/firebase/functions';
import type { ResumenAcudiente } from '@/functions/src/educadores/dominio';

export type AccionAcudiente = 'enlace' | 'revocar' | 'correo' | 'quitarCorreo';

export interface EstadoAcudiente {
  token: string | null;
  correo: string | null;
  correoActivo: boolean;
}

const URL_APP_POR_DEFECTO = 'https://ceti-d3769.web.app';

/** El enlace que se comparte: el mismo origen en web (sirve en el salón demo). */
export function enlaceDeAcudiente(token: string): string {
  const origen =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : process.env.EXPO_PUBLIC_APP_URL || URL_APP_POR_DEFECTO;
  return `${origen.replace(/\/+$/, '')}/acudiente/${token}`;
}

/**
 * Comparte un texto con el menú del celular. En web usa el del navegador o,
 * si no hay, lo copia. Devuelve 'copiado' cuando lo copió.
 */
export async function compartirTexto(mensaje: string): Promise<'compartido' | 'copiado' | 'no'> {
  if (Platform.OS !== 'web') {
    await Share.share({ message: mensaje });
    return 'compartido';
  }
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ text: mensaje });
      return 'compartido';
    } catch {
      /* cancelado: se copia */
    }
  }
  if (nav?.clipboard) {
    await nav.clipboard.writeText(mensaje);
    return 'copiado';
  }
  return 'no';
}

export const acudienteRepository = {
  gestionar(input: {
    colegioId: string;
    cursoId: string;
    uid: string;
    accion: AccionAcudiente;
    correo?: string;
    autorizado?: boolean;
  }): Promise<EstadoAcudiente> {
    return callFunction<EstadoAcudiente>('gestionarAcudiente', input);
  },

  /** Lo guardado del acudiente de un estudiante (solo el profe lo lee). */
  async estado(colegioId: string, cursoId: string, uid: string): Promise<EstadoAcudiente> {
    const db = getFirebaseClients()?.firestore;
    if (!db) return { token: null, correo: null, correoActivo: false };
    const snap = await getDoc(
      doc(db, 'colegios', colegioId, 'cursos', cursoId, 'estudiantes', uid, 'acudiente', 'datos')
    );
    const d = snap.data() ?? {};
    return {
      token: typeof d.token === 'string' ? d.token : null,
      correo: typeof d.correo === 'string' ? d.correo : null,
      correoActivo: d.correoActivo === true,
    };
  },

  ver(token: string): Promise<ResumenAcudiente> {
    return callFunction<ResumenAcudiente>('verResumenAcudiente', { token });
  },

  baja(token: string): Promise<{ ok: true }> {
    return callFunction<{ ok: true }>('bajaAcudiente', { token });
  },
};
