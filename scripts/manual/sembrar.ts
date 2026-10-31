/**
 * Datos de muestra del manual interactivo: la "Institución Educativa Ceti" en
 * los EMULADORES locales (proyecto demo-ceti). Nunca toca producción: usa la
 * misma conexión que el Salón demo (scripts/salon/comun.ts), que fija las
 * variables de los emuladores y borra las credenciales de Google.
 *
 *   npm run salon:emuladores   # en otra terminal
 *   npm run manual:sembrar
 *
 * Idempotente: borra todo el emulador (Firestore + Auth) y lo recrea; correrlo
 * de nuevo deja lo mismo (con fechas relativas a hoy). Reemplaza al Salón demo
 * en el emulador: para volver a él, `npm run salon:sembrar`.
 *
 * Cómo siembra:
 * - Lo que tiene fecha vieja (matrícula, semanas de intentos, visitas, avance,
 *   prueba de entrada y salida, entregas, muro) se escribe directo con las
 *   formas del servidor y de la app.
 * - Lo que pasa "hoy" va por las callables reales del emulador de Functions,
 *   con el token de cada cuenta: anuncios y mensajes, acudiente, certificados,
 *   una clase en vivo completa, calificaciones con rúbrica, dominios, LTI,
 *   cotización y el cierre del periodo. Los disparadores reales (onIntentoClase,
 *   onProgressWriteAggregate) arman los resúmenes, y las tareas programadas
 *   (alertas, resumen de acudientes, adopción, Bitácora) se corren aquí mismo.
 *
 * Las cuentas están en scripts/manual/cuentas.json (las lee /dev/entrar).
 */
import * as fs from 'fs';
import * as path from 'path';
import type { DocumentReference } from 'firebase-admin/firestore';
import { buildWorldProgress } from '@features/learning/data/worldProgress';
import { WORLD_DEFS } from '@features/learning/data/worldMeta';
import { abrirCdt, depositar } from '@features/orbita/domain/boveda';
import type { EstadoOrbita } from '@features/orbita/domain/orbita';
import { calcularRacha, diasAprendiendo } from '@features/orbita/domain/racha';
import { dayKey } from '@features/orbita/domain/tiempo';
import {
  aplicarPagoAprobado,
  cicloDiario,
  nuevaSuscripcion,
  precioPlan,
  vigencia,
  type Suscripcion,
} from '../../functions/src/educadores/dominio';
import { bitacoraDeProfe } from '../../functions/src/educadores/bitacoraSemanal';
import { recalcularAdopcionColegio } from '../../functions/src/educadores/adopcionColegio';
import { correrAlertasProfe } from '../../functions/src/educadores/alertasProfe';
import { correrResumenAcudientes } from '../../functions/src/educadores/acudientes';
import {
  auth,
  azar,
  db,
  DIA_MS as DIA,
  docJuego,
  emuladoresActivos,
  FieldValue,
  HOST_AUTH,
  HOST_FIRESTORE,
  HOST_FUNCTIONS,
  PROYECTO,
  RAIZ,
  reproducirJuego,
  rutaJuego,
  Timestamp,
  type PracticaPlan,
} from '../salon/comun';
import cuentasJson from './cuentas.json';

process.env.FUNCTIONS_EMULATOR = 'true'; // alertas y correos sin push real

const AHORA = Date.now();
const HORA = 60 * 60 * 1000;
const POLITICA_VERSION = 'v1';
const PASSWORD = cuentasJson.password;

interface CuentaManual {
  id: string;
  rol: 'admin' | 'profesor' | 'estudiante';
  nombre: string;
  email: string;
  colegio?: string;
  curso?: string;
  cursos?: string[];
  perfil?: Perfil;
  f?: boolean;
}
type Perfil = 'estrella' | 'fuerte' | 'medio' | 'flojo' | 'dormido' | 'pendiente' | 'galaxia' | 'nuevo' | 'invitada' | 'volvio';

const CUENTAS = cuentasJson.cuentas as CuentaManual[];
const cuenta = (id: string) => {
  const c = CUENTAS.find((x) => x.id === id);
  if (!c) throw new Error(`Cuenta desconocida: ${id}`);
  return c;
};

// ---------------------------------------------------------------------------
// Instituciones y clases (ids estables: las capturas del manual los usan)
// ---------------------------------------------------------------------------

const IE = 'ie-ceti';

const COLEGIOS: Record<string, { nombre: string; creador: string; entidad?: boolean }> = {
  [IE]: { nombre: 'Institución Educativa Ceti', creador: 'ie-admin', entidad: true },
  'refuerzo-daniela': { nombre: 'Refuerzo escolar Daniela Suárez', creador: 'ie-daniela' },
  'tutorias-lora': { nombre: 'Tutorías Lora', creador: 'ie-sebastian' },
  'academia-sinu': { nombre: 'Academia Sinú', creador: 'ie-natalia' },
};

interface Clase {
  colegioId: string;
  cursoId: string;
  nombre: string;
  grado: string;
  codigo: string;
  profes: string[];
  soloCalificar?: string[];
  /** Días desde que se creó la clase. */
  creadaHace: number;
}

const CLASES: Record<string, Clase> = {
  '3a': { colegioId: IE, cursoId: '3a', nombre: '3°A', grado: '3', codigo: 'CETI3A', profes: ['ie-yolanda'], creadaHace: 80 },
  '7a': { colegioId: IE, cursoId: '7a', nombre: '7°A', grado: '7', codigo: 'CETI7A', profes: ['ie-luz'], creadaHace: 82 },
  '9b': { colegioId: IE, cursoId: '9b', nombre: '9°B', grado: '9', codigo: 'CETI9B', profes: ['ie-carlos', 'ie-luz'], creadaHace: 84 },
  '11a': {
    colegioId: IE,
    cursoId: '11a',
    nombre: '11°A',
    grado: '11',
    codigo: 'CETI11',
    profes: ['ie-carlos', 'ie-jhon'],
    soloCalificar: ['ie-jhon'],
    creadaHace: 85,
  },
  refuerzo8: { colegioId: 'refuerzo-daniela', cursoId: 'refuerzo8', nombre: 'Refuerzo 8°', grado: '8', codigo: 'DANI8R', profes: ['ie-daniela'], creadaHace: 40 },
  preicfes11: { colegioId: 'tutorias-lora', cursoId: 'preicfes11', nombre: 'Preicfes 11°', grado: '11', codigo: 'LORA11', profes: ['ie-sebastian'], creadaHace: 60 },
  finanzas10: { colegioId: 'academia-sinu', cursoId: 'finanzas10', nombre: 'Finanzas 10°', grado: '10', codigo: 'SINU10', profes: ['ie-natalia'], creadaHace: 70 },
};

const MUNDOS = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5', 'world_6'] as const;
const NOMBRE_MUNDO = Object.fromEntries(WORLD_DEFS.map((w) => [w.id, w.name])) as Record<string, string>;

/** Grupo de grados del MEN → archivo de banco (gradoDeBanco). */
function bancoDeGrado(grado: string): string {
  const g = Number(grado);
  if (g <= 3) return '1';
  if (g <= 5) return '4';
  if (g <= 7) return '6';
  return String(g);
}

// ---------------------------------------------------------------------------
// Escritura en lotes
// ---------------------------------------------------------------------------

type Op = { ref: DocumentReference; data: Record<string, unknown> };
const pendientes: Op[] = [];
function poner(ruta: string, data: Record<string, unknown>): void {
  pendientes.push({ ref: db.doc(ruta), data });
}
async function confirmar(): Promise<void> {
  while (pendientes.length) {
    const lote = pendientes.splice(0, 400);
    const batch = db.batch();
    lote.forEach((o) => batch.set(o.ref, o.data));
    await batch.commit();
  }
}
const rutaClase = (k: Clase) => `colegios/${k.colegioId}/cursos/${k.cursoId}`;
const rutaEst = (k: Clase, uid: string) => `${rutaClase(k)}/estudiantes/${uid}`;

/** Tarde en Bogotá (UTC-5) de hace `haceDias`, con minutos de variación. */
function dia(haceDias: number, hora = 16, rnd = 0): number {
  const base = new Date(AHORA - haceDias * DIA);
  base.setUTCHours(hora + 5, Math.floor(rnd * 50), 0, 0);
  return Math.min(base.getTime(), AHORA - 60_000);
}

// ---------------------------------------------------------------------------
// 0. Limpieza total del emulador
// ---------------------------------------------------------------------------

async function limpiar(): Promise<void> {
  const r1 = await fetch(
    `http://${HOST_FIRESTORE}/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  const r2 = await fetch(`http://${HOST_AUTH}/emulator/v1/projects/${PROYECTO}/accounts`, {
    method: 'DELETE',
  });
  if (!r1.ok || !r2.ok) throw new Error(`No se pudo limpiar el emulador (${r1.status}/${r2.status}).`);
}

// ---------------------------------------------------------------------------
// 1. Cuentas: Auth + claims + membership + users/{uid}
// ---------------------------------------------------------------------------

function cursosDe(c: CuentaManual): string[] {
  return c.cursos ?? (c.curso ? [c.curso] : []);
}

function claimsDe(c: CuentaManual): Record<string, unknown> {
  if (c.perfil === 'nuevo') return {}; // recién creada: aún no pasa por el primer ingreso
  if (c.rol === 'admin') return { role: 'admin' };
  if (c.rol === 'profesor') return { role: 'profesor', colegioId: c.colegio };
  const cursos = cursosDe(c);
  // Sin clase el claim no lleva rol (el store queda en Mi galaxia).
  if (!cursos.length) return { role: 'estudiante' };
  // Fase 1: hasta 5 clases, { cursoId: colegioId } (clasesEstudiante.ts).
  return {
    role: 'estudiante',
    clases: Object.fromEntries(cursos.map((k) => [k, CLASES[k].colegioId])),
  };
}

function avatarDe(c: CuentaManual, i: number) {
  const personaje = c.f ? (i % 2 ? 'vale' : 'sofi') : i % 2 ? 'santiago' : 'juan';
  const prendas = ['traje', 'sudadera', 'traje'];
  return { personaje, tono: 'original', pelo: 'original', prenda: prendas[i % 3], accesorio: null };
}

async function crearCuentas(): Promise<void> {
  for (const [i, c] of CUENTAS.entries()) {
    await auth.createUser({
      uid: c.id,
      email: c.email,
      password: PASSWORD,
      displayName: c.nombre,
      emailVerified: true,
    });
    const claims = claimsDe(c);
    await auth.setCustomUserClaims(c.id, claims);
    poner(`membership/${c.id}`, { ...claims, claimsUpdatedAt: FieldValue.serverTimestamp() });
    const user: Record<string, unknown> = {
      displayName: c.nombre,
      email: c.email,
      photoURL: null,
      provider: 'password',
      createdAt: Timestamp.fromMillis(AHORA - 90 * DIA),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (c.rol === 'estudiante' && c.perfil !== 'nuevo') {
      const avatar = avatarDe(c, i);
      user.profile = {
        nickname: c.nombre.split(' ')[0],
        fullName: c.nombre,
        avatarId: avatar.personaje,
        avatarEmoji: '',
        avatar,
      };
    }
    poner(`users/${c.id}`, user);
  }
  await confirmar();
}

// ---------------------------------------------------------------------------
// 2. Contenido global (bancos, Elige camino, micro-teoría) desde content/
// ---------------------------------------------------------------------------

const TIPOS_BANCO = ['multiple_choice', 'true_false', 'ordenar'];
const leerJson = (ruta: string) => JSON.parse(fs.readFileSync(ruta, 'utf8')) as Record<string, unknown>;

function sembrarContenidoGlobal(): number {
  let n = 0;
  const dirBancos = path.join(RAIZ, 'content', 'bancos');
  for (const f of fs.readdirSync(dirBancos).filter((x) => x.endsWith('.json'))) {
    const id = f.replace(/\.json$/, '');
    const col = TIPOS_BANCO.some((t) => id.endsWith(`_${t}`)) ? 'bancos' : 'bancosEligeCamino';
    poner(`${col}/${id}`, leerJson(path.join(dirBancos, f)));
    n++;
  }
  const dirTeoria = path.join(RAIZ, 'content', 'microteoria');
  for (const f of fs.readdirSync(dirTeoria).filter((x) => x.endsWith('.json'))) {
    poner(`microteoria/${f.replace(/\.json$/, '')}`, leerJson(path.join(dirTeoria, f)));
    n++;
  }
  return n;
}

interface Item {
  id: string;
  enunciado: string;
  tipo: string;
  dificultad: number;
  desempeno?: string;
  opciones?: string[];
  correctIndex?: number;
  respuesta?: boolean;
  elementos?: string[];
  ordenCanonico?: number[];
  prueba?: boolean;
  ambito?: string;
}

const cacheBancos = new Map<string, Item[]>();
/** Preguntas jugables de un mundo para el grado (sin las de la prueba). */
function preguntas(grado: string, worldId: string, incluirPrueba = false): Item[] {
  const clave = `${bancoDeGrado(grado)}_${worldId}_${incluirPrueba}`;
  if (cacheBancos.has(clave)) return cacheBancos.get(clave)!;
  const out: Item[] = [];
  for (const tipo of TIPOS_BANCO) {
    const f = path.join(RAIZ, 'content', 'bancos', `${bancoDeGrado(grado)}_${worldId}_${tipo}.json`);
    if (!fs.existsSync(f)) continue;
    for (const it of (leerJson(f).items as Item[]) ?? []) {
      if (!incluirPrueba && it.prueba) continue;
      out.push({ ...it, tipo });
    }
  }
  cacheBancos.set(clave, out);
  return out;
}

// ---------------------------------------------------------------------------
// 3. Instituciones, entidad, clases y configuración
// ---------------------------------------------------------------------------

function sembrarInstituciones(): void {
  for (const [id, c] of Object.entries(COLEGIOS)) {
    poner(`colegios/${id}`, {
      nombre: c.nombre,
      sedesEnabled: false,
      createdAt: Timestamp.fromMillis(AHORA - 120 * DIA),
      createdByUid: c.creador,
      ...(c.entidad
        ? {
            entidad: {
              nombre: c.nombre,
              tipo: 'colegio',
              creadaAt: AHORA - 120 * DIA,
              creadaPor: c.creador,
            },
            // Plan Colegio anual por estudiantes (dominio/entidad.ts LicenciaEntidad).
            licencia: { plan: 'colegio', ciclo: 'anual', hasta: AHORA + 230 * DIA, cupo: 600, cotizacionId: null },
          }
        : {}),
    });
  }

  // Miembros de la entidad (colegios/{cid}/profes): el admin es un permiso, no un claim.
  const miembros: [string, 'admin' | 'profe', number][] = [
    ['ie-admin', 'admin', 120],
    ['ie-carlos', 'profe', 110],
    ['ie-luz', 'profe', 105],
    ['ie-yolanda', 'profe', 100],
    ['ie-jhon', 'profe', 60],
  ];
  for (const [uid, rol, hace] of miembros) {
    const c = cuenta(uid);
    poner(`colegios/${IE}/profes/${uid}`, { uid, nombre: c.nombre, correo: c.email, rol, unidoAt: AHORA - hace * DIA });
  }
  // Daniela (Cadete, por fuera) tiene una invitación: al aceptarla su clase se muda.
  const daniela = cuenta('ie-daniela');
  const inv = {
    correo: daniela.email,
    rol: 'profe',
    invitadoPor: 'ie-admin',
    invitadoPorNombre: 'Patricia Gómez Restrepo',
    creadaAt: AHORA - 2 * DIA,
  };
  poner(`colegios/${IE}/invitacionesProfe/${daniela.email}`, inv);
  poner(`invitacionesProfe/${IE}:${daniela.email}`, { ...inv, colegioId: IE });

  // SIEE: escala 1,0–5,0 (Decreto 1290) y cuatro periodos del calendario A.
  poner(`colegios/${IE}/config/evaluacion`, {
    calendario: 'periodos',
    escala: {
      notaMin: 1,
      notaMax: 5,
      rangos: [
        { desempeno: 'bajo', min: 1 },
        { desempeno: 'basico', min: 3 },
        { desempeno: 'alto', min: 4 },
        { desempeno: 'superior', min: 4.6 },
      ],
    },
    periodos: [
      { nombre: 'Primer periodo', desde: '01-26', hasta: '04-03' },
      { nombre: 'Segundo periodo', desde: '04-13', hasta: '06-19' },
      { nombre: 'Tercer periodo', desde: '07-06', hasta: '09-11' },
      { nombre: 'Cuarto periodo', desde: '09-14', hasta: '11-27' },
    ],
    actualizadoAt: AHORA - 100 * DIA,
    actualizadoPor: 'ie-admin',
  });
}

function sembrarClases(): void {
  for (const k of Object.values(CLASES)) {
    const creado = Timestamp.fromMillis(AHORA - k.creadaHace * DIA);
    poner(`classCodes/${k.codigo}`, { colegioId: k.colegioId, cursoId: k.cursoId, createdAt: creado });
    poner(rutaClase(k), {
      nombre: k.nombre,
      grado: k.grado,
      profesorUids: k.profes,
      ...(k.soloCalificar ? { soloCalificar: k.soloCalificar } : {}),
      codigo: k.codigo,
      createdAt: creado,
      createdByUid: k.profes[0],
    });
  }

  // 9°B: requisitos para abrir mundos (dominio/requisitosMundo.ts) y muro encendido.
  const en = (d: number) => new Date(AHORA + d * DIA - 5 * HORA).toISOString().slice(0, 10);
  poner(`${rutaClase(CLASES['9b'])}/config/mundos`, {
    mundos: [
      { worldId: 'world_1', activo: true },
      { worldId: 'world_2', activo: true },
      { worldId: 'world_3', activo: true, requisitos: { desde: en(3), despuesDe: null, notaMinima: null } },
      { worldId: 'world_4', activo: true, requisitos: { desde: null, despuesDe: 'world_3', notaMinima: 3.5 } },
      { worldId: 'world_5', activo: true },
      { worldId: 'world_6', activo: false },
    ],
    overrides: {},
    version: 2,
    updatedAt: AHORA - 6 * DIA,
    updatedByUid: 'ie-carlos',
  });
  // Resumen semanal para acudientes encendido en 11°A, 9°B y Finanzas 10° (Comandante).
  for (const [kId, profe] of [['11a', 'ie-carlos'], ['9b', 'ie-carlos'], ['finanzas10', 'ie-natalia']]) {
    poner(`${rutaClase(CLASES[kId])}/config/comunicacion`, {
      acudientes: { activo: true },
      alertas: { inactividad: { activa: true, dias: 7 }, tarea: { activa: true }, promedio: { activa: true } },
      actualizadoAt: AHORA - 30 * DIA,
      actualizadoPor: profe,
    });
  }
  poner(`${rutaClase(CLASES['9b'])}/config/muro`,{ activo: true, actualizadoAt: AHORA - 12 * DIA, actualizadoPor: 'ie-carlos' });

  // 7°A: mundo propio de Luz Marina, "La tienda del barrio" (copy-on-write).
  const k7 = CLASES['7a'];
  const cw = 'cw_tienda_barrio';
  for (const tipo of TIPOS_BANCO) {
    const base = leerJson(path.join(RAIZ, 'content', 'bancos', `6_world_2_${tipo}.json`));
    poner(`${rutaClase(k7)}/contenido/banco_${cw}_${tipo}`, {
      bancoId: `banco_${cw}_${tipo}`,
      grado: '7',
      worldId: cw,
      tipo,
      version: 3,
      generadoPor: 'profesor',
      pendiente_validacion_docente: false,
      items: (base.items as Item[]).filter((it) => !it.prueba).map((it, i) => ({ ...it, id: `${cw}_${tipo}_${i + 1}`, competencia: 'presupuesto' })),
    });
  }
  const teoria = leerJson(path.join(RAIZ, 'content', 'microteoria', '6_world_2.json'));
  poner(`${rutaClase(k7)}/contenido/microteoria_${cw}`, {
    grado: '7',
    worldId: cw,
    cards: teoria.cards,
    generadoPor: 'profesor',
    pendiente_validacion_docente: false,
  });
  poner(`${rutaClase(k7)}/config/mundos`, {
    mundos: [
      ...MUNDOS.map((worldId) => ({ worldId, activo: true })),
      {
        worldId: cw,
        activo: true,
        nombre: 'La tienda del barrio',
        subtitle: 'Cuentas claras en la tienda',
        descripcion: 'Un mundo de la profe Luz Marina con compras, vueltos y fiado en la tienda de la esquina.',
        competencia: 'presupuesto',
        ambitosMen: ['presupuesto', 'contextualizacionFinanciera'],
      },
    ],
    overrides: { [cw]: { mc: true, vf: true, ordenar: true, teoria: true } },
    version: 3,
    updatedAt: AHORA - 20 * DIA,
    updatedByUid: 'ie-luz',
  });

  // 11°A: grupos (dominio/grupos.ts) para la clase en vivo y Análisis.
  const k11 = CLASES['11a'];
  const activos11 = CUENTAS.filter((c) => cursosDe(c).includes('11a') && c.perfil !== 'pendiente').map((c) => c.id);
  const nombres = ['Jaguares', 'Colibríes', 'Manatíes', 'Guacamayas'];
  const colores = ['#2F7BE5', '#2F9E5B', '#E5484D', '#D9901A'];
  poner(`${rutaClase(k11)}/config/grupos`, {
    grupos: nombres.map((nombre, g) => ({
      id: `g${g + 1}`,
      nombre,
      color: colores[g],
      uids: activos11.filter((_, i) => i % 4 === g),
    })),
    actualizadoAt: AHORA - 15 * DIA,
    actualizadoPor: 'ie-carlos',
  });

  // 3°A: leer en voz alta para toda la clase (por defecto en 1°–3°) y las adaptaciones de Matías.
  poner(`${rutaClase(CLASES['3a'])}/config/accesibilidad`, { leerEnVozAlta: true, actualizadoAt: AHORA - 30 * DIA, actualizadoPor: 'ie-yolanda' });
  poner(`${rutaEst(CLASES['3a'], 'ie-matias')}/adaptaciones/actual`, {
    masTiempo: true,
    menosOpciones: false,
    leerEnVozAlta: true,
    letraGrande: true,
    actualizadoAt: AHORA - 25 * DIA,
    actualizadoPor: 'ie-yolanda',
  });

  // Asignaciones (tareas con fecha), forma de asignacionShapeValida en las reglas.
  const asignaciones: [string, Record<string, unknown>][] = [
    ['ie-carlos', { worldId: 'world_4', target: { tipo: 'curso', cursoId: '11a' }, fechaInicio: AHORA - 3 * DIA, deadline: AHORA + 5 * DIA }],
    ['ie-carlos', { worldId: 'world_3', target: { tipo: 'curso', cursoId: '11a' }, fechaInicio: AHORA - 24 * DIA, deadline: AHORA - 10 * DIA }],
    ['ie-carlos', { kind: 'reto', reto: { tipo: 'crear_meta', cantidad: 1 }, target: { tipo: 'curso', cursoId: '11a' }, fechaInicio: AHORA - 2 * DIA, deadline: AHORA + 6 * DIA }],
    ['ie-carlos', { worldId: 'world_2', target: { tipo: 'curso', cursoId: '9b' }, fechaInicio: AHORA - 4 * DIA, deadline: AHORA + 3 * DIA }],
    ['ie-luz', { worldId: cw, target: { tipo: 'curso', cursoId: '7a' }, fechaInicio: AHORA - 2 * DIA, deadline: AHORA + 8 * DIA }],
    ['ie-yolanda', { worldId: 'world_1', target: { tipo: 'curso', cursoId: '3a' }, fechaInicio: AHORA - 5 * DIA, deadline: AHORA + 2 * DIA }],
  ];
  asignaciones.forEach(([profe, a], i) => {
    const k = Object.values(CLASES).find((x) => x.cursoId === (a.target as { cursoId: string }).cursoId)!;
    poner(`colegios/${k.colegioId}/asignaciones/manual-${i + 1}`, {
      ...a,
      createdByUid: profe,
      createdAt: (a.fechaInicio as number) - HORA,
    });
  });
}

// ---------------------------------------------------------------------------
// 4. Estudiantes: matrícula, semanas de intentos, visitas, avance y juego
// ---------------------------------------------------------------------------

interface Plan {
  /** Días con práctica (ms, ascendente). */
  dias: number[];
  /** Mundos conquistados (jefe ganado). */
  conquistados: number;
  /** Probabilidad de acertar. */
  nivel: number;
}

function planDe(id: string, perfil: Perfil, ventana: number): Plan | null {
  const r = azar(id);
  const entre = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const racha = (largo: number, terminaHace: number) => Array.from({ length: largo }, (_, k) => terminaHace + k);
  const sueltos = (n: number, desde: number, hasta: number) => Array.from({ length: n }, () => entre(desde, hasta));
  let hace: number[];
  let conquistados: number;
  let nivel: number;
  switch (perfil) {
    case 'estrella':
      hace = [...racha(18, 0), ...sueltos(22, 19, ventana)];
      conquistados = 4;
      nivel = 0.88;
      break;
    case 'fuerte':
      hace = [...racha(entre(5, 10), entre(0, 1)), ...sueltos(16, 12, ventana)];
      conquistados = entre(3, 4);
      nivel = 0.78;
      break;
    case 'medio':
      hace = [...racha(entre(1, 3), entre(0, 3)), ...sueltos(11, 6, ventana)];
      conquistados = entre(1, 3);
      nivel = 0.64;
      break;
    case 'flojo':
      hace = sueltos(5, entre(9, 18), ventana);
      conquistados = entre(0, 1);
      nivel = 0.46;
      break;
    default:
      return null;
  }
  const dias = [...new Set(hace.filter((h) => h <= ventana))].sort((a, b) => b - a).map((h, k) => dia(h, 14 + (k % 6), r()));
  return { dias: dias.sort((a, b) => a - b), conquistados, nivel };
}

/** Respuesta de una pregunta como la guarda construirIntento ("r"). */
function respuestaDe(it: Item, ok: boolean, r: () => number): string {
  if (it.tipo === 'true_false') return String(ok ? it.respuesta : !it.respuesta);
  if (it.tipo === 'ordenar') {
    const canon = it.ordenCanonico ?? (it.elementos ?? []).map((_, i) => i);
    if (ok) return canon.join('-');
    const mal = [...canon];
    const a = Math.floor(r() * mal.length);
    const b = (a + 1) % mal.length;
    [mal[a], mal[b]] = [mal[b], mal[a]];
    return mal.join('-');
  }
  const correcta = it.correctIndex ?? 0;
  if (ok) return String(correcta);
  const n = it.opciones?.length ?? 4;
  // La errada más común es la siguiente a la correcta: Análisis la muestra.
  return String(r() < 0.6 ? (correcta + 1) % n : (correcta + 2) % n);
}

interface Practica {
  tipo: 'leccion' | 'jefe';
  worldId: string;
  nivel: number | null;
  aciertos: number;
  total: number;
  ganado: boolean;
}

/** Arma los intentos de un estudiante en una clase (registroClase.ts IntentoClase). */
function intentosDe(uid: string, k: Clase, plan: Plan): { intentos: Record<string, unknown>[]; practicas: Practica[]; puntajes: Record<string, number> } {
  const r = azar(`${uid}@${k.cursoId}`);
  const intentos: Record<string, unknown>[] = [];
  const practicas: Practica[] = [];
  const puntajes: Record<string, number> = {};
  // Secuencia: 4 lecciones + jefe por mundo conquistado; luego 2 lecciones del siguiente.
  const cola: { tipo: 'leccion' | 'jefe'; worldId: string; nivel: number | null }[] = [];
  for (let w = 0; w < plan.conquistados; w++) {
    for (let n = 0; n < 4; n++) cola.push({ tipo: 'leccion', worldId: MUNDOS[w], nivel: n });
    cola.push({ tipo: 'jefe', worldId: MUNDOS[w], nivel: null });
  }
  if (plan.conquistados < 5) {
    for (let n = 0; n < 2; n++) cola.push({ tipo: 'leccion', worldId: MUNDOS[plan.conquistados], nivel: n });
  }
  const D = plan.dias.length;
  cola.forEach((paso, i) => {
    const cuando = plan.dias[Math.min(D - 1, Math.floor((i * D) / cola.length))] + (i % 3) * 9 * 60_000;
    const pool = preguntas(k.grado, paso.worldId);
    const n = paso.tipo === 'jefe' ? 10 : 5;
    const respuestas = [];
    let t = cuando;
    for (let q = 0; q < n; q++) {
      const it = pool[(i * 3 + q * 7 + Math.floor(r() * pool.length)) % pool.length];
      // Las preguntas de dificultad alta y las de ordenar cuestan más (Análisis las marca).
      const p = plan.nivel - (it.dificultad >= 3 ? 0.18 : 0) - (it.tipo === 'ordenar' ? 0.1 : 0);
      const ok = r() < p;
      const ms = 4000 + Math.floor(r() * (it.tipo === 'ordenar' ? 22000 : 12000));
      t += ms;
      respuestas.push({ p: it.id, t: it.tipo, ok, r: respuestaDe(it, ok, r), ms, ...(it.desempeno ? { d: it.desempeno } : {}) });
    }
    let aciertos = respuestas.filter((x) => x.ok).length;
    // El jefe se conquista con 8 de 10 (MASTERY_THRESHOLD); antes queda un intento perdido.
    if (paso.tipo === 'jefe' && aciertos < 8) {
      intentos.push(intento(paso, 'perdido', cuando - 25 * 60_000, respuestas.map((x) => ({ ...x }))));
      for (const x of respuestas) if (!x.ok && aciertos < 8) { x.ok = true; x.r = respuestaDe(pool.find((it) => it.id === x.p)!, true, r); aciertos++; }
    }
    const ganado = paso.tipo === 'leccion' || aciertos >= 8;
    intentos.push(intento(paso, 'completado', cuando, respuestas, t));
    practicas.push({ ...paso, aciertos, total: n, ganado });
    if (paso.tipo === 'jefe') puntajes[paso.worldId] = aciertos;
  });
  return { intentos, practicas, puntajes };
}

function intento(
  paso: { tipo: 'leccion' | 'jefe'; worldId: string; nivel: number | null },
  resultado: 'completado' | 'perdido',
  inicioAt: number,
  respuestas: { ok: boolean; ms: number }[],
  finAt = inicioAt + respuestas.reduce((s, x) => s + x.ms, 0)
): Record<string, unknown> {
  return {
    worldId: paso.worldId,
    tipo: paso.tipo,
    nivel: paso.tipo === 'leccion' ? paso.nivel : null,
    resultado,
    inicioAt,
    finAt,
    duracionMs: finAt - inicioAt,
    total: respuestas.length,
    aciertos: respuestas.filter((x) => x.ok).length,
    respuestas,
  };
}

/** Bóveda y un CDT para la estudiante destacada (como el Salón demo). */
function ahorroDestacada(e: EstadoOrbita, hoy: string, idx: number, total: number): EstadoOrbita {
  if (idx !== total - 9) return e;
  const d = depositar(e.boveda, Math.floor(e.boveda.bolsillo * 0.7));
  if (!d.ok) return e;
  const cdt = abrirCdt(d.estado, Math.min(Math.floor(e.boveda.bolsillo * 0.4), 2000), 4, hoy, 'cdt-manual-1');
  return { ...e, boveda: cdt.ok ? cdt.estado : d.estado };
}

const ESPERADOS: Record<string, { intentos: number; progreso: number }> = {};

function sembrarEstudiantes(): void {
  const VENTANA = 68; // días de actividad: desde finales de agosto
  for (const c of CUENTAS.filter((x) => x.rol === 'estudiante')) {
    const cursos = cursosDe(c);
    const todas: PracticaPlan[] = [];
    let diasJuego: number[] = [];
    for (const kId of cursos) {
      const k = CLASES[kId];
      const perfil = c.perfil ?? 'medio';
      const ventana = Math.min(VENTANA, k.creadaHace - 4);
      const plan = planDe(`${c.id}@${kId}`, perfil, ventana);
      const unido = AHORA - (ventana + 3) * DIA;
      const pendiente = perfil === 'pendiente';
      poner(rutaEst(k, c.id), {
        email: c.email,
        nombre: c.nombre,
        estado: pendiente ? 'pendiente_atestacion' : 'activo',
        atestado: !pendiente,
        joinedAt: Timestamp.fromMillis(unido),
        ...(pendiente
          ? {}
          : { politicaVersion: POLITICA_VERSION, atestadoPor: k.profes[0], atestadoAt: Timestamp.fromMillis(unido + 3 * HORA) }),
      });
      ESPERADOS[kId] ??= { intentos: 0, progreso: 0 };
      if (!plan) continue;

      const { intentos, practicas, puntajes } = intentosDe(c.id, k, plan);
      intentos.forEach((x, i) => {
        poner(`${rutaEst(k, c.id)}/intentos/i${String(i).padStart(3, '0')}`, {
          ...x,
          uid: c.id,
          creadoAt: Timestamp.fromMillis(x.finAt as number),
        });
      });
      ESPERADOS[kId].intentos += intentos.length;
      // Visitas por día (máximo una cada 30 min).
      const porDia = new Map<string, number[]>();
      for (const ms of plan.dias) {
        const d = new Date(ms - 5 * HORA).toISOString().slice(0, 10);
        porDia.set(d, [...(porDia.get(d) ?? []), ms]);
      }
      for (const [d, lista] of porDia) {
        const veces = 1 + (lista.length > 1 ? 1 : 0) + (azar(d + c.id)() < 0.3 ? 1 : 0);
        poner(`${rutaEst(k, c.id)}/visitas/${d}`, { dia: d, visitas: veces, ultimaAt: Math.max(...lista) + 40 * 60_000 });
      }
      // Avance por mundo (lo que escribe saga/[worldId].tsx al vencer al jefe).
      const ultimo = plan.dias[plan.dias.length - 1];
      for (const [w, correct] of Object.entries(puntajes)) {
        const cuando = intentos.filter((x) => x.worldId === w && x.tipo === 'jefe').map((x) => x.finAt as number).pop() ?? ultimo;
        poner(`${rutaEst(k, c.id)}/progress/${w}`, progreso(k, c.id, w, correct, cuando));
        ESPERADOS[kId].progreso++;
      }
      const enCurso = MUNDOS[plan.conquistados];
      if (enCurso && plan.conquistados < 5) {
        poner(`${rutaEst(k, c.id)}/progress/${enCurso}`, progreso(k, c.id, enCurso, Math.round(plan.nivel * 7), ultimo));
        ESPERADOS[kId].progreso++;
      }
      todas.push(...practicas.map((p) => ({ tipo: p.tipo, worldId: p.worldId, nivel: p.nivel ?? undefined, aciertos: Math.round((p.aciertos / p.total) * 5) })));
      diasJuego = [...diasJuego, ...plan.dias];
    }
    if (c.perfil === 'volvio') {
      poner(rutaJuego(c.id), docJuego(estadoQueVuelve()));
      continue;
    }
    if (c.perfil === 'invitada') {
      diasJuego = [9, 8, 7, 6].map((h) => dia(h, 18));
      for (let n = 0; n < 4; n++) todas.push({ tipo: 'leccion', worldId: 'world_1', nivel: n, aciertos: 4 });
    }
    if (c.perfil === 'galaxia') {
      // Juan David: sin clase, practica en su galaxia.
      diasJuego = [0, 1, 2, 3, 4, 5, 6, 8, 9, 12, 15, 19, 23].map((h) => dia(h, 19));
      for (let w = 0; w < 2; w++) {
        for (let n = 0; n < 4; n++) todas.push({ tipo: 'leccion', worldId: MUNDOS[w], nivel: n, aciertos: 4 });
        todas.push({ tipo: 'jefe', worldId: MUNDOS[w], aciertos: 5 });
      }
      todas.push({ tipo: 'leccion', worldId: 'world_3', nivel: 0, aciertos: 4 });
    }
    if (!diasJuego.length) continue;
    const dias = [...new Set(diasJuego)].sort((a, b) => a - b);
    const estado = reproducirJuego(
      dias,
      todas,
      AHORA,
      c.perfil === 'estrella' ? (e, hoy, _ms, idx) => ahorroDestacada(e, hoy, idx, dias.length) : undefined
    );
    poner(rutaJuego(c.id), docJuego(estado));
    // Resumen de Órbita copiado a cada clase (para el nivel y la racha en la ficha).
    for (const kId of cursos) {
      if (c.perfil === 'pendiente') continue;
      poner(`${rutaEst(CLASES[kId], c.id)}/resumen/orbita`, {
        xpTotal: estado.progreso.xpTotal,
        racha: calcularRacha(estado.racha, dayKey(AHORA)),
        mejorRacha: estado.racha.mejor ?? 0,
        diasAprendiendo: diasAprendiendo(estado.racha),
        actualizadoAt: AHORA - 2 * HORA,
      });
    }
  }
}

/**
 * Kevin vuelve después de unos días: practicó a diario hasta el domingo
 * anterior, dejó Cetis en la Bóveda y un CDT a una semana, y tiene dos
 * escudos. Su último ingreso fue ese domingo, así que al abrir hoy la app
 * (alAbrir) le pasan cosas: la Bóveda paga interés, el CDT venció y los
 * escudos cubren lo que pueden de la racha («Lo que pasó mientras no estabas»).
 */
function estadoQueVuelve(): EstadoOrbita {
  // dia() cuenta en fecha UTC: el domingo pasado está a getUTCDay() días (7 si hoy es domingo).
  const ultimo = new Date(AHORA).getUTCDay() || 7;
  // Mediodía en Bogotá: así el día UTC coincide con el local y el último ingreso cae en domingo.
  const dias = Array.from({ length: 16 }, (_, k) => dia(ultimo + 15 - k, 12));
  const practicas: PracticaPlan[] = [];
  for (let w = 0; w < 2; w++) {
    for (let n = 0; n < 4; n++) practicas.push({ tipo: 'leccion', worldId: MUNDOS[w], nivel: n, aciertos: 5 });
    practicas.push({ tipo: 'jefe', worldId: MUNDOS[w], aciertos: 5 });
  }
  const finUltimo = dias[dias.length - 1] + 2 * HORA;
  let e = reproducirJuego(dias, practicas, finUltimo, (est, diaClave, _ms, idx) => {
    // El CDT a 2 semanas se abre dos semanas menos un día antes del último ingreso: vence ya ausente.
    if (idx !== dias.length - 14) return est;
    const d = depositar(est.boveda, Math.floor(est.boveda.bolsillo * 0.8));
    if (!d.ok) return est;
    const cdt = abrirCdt(d.estado, Math.min(Math.floor(d.estado.boveda * 0.4), 1500), 2, diaClave, 'cdt-kevin-1');
    return { ...est, boveda: cdt.ok ? cdt.estado : d.estado };
  });
  e = { ...e, racha: { ...e.racha, escudos: 2 } };
  return e;
}

function progreso(k: Clase, uid: string, worldId: string, correct: number, now: number) {
  return buildWorldProgress({
    colegioId: k.colegioId,
    cursoId: k.cursoId,
    uid,
    worldId: worldId as (typeof MUNDOS)[number],
    correct,
    total: 10,
    now,
  }) as unknown as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 5. Prueba de entrada y salida (11°A), tarea abierta, muro e insignias
// ---------------------------------------------------------------------------

const activosDe = (kId: string) =>
  CUENTAS.filter((c) => cursosDe(c).includes(kId) && c.perfil !== 'pendiente');

function sembrarPruebaYTareas(): void {
  const k = CLASES['11a'];
  // Prueba: abierta y cerrada la entrada hace 7 semanas; la salida, esta semana.
  poner(`${rutaClase(k)}/config/prueba`, {
    pre: { abiertaAt: AHORA - 52 * DIA, cerradaAt: AHORA - 45 * DIA, abiertaPor: 'ie-carlos' },
    post: { abiertaAt: AHORA - 6 * DIA, cerradaAt: AHORA - 1 * DIA, abiertaPor: 'ie-carlos' },
  });
  // Las preguntas de prueba de cada mundo (prueba: true), con su ámbito del MEN.
  const items = MUNDOS.flatMap((w) => preguntas(k.grado, w, true).filter((it) => it.prueba));
  for (const c of activosDe('11a')) {
    if (c.perfil === 'dormido') continue;
    const r = azar(`prueba-${c.id}`);
    const base = c.perfil === 'estrella' ? 0.62 : c.perfil === 'fuerte' ? 0.5 : c.perfil === 'medio' ? 0.4 : 0.3;
    for (const [fase, p, hace] of [['pre', base, 48], ['post', Math.min(0.95, base + 0.28), 3]] as const) {
      if (fase === 'post' && c.perfil === 'flojo' && r() < 0.5) continue;
      const breakdown: Record<string, number> = {};
      const totales: Record<string, number> = {};
      let score = 0;
      for (const it of items) {
        const a = it.ambito ?? 'otro';
        totales[a] = (totales[a] ?? 0) + 1;
        const ok = r() < p;
        breakdown[a] = (breakdown[a] ?? 0) + (ok ? 1 : 0);
        if (ok) score++;
      }
      poner(`${rutaEst(k, c.id)}/impactTest/${fase}`, { score, total: items.length, takenAt: dia(hace, 10, r()), breakdown, totales });
    }
  }

  // Tarea abierta con rúbrica (dominio/rubricas.ts), con entregas.
  const tarea = {
    titulo: 'Presupuesto del paseo de grado',
    consigna:
      'El curso quiere ir a Coveñas en diciembre. Arma un presupuesto por persona: transporte, alojamiento, comida y un imprevisto. Explica de dónde sale la plata (ahorro, rifa, aporte de la familia) y qué recortarías si falta.',
    rubrica: {
      criterios: [
        { nombre: 'Gastos completos', niveles: niveles(['Faltan varios rubros', 'Faltan uno o dos', 'Todos los rubros', 'Todos y con precios reales']) },
        { nombre: 'Fuentes de dinero', niveles: niveles(['No las dice', 'Una sola fuente', 'Varias fuentes', 'Varias, con fechas y montos']) },
        { nombre: 'Plan B', niveles: niveles(['Sin plan B', 'Plan B vago', 'Recorta un gasto', 'Prioriza y justifica']) },
      ],
    },
    deadline: AHORA + 4 * DIA,
    worldId: 'world_2',
    estado: 'abierta',
    creadaPor: 'ie-carlos',
    creadaAt: AHORA - 9 * DIA,
  };
  poner(`${rutaClase(k)}/tareasAbiertas/paseo-grado`, tarea);
  const textos = [
    'Transporte Montería–Coveñas ida y vuelta $60.000, cabaña 2 noches dividida entre 6 $90.000, comida $75.000, imprevisto $25.000. Total $250.000. Ahorro $5.000 semanales desde septiembre y la rifa del curso. Si falta, dejamos la segunda noche.',
    'Bus $55.000, hotel $120.000, comida $60.000. Total $235.000. Mi mamá me ayuda con la mitad y lo otro lo ahorro de la mesada.',
    'Transporte $60.000, alojamiento $100.000, comida $80.000 y $30.000 para imprevistos. Vendo empanadas en el descanso los viernes y aparto lo que gano. Plan B: llevar comida preparada desde la casa.',
    'Gasto como $200.000. Pido prestado si me falta.',
    'Transporte en buseta del colegio $45.000, cabaña $85.000, mercado entre todos $50.000, imprevisto $20.000. Rifa de una ancheta $40.000 por persona y el resto ahorro. Si falta, cocinamos nosotros en vez de restaurante.',
  ];
  activosDe('11a')
    .filter((c) => c.perfil !== 'dormido')
    .slice(0, 10)
    .forEach((c, i) => {
      poner(`${rutaClase(k)}/tareasAbiertas/paseo-grado/entregas/${c.id}`, {
        uid: c.id,
        texto: textos[i % textos.length],
        entregadaAt: AHORA - (6 - (i % 5)) * DIA - i * HORA,
        calificada: false,
        calificacion: null,
      });
    });

  // Muro de preguntas de 9°B (dominio/muroClase.ts): publicadas, respondidas y pendientes.
  const k9 = CLASES['9b'];
  const est9 = activosDe('9b');
  const muro: [number, string, 'publicada' | 'pendiente', string | null, string | null][] = [
    [0, '¿Una tarjeta de crédito es plata que el banco me regala?', 'publicada', 'No: es un préstamo. Lo que gastes lo devuelves, y si te atrasas pagas intereses. Lo vemos en la Nebulosa del Crédito.', 'ie-carlos'],
    [3, '¿Cuánto debería ahorrar si me dan $20.000 a la semana?', 'publicada', 'Una regla fácil es apartar al menos el 10 % apenas te la den, o sea $2.000. Si tienes una meta, divide el valor entre las semanas que faltan.', 'ie-luz'],
    [5, '¿Qué es un CDT y por qué paga más que la alcancía?', 'publicada', null, null],
    [7, 'Profe, ¿el jueves hay clase en vivo?', 'pendiente', null, null],
    [9, '¿Es malo pedir fiado en la tienda?', 'pendiente', null, null],
  ];
  muro.forEach(([i, texto, estado, respuesta, por], n) => {
    const c = est9[i % est9.length];
    const creado = AHORA - (8 - n) * DIA - 3 * HORA;
    poner(`${rutaClase(k9)}/muro/m${n + 1}`, {
      uid: c.id,
      nombre: `${c.nombre.split(' ')[0]} ${c.nombre.split(' ').slice(-2, -1)[0][0]}.`,
      texto,
      estado,
      creadoAt: creado,
      respuesta,
      respondidaPor: por,
      respondidaPorNombre: por ? cuenta(por).nombre.split(' ').slice(0, 2).join(' ') : null,
      respondidaAt: por ? creado + 5 * HORA : null,
    });
  });

  // Insignias del profe (8 ids fijos de las reglas).
  const insignias: [string, string, string, string | null, number][] = [
    ['11a', 'ie-valentina', 'ahorro_estrella', 'Su plan de ahorro para la universidad fue el mejor de la clase.', 12],
    ['11a', 'ie-valentina', 'clase_en_vivo', 'Primer lugar en la clase en vivo del crédito.', 2],
    ['11a', 'ie-valentina', 'constancia', null, 20],
    ['9b', 'ie-santiago', 'gran_pregunta', 'Preguntó por el CDT en el muro y abrió la discusión.', 5],
    ['7a', 'ie-isabella', 'gran_avance', null, 9],
    ['3a', 'ie-matias', 'ayudo_companero', 'Le explicó a su compañero cómo contar las monedas.', 4],
  ];
  for (const [kId, uid, insignia, motivo, hace] of insignias) {
    const k2 = CLASES[kId];
    const profe = k2.profes[0];
    poner(`${rutaEst(k2, uid)}/insignias/${insignia}`, {
      insignia,
      motivo,
      dadaPor: profe,
      dadaPorNombre: cuenta(profe).nombre.split(' ').slice(0, 2).join(' '),
      dadaAt: AHORA - hace * DIA,
    });
  }
  // Jhon Jairo (ve y califica) también da insignias en 11°A.
  const otra = activosDe('11a').find((c) => c.perfil === 'fuerte');
  if (otra) {
    poner(`${rutaEst(k, otra.id)}/insignias/pensamiento_critico`, {
      insignia: 'pensamiento_critico',
      motivo: 'Comparó tres créditos y explicó cuál convenía.',
      dadaPor: 'ie-jhon',
      dadaPorNombre: 'Jhon Jairo',
      dadaAt: AHORA - 3 * DIA,
    });
  }
}

function niveles(descriptores: string[]) {
  return ['Bajo', 'Básico', 'Alto', 'Superior'].map((nombre, i) => ({ nombre, puntos: i + 1, descriptor: descriptores[i] }));
}

// ---------------------------------------------------------------------------
// 6. Suscripciones de los profes que no están en la entidad
// ---------------------------------------------------------------------------

function docSuscripcion(sub: Suscripcion): Record<string, unknown> {
  const v = vigencia(sub);
  return { ...sub, planVigente: v.plan, vigenteHasta: v.hasta, actualizadoAt: AHORA };
}

function sembrarCobros(): void {
  // Daniela: la prueba de Piloto venció; el ciclo diario la bajó a Cadete.
  let cadete = nuevaSuscripcion('ie-daniela', AHORA - 30 * DIA);
  cadete = cicloDiario(cadete, (cadete.pruebaHasta ?? AHORA) - 2 * DIA).sub;
  cadete = cicloDiario(cadete, (cadete.pruebaHasta ?? AHORA) + 6 * HORA).sub;
  poner('suscripciones/ie-daniela', docSuscripcion(cadete));

  const pagar = (uid: string, plan: 'piloto' | 'comandante', ciclo: 'mensual' | 'semestral', pagos: number[], metodo: 'tarjeta' | 'nequi') => {
    let sub = nuevaSuscripcion(uid, pagos[0] - 3 * DIA);
    const monto = precioPlan(plan, ciclo);
    const email = cuenta(uid).email;
    pagos.forEach((ms, i) => {
      sub = aplicarPagoAprobado(sub, { plan, ciclo, montoCop: monto, fundador: false, fuentePagoId: `fuente_${uid}`, metodo, ahora: ms });
      const referencia = `${i ? 'ren' : 'ceti'}_${uid.slice(0, 8)}_${ms}`;
      poner(`pagos/${referencia}`, {
        uid,
        referencia,
        plan,
        ciclo,
        montoCop: monto,
        estado: 'aprobado',
        metodo,
        tipo: 'recurrente',
        creadoAt: ms - 60_000,
        facturaUrl: null,
        email,
        fundador: false,
        renovacion: i > 0,
        fuentePagoId: `fuente_${uid}`,
        wompiTxId: `tx-manual-${uid}-${i}`,
        finPeriodo: sub.finPeriodo,
        aprobadoAt: ms,
        alerta: null,
      });
    });
    poner(`suscripciones/${uid}`, docSuscripcion(sub));
  };
  pagar('ie-sebastian', 'piloto', 'mensual', [AHORA - 52 * DIA, AHORA - 22 * DIA], 'nequi');
  pagar('ie-natalia', 'comandante', 'semestral', [AHORA - 64 * DIA], 'tarjeta');
}

// ---------------------------------------------------------------------------
// 7. Joven B2C (Juan David): metas, aportes y gastos en "Mi galaxia"
// ---------------------------------------------------------------------------

function sembrarJoven(): void {
  const uid = 'ie-juan';
  const t = (h: number) => dia(h, 12);
  const metas = [
    { id: 'meta-bici', title: 'Bicicleta para ir al colegio', iconId: 'bike', category: 'transport', targetAmount: 650_000, deadline: AHORA + 90 * DIA, creada: 40 },
    { id: 'meta-celular', title: 'Celular nuevo', iconId: 'phone', category: 'electronics', targetAmount: 900_000, deadline: AHORA + 180 * DIA, creada: 25 },
  ];
  for (const m of metas) {
    poner(`users/${uid}/goals/${m.id}`, { id: m.id, title: m.title, iconId: m.iconId, category: m.category, targetAmount: m.targetAmount, deadline: m.deadline, createdAt: t(m.creada), updatedAt: t(2) });
  }
  const aportes: [string, number, string, number][] = [
    ['meta-bici', 50_000, 'Ayudé a mi tío en el taller', 35],
    ['meta-bici', 30_000, 'Mesada', 21],
    ['meta-bici', 45_000, 'Vendí mis tenis viejos', 12],
    ['meta-celular', 40_000, 'Cumpleaños', 18],
    ['meta-celular', 20_000, 'Mesada', 4],
  ];
  aportes.forEach(([goalId, amount, description, hace], i) => {
    poner(`users/${uid}/deposits/aporte-${i + 1}`, { id: `aporte-${i + 1}`, type: 'aporte', amount, description, goalId, fecha: t(hace), createdAt: t(hace), updatedAt: t(hace) });
  });
  const gastos: [number, string, string, number][] = [
    [6_000, 'Empanada y jugo en el descanso', 'comida', 0],
    [3_200, 'Bus al colegio', 'transporte', 0],
    [15_000, 'Recarga de datos', 'tecnologia', 2],
    [12_000, 'Cine en el centro comercial', 'entretenimiento', 5],
    [8_500, 'Cuaderno y lapiceros', 'educacion', 7],
    [6_400, 'Bus de la semana', 'transporte', 8],
  ];
  gastos.forEach(([monto, descripcion, categoria, hace], i) => {
    poner(`users/${uid}/movimientos/mov-${i + 1}`, { id: `mov-${i + 1}`, tipo: 'gasto', monto, descripcion, categoria, origen: i % 3 === 0 ? 'voz' : 'manual', fecha: t(hace), createdAt: t(hace), updatedAt: t(hace) });
  });
  poner(`users/${uid}/config/presupuestos`, { topes: { comida: 80_000, transporte: 40_000, entretenimiento: 30_000 }, updatedAt: t(20) });
}

// ---------------------------------------------------------------------------
// 8. Callables reales del emulador (con el token de cada cuenta)
// ---------------------------------------------------------------------------

const tokens = new Map<string, string>();
async function token(uid: string): Promise<string> {
  if (tokens.has(uid)) return tokens.get(uid)!;
  const r = await fetch(`http://${HOST_AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: cuenta(uid).email, password: PASSWORD, returnSecureToken: true }),
  });
  const j = (await r.json()) as { idToken?: string };
  if (!j.idToken) throw new Error(`No pude entrar como ${uid}.`);
  tokens.set(uid, j.idToken);
  return j.idToken;
}

async function llamar<T = Record<string, unknown>>(uid: string, fn: string, data: Record<string, unknown>): Promise<T> {
  const r = await fetch(`http://${HOST_FUNCTIONS}/${PROYECTO}/us-central1/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await token(uid)}` },
    body: JSON.stringify({ data }),
  });
  const j = (await r.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(`${fn} (${uid}): ${j.error.message}`);
  return j.result as T;
}

/** Una llamada que puede fallar sin tumbar la siembra (se avisa). */
async function intentar(etiqueta: string, f: () => Promise<unknown>): Promise<void> {
  try {
    await f();
  } catch (e) {
    console.warn(`  ⚠ ${etiqueta}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function sembrarConCallables(): Promise<void> {
  const k11 = CLASES['11a'];
  const k9 = CLASES['9b'];
  const k7 = CLASES['7a'];
  const k3 = CLASES['3a'];
  const est11 = activosDe('11a');

  // Comunicación (comunicacion.ts): anuncios, mensajes y comentarios.
  const anuncios: [string, Clase, string][] = [
    ['ie-carlos', k11, 'Esta semana cerramos la Nebulosa del Crédito. El jueves hacemos clase en vivo: traigan el celular cargado.'],
    ['ie-carlos', k11, 'Recuerden la tarea del paseo de grado: la rúbrica está en Tareas. Pueden entregar hasta el lunes.'],
    ['ie-carlos', k9, 'Ya está abierto el muro de preguntas. Pregunten sin miedo: yo reviso antes de publicar.'],
    ['ie-luz', k7, 'Nuevo mundo: La tienda del barrio. Practiquen vueltos y fiado antes del viernes.'],
    ['ie-yolanda', k3, 'Mañana jugamos con las monedas en clase. Pidan permiso en casa para traer una alcancía.'],
  ];
  for (const [profe, k, texto] of anuncios) {
    await intentar('anuncio', () => llamar(profe, 'enviarComunicado', { colegioId: k.colegioId, cursoId: k.cursoId, tipo: 'anuncio', texto }));
  }
  const flojos = est11.filter((c) => c.perfil === 'flojo' || c.perfil === 'dormido').map((c) => c.id);
  await intentar('mensaje', () =>
    llamar('ie-carlos', 'enviarComunicado', {
      colegioId: IE,
      cursoId: '11a',
      tipo: 'mensaje',
      para: flojos,
      texto: 'Hola. Vi que llevas días sin entrar a Ceti. Te quedan dos lecciones del Agujero Negro: con 15 minutos hoy alcanzas. Cuenta conmigo si algo no se entiende.',
    })
  );
  await intentar('retro', () =>
    llamar('ie-carlos', 'enviarComunicado', {
      colegioId: IE,
      cursoId: '11a',
      tipo: 'retro',
      para: ['ie-valentina'],
      contexto: { worldId: 'world_4' },
      texto: 'Muy bien en la Nebulosa del Crédito, Valentina. Tu explicación de la tasa efectiva anual le sirvió a todo el curso.',
    })
  );
  await intentar('retro 9b', () =>
    llamar('ie-luz', 'enviarComunicado', {
      colegioId: IE,
      cursoId: '9b',
      tipo: 'retro',
      para: ['ie-santiago'],
      contexto: { worldId: 'world_2' },
      texto: 'Santiago, revisa la lección 3 de la Luna del Presupuesto: confundiste gasto fijo con variable.',
    })
  );

  // Acudiente de Valentina (acudientes.ts): enlace y correo autorizado.
  let tokenAcudiente: string | null = null;
  await intentar('acudiente', async () => {
    const r = await llamar<{ token?: string }>('ie-carlos', 'gestionarAcudiente', { colegioId: IE, cursoId: '11a', uid: 'ie-valentina', accion: 'enlace' });
    tokenAcudiente = r.token ?? null;
    await llamar('ie-carlos', 'gestionarAcudiente', { colegioId: IE, cursoId: '11a', uid: 'ie-valentina', accion: 'correo', correo: 'rosa.polo@correo.test', autorizado: true });
  });
  await intentar('acudiente 9b', () =>
    llamar('ie-carlos', 'gestionarAcudiente', { colegioId: IE, cursoId: '9b', uid: 'ie-santiago', accion: 'enlace' })
  );

  // Certificados (certificados.ts) para quienes conquistaron los mundos 1 a 3.
  const mundosCert = ['world_1', 'world_2', 'world_3'];
  const certificados: { uid: string; codigo: string }[] = [];
  await intentar('certificados', async () => {
    const r = await llamar<{ emitidos: { uid: string; codigo: string }[] }>('ie-carlos', 'emitirCertificados', {
      cursoId: '11a',
      uids: est11.map((c) => c.id),
      mundos: mundosCert,
      nombresMundos: Object.fromEntries(mundosCert.map((w) => [w, NOMBRE_MUNDO[w]])),
    });
    certificados.push(...r.emitidos);
  });
  // Uno revocado (emitido por error a quien ya se retiró del colegio): queda el estado.
  const revocar = certificados.find((x) => x.uid !== 'ie-valentina');
  if (revocar) {
    await intentar('revocar', () => llamar('ie-carlos', 'revocarCertificado', { cursoId: '11a', codigo: revocar.codigo, motivo: 'Emitido por error.' }));
  }

  // Calificar con rúbrica (claseAbierta.ts): las primeras entregas.
  const entregas = await db.collection(`${rutaClase(k11)}/tareasAbiertas/paseo-grado/entregas`).get();
  const elecciones = [[3, 3, 3], [2, 1, 1], [3, 2, 3], [0, 0, 0], [3, 3, 2], [2, 2, 2]];
  const comentarios = [
    'Excelente: precios reales y un plan B claro.',
    'Te falta el imprevisto y decir cuánto ahorras por semana.',
    'Muy bien la venta de empanadas como fuente. Revisa la suma.',
    'Pedir prestado no es un plan. Vuelve a intentarlo con fuentes propias.',
    'Bien. El plan B puede priorizar mejor.',
    'Completo, aunque faltan fechas.',
  ];
  for (const [i, d] of entregas.docs.slice(0, 6).entries()) {
    await intentar('calificar', () =>
      llamar(i % 2 ? 'ie-jhon' : 'ie-carlos', 'calificarEntrega', { cursoId: '11a', tareaId: 'paseo-grado', uid: d.id, niveles: elecciones[i], comentario: comentarios[i] })
    );
  }

  // Clase en vivo completa en 11°A (claseVivo.ts), con respuestas de la clase.
  await intentar('clase en vivo', () => claseEnVivo(k11, est11.map((c) => c.id)));

  // Entidad: dominio institucional, plataforma LTI, cotización y cierre del periodo 3.
  await intentar('dominio', () => llamar('ie-admin', 'gestionarDominiosEntidad', { accion: 'agregar', dominio: 'ieceti.edu.co' }));
  await intentar('LTI', () =>
    llamar('ie-admin', 'gestionarPlataformaLti', {
      accion: 'registrar',
      nombre: 'Moodle IE Ceti',
      issuer: 'https://aulas.ieceti.edu.co',
      clientId: 'ceti-moodle-01',
      deploymentId: '1',
      authLoginUrl: 'https://aulas.ieceti.edu.co/mod/lti/auth.php',
      keysetUrl: 'https://aulas.ieceti.edu.co/mod/lti/certs.php',
    })
  );
  await intentar('cotización', () => llamar('ie-admin', 'cotizarPlanEntidad', { plan: 'colegio', ciclo: 'anual', cantidad: 600 }));
  await intentar('cierre', () => llamar('ie-admin', 'cerrarPeriodoEntidad', { anio: new Date(AHORA).getFullYear(), periodo: 3 }));

  // Bibliotecas: el mundo de Luz Marina en la de la entidad y en la pública.
  await intentar('biblioteca entidad', () => llamar('ie-luz', 'publicarEnBiblioteca', { cursoId: '7a', worldId: 'cw_tienda_barrio' }));
  await intentar('biblioteca pública', () => llamar('ie-luz', 'publicarEnBibliotecaPublica', { cursoId: '7a', worldId: 'cw_tienda_barrio' }));

  if (tokenAcudiente) console.log(`  · Enlace del acudiente de Valentina: /acudiente/${tokenAcudiente}`);
  const cert = certificados.find((x) => x.uid === 'ie-valentina');
  if (cert) console.log(`  · Certificado de Valentina: /certificado/${cert.codigo}`);
  fs.writeFileSync(
    path.join(__dirname, '.ultima-siembra.json'),
    JSON.stringify({ acudiente: tokenAcudiente, certificado: cert?.codigo ?? null, revocado: revocar?.codigo ?? null }, null, 2)
  );
}

/** Una sesión de clase en vivo de punta a punta, con las respuestas de la clase. */
async function claseEnVivo(k: Clase, uids: string[]): Promise<void> {
  const pool = preguntas(k.grado, 'world_4').filter((it) => it.tipo !== 'ordenar').slice(0, 5);
  const preguntasVivo = pool.map((it) => ({
    id: it.id,
    tipo: it.tipo,
    enunciado: it.enunciado,
    ...(it.tipo === 'true_false'
      ? { opciones: ['Verdadero', 'Falso'], correcta: it.respuesta ? 0 : 1 }
      : { opciones: it.opciones, correcta: it.correctIndex }),
    d: it.desempeno,
  }));
  const vivo = (accion: string, extra: Record<string, unknown> = {}) =>
    llamar<{ sesion: { id: string; pregunta?: { n: number; opciones: string[] } } }>('ie-carlos', 'operarClaseVivo', { cursoId: k.cursoId, accion, ...extra });
  const { sesion } = await vivo('crear', { worldId: 'world_4', titulo: 'Repaso: Nebulosa del Crédito', segundos: 20, preguntas: preguntasVivo });
  const ref = db.doc(`${rutaClase(k)}/vivo/actual`);
  for (const uid of uids) await ref.collection('presentes').doc(uid).set({ sesion: sesion.id, entradaAt: Date.now() });
  for (let q = 0; q < preguntasVivo.length; q++) {
    const s = await vivo('siguiente');
    const n = s.sesion.pregunta!.n;
    for (const [i, uid] of uids.entries()) {
      const r = azar(`${uid}-vivo-${q}`);
      if (r() < 0.12) continue; // no alcanzó a responder
      const acierta = r() < (uid === 'ie-valentina' ? 0.95 : 0.66);
      const opciones = preguntasVivo[q].opciones!.length;
      const resp = acierta ? (preguntasVivo[q].correcta as number) : ((preguntasVivo[q].correcta as number) + 1) % opciones;
      await ref.collection('respuestas').doc(`${n}_${uid}`).set({
        uid,
        n,
        r: resp,
        sesion: sesion.id,
        creadoAt: Timestamp.fromMillis(Date.now() + 800 + i * 350 + Math.floor(r() * 6000)),
      });
    }
    await vivo('revelar');
  }
  await vivo('terminar');
  await vivo('cerrar');
}

// ---------------------------------------------------------------------------
// 9. Esperar los disparadores y correr las tareas programadas
// ---------------------------------------------------------------------------

async function esperarDisparadores(): Promise<boolean> {
  const limite = Date.now() + 240_000;
  while (Date.now() < limite) {
    const listos = await Promise.all(
      Object.values(CLASES).map(async (k) => {
        const quiere = ESPERADOS[k.cursoId]?.intentos ?? 0;
        if (!quiere) return true;
        const s = await db.collection(`${rutaClase(k)}/estudiantes`).get();
        let suma = 0;
        for (const e of s.docs) {
          const r = await e.ref.collection('resumen').doc('clase').get();
          suma += (r.get('intentos') as number | undefined) ?? 0;
        }
        return suma >= quiere;
      })
    );
    if (listos.every(Boolean)) return true;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

async function main(): Promise<void> {
  const activos = await emuladoresActivos();
  if (!activos.includes('firestore') || !activos.includes('auth') || !activos.includes('functions')) {
    throw new Error('Los emuladores no están arriba (Auth, Firestore y Functions). Corre primero: npm run salon:emuladores');
  }
  console.log(`Institución Educativa Ceti → emuladores de ${PROYECTO} (Firestore ${HOST_FIRESTORE}, Auth ${HOST_AUTH})`);
  await limpiar();
  console.log('· Emulador limpio');

  await crearCuentas();
  console.log(`· ${CUENTAS.length} cuentas con claims y perfil`);

  const n = sembrarContenidoGlobal();
  sembrarInstituciones();
  sembrarClases();
  sembrarCobros();
  sembrarJoven();
  await confirmar();
  console.log(`· Contenido global (${n} docs), la entidad, 7 clases, suscripciones y el joven sin clase`);

  sembrarEstudiantes();
  sembrarPruebaYTareas();
  await confirmar();
  const total = Object.values(ESPERADOS).reduce((s, x) => s + x.intentos, 0);
  console.log(`· Matrícula, ${total} intentos con desempeños, visitas, avance, prueba, tarea, muro e insignias`);

  process.stdout.write('· Esperando a onIntentoClase y onProgressWriteAggregate… ');
  console.log((await esperarDisparadores()) ? 'listos' : 'tardaron (sigo igual)');

  await sembrarConCallables();
  console.log('· Comunicados, acudiente, certificados, clase en vivo, calificaciones, dominio, LTI, cotización, cierre y bibliotecas');

  const alertas = await correrAlertasProfe(Date.now(), db);
  const correos = await correrResumenAcudientes(Date.now(), db);
  for (const colegioId of Object.keys(COLEGIOS)) await recalcularAdopcionColegio(colegioId, AHORA, db);
  for (const uid of ['ie-carlos', 'ie-luz', 'ie-yolanda', 'ie-daniela', 'ie-sebastian', 'ie-natalia']) {
    const c = cuenta(uid);
    const profe = { uid, colegioId: c.colegio!, email: c.email, nombre: c.nombre };
    await bitacoraDeProfe(db, profe, AHORA - 7 * DIA);
    await bitacoraDeProfe(db, profe, AHORA);
  }
  console.log(`· ${alertas.alertas} alertas, ${correos.enviados} resúmenes de acudientes, adopción y Bitácoras`);

  console.log(`\nListo. Contraseña de todas las cuentas (solo emulador): ${PASSWORD}`);
  console.log('Entra con un toque: /dev/entrar?cuenta=<id>&ir=<ruta>');
  for (const c of CUENTAS.filter((x) => x.rol !== 'estudiante' || x.perfil === 'estrella' || x.perfil === 'galaxia')) {
    console.log(`  ${c.id.padEnd(14)} ${c.nombre}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('✗', e instanceof Error ? e.message : e);
    process.exit(1);
  });
