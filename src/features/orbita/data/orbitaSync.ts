/**
 * Sincroniza el estado de juego con `users/{uid}/juego/orbita`.
 *
 * - Al iniciar sesión lee el documento remoto: gana el más reciente
 *   (`actualizadoEn`). Si el remoto es más viejo o no existe, sube el local.
 * - Después, cada cambio local se sube con un pequeño retraso (agrupa ráfagas).
 *
 * El documento no es un perfil financiero: son números de juego (racha, XP,
 * Cetis virtuales). Nunca lleva montos reales de gastos.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';
import { FIRESTORE_COLLECTIONS } from '@shared/lib/firebase/paths';
import { recordError } from '@shared/lib/analytics/crashlytics';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import { esEstadoOrbita, type EstadoOrbita } from '@features/orbita/domain/orbita';

export const JUEGO_COLECCION = 'juego';
export const JUEGO_DOC_ID = 'orbita';
const RETRASO_SUBIDA_MS = 1500;

let uidActivo = '';
let cancelarSuscripcion: (() => void) | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;

function refJuego(uid: string) {
  const clients = getFirebaseClients();
  if (!clients?.firestore) return null;
  return doc(clients.firestore, FIRESTORE_COLLECTIONS.users, uid, JUEGO_COLECCION, JUEGO_DOC_ID);
}

/** Firestore no acepta `undefined`: se limpian los campos opcionales vacíos. */
function serializable(e: EstadoOrbita): EstadoOrbita {
  return JSON.parse(JSON.stringify(e)) as EstadoOrbita;
}

async function subir(uid: string): Promise<void> {
  const ref = refJuego(uid);
  const estado = useOrbitaStore.getState().porUid[uid];
  if (!ref || !estado || uid !== uidActivo) return;
  try {
    await setDoc(ref, serializable(estado));
  } catch (err) {
    void recordError(err, 'orbita_subir');
  }
}

export function detenerOrbitaSync(): void {
  uidActivo = '';
  cancelarSuscripcion?.();
  cancelarSuscripcion = null;
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
}

export async function iniciarOrbitaSync(uid: string): Promise<void> {
  detenerOrbitaSync();
  if (!uid.trim() || !isFirebaseConfigured()) return;
  const ref = refJuego(uid);
  if (!ref) return;
  uidActivo = uid;

  try {
    const snap = await getDoc(ref);
    if (uid !== uidActivo) return;
    const remoto = snap.exists() ? snap.data() : null;
    const local = useOrbitaStore.getState().porUid[uid];
    if (esEstadoOrbita(remoto) && (!local || remoto.actualizadoEn > local.actualizadoEn)) {
      useOrbitaStore.getState().reemplazar(uid, remoto);
    } else if (local) {
      void subir(uid);
    }
  } catch (err) {
    void recordError(err, 'orbita_leer');
  }

  let anterior = useOrbitaStore.getState().porUid[uid];
  cancelarSuscripcion = useOrbitaStore.subscribe((s) => {
    const actual = s.porUid[uid];
    if (!actual || actual === anterior) return;
    anterior = actual;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => void subir(uid), RETRASO_SUBIDA_MS);
  });
}
