/**
 * Pruebas de firestore.rules contra el emulador (sin jest).
 *   npm run test:rules
 * (= firebase emulators:exec --only firestore --project demo-ceti "node scripts/testFirestoreRules.mjs")
 *
 * Cubre lo que protege a los estudiantes y a las clases: aislamiento entre
 * colegios, la autorización de Ley 1581 (pendiente → activo), los tokens de
 * hasta 5 clases (`clases: {cursoId: colegioId}`) y los de antes
 * (`colegioId`/`cursoId`), el registro de clase de la Fase 1 (intentos,
 * visitas, resúmenes), la configuración y el contenido del profe (con plan),
 * las tareas y los agregados. Al menos un "sí" y un "no" por regla. Sale con
 * código 1 si algo falla.
 */
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  where,
} from 'firebase/firestore';

// Los "no" esperados llenan la consola de PERMISSION_DENIED: solo errores reales.
setLogLevel('silent');

const env = await initializeTestEnvironment({
  projectId: 'demo-ceti',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});

let passed = 0;
let failed = 0;
async function check(name, promise) {
  try {
    await promise;
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n      ${e?.message ?? e}`);
  }
}
const si = (name, p) => check(`sí · ${name}`, assertSucceeds(p));
const no = (name, p) => check(`no · ${name}`, assertFails(p));

const LEJOS = Date.now() + 365 * 24 * 3600 * 1000;
const K1 = 'colegios/A/cursos/k1';
const KB = 'colegios/B/cursos/kb';

// ── Datos de partida (sin reglas) ──────────────────────────────────────────
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'colegios/A'), { nombre: 'Colegio A' });
  await setDoc(doc(db, 'colegios/B'), { nombre: 'Colegio B' });
  await setDoc(doc(db, K1), { nombre: '9A', grado: '9', profesorUids: ['pA'] });
  await setDoc(doc(db, 'colegios/A/cursos/k2'), {
    nombre: '9B',
    grado: '9',
    profesorUids: ['pA2'],
  });
  await setDoc(doc(db, KB), { nombre: 'Tutoría', grado: '10', profesorUids: ['pB'] });
  for (const [uid, estado] of [
    ['eAct', 'activo'],
    ['ePend', 'pendiente_atestacion'],
    ['eRet', 'retirado'],
    ['eMulti', 'activo'],
  ]) {
    await setDoc(doc(db, `${K1}/estudiantes/${uid}`), {
      nombre: uid,
      email: `${uid}@x.co`,
      estado,
    });
  }
  await setDoc(doc(db, `${KB}/estudiantes/eMulti`), { nombre: 'eMulti', estado: 'activo' });
  await setDoc(doc(db, 'suscripciones/pA'), { planVigente: 'piloto', vigenteHasta: LEJOS });
  await setDoc(doc(db, `${K1}/agregados/resumen`), { masteryPromedio: 0.5 });
  await setDoc(doc(db, 'colegios/A/asignaciones/aCurso'), {
    worldId: 'world_1',
    target: { tipo: 'curso', cursoId: 'k1' },
    fechaInicio: 1,
    deadline: 2,
    createdByUid: 'pA',
    createdAt: 1,
  });
  await setDoc(doc(db, 'colegios/A/asignaciones/aPend'), {
    worldId: 'world_1',
    target: { tipo: 'estudiante', cursoId: 'k1', uid: 'ePend' },
    fechaInicio: 1,
    deadline: 2,
    createdByUid: 'pA',
    createdAt: 1,
  });
  await setDoc(doc(db, 'classCodes/ABC234'), { colegioId: 'A', cursoId: 'k1' });
  await setDoc(doc(db, 'membership/eAct'), { role: 'estudiante' });
  await setDoc(doc(db, `${K1}/estudiantes/eAct/resumen/clase`), { intentos: 1 });
});

// ── Quién llama ────────────────────────────────────────────────────────────
const como = (uid, claims) => env.authenticatedContext(uid, claims).firestore();
const pA = como('pA', { role: 'profesor', colegioId: 'A' }); // dueño de k1, Piloto
const pA2 = como('pA2', { role: 'profesor', colegioId: 'A' }); // dueño de k2, sin plan
const pB = como('pB', { role: 'profesor', colegioId: 'B' });
const eAct = como('eAct', { role: 'estudiante', clases: { k1: 'A' } });
const eActViejo = como('eAct', { role: 'estudiante', colegioId: 'A', cursoId: 'k1' });
const ePend = como('ePend', { role: 'estudiante', clases: { k1: 'A' } });
const eRetConToken = como('eRet', { role: 'estudiante', clases: { k1: 'A' } }); // token viejo
const eSinClase = como('eSolo', { role: 'estudiante' });
const eMulti = como('eMulti', { role: 'estudiante', clases: { k1: 'A', kb: 'B' } });
const admin = como('admin', { role: 'admin' });
const anon = env.unauthenticatedContext().firestore();

const progreso = (uid, cursoId = 'k1', colegioId = 'A') => ({
  colegioId,
  cursoId,
  uid,
  competencia: 'ahorro',
  mastery: 0.8,
  completed: true,
  updatedAt: Date.now(),
});
const intento = (uid, extra = {}) => ({
  worldId: 'world_1',
  tipo: 'leccion',
  nivel: 0,
  resultado: 'completado',
  inicioAt: 1000,
  finAt: 61000,
  duracionMs: 60000,
  total: 2,
  aciertos: 1,
  respuestas: [
    { p: 'q1', t: 'multiple_choice', ok: true, r: '1', ms: 3000 },
    { p: 'q2', t: 'true_false', ok: false, r: 'false', ms: 4000 },
  ],
  uid,
  creadoAt: serverTimestamp(),
  ...extra,
});

console.log('\nColegio');
await si('profe lee su colegio', getDoc(doc(pA, 'colegios/A')));
await no('profe de otro colegio', getDoc(doc(pB, 'colegios/A')));
await si('estudiante lee el colegio de su clase', getDoc(doc(eAct, 'colegios/A')));
await si('multi-clase lee su segundo colegio', getDoc(doc(eMulti, 'colegios/B')));
await no('estudiante sin clase', getDoc(doc(eSinClase, 'colegios/A')));
await no('admin no tiene nada en el cliente', getDoc(doc(admin, 'colegios/A')));
await no('anónimo', getDoc(doc(anon, 'colegios/A')));
await no('nadie escribe el colegio', setDoc(doc(pA, 'colegios/A'), { nombre: 'x' }));

console.log('\nClase');
await si('su profe la lee', getDoc(doc(pA, K1)));
await no('otro profe del mismo colegio', getDoc(doc(pA2, K1)));
await si(
  'el profe lista sus clases',
  getDocs(query(collection(pA, 'colegios/A/cursos'), where('profesorUids', 'array-contains', 'pA')))
);
await si('estudiante pendiente ve su clase', getDoc(doc(ePend, K1)));
await si('token de antes (colegioId/cursoId) sigue sirviendo', getDoc(doc(eActViejo, K1)));
await no('estudiante sin esa clase', getDoc(doc(eSinClase, K1)));
await no('el cliente no edita la clase', updateDoc(doc(pA, K1), { nombre: 'x' }));
await no('nadie lee los códigos', getDoc(doc(eAct, 'classCodes/ABC234')));

console.log('\nLista (roster)');
await si('el profe lee la lista', getDocs(collection(pA, `${K1}/estudiantes`)));
await no('otro profe no', getDocs(collection(pB, `${K1}/estudiantes`)));
await si('el pendiente lee su propio estado', getDoc(doc(ePend, `${K1}/estudiantes/ePend`)));
await no('un estudiante no lee a otro', getDoc(doc(ePend, `${K1}/estudiantes/eAct`)));
await no(
  'el estudiante no se cambia el estado',
  setDoc(doc(ePend, `${K1}/estudiantes/ePend`), { estado: 'activo' })
);

console.log('\nAvance por mundo');
await si(
  'activo escribe su avance',
  setDoc(doc(eAct, `${K1}/estudiantes/eAct/progress/world_1`), progreso('eAct'))
);
await no(
  'pendiente no escribe',
  setDoc(doc(ePend, `${K1}/estudiantes/ePend/progress/world_1`), progreso('ePend'))
);
await no(
  'retirado con token viejo no escribe',
  setDoc(doc(eRetConToken, `${K1}/estudiantes/eRet/progress/world_1`), progreso('eRet'))
);
await no(
  'uid del doc distinto',
  setDoc(doc(eAct, `${K1}/estudiantes/eAct/progress/world_2`), progreso('otro'))
);
await no(
  'en la ruta de otro estudiante',
  setDoc(doc(eAct, `${K1}/estudiantes/eMulti/progress/world_1`), progreso('eMulti'))
);
await si(
  'multi-clase escribe en su clase B',
  setDoc(doc(eMulti, `${KB}/estudiantes/eMulti/progress/world_1`), progreso('eMulti', 'kb', 'B'))
);
await si(
  'multi-clase escribe en su clase A',
  setDoc(doc(eMulti, `${K1}/estudiantes/eMulti/progress/world_1`), progreso('eMulti'))
);
await si('el profe lee el avance', getDoc(doc(pA, `${K1}/estudiantes/eAct/progress/world_1`)));
await no('otro colegio no', getDoc(doc(pB, `${K1}/estudiantes/eAct/progress/world_1`)));

console.log('\nRegistro de clase · intentos');
const intentos = (db, uid) => collection(db, `${K1}/estudiantes/${uid}/intentos`);
await si('activo registra un intento', addDoc(intentos(eAct, 'eAct'), intento('eAct')));
await si('con el token de antes también', addDoc(intentos(eActViejo, 'eAct'), intento('eAct')));
await no('pendiente no', addDoc(intentos(ePend, 'ePend'), intento('ePend')));
await no(
  'más aciertos que respuestas',
  addDoc(intentos(eAct, 'eAct'), intento('eAct', { aciertos: 5 }))
);
await no(
  'total distinto a las respuestas',
  addDoc(intentos(eAct, 'eAct'), intento('eAct', { total: 3 }))
);
await no('un campo de más', addDoc(intentos(eAct, 'eAct'), intento('eAct', { nota: 5 })));
await no('uid de otro', addDoc(intentos(eAct, 'eAct'), intento('eMulti')));
await no(
  'fecha inventada en creadoAt',
  addDoc(intentos(eAct, 'eAct'), intento('eAct', { creadoAt: 1 }))
);
await no(
  'duración absurda',
  addDoc(intentos(eAct, 'eAct'), intento('eAct', { duracionMs: 9_000_000 }))
);
await si('el profe los lee', getDocs(intentos(pA, 'eAct')));
await no('otro estudiante no', getDocs(intentos(eMulti, 'eAct')));
await no('otro colegio no', getDocs(intentos(pB, 'eAct')));
let primero;
await env.withSecurityRulesDisabled(async (ctx) => {
  [primero] = (await getDocs(collection(ctx.firestore(), `${K1}/estudiantes/eAct/intentos`))).docs;
});
await no('no se edita', updateDoc(doc(eAct, primero.ref.path), { aciertos: 2 }));
await no('no se borra', deleteDoc(doc(eAct, primero.ref.path)));

console.log('\nRegistro de clase · visitas y resúmenes');
const visita = (db, dia = '2026-10-30') => doc(db, `${K1}/estudiantes/eAct/visitas/${dia}`);
await si(
  'primera visita del día',
  setDoc(visita(eAct), { dia: '2026-10-30', visitas: 1, ultimaAt: 1 })
);
await si('una más', setDoc(visita(eAct), { dia: '2026-10-30', visitas: 2, ultimaAt: 2 }));
await no('saltarse visitas', setDoc(visita(eAct), { dia: '2026-10-30', visitas: 9, ultimaAt: 3 }));
await no(
  'día distinto al del doc',
  setDoc(visita(eAct, '2026-10-31'), { dia: '2026-10-30', visitas: 1, ultimaAt: 1 })
);
await no(
  'pendiente no',
  setDoc(doc(ePend, `${K1}/estudiantes/ePend/visitas/2026-10-30`), {
    dia: '2026-10-30',
    visitas: 1,
    ultimaAt: 1,
  })
);
const orbita = { xpTotal: 120, racha: 3, mejorRacha: 5, diasAprendiendo: 9, actualizadoAt: 1 };
await si(
  'activo guarda su racha y XP',
  setDoc(doc(eAct, `${K1}/estudiantes/eAct/resumen/orbita`), orbita)
);
await no(
  'XP negativo',
  setDoc(doc(eAct, `${K1}/estudiantes/eAct/resumen/orbita`), { ...orbita, xpTotal: -1 })
);
await no(
  'el resumen de la clase es solo del servidor',
  setDoc(doc(eAct, `${K1}/estudiantes/eAct/resumen/clase`), { intentos: 99 })
);
await si('el profe lee los resúmenes', getDoc(doc(pA, `${K1}/estudiantes/eAct/resumen/clase`)));

console.log('\nConfiguración y contenido del profe');
const config = (uid) => ({
  mundos: [{ worldId: 'world_1', activo: true }],
  version: 2,
  updatedAt: 1,
  updatedByUid: uid,
});
await si('profe con plan configura mundos', setDoc(doc(pA, `${K1}/config/mundos`), config('pA')));
await no(
  'profe sin plan no',
  setDoc(doc(pA2, 'colegios/A/cursos/k2/config/mundos'), config('pA2'))
);
await no('no en una clase ajena', setDoc(doc(pA2, `${K1}/config/mundos`), config('pA2')));
await si('estudiante activo lee la configuración', getDoc(doc(eAct, `${K1}/config/mundos`)));
await no('pendiente no la lee', getDoc(doc(ePend, `${K1}/config/mundos`)));
const banco = {
  bancoId: 'b',
  grado: '9',
  worldId: 'world_1',
  tipo: 'multiple_choice',
  version: 1,
  items: [{ id: 'q' }],
};
await si(
  'profe con plan escribe contenido',
  setDoc(doc(pA, `${K1}/contenido/banco_world_1_mc`), banco)
);
await no('el estudiante no', setDoc(doc(eAct, `${K1}/contenido/banco_world_1_mc`), banco));
await si('restaurar (borrar) siempre se puede', deleteDoc(doc(pA, `${K1}/config/mundos`)));
const mapa = {
  worldId: 'world_1',
  lecciones: [{ preguntas: ['a', 'b', 'c'] }],
  jefe: ['a'],
  actualizadoAt: 1,
};
await si(
  'profe con plan guarda el mapa de un mundo',
  setDoc(doc(pA, `${K1}/contenido/mapa_world_1`), mapa)
);
await no(
  'el mapa no lleva campos de más',
  setDoc(doc(pA, `${K1}/contenido/mapa_world_1`), { ...mapa, extra: 1 })
);
await no(
  'mapa sin lecciones',
  setDoc(doc(pA, `${K1}/contenido/mapa_world_1`), { ...mapa, lecciones: [] })
);
await no(
  'profe sin plan no guarda mapa',
  setDoc(doc(pA2, 'colegios/A/cursos/k2/contenido/mapa_world_1'), mapa)
);
await no('el estudiante no guarda mapa', setDoc(doc(eAct, `${K1}/contenido/mapa_world_1`), mapa));
const camino = {
  bancoId: 'eligeCamino_world_1',
  grado: '9',
  worldId: 'world_1',
  situaciones: [{ id: 's' }],
  pendiente_validacion_docente: false,
};
await si(
  'profe con plan guarda Elige camino',
  setDoc(doc(pA, `${K1}/contenido/eligeCamino_world_1`), camino)
);
await si(
  'estudiante activo lee el contenido de su clase',
  getDoc(doc(eAct, `${K1}/contenido/mapa_world_1`))
);

console.log('\nMi banco de preguntas');
const guardada = {
  item: { id: 'q', enunciado: 'x' },
  tipo: 'emparejar',
  temas: ['Ahorro'],
  origen: null,
  creadoAt: 1,
};
await si('el profe guarda en su banco', setDoc(doc(pA, 'bancosProfe/pA/preguntas/q1'), guardada));
await si('y lo lee', getDocs(collection(pA, 'bancosProfe/pA/preguntas')));
await no('otro profe no lo lee', getDocs(collection(pA2, 'bancosProfe/pA/preguntas')));
await no('ni escribe en él', setDoc(doc(pA2, 'bancosProfe/pA/preguntas/q2'), guardada));
await no(
  'un estudiante no tiene banco',
  setDoc(doc(eAct, 'bancosProfe/eAct/preguntas/q'), guardada)
);
await no(
  'tipo inventado',
  setDoc(doc(pA, 'bancosProfe/pA/preguntas/q3'), { ...guardada, tipo: 'ensayo' })
);
await si('el profe borra de su banco', deleteDoc(doc(pA, 'bancosProfe/pA/preguntas/q1')));

console.log('\nTareas');
const tarea = (target, extra = {}) => ({
  worldId: 'world_2',
  target,
  fechaInicio: 1,
  deadline: 99,
  createdByUid: 'pA',
  createdAt: 1,
  ...extra,
});
await si(
  'el profe crea una tarea',
  setDoc(doc(pA, 'colegios/A/asignaciones/nueva'), tarea({ tipo: 'curso', cursoId: 'k1' }))
);
await no(
  'un reto con texto libre',
  setDoc(doc(pA, 'colegios/A/asignaciones/reto'), {
    kind: 'reto',
    reto: { tipo: 'crear_meta', cantidad: 1, texto: 'x' },
    target: { tipo: 'curso', cursoId: 'k1' },
    fechaInicio: 1,
    deadline: 9,
    createdByUid: 'pA',
    createdAt: 1,
  })
);
await no(
  'profe de otra clase no',
  setDoc(
    doc(pA2, 'colegios/A/asignaciones/ajena'),
    tarea({ tipo: 'curso', cursoId: 'k1' }, { createdByUid: 'pA2' })
  )
);
await si(
  'el profe mueve la fecha',
  updateDoc(doc(pA, 'colegios/A/asignaciones/nueva'), { deadline: 199 })
);
await no(
  'pero no el destino',
  updateDoc(doc(pA, 'colegios/A/asignaciones/nueva'), { target: { tipo: 'curso', cursoId: 'k2' } })
);
await si('el profe la borra', deleteDoc(doc(pA, 'colegios/A/asignaciones/nueva')));
await si(
  'estudiante activo lee la tarea de la clase',
  getDoc(doc(eAct, 'colegios/A/asignaciones/aCurso'))
);
await no('no lee la individual de otro', getDoc(doc(eAct, 'colegios/A/asignaciones/aPend')));
await no('pendiente todavía no las lee', getDoc(doc(ePend, 'colegios/A/asignaciones/aPend')));

console.log('\nAgregados y otros');
await si('profe del colegio lee el agregado', getDoc(doc(pA, `${K1}/agregados/resumen`)));
await no('estudiante no', getDoc(doc(eAct, `${K1}/agregados/resumen`)));
await no('nadie escribe agregados', setDoc(doc(pA, `${K1}/agregados/resumen`), { x: 1 }));
await si('cada uno lee su membresía', getDoc(doc(eAct, 'membership/eAct')));
await no('no la de otro', getDoc(doc(pA, 'membership/eAct')));
await no('el profe no lee el juego del estudiante', getDoc(doc(pA, 'users/eAct/juego/orbita')));

await env.cleanup();
console.log(`\n${passed} bien, ${failed} mal`);
process.exit(failed > 0 ? 1 : 0);
