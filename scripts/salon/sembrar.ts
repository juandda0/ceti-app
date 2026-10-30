/**
 * Siembra del Salón demo en los EMULADORES locales (proyecto demo-ceti).
 * Idempotente: borra todo el emulador (Firestore + Auth) y lo recrea.
 *
 *   npm run salon:emuladores   # en otra terminal
 *   npm run salon:sembrar
 *
 * Escribe con las mismas formas que el servidor y la app (functions/src/index.ts,
 * functions/src/educadores/**, src/shared/types/tenancy.ts, firestore.rules) y
 * construye los estados con sus funciones puras: buildWorldProgress (progreso),
 * completarPractica/alAbrir (Órbita), nuevaSuscripcion/aplicarPagoAprobado/
 * cicloDiario (cobros). Los agregados de curso los calcula el disparador real
 * onProgressWriteAggregate en el emulador de Functions; la adopción y la
 * Bitácora se generan llamando a las funciones del servidor.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { DocumentReference } from 'firebase-admin/firestore';
import { buildWorldProgress } from '@features/learning/data/worldProgress';
import { abrirCdt, depositar } from '@features/orbita/domain/boveda';
import type { EstadoOrbita } from '@features/orbita/domain/orbita';
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
import {
  auth,
  avatarDe,
  azar,
  cuenta,
  CUENTAS,
  DIA_MS as DIA,
  CURSOS,
  db,
  docJuego,
  emuladoresActivos,
  FieldValue,
  HOST_AUTH,
  HOST_FIRESTORE,
  MUNDOS,
  PASSWORD,
  PROYECTO,
  RAIZ,
  reproducirJuego,
  rutaJuego,
  Timestamp,
  type Cuenta,
  type CursoSalon,
  type PracticaPlan,
} from './comun';

const AHORA = Date.now();
const POLITICA_VERSION = 'v1'; // CourseManageScreen.POLICY_VERSION

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
  if (!r1.ok || !r2.ok)
    throw new Error(`No se pudo limpiar el emulador (${r1.status}/${r2.status}).`);
}

// ---------------------------------------------------------------------------
// 1. Cuentas: Auth + claims + membership + users/{uid}
// ---------------------------------------------------------------------------

function claimsDe(c: Cuenta): Record<string, string> {
  if (c.rol === 'admin') return { role: 'admin' };
  if (c.rol === 'profesor') return { role: 'profesor', colegioId: colegioDeProfe(c.id) };
  if (!c.curso) return { role: 'estudiante' };
  const k = CURSOS[c.curso];
  return { role: 'estudiante', colegioId: k.colegioId, cursoId: k.cursoId };
}

/** Profes de la entidad San Mateo que no son dueños de una clase (Fase 6). */
const PROFES_SIN_CLASE: Record<string, string> = { 'admin-entidad': 'san-mateo', 'profe-sm': 'san-mateo' };

function colegioDeProfe(uid: string): string {
  if (PROFES_SIN_CLASE[uid]) return PROFES_SIN_CLASE[uid];
  const k = Object.values(CURSOS).find((x) => x.profe === uid);
  if (!k) throw new Error(`Profe sin curso: ${uid}`);
  return k.colegioId;
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
    // Igual que applyClaims (functions/src/index.ts): claims + espejo en membership.
    await auth.setCustomUserClaims(c.id, claims);
    poner(`membership/${c.id}`, { ...claims, claimsUpdatedAt: FieldValue.serverTimestamp() });

    const user: Record<string, unknown> = {
      displayName: c.nombre,
      email: c.email,
      photoURL: null,
      provider: 'unknown',
      createdAt: Timestamp.fromMillis(AHORA - 60 * DIA),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (c.rol === 'estudiante') {
      const avatar = avatarDe(c.nombre, i);
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

function leerJson(ruta: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(ruta, 'utf8')) as Record<string, unknown>;
}

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

// ---------------------------------------------------------------------------
// 3. Colegios, cursos, códigos y roster
// ---------------------------------------------------------------------------

const COLEGIOS: Record<
  string,
  {
    nombre: string;
    profe: string;
    licencia?: Record<string, unknown>;
    entidad?: Record<string, unknown>;
  }
> = {
  'san-mateo': {
    nombre: 'Colegio San Mateo',
    profe: 'profe-piloto',
    // Licencia Nave de antes de la Fase 6 (= plan Colegio): prueba la compatibilidad.
    licencia: { plan: 'nave', hasta: AHORA + 240 * DIA, estudiantes: 150, padrino: null },
    entidad: { nombre: 'Colegio San Mateo', tipo: 'colegio', creadaAt: AHORA - 60 * DIA, creadaPor: 'profe-piloto' },
  },
  'los-andes': { nombre: 'Colegio Los Andes', profe: 'profe-cadete' },
  'nuevo-horizonte': { nombre: 'Colegio Nuevo Horizonte', profe: 'profe-prueba' },
};

function sembrarColegiosYCursos(): void {
  for (const [id, c] of Object.entries(COLEGIOS)) {
    poner(`colegios/${id}`, {
      nombre: c.nombre,
      sedesEnabled: false,
      createdAt: Timestamp.fromMillis(AHORA - (id === 'nuevo-horizonte' ? 6 : 90) * DIA),
      createdByUid: c.profe,
      ...(c.licencia ? { licencia: c.licencia } : {}),
      ...(c.entidad ? { entidad: c.entidad } : {}),
    });
  }
  for (const k of Object.values(CURSOS)) {
    const creado = Timestamp.fromMillis(AHORA - (k.cursoId === '7c' ? 5 : 80) * DIA);
    // Igual que crearMiCurso.
    poner(`classCodes/${k.codigo}`, {
      colegioId: k.colegioId,
      cursoId: k.cursoId,
      createdAt: creado,
    });
    poner(`colegios/${k.colegioId}/cursos/${k.cursoId}`, {
      nombre: k.nombre,
      grado: k.grado,
      // 9°A tiene co-docente (Fase 6): Jorge acompaña a Andrés.
      profesorUids: k.cursoId === '9a' ? [k.profe, 'profe-sm'] : [k.profe],
      codigo: k.codigo,
      createdAt: creado,
      createdByUid: k.profe,
    });
  }
}

// ---------------------------------------------------------------------------
// 4. Estudiantes de clase: roster, progreso por mundo y estado de juego
// ---------------------------------------------------------------------------

type Perfil = 'estrella' | 'fuerte' | 'medio' | 'flojo' | 'dormido' | 'pendiente';

function perfilDe(id: string): Perfil {
  const n = Number(id.split('-').pop());
  if (id.startsWith('est-')) {
    if (n === 1) return 'estrella';
    if (n <= 6) return 'fuerte';
    if (n <= 14 || n === 24) return 'medio';
    if (n <= 19) return 'flojo';
    if (n <= 22) return 'dormido';
    return 'pendiente';
  }
  if (id.startsWith('est9a-')) {
    if (n <= 3) return 'fuerte';
    if (n <= 8) return 'medio';
    if (n <= 10) return 'flojo';
    return n === 11 ? 'dormido' : 'pendiente';
  }
  if (id.startsWith('andes-')) return n <= 2 ? 'medio' : n <= 4 ? 'flojo' : 'dormido';
  return n === 1 ? 'medio' : n === 2 ? 'flojo' : 'dormido'; // horizonte-*
}

interface Actividad {
  /** Días con práctica (epoch ms, ascendente). */
  dias: number[];
  completados: number;
  /** Aciertos de 10 en el quiz de cada mundo terminado. */
  aciertosMundo: number[];
  /** Mundo en curso (sin dominar): aciertos de 10, o null. */
  enCurso: number | null;
  aciertosLeccion: [number, number];
}

function dia(haceDias: number, hora = 16, rnd = 0): number {
  // Tarde en Bogotá (UTC-5), con unos minutos de variación.
  const base = new Date(AHORA - haceDias * DIA);
  base.setUTCHours(hora + 5, Math.floor(rnd * 50), 0, 0);
  return Math.min(base.getTime(), AHORA - 60_000);
}

function actividadDe(id: string, perfil: Perfil): Actividad | null {
  const r = azar(id);
  const entre = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const racha = (largo: number, terminaHace: number) =>
    Array.from({ length: largo }, (_, k) => terminaHace + largo - 1 - k);
  const sueltos = (cuantos: number, desde: number, hasta: number) =>
    Array.from({ length: cuantos }, () => entre(desde, hasta));
  let hace: number[];
  let a: Omit<Actividad, 'dias'>;
  switch (perfil) {
    case 'estrella':
      hace = [...racha(15, 0), ...sueltos(8, 17, 40)];
      a = { completados: 4, aciertosMundo: [10, 9, 10, 9], enCurso: 6, aciertosLeccion: [4, 5] };
      break;
    case 'fuerte': {
      const largo = entre(6, 12);
      hace = [...racha(largo, entre(0, 1)), ...sueltos(5, largo + 2, 35)];
      const c = entre(3, 4);
      a = {
        completados: c,
        aciertosMundo: Array.from({ length: c }, () => entre(8, 10)),
        enCurso: c < 5 ? entre(5, 7) : null,
        aciertosLeccion: [4, 5],
      };
      break;
    }
    case 'medio': {
      const largo = entre(1, 4);
      hace = [...racha(largo, entre(0, 3)), ...sueltos(4, largo + 5, 30)];
      const c = entre(1, 3);
      a = {
        completados: c,
        aciertosMundo: Array.from({ length: c }, () => entre(8, 9)),
        enCurso: entre(6, 7),
        aciertosLeccion: [3, 4],
      };
      break;
    }
    case 'flojo':
      hace = sueltos(3, entre(9, 20), 32);
      hace.push(Math.min(...hace)); // al menos un día "último"
      a = { completados: 0, aciertosMundo: [], enCurso: entre(3, 5), aciertosLeccion: [2, 3] };
      break;
    default:
      return null;
  }
  const dias = [...new Set(hace)].sort((x, y) => y - x).map((h, k) => dia(h, 15 + (k % 4), r()));
  return { dias: dias.sort((x, y) => x - y), ...a };
}

function practicasDe(a: Actividad): PracticaPlan[] {
  const r = azar(`${a.dias.length}-${a.completados}`);
  const aciertos = () =>
    a.aciertosLeccion[0] + Math.floor(r() * (a.aciertosLeccion[1] - a.aciertosLeccion[0] + 1));
  const out: PracticaPlan[] = [];
  for (let w = 0; w < a.completados; w++) {
    for (let nivel = 0; nivel < 4; nivel++)
      out.push({ tipo: 'leccion', worldId: MUNDOS[w], nivel, aciertos: aciertos() });
    out.push({ tipo: 'jefe', worldId: MUNDOS[w], aciertos: aciertos() });
  }
  if (a.enCurso !== null && a.completados < MUNDOS.length) {
    for (let nivel = 0; nivel < 2; nivel++) {
      out.push({ tipo: 'leccion', worldId: MUNDOS[a.completados], nivel, aciertos: aciertos() });
    }
  }
  return out;
}

/** Ahorro de la estudiante destacada: Bóveda + un CDT a 4 semanas. */
function ahorroDestacada(
  e: EstadoOrbita,
  hoy: string,
  _ms: number,
  idx: number,
  total: number
): EstadoOrbita {
  if (idx !== total - 9) return e;
  const deposito = Math.floor(e.boveda.bolsillo * 0.7);
  const d = depositar(e.boveda, deposito);
  if (!d.ok) return e;
  const cdt = abrirCdt(d.estado, Math.min(Math.floor(deposito * 0.6), 2000), 4, hoy, 'cdt-salon-1');
  return { ...e, boveda: cdt.ok ? cdt.estado : d.estado };
}

interface ResumenCurso {
  conProgreso: number;
}

function sembrarEstudiantes(): Record<string, ResumenCurso> {
  const resumen: Record<string, ResumenCurso> = {};
  const alumnos = CUENTAS.filter((c) => c.rol === 'estudiante' && c.curso);
  for (const c of alumnos) {
    const k = CURSOS[c.curso!];
    const perfil = perfilDe(c.id);
    const act = actividadDe(c.id, perfil);
    const base = `colegios/${k.colegioId}/cursos/${k.cursoId}/estudiantes/${c.id}`;
    const unido = act ? act.dias[0] - 2 * DIA : AHORA - (k.cursoId === '7c' ? 3 : 40) * DIA;
    const pendiente = perfil === 'pendiente';
    // Roster: como joinByCode + atestar (functions/src/index.ts).
    poner(base, {
      email: c.email,
      nombre: c.nombre,
      estado: pendiente ? 'pendiente_atestacion' : 'activo',
      atestado: !pendiente,
      joinedAt: Timestamp.fromMillis(unido),
      ...(pendiente
        ? {}
        : {
            politicaVersion: POLITICA_VERSION,
            atestadoPor: k.profe,
            atestadoAt: Timestamp.fromMillis(unido + 3 * 60 * 60 * 1000),
          }),
    });
    resumen[k.cursoId] ??= { conProgreso: 0 };
    if (!act) continue;
    resumen[k.cursoId].conProgreso++;

    // Progreso por mundo: lo que escribe app/(app)/saga/[worldId].tsx al vencer al jefe.
    const D = act.dias.length;
    for (let w = 0; w < act.completados; w++) {
      const cuando = act.dias[Math.max(0, Math.floor(((w + 1) * D) / (act.completados + 1)) - 1)];
      poner(
        `${base}/progress/${MUNDOS[w]}`,
        mundoProgreso(k, c.id, MUNDOS[w], act.aciertosMundo[w], cuando)
      );
    }
    if (act.enCurso !== null && act.completados < MUNDOS.length) {
      const w = MUNDOS[act.completados];
      poner(`${base}/progress/${w}`, mundoProgreso(k, c.id, w, act.enCurso, act.dias[D - 1]));
    }

    // Estado de juego (users/{uid}/juego/orbita).
    const estado = reproducirJuego(
      act.dias,
      practicasDe(act),
      AHORA,
      perfil === 'estrella' ? (e, hoy, ms, idx) => ahorroDestacada(e, hoy, ms, idx, D) : undefined
    );
    poner(rutaJuego(c.id), docJuego(estado));
  }
  return resumen;
}

function mundoProgreso(k: CursoSalon, uid: string, worldId: string, correct: number, now: number) {
  const p = buildWorldProgress({
    colegioId: k.colegioId,
    cursoId: k.cursoId,
    uid,
    worldId: worldId as (typeof MUNDOS)[number],
    correct,
    total: 10,
    now,
  });
  return p as unknown as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 5. Joven B2C: metas, aportes, movimientos, presupuesto y juego
// ---------------------------------------------------------------------------

function sembrarJoven(): void {
  const uid = 'joven';
  const t = (haceDias: number) => dia(haceDias, 12);
  const metas = [
    {
      id: 'meta-viaje',
      title: 'Viaje a Santa Marta',
      iconId: 'plane',
      category: 'trip',
      targetAmount: 1_200_000,
      deadline: AHORA + 110 * DIA,
      creada: 50,
    },
    {
      id: 'meta-portatil',
      title: 'Portátil para la U',
      iconId: 'laptop',
      category: 'electronics',
      targetAmount: 2_800_000,
      deadline: AHORA + 200 * DIA,
      creada: 35,
    },
    {
      id: 'meta-emergencia',
      title: 'Fondo de emergencia',
      iconId: 'shield',
      category: 'emergency',
      targetAmount: 600_000,
      creada: 20,
    },
  ];
  for (const m of metas) {
    poner(`users/${uid}/goals/${m.id}`, {
      id: m.id,
      title: m.title,
      iconId: m.iconId,
      category: m.category,
      targetAmount: m.targetAmount,
      ...(m.deadline ? { deadline: m.deadline } : {}),
      createdAt: t(m.creada),
      updatedAt: t(2),
    });
  }
  const aportes: [string, number, string, number][] = [
    ['meta-viaje', 150_000, 'Quincena', 45],
    ['meta-viaje', 120_000, 'Quincena', 30],
    ['meta-viaje', 90_000, 'Venta de ropa usada', 16],
    ['meta-portatil', 200_000, 'Prima', 28],
    ['meta-portatil', 100_000, 'Quincena', 14],
    ['meta-emergencia', 80_000, 'Ahorro del mes', 10],
    ['meta-emergencia', 60_000, 'Me sobró del mercado', 3],
  ];
  aportes.forEach(([goalId, amount, description, hace], i) => {
    const id = `aporte-${i + 1}`;
    poner(`users/${uid}/deposits/${id}`, {
      id,
      type: 'aporte',
      amount,
      description,
      goalId,
      fecha: t(hace),
      createdAt: t(hace),
      updatedAt: t(hace),
    });
  });
  const gastos: [number, string, string, number][] = [
    [18_000, 'Almuerzo en la U', 'comida', 0],
    [5_900, 'Pasaje TransMilenio', 'transporte', 0],
    [32_000, 'Cine con amigos', 'entretenimiento', 1],
    [14_500, 'Empanadas y jugo', 'comida', 2],
    [11_800, 'Pasajes de la semana', 'transporte', 3],
    [89_900, 'Tenis en promoción', 'ropa', 5],
    [25_000, 'Fotocopias y libro', 'educacion', 6],
    [16_900, 'Plan de datos', 'tecnologia', 8],
    [42_000, 'Regalo de cumpleaños', 'regalos', 9],
    [22_000, 'Mercado pequeño', 'comida', 11],
  ];
  gastos.forEach(([monto, descripcion, categoria, hace], i) => {
    const id = `mov-${i + 1}`;
    poner(`users/${uid}/movimientos/${id}`, {
      id,
      tipo: 'gasto',
      monto,
      descripcion,
      categoria,
      origen: i % 3 === 0 ? 'voz' : 'manual',
      fecha: t(hace),
      createdAt: t(hace),
      updatedAt: t(hace),
    });
  });
  poner(`users/${uid}/config/presupuestos`, {
    topes: { comida: 350_000, transporte: 120_000, entretenimiento: 150_000, ropa: 120_000 },
    updatedAt: t(20),
  });
  const dias = [4, 3, 2, 1, 0, 9, 12, 15].map((h) => dia(h, 20)).sort((a, b) => a - b);
  const practicas: PracticaPlan[] = [
    ...[0, 1, 2, 3].map((nivel) => ({
      tipo: 'leccion' as const,
      worldId: 'world_1',
      nivel,
      aciertos: 4,
    })),
    { tipo: 'jefe', worldId: 'world_1', aciertos: 5 },
    ...[0, 1, 2].map((nivel) => ({
      tipo: 'leccion' as const,
      worldId: 'world_2',
      nivel,
      aciertos: 4,
    })),
  ];
  poner(rutaJuego(uid), docJuego(reproducirJuego(dias, practicas, AHORA)));
}

// ---------------------------------------------------------------------------
// 6. Lo del profe en 10°B: asignaciones, contenido propio, mundo propio, invitados
// ---------------------------------------------------------------------------

function itemsDe(bancoId: string, prefijo: string): Record<string, unknown>[] {
  const banco = leerJson(path.join(RAIZ, 'content', 'bancos', `${bancoId}.json`));
  return (banco.items as Record<string, unknown>[]).map((it, i) => ({
    ...it,
    id: `${prefijo}_${i + 1}`,
  }));
}

function sembrarClaseDelProfe(): void {
  const k = CURSOS['10b'];
  const curso = `colegios/${k.colegioId}/cursos/${k.cursoId}`;
  const profe = k.profe;

  // Asignaciones (forma de asignacionShapeValida en firestore.rules).
  const asignaciones: Record<string, unknown>[] = [
    {
      worldId: 'world_3',
      target: { tipo: 'curso', cursoId: '10b' },
      fechaInicio: AHORA - 3 * DIA,
      deadline: AHORA + 4 * DIA,
    },
    {
      worldId: 'cw_tienda',
      target: { tipo: 'curso', cursoId: '10b' },
      fechaInicio: AHORA - 1 * DIA,
      deadline: AHORA + 9 * DIA,
    },
    {
      kind: 'reto',
      reto: { tipo: 'crear_meta', cantidad: 1 },
      target: { tipo: 'curso', cursoId: '10b' },
      fechaInicio: AHORA - 2 * DIA,
      deadline: AHORA + 5 * DIA,
    },
    {
      worldId: 'world_1',
      target: { tipo: 'estudiante', cursoId: '10b', uid: 'est-16' },
      fechaInicio: AHORA - 2 * DIA,
      deadline: AHORA + 6 * DIA,
    },
    {
      worldId: 'world_2',
      target: { tipo: 'curso', cursoId: '10b' },
      fechaInicio: AHORA - 20 * DIA,
      deadline: AHORA - 6 * DIA,
    },
    {
      worldId: 'world_1',
      target: { tipo: 'curso', cursoId: '9a' },
      fechaInicio: AHORA - 4 * DIA,
      deadline: AHORA + 3 * DIA,
    },
  ];
  asignaciones.forEach((a, i) => {
    poner(`colegios/${k.colegioId}/asignaciones/salon-${i + 1}`, {
      ...a,
      createdByUid: profe,
      createdAt: (a.fechaInicio as number) - 60 * 60 * 1000,
    });
  });

  // Contenido propio (copy-on-write): una pregunta suya en Luna del Presupuesto.
  const mc = itemsDe('10_world_2_multiple_choice', '10b_world_2_mc');
  mc[0] = {
    ...mc[0],
    enunciado:
      'En la tienda del colegio, ¿qué haces primero si quieres que la mesada te alcance toda la semana?',
    opciones: [
      'Gastar lo que quiera el lunes y ver qué queda',
      'Dividir la mesada por días y anotar cada compra',
      'Pedir prestado cuando se acabe',
      'Comprar solo lo más barato aunque no lo necesite',
    ],
    correctIndex: 1,
    explicacion:
      'Repartir la mesada por días y anotar los gastos es un presupuesto: te deja ver a tiempo si vas bien.',
  };
  poner(`${curso}/contenido/banco_world_2_multiple_choice`, {
    bancoId: 'banco_world_2_multiple_choice',
    grado: '10',
    worldId: 'world_2',
    tipo: 'multiple_choice',
    version: 3,
    generadoPor: 'profesor',
    pendiente_validacion_docente: false,
    items: mc,
  });

  // Mundo propio activo: "La tienda escolar" (como createCustomWorld + activación).
  const cw = 'cw_tienda';
  for (const tipo of TIPOS_BANCO) {
    poner(`${curso}/contenido/banco_${cw}_${tipo}`, {
      bancoId: `banco_${cw}_${tipo}`,
      grado: '10',
      worldId: cw,
      tipo,
      version: 4,
      generadoPor: 'profesor',
      pendiente_validacion_docente: false,
      items: itemsDe(`10_world_2_${tipo}`, `${cw}_${tipo}`).map((it) => ({
        ...it,
        competencia: 'presupuesto',
      })),
    });
  }
  const teoria = leerJson(path.join(RAIZ, 'content', 'microteoria', '10_world_2.json'));
  poner(`${curso}/contenido/microteoria_${cw}`, {
    grado: '10',
    worldId: cw,
    cards: teoria.cards,
    generadoPor: 'profesor',
    pendiente_validacion_docente: false,
  });
  poner(`${curso}/config/mundos`, {
    mundos: [
      ...MUNDOS.map((worldId) => ({ worldId, activo: true })),
      {
        worldId: cw,
        activo: true,
        nombre: 'La tienda escolar',
        subtitle: 'Presupuesto con la mesada',
        descripcion: 'Un mundo hecho por el profe Andrés con casos de la tienda del colegio.',
        competencia: 'presupuesto',
      },
    ],
    overrides: {
      world_2: { mc: true },
      [cw]: { mc: true, vf: true, ordenar: true, teoria: true },
    },
    version: 4,
    updatedAt: AHORA - 1 * DIA - 2 * 60 * 60 * 1000,
    updatedByUid: profe,
  });

  // Invitaciones pendientes de la lista (como invitarLista).
  const invitados: [string, string][] = [
    ['Felipe Cano', 'felipe.cano@salon.ceti.test'],
    ['Ximena Ardila', 'ximena.ardila@salon.ceti.test'],
    ['Óscar Beltrán', 'oscar.beltran@salon.ceti.test'],
  ];
  const creadoAt = AHORA - 2 * DIA;
  for (const [nombre, correo] of invitados) {
    poner(`${curso}/invitados/${correo}`, {
      correo,
      nombre,
      estado: 'pendiente',
      invitadoPor: profe,
      creadoAt,
      correoEnviadoAt: creadoAt + 5000,
    });
    poner(`invitacionesPorCorreo/${correo}`, {
      colegioId: k.colegioId,
      cursoId: k.cursoId,
      creadoAt,
    });
  }
}

// ---------------------------------------------------------------------------
// 6b. Entidad San Mateo (Fase 6): admins, profes, invitación pendiente y SIEE
// ---------------------------------------------------------------------------

function sembrarEntidad(): void {
  const cid = 'san-mateo';
  const miembros: [string, 'admin' | 'profe', number][] = [
    ['profe-piloto', 'admin', 60],
    ['admin-entidad', 'admin', 45],
    ['profe-sm', 'profe', 30],
  ];
  for (const [uid, rol, hace] of miembros) {
    const c = CUENTAS.find((x) => x.id === uid);
    poner(`colegios/${cid}/profes/${uid}`, {
      uid,
      nombre: c?.nombre ?? uid,
      correo: c?.email ?? null,
      rol,
      unidoAt: AHORA - hace * DIA,
    });
  }
  // Lucía (Los Andes, 8°A) tiene una invitación: al aceptarla su clase se muda.
  const lucia = CUENTAS.find((x) => x.id === 'profe-cadete');
  if (lucia) {
    const inv = {
      correo: lucia.email,
      rol: 'profe',
      invitadoPor: 'admin-entidad',
      invitadoPorNombre: 'Diana Castro',
      creadaAt: AHORA - 1 * DIA,
    };
    poner(`colegios/${cid}/invitacionesProfe/${lucia.email}`, inv);
    poner(`invitacionesProfe/${cid}:${lucia.email}`, { ...inv, colegioId: cid });
  }
  // SIEE propio: escala 1,0–5,0 con Básico desde 3,5 y tres trimestres.
  poner(`colegios/${cid}/config/evaluacion`, {
    calendario: 'periodos',
    escala: {
      notaMin: 1,
      notaMax: 5,
      rangos: [
        { desempeno: 'bajo', min: 1 },
        { desempeno: 'basico', min: 3.5 },
        { desempeno: 'alto', min: 4.2 },
        { desempeno: 'superior', min: 4.7 },
      ],
    },
    periodos: [
      { nombre: 'Primer trimestre', desde: '01-26', hasta: '04-24' },
      { nombre: 'Segundo trimestre', desde: '04-27', hasta: '08-28' },
      { nombre: 'Tercer trimestre', desde: '08-31', hasta: '11-27' },
    ],
    actualizadoAt: AHORA - 20 * DIA,
    actualizadoPor: 'admin-entidad',
  });
}

// ---------------------------------------------------------------------------
// 7. Suscripciones y pagos (dominio puro de cobros + aDoc de plan.ts)
// ---------------------------------------------------------------------------

function docSuscripcion(
  sub: Suscripcion,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const v = vigencia(sub);
  return { ...sub, planVigente: v.plan, vigenteHasta: v.hasta, actualizadoAt: AHORA, ...extra };
}

function sembrarCobros(): void {
  // Profe Piloto: tarifa fundador mensual con tarjeta, dos pagos aprobados.
  const uid = 'profe-piloto';
  const email = cuenta(uid).email;
  const creada = AHORA - 48 * DIA;
  const monto = precioPlan('piloto', 'mensual', true); // 19.900
  const fuentePagoId = 'fuente_salon_demo';
  let sub = nuevaSuscripcion(uid, creada);
  const pago1 = AHORA - 40 * DIA;
  sub = aplicarPagoAprobado(sub, {
    plan: 'piloto',
    ciclo: 'mensual',
    montoCop: monto,
    fundador: true,
    fuentePagoId,
    metodo: 'tarjeta',
    ahora: pago1,
  });
  const pago2 = (sub.finPeriodo ?? AHORA) - 2 * 60 * 60 * 1000;
  const fin1 = sub.finPeriodo;
  sub = aplicarPagoAprobado(sub, {
    plan: 'piloto',
    ciclo: 'mensual',
    montoCop: monto,
    fundador: true,
    fuentePagoId,
    metodo: 'tarjeta',
    ahora: pago2,
  });
  poner(`suscripciones/${uid}`, docSuscripcion(sub));
  const pagos = [
    {
      referencia: `ceti_${uid.slice(0, 8)}_${pago1}`,
      ahora: pago1,
      fin: fin1,
      renovacion: false,
      tx: 'tx-salon-1',
    },
    {
      referencia: `ren_${uid.slice(0, 8)}_${pago2}`,
      ahora: pago2,
      fin: sub.finPeriodo,
      renovacion: true,
      tx: 'tx-salon-2',
    },
  ];
  for (const p of pagos) {
    poner(`pagos/${p.referencia}`, {
      uid,
      referencia: p.referencia,
      plan: 'piloto',
      ciclo: 'mensual',
      montoCop: monto,
      estado: 'aprobado',
      metodo: 'tarjeta',
      tipo: 'recurrente',
      creadoAt: p.ahora - 60_000,
      facturaUrl: null,
      email,
      fundador: true,
      renovacion: p.renovacion,
      fuentePagoId,
      wompiTxId: p.tx,
      finPeriodo: p.fin,
      aprobadoAt: p.ahora,
      alerta: null,
    });
  }
  poner('fundadores/contador', { usados: 1, actualizadoAt: pago1 });

  // Profe Cadete: la prueba venció hace días; el ciclo diario la bajó a gratis.
  let cadete = nuevaSuscripcion('profe-cadete', AHORA - 26 * DIA);
  cadete = cicloDiario(cadete, (cadete.pruebaHasta ?? AHORA) - 2 * DIA).sub; // aviso de fin de prueba
  cadete = cicloDiario(cadete, (cadete.pruebaHasta ?? AHORA) + 6 * 60 * 60 * 1000).sub; // degradado
  poner('suscripciones/profe-cadete', docSuscripcion(cadete));

  // Profe en prueba: 9 días restantes (diasDePrueba redondea hacia arriba).
  const prueba = nuevaSuscripcion('profe-prueba', AHORA - 5 * DIA - 60 * 60 * 1000);
  poner('suscripciones/profe-prueba', docSuscripcion(prueba));
}

// ---------------------------------------------------------------------------
// 8. Agregados (disparador real), adopción y Bitácora (funciones del servidor)
// ---------------------------------------------------------------------------

async function esperarAgregados(esperados: Record<string, ResumenCurso>): Promise<boolean> {
  const limite = Date.now() + 90_000;
  while (Date.now() < limite) {
    const listos = await Promise.all(
      Object.values(CURSOS).map(async (k) => {
        const quiere = esperados[k.cursoId]?.conProgreso ?? 0;
        if (quiere === 0) return true;
        const s = await db
          .doc(`colegios/${k.colegioId}/cursos/${k.cursoId}/agregados/resumen`)
          .get();
        return s.exists && s.get('estudiantesActivos') === quiere;
      })
    );
    if (listos.every(Boolean)) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function generarBitacoras(): Promise<void> {
  for (const uid of ['profe-piloto', 'profe-cadete', 'profe-prueba']) {
    const c = cuenta(uid);
    const profe = { uid, colegioId: colegioDeProfe(uid), email: c.email, nombre: c.nombre };
    // La de la semana pasada (historial) y la de esta semana.
    await bitacoraDeProfe(db, profe, AHORA - 7 * DIA);
    await bitacoraDeProfe(db, profe, AHORA);
  }
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const activos = await emuladoresActivos();
  if (!activos.includes('firestore') || !activos.includes('auth')) {
    throw new Error('Los emuladores no están arriba. Corre primero: npm run salon:emuladores');
  }
  const conFunctions = activos.includes('functions');
  if (!conFunctions) {
    console.warn('⚠ El emulador de Functions no está arriba: no habrá agregados de curso.');
  }

  console.log(
    `Salón demo → emuladores de ${PROYECTO} (Firestore ${HOST_FIRESTORE}, Auth ${HOST_AUTH})`
  );
  await limpiar();
  console.log('· Emulador limpio');

  await crearCuentas();
  console.log(`· ${CUENTAS.length} cuentas con claims y perfil`);

  const n = sembrarContenidoGlobal();
  sembrarColegiosYCursos();
  sembrarCobros();
  sembrarJoven();
  sembrarClaseDelProfe();
  sembrarEntidad();
  await confirmar();
  console.log(
    `· Contenido global (${n} docs), 3 colegios (San Mateo es entidad), 4 clases, cobros, joven B2C y la clase del profe`
  );

  const resumen = sembrarEstudiantes();
  await confirmar();
  console.log('· Roster, progreso por mundo y estado de juego de los estudiantes');

  if (conFunctions) {
    process.stdout.write('· Esperando los agregados del disparador onProgressWriteAggregate… ');
    console.log((await esperarAgregados(resumen)) ? 'listos' : 'tardaron (sigo igual)');
  }
  for (const colegioId of Object.keys(COLEGIOS))
    await recalcularAdopcionColegio(colegioId, AHORA, db);
  console.log('· Adopción de los 3 colegios');
  await generarBitacoras();
  console.log('· Bitácoras de esta semana y la anterior');

  console.log(`\nListo. Contraseña de todas las cuentas (solo emulador): ${PASSWORD}`);
  console.log('Entra con un toque: /dev/entrar?cuenta=<id>  ·  Salón: /dev/salon');
  for (const c of CUENTAS.filter((x) => x.rol !== 'estudiante' || x.alias || x.id === 'joven')) {
    console.log(`  ${(c.alias ?? c.id).padEnd(13)} ${c.nombre.padEnd(16)} ${c.email}`);
  }
  console.log('  est-1 … est-24 (10°B), est9a-1 … est9a-12 (9°A), andes-1 … 6, horizonte-1 … 4');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('✗', e instanceof Error ? e.message : e);
    process.exit(1);
  });
