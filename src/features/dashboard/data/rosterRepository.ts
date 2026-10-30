import { getDoc, getDocs } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import {
  colegioDocRef,
  cursoDocRef,
  cursosByProfesorQuery,
  cursosCollectionRef,
  estudianteDocRef,
  estudiantesCollectionRef,
} from '@shared/lib/firebase/paths';
import type { Colegio, Curso, Estudiante } from '@shared/types/tenancy';

export type CursoWithId = Curso & { id: string };
export type EstudianteWithId = { uid: string } & Estudiante;

/** Reads the institutional roster (courses a teacher manages, students in a course). */
export const rosterRepository = {
  /** The teacher's classes. Archived ones are left out unless asked for. */
  async getCursosByProfesor(
    colegioId: string,
    uid: string,
    { incluirArchivadas = false }: { incluirArchivadas?: boolean } = {}
  ): Promise<CursoWithId[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(cursosByProfesorQuery(clients.firestore, colegioId, uid));
    const cursos = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Curso) }));
    return incluirArchivadas ? cursos : cursos.filter((c) => c.archivada !== true);
  },

  /** A whole course doc (the teacher's, or the student's own class). */
  async getCurso(colegioId: string, cursoId: string): Promise<CursoWithId | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(cursoDocRef(clients.firestore, colegioId, cursoId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Curso) };
  },

  /** All courses in the colegio (profesor school-wide report). */
  async getAllCursos(colegioId: string): Promise<CursoWithId[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(cursosCollectionRef(clients.firestore, colegioId));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Curso) }));
  },

  /**
   * Reads the colegio's display name (rules: any colegio member may read its
   * identity — nombre/logo for headers). Falls back to null offline / not found,
   * so callers can show the id or a placeholder.
   */
  async getColegioNombre(colegioId: string): Promise<string | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(colegioDocRef(clients.firestore, colegioId));
    if (!snap.exists()) return null;
    return (snap.data() as Colegio).nombre ?? null;
  },

  async getRoster(colegioId: string, cursoId: string): Promise<EstudianteWithId[]> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return [];
    const snap = await getDocs(estudiantesCollectionRef(clients.firestore, colegioId, cursoId));
    return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Estudiante) }));
  },

  /** A single roster slot — used by a student to read their own status (rules allow self). */
  async getEstudiante(
    colegioId: string,
    cursoId: string,
    uid: string
  ): Promise<EstudianteWithId | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(estudianteDocRef(clients.firestore, colegioId, cursoId, uid));
    if (!snap.exists()) return null;
    return { uid: snap.id, ...(snap.data() as Estudiante) };
  },

  /** Nombre visible de la clase (para enlaces directos que no traen `?nombre=`). */
  async getCursoNombre(colegioId: string, cursoId: string): Promise<string | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(cursoDocRef(clients.firestore, colegioId, cursoId));
    if (!snap.exists()) return null;
    return (snap.data() as Curso).nombre ?? null;
  },

  /**
   * Reads only the `grado` field of a course doc (R4: grado comes from the
   * course, never from the student record). Used to determine which banco set
   * to load for the quiz (R7/R9). Rules allow any colegio member to read cursos.
   * Falls back to null when offline / course not found.
   */
  async getCursoGrado(
    colegioId: string,
    cursoId: string
  ): Promise<import('@shared/types/tenancy').Grado | null> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return null;
    const snap = await getDoc(cursoDocRef(clients.firestore, colegioId, cursoId));
    if (!snap.exists()) return null;
    const data = snap.data() as import('@shared/types/tenancy').Curso;
    return data.grado ?? null;
  },
};
