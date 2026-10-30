/**
 * Fase 5 — notificaciones de la app. Cada aviso se guarda en
 * `notificaciones/{uid}/items/{id}` (la app lo muestra y lo marca como leído) y
 * después se intenta el push con un `Enviador`.
 *
 * El envío real va detrás de esta interfaz: `enviadorExpo` usa el servicio de
 * push de Expo con los tokens que el celular guardó en `notificaciones/{uid}`
 * (`expoTokens`). En el emulador y sin tokens no se envía nada; en web nunca
 * hay token. El aviso guardado es la fuente de verdad: si el push falla, el
 * usuario lo ve igual al abrir la app.
 */
import type { Firestore } from 'firebase-admin/firestore';

export const COL_NOTIFICACIONES = 'notificaciones';
export const MAX_TOKENS = 5;

export type TipoNotificacion = 'anuncio' | 'mensaje' | 'retro' | 'alerta';

export interface Notificacion {
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  /** Ruta de expo-router que abre el aviso. */
  ruta: string;
  colegioId: string;
  cursoId: string;
  /** Datos extra para la pantalla (p. ej. los estudiantes de una alerta). */
  datos?: Record<string, unknown>;
}

export interface PushSaliente {
  tokens: string[];
  titulo: string;
  cuerpo: string;
  ruta: string;
}

export interface Enviador {
  enviar(mensajes: PushSaliente[]): Promise<void>;
}

/** No envía nada (emulador, pruebas). */
export const enviadorNulo: Enviador = {
  async enviar() {
    /* nada */
  },
};

const URL_EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

/** Lo que espera el servicio de Expo: un mensaje por token, de a 100. Puro. */
export function mensajesExpo(mensajes: PushSaliente[]): Record<string, unknown>[][] {
  const planos = mensajes.flatMap((m) =>
    m.tokens.map((to) => ({
      to,
      title: m.titulo,
      body: m.cuerpo,
      sound: 'default',
      data: { ruta: m.ruta },
    }))
  );
  const lotes: Record<string, unknown>[][] = [];
  for (let i = 0; i < planos.length; i += 100) lotes.push(planos.slice(i, i + 100));
  return lotes;
}

export const enviadorExpo: Enviador = {
  async enviar(mensajes) {
    for (const lote of mensajesExpo(mensajes)) {
      try {
        const r = await fetch(URL_EXPO_PUSH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(lote),
        });
        if (!r.ok) console.error('push: Expo respondió', r.status);
      } catch (e) {
        console.error('push: no se pudo enviar', String(e));
      }
    }
  },
};

/** El de producción; en el emulador no sale nada a internet. */
export function enviadorPorDefecto(): Enviador {
  return process.env.FUNCTIONS_EMULATOR === 'true' ? enviadorNulo : enviadorExpo;
}

/** Tokens válidos de Expo guardados por la app del usuario. Puro. */
export function tokensDe(data: Record<string, unknown> | undefined): string[] {
  const lista = Array.isArray(data?.expoTokens) ? data.expoTokens : [];
  return lista
    .filter((t): t is string => typeof t === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(t))
    .slice(0, MAX_TOKENS);
}

/**
 * Guarda el aviso para cada usuario y manda el push a los que tienen celular
 * registrado. Escrituras en lotes de 400.
 */
export async function notificar(
  db: Firestore,
  uids: string[],
  n: Notificacion,
  enviador: Enviador = enviadorPorDefecto(),
  ahora = Date.now()
): Promise<void> {
  const unicos = [...new Set(uids)];
  if (unicos.length === 0) return;
  const doc = {
    ...n,
    datos: n.datos ?? null,
    creadoAt: ahora,
    leidaAt: null,
  };
  for (let i = 0; i < unicos.length; i += 400) {
    const batch = db.batch();
    for (const uid of unicos.slice(i, i + 400)) {
      batch.set(db.collection(`${COL_NOTIFICACIONES}/${uid}/items`).doc(), doc);
    }
    await batch.commit();
  }
  const registros = await db.getAll(...unicos.map((uid) => db.doc(`${COL_NOTIFICACIONES}/${uid}`)));
  const tokens = registros.flatMap((s) => (s.exists ? tokensDe(s.data()) : []));
  if (tokens.length === 0) return;
  await enviador.enviar([{ tokens, titulo: n.titulo, cuerpo: n.cuerpo, ruta: n.ruta }]);
}
