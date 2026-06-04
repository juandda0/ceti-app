import { getDoc, getDocs } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import {
  cursoDocRef,
  cursosByProfesorQuery,
  cursosCollectionRef,
  estudianteDocRef,
  estudiantesCollectionRef,
} from '@shared/lib/firebase/paths';
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

  /** All courses in the colegio (rector/coordinador school-wide report). */
  async getAllCursos(colegioId: string): Promise<CursoWithId[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(cursosCollectionRef(clients.firestore, colegioId));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Curso) }));
  },

  async getRoster(colegioId: string, cursoId: string): Promise<EstudianteWithId[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(estudiantesCollectionRef(clients.firestore, colegioId, cursoId));
    return snap.docs.map((d) => ({ studentId: d.id, ...(d.data() as Estudiante) }));
  },

  /** A single course doc — any colegio member may read it (rules allow sameColegio). */
  async getCurso(colegioId: string, cursoId: string): Promise<CursoWithId | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(cursoDocRef(clients.firestore, colegioId, cursoId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Curso) };
  },

  /** A single roster slot — used by a student to read their own status (rules allow self). */
  async getEstudiante(
    colegioId: string,
    cursoId: string,
    studentId: string
  ): Promise<EstudianteWithId | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(estudianteDocRef(clients.firestore, colegioId, cursoId, studentId));
    if (!snap.exists()) return null;
    return { studentId: snap.id, ...(snap.data() as Estudiante) };
  },
};
