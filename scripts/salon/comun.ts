/**
 * Base compartida de los scripts del Salón demo: conexión a los emuladores
 * (nunca a producción), las cuentas de cuentas.json y la reconstrucción del
 * estado de juego con las funciones puras de la app.
 *
 * firebase-admin se carga desde functions/node_modules: así la siembra puede
 * llamar a las funciones del servidor (Bitácora, adopción) con la misma copia
 * del SDK que usan ellas.
 */
import { createRequire } from 'module';
import * as path from 'path';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import {
  alAbrir,
  completarPractica,
  estadoInicial,
  type EstadoOrbita,
  type TipoPractica,
} from '@features/orbita/domain/orbita';
import { dayKey } from '@features/orbita/domain/tiempo';
import cuentasJson from './cuentas.json';

export const RAIZ = path.resolve(__dirname, '../..');
export const PROYECTO = cuentasJson.proyecto; // 'demo-ceti'
export const HOST_FIRESTORE = process.env.SALON_FIRESTORE_HOST || '127.0.0.1:8099';
export const HOST_AUTH = process.env.SALON_AUTH_HOST || '127.0.0.1:9098';
export const HOST_FUNCTIONS = process.env.SALON_FUNCTIONS_HOST || '127.0.0.1:5001';
export const HOST_HUB = process.env.SALON_HUB_HOST || '127.0.0.1:4400';

// Siempre emulador: con estas variables el Admin SDK no puede tocar producción
// aunque haya credenciales de Google en la máquina.
process.env.GCLOUD_PROJECT = PROYECTO;
process.env.GOOGLE_CLOUD_PROJECT = PROYECTO;
process.env.FIRESTORE_EMULATOR_HOST = HOST_FIRESTORE;
process.env.FIREBASE_AUTH_EMULATOR_HOST = HOST_AUTH;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

const requireFunctions = createRequire(path.join(RAIZ, 'functions', 'package.json'));
const adminApp = requireFunctions('firebase-admin/app');
const adminFirestore = requireFunctions('firebase-admin/firestore');
const adminAuth = requireFunctions('firebase-admin/auth');

if (!adminApp.getApps().length) adminApp.initializeApp({ projectId: PROYECTO });

export const db: Firestore = adminFirestore.getFirestore();
export const auth: Auth = adminAuth.getAuth();
export const FieldValue: typeof import('firebase-admin/firestore').FieldValue =
  adminFirestore.FieldValue;
export const Timestamp: typeof import('firebase-admin/firestore').Timestamp =
  adminFirestore.Timestamp;

export const DIA_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------

export interface Cuenta {
  id: string;
  rol: 'admin' | 'profesor' | 'estudiante';
  nombre: string;
  email: string;
  colegio?: string;
  curso?: string;
  alias?: string;
  descripcion?: string;
  ir?: string;
}

export const PASSWORD = cuentasJson.password;
export const CUENTAS = cuentasJson.cuentas as Cuenta[];

export function cuenta(id: string): Cuenta {
  const c = CUENTAS.find((x) => x.id === id);
  if (!c) throw new Error(`Cuenta desconocida: ${id}`);
  return c;
}

// ---------------------------------------------------------------------------
// Tenancy fija (ids estables para que las URLs del salón no cambien)
// ---------------------------------------------------------------------------

export interface CursoSalon {
  colegioId: string;
  cursoId: string;
  nombre: string;
  grado: string;
  codigo: string;
  profe: string;
}

export const CURSOS: Record<string, CursoSalon> = {
  '10b': {
    colegioId: 'san-mateo',
    cursoId: '10b',
    nombre: '10°B',
    grado: '10',
    codigo: 'MATE2B',
    profe: 'profe-piloto',
  },
  '9a': {
    colegioId: 'san-mateo',
    cursoId: '9a',
    nombre: '9°A',
    grado: '9',
    codigo: 'MATE9A',
    profe: 'profe-piloto',
  },
  '8a': {
    colegioId: 'los-andes',
    cursoId: '8a',
    nombre: '8°A',
    grado: '8',
    codigo: 'ANDES8',
    profe: 'profe-cadete',
  },
  '7c': {
    colegioId: 'nuevo-horizonte',
    cursoId: '7c',
    nombre: '7°C',
    grado: '7',
    codigo: 'HRZN7C',
    profe: 'profe-prueba',
  },
};

export const MUNDOS = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'] as const;

// ---------------------------------------------------------------------------
// Avatar (personajes del catálogo: juan, santiago, sofi, vale)
// ---------------------------------------------------------------------------

const NOMBRES_FEMENINOS = new Set([
  'Mariana',
  'Valentina',
  'Isabella',
  'Sofía',
  'Luciana',
  'Gabriela',
  'Antonella',
  'Salomé',
  'Mariángel',
  'Sara',
  'Laura',
  'María',
  'Camila',
  'Paula',
  'Manuela',
  'Juliana',
  'Natalia',
  'Isabel',
  'Daniela',
  'Ana',
  'Valeria',
  'Elena',
  'Lucía',
]);

export function avatarDe(nombre: string, i: number) {
  const mujer = NOMBRES_FEMENINOS.has(nombre.split(' ')[0]);
  const personaje = mujer ? (i % 2 ? 'vale' : 'sofi') : i % 2 ? 'santiago' : 'juan';
  return { personaje, tono: 'original', pelo: 'original', prenda: 'traje', accesorio: null };
}

// ---------------------------------------------------------------------------
// Estado de juego (users/{uid}/juego/orbita) con las funciones puras de Órbita
// ---------------------------------------------------------------------------

export interface PracticaPlan {
  tipo: TipoPractica;
  worldId: string;
  nivel?: number;
  /** Respuestas correctas de 5 (XP_ACIERTO = 2 por respuesta). */
  aciertos: number;
}

/**
 * Reproduce, día por día, lo que habría hecho la app: abrir (alAbrir) y
 * terminar prácticas (completarPractica). `dias` son epochs (ms) de días con
 * práctica, en orden; las prácticas se reparten entre ellos.
 */
export function reproducirJuego(
  dias: number[],
  practicas: PracticaPlan[],
  ahora: number,
  extra?: (e: EstadoOrbita, hoy: string, ms: number, indiceDia: number) => EstadoOrbita
): EstadoOrbita {
  const inicio = dias.length ? dias[0] - DIA_MS : ahora;
  let e = estadoInicial(inicio);
  e = { ...e, ajustes: { ...e.ajustes, primerVuelo: true } };
  const P = practicas.length;
  const D = Math.max(1, dias.length);
  let p = 0;
  dias.forEach((ms, idx) => {
    const hoy = dayKey(ms);
    e = alAbrir(e, hoy, ms).estado;
    // Reparto parejo; un día sin práctica asignada repite una lección ya hecha.
    const n = Math.max(1, Math.floor(((idx + 1) * P) / D) - Math.floor((idx * P) / D));
    for (let k = 0; k < n; k++) {
      const ultima = practicas[P - 1];
      if (!ultima) break;
      const pr: PracticaPlan =
        p < P
          ? practicas[p++]
          : { tipo: 'leccion', worldId: ultima.worldId, nivel: 0, aciertos: 4 };
      e = completarPractica(
        e,
        {
          tipo: pr.tipo,
          worldId: pr.worldId,
          nivel: pr.tipo === 'leccion' ? pr.nivel : undefined,
          xpRespuestas: pr.aciertos * 2,
          perfecta: pr.aciertos === 5,
        },
        hoy,
        ms + k * 7 * 60_000
      ).estado;
    }
    if (extra) e = extra(e, hoy, ms, idx);
  });
  return alAbrir(e, dayKey(ahora), ahora).estado;
}

/** Firestore no acepta undefined (igual que orbitaSync.serializable). */
export function serializable<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export function rutaJuego(uid: string): string {
  return `users/${uid}/juego/orbita`;
}

/**
 * Contención (reportada a Órbita el 2026-10-22): en un dispositivo nuevo,
 * orbitaSync compara `actualizadoEn` contra un estado local recién creado con
 * Date.now() y, si el remoto es más viejo, lo pisa con el vacío. Sembrar el
 * documento con `actualizadoEn` a un año hace que el remoto gane en el primer
 * inicio de sesión de cada teléfono del salón, sea cuando sea la presentación.
 */
export const MARGEN_ACTUALIZADO_MS = 365 * DIA_MS;

export function docJuego(e: EstadoOrbita): Record<string, unknown> {
  return serializable({
    ...e,
    actualizadoEn: e.actualizadoEn + MARGEN_ACTUALIZADO_MS,
  }) as unknown as Record<string, unknown>;
}

/** Número pseudoaleatorio estable por semilla (la siembra es reproducible). */
export function azar(semilla: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) h = Math.imul(h ^ semilla.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** ¿Responden los emuladores? Devuelve los nombres activos según el hub. */
export async function emuladoresActivos(): Promise<string[]> {
  try {
    const r = await fetch(`http://${HOST_HUB}/emulators`);
    if (!r.ok) return [];
    return Object.keys((await r.json()) as Record<string, unknown>);
  } catch {
    return [];
  }
}
