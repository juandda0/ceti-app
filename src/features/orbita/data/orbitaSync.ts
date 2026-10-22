/**
 * Sincroniza el estado de juego con `users/{uid}/juego/orbita`.
 *
 * - Al iniciar sesión lee el documento remoto y decide con `elegirEstado`: el
 *   remoto gana salvo que el local tenga actividad y sea más nuevo. Un estado
 *   creado en este teléfono (actualizadoEn 0) nunca pisa al remoto.
 * - Nada se sube hasta haber leído el remoto: si la lectura falla (sin red), se
 *   reintenta antes de la siguiente subida.
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
import { elegirEstado, type EstadoOrbita } from '@features/orbita/domain/orbita';

export const JUEGO_COLECCION = 'juego';
export const JUEGO_DOC_ID = 'orbita';
const RETRASO_SUBIDA_MS = 1500;

let uidActivo = '';
/** Ya se leyó el remoto de `uidActivo` (antes de eso no se sube nada). */
let leido = false;
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

/** Lee el remoto y se queda con el estado que corresponde. Devuelve si pudo leer. */
async function leerYElegir(uid: string): Promise<boolean> {
  const ref = refJuego(uid);
  if (!ref) return false;
  try {
    const snap = await getDoc(ref);
    if (uid !== uidActivo) return false;
    const remoto = snap.exists() ? snap.data() : null;
    if (elegirEstado(useOrbitaStore.getState().porUid[uid], remoto) === 'remoto') {
      useOrbitaStore.getState().reemplazar(uid, remoto as EstadoOrbita);
    }
    leido = true;
    return true;
  } catch (err) {
    void recordError(err, 'orbita_leer');
    return false;
  }
}

async function subir(uid: string): Promise<void> {
  if (uid !== uidActivo) return;
  if (!leido && !(await leerYElegir(uid))) return;
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
  leido = false;
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

  if (await leerYElegir(uid)) {
    const local = useOrbitaStore.getState().porUid[uid];
    // Si el local ganó (tiene actividad más nueva), se sube de una vez.
    if (local && local.actualizadoEn > 0) void subir(uid);
  }
  if (uid !== uidActivo) return;

  let anterior = useOrbitaStore.getState().porUid[uid];
  cancelarSuscripcion = useOrbitaStore.subscribe((s) => {
    const actual = s.porUid[uid];
    if (!actual || actual === anterior) return;
    anterior = actual;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => void subir(uid), RETRASO_SUBIDA_MS);
  });
}
