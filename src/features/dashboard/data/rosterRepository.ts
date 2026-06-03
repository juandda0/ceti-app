import { getDocs } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { cursosByProfesorQuery, estudiantesCollectionRef } from '@shared/lib/firebase/paths';
import type { Curso, Estudiante } from '@shared/types/tenancy';

export type CursoWithId = Curso & { id: string };
export type EstudianteWithId = Estudiante & { studentId: string };

/** Reads the institutional roster (courses a teacher manages, students in a course). */
export const rosterRepository = {
  async getCursosByProfesor(colegioId: string, uid: string): Promise<CursoWithId[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(cursosByProfesorQuery(clients.firestore, colegioId, uid));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Curso) }));
  },

  async getRoster(colegioId: string, cursoId: string): Promise<EstudianteWithId[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(estudiantesCollectionRef(clients.firestore, colegioId, cursoId));
    return snap.docs.map((d) => ({ studentId: d.id, ...(d.data() as Estudiante) }));
  },
};
