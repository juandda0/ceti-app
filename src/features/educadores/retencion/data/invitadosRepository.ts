/**
 * Invitados por lista (E2): el profe pega la lista del curso y el servidor
 * (`invitarLista`) crea un invitado por correo. Cuando el estudiante entra con
 * ese correo queda unido a la clase. La app lee los invitados para mostrar los
 * pendientes; solo el servidor los escribe.
 */
import { collection, getDocs } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { callFunction } from '@shared/lib/firebase/functions';
import type { InvitadoLista, ResultadoLista } from '@/functions/src/educadores/dominio';

export interface Invitado {
  correo: string;
  nombre: string;
  estado: 'pendiente' | 'unido';
  invitadoPor: string;
  creadoAt: number;
}

/** Respuesta de `invitarLista` (functions/src/educadores/invitaciones.ts). */
export interface ResultadoInvitarLista {
  /** Los que quedaron invitados en esta llamada. */
  invitados: InvitadoLista[];
  errores: ResultadoLista['errores'];
  /** Repetidos en la lista, ya invitados o ya en la clase. */
  duplicados: number;
  /** Los que no cupieron en el plan de la clase. */
  sinCupo: InvitadoLista[];
}

export const invitadosRepository = {
  async listar(colegioId: string, cursoId: string): Promise<Invitado[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(
      collection(clients.firestore, 'colegios', colegioId, 'cursos', cursoId, 'invitados')
    );
    return snap.docs
      .map((d) => {
        const data = d.data() as Partial<Invitado> & { creadoAt?: unknown };
        const creado = data.creadoAt as { toMillis?: () => number } | number | undefined;
        return {
          correo: data.correo ?? d.id,
          nombre: data.nombre ?? d.id,
          estado: data.estado === 'unido' ? ('unido' as const) : ('pendiente' as const),
          invitadoPor: data.invitadoPor ?? '',
          creadoAt:
            typeof creado === 'number'
              ? creado
              : typeof creado?.toMillis === 'function'
                ? creado.toMillis()
                : 0,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  },

  async invitarLista(input: {
    colegioId: string;
    cursoId: string;
    texto: string;
  }): Promise<ResultadoInvitarLista> {
    return callFunction<ResultadoInvitarLista>('invitarLista', input);
  },
};
