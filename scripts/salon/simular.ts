/**
 * Simulador de clase del Salón demo. Cada pocos segundos un estudiante al azar
 * de 10°B completa un mundo, sube su racha o entra por primera vez en días,
 * escribiendo lo mismo que escribiría la app (progreso por mundo con
 * buildWorldProgress y estado de juego con completarPractica/alAbrir). El
 * disparador real recalcula el agregado del curso y, cada tanto, el simulador
 * regenera la Bitácora de la semana del profe con la función del servidor.
 *
 *   npm run salon:simular                        # un evento cada 5 s
 *   npm run salon:simular -- --cada 2            # más rápido
 *   npm run salon:simular -- --curso 9a --estudiantes 8
 *
 * Solo emulador (proyecto demo-ceti). Ctrl+C para detenerlo.
 */
import { buildWorldProgress } from '@features/learning/data/worldProgress';
import {
  alAbrir,
  completarPractica,
  esEstadoOrbita,
  estadoInicial,
  type EstadoOrbita,
  type TipoPractica,
} from '@features/orbita/domain/orbita';
import { calcularRacha } from '@features/orbita/domain/racha';
import { dayKey } from '@features/orbita/domain/tiempo';
import { semanaIso } from '../../functions/src/educadores/dominio';
import {
  bitacoraDeProfe,
  NOMBRES_MUNDOS_POR_DEFECTO,
} from '../../functions/src/educadores/bitacoraSemanal';
import {
  CUENTAS,
  CURSOS,
  cuenta,
  db,
  emuladoresActivos,
  MUNDOS,
  PROYECTO,
  rutaJuego,
  serializable,
} from './comun';

function argumento(nombre: string, porDefecto: number): number {
  const i = process.argv.indexOf(`--${nombre}`);
  const v = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : porDefecto;
}
function argumentoTexto(nombre: string, porDefecto: string): string {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : porDefecto;
}

const CADA_S = argumento('cada', 5);
const BITACORA_CADA = Math.round(argumento('bitacora', 5)); // eventos
const CURSO = CURSOS[argumentoTexto('curso', '10b')];
if (!CURSO) throw new Error('Curso desconocido. Usa 10b, 9a, 8a o 7c.');
const LIMITE = Math.round(argumento('estudiantes', 24));

const alumnos = CUENTAS.filter((c) => c.curso === CURSO.cursoId).slice(0, LIMITE);
const base = (uid: string) =>
  `colegios/${CURSO.colegioId}/cursos/${CURSO.cursoId}/estudiantes/${uid}`;
const hora = () => new Date().toLocaleTimeString('es-CO', { hour12: false });
const pct = (x: number) => `${Math.round(x * 100)} %`;

interface Estado {
  uid: string;
  nombre: string;
  /** worldId → { mastery, completed } */
  mundos: Map<string, { mastery: number; completed: boolean }>;
}

async function leerAlumno(uid: string): Promise<Estado | null> {
  const roster = await db.doc(base(uid)).get();
  if (!roster.exists || roster.get('estado') !== 'activo') return null;
  const prog = await db.collection(`${base(uid)}/progress`).get();
  return {
    uid,
    nombre: roster.get('nombre') as string,
    mundos: new Map(
      prog.docs.map((d) => [
        d.id,
        { mastery: d.get('mastery') as number, completed: d.get('completed') === true },
      ])
    ),
  };
}

async function juego(uid: string, ahora: number): Promise<EstadoOrbita> {
  const snap = await db.doc(rutaJuego(uid)).get();
  const e =
    snap.exists && esEstadoOrbita(snap.data())
      ? (snap.data() as EstadoOrbita)
      : estadoInicial(ahora);
  return alAbrir(e, dayKey(ahora), ahora).estado;
}

/** Lo que hace la app al terminar una práctica: juego + (si aplica) progreso del mundo. */
async function practicar(
  e: Estado,
  worldId: string,
  tipo: TipoPractica,
  correct: number | null
): Promise<{ racha: number; xp: number }> {
  const ahora = Date.now();
  const hoy = dayKey(ahora);
  const antes = await juego(e.uid, ahora);
  const nivel = antes.niveles[worldId] ?? 0;
  const r = completarPractica(
    antes,
    {
      tipo,
      worldId,
      nivel: tipo === 'leccion' ? nivel : undefined,
      xpRespuestas: 8 + Math.round(Math.random() * 2),
      perfecta: Math.random() < 0.4,
    },
    hoy,
    ahora
  );
  const escrituras: Promise<unknown>[] = [db.doc(rutaJuego(e.uid)).set(serializable(r.estado))];
  if (correct !== null) {
    const progress = buildWorldProgress({
      colegioId: CURSO.colegioId,
      cursoId: CURSO.cursoId,
      uid: e.uid,
      worldId: worldId as (typeof MUNDOS)[number],
      correct,
      total: 10,
      now: ahora,
    });
    // worldProgressRepository.upsert usa merge.
    escrituras.push(db.doc(`${base(e.uid)}/progress/${worldId}`).set(progress, { merge: true }));
    e.mundos.set(worldId, { mastery: progress.mastery, completed: progress.completed });
  }
  await Promise.all(escrituras);
  return { racha: calcularRacha(r.estado.racha, hoy), xp: r.estado.progreso.xpTotal };
}

const siguienteMundo = (e: Estado) => MUNDOS.find((w) => !e.mundos.get(w)?.completed) ?? null;
const azarDe = <T>(xs: T[]): T | undefined => xs[Math.floor(Math.random() * xs.length)];

async function evento(estados: Estado[]): Promise<string | null> {
  const activos = estados.filter((e) => e.mundos.size > 0 && siguienteMundo(e));
  const dormidos = estados.filter((e) => e.mundos.size === 0);
  const tirada = Math.random();

  if ((tirada < 0.15 && dormidos.length) || activos.length === 0) {
    // Entra a la app después de días y hace su primera lección.
    const e = azarDe(dormidos.length ? dormidos : estados);
    if (!e) return null;
    const w = siguienteMundo(e) ?? 'world_1';
    const r = await practicar(e, w, 'leccion', 5 + Math.floor(Math.random() * 3));
    return `${e.nombre} entró a la app y empezó ${NOMBRES_MUNDOS_POR_DEFECTO[w]} (racha ${r.racha})`;
  }
  const e = azarDe(activos)!;
  const w = siguienteMundo(e)!;
  const actual = e.mundos.get(w)?.mastery ?? 0;
  if (tirada < 0.7 && actual >= 0.5) {
    // Vence al jefe: mundo dominado.
    const correct = 8 + Math.floor(Math.random() * 3);
    const r = await practicar(e, w, 'jefe', correct);
    return `${e.nombre} completó ${NOMBRES_MUNDOS_POR_DEFECTO[w]} (${pct(correct / 10)}) · racha ${r.racha} · ${r.xp} XP`;
  }
  // Una lección más: sube la racha y la maestría del mundo en curso (nunca la baja).
  const correct = Math.min(
    7,
    Math.max(5, Math.round(actual * 10) + 1 + Math.floor(Math.random() * 2))
  );
  const r = await practicar(e, w, 'leccion', correct);
  return `${e.nombre} hizo una lección de ${NOMBRES_MUNDOS_POR_DEFECTO[w]} → ${pct(correct / 10)} · racha ${r.racha}`;
}

async function refrescarBitacora(): Promise<void> {
  const uid = CURSO.profe;
  const ahora = Date.now();
  await db.doc(`bitacoras/${uid}/semanas/${semanaIso(ahora)}`).delete();
  const c = cuenta(uid);
  await bitacoraDeProfe(
    db,
    { uid, colegioId: CURSO.colegioId, email: c.email, nombre: c.nombre },
    ahora
  );
}

async function main(): Promise<void> {
  if (!(await emuladoresActivos()).includes('firestore')) {
    throw new Error('Los emuladores no están arriba (npm run salon:emuladores) o falta sembrar.');
  }
  const estados = (await Promise.all(alumnos.map((a) => leerAlumno(a.id)))).filter(
    (e): e is Estado => !!e
  );
  if (!estados.length) throw new Error('No hay estudiantes activos. Corre npm run salon:sembrar.');
  console.log(
    `Simulando ${CURSO.nombre} (${estados.length} estudiantes activos) en ${PROYECTO}: un evento cada ${CADA_S} s. Ctrl+C para parar.`
  );

  let n = 0;
  let parar = false;
  process.on('SIGINT', () => {
    parar = true;
    console.log(`\n${n} eventos. El tablero del profe ya los muestra.`);
    process.exit(0);
  });
  while (!parar) {
    try {
      const msg = await evento(estados);
      if (msg) {
        n++;
        console.log(`[${hora()}] ${msg}`);
      }
      if (n > 0 && n % BITACORA_CADA === 0) {
        await refrescarBitacora();
        console.log(`[${hora()}] · Bitácora de ${CURSO.profe} actualizada`);
      }
    } catch (e) {
      console.error(`[${hora()}] ✗`, e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, CADA_S * 1000 * (0.6 + Math.random() * 0.8)));
  }
}

main().catch((e) => {
  console.error('✗', e instanceof Error ? e.message : e);
  process.exit(1);
});
