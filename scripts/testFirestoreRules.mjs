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

// Proyecto propio, no el del Salón demo (demo-ceti): así se puede correr con el
// salón prendido sin tocar sus datos, y cada corrida empieza de cero (si no,
// las marcas de una corrida anterior convierten los "create" en "update").
const env = await initializeTestEnvironment({
  projectId: 'demo-ceti-reglas',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});
await env.clearFirestore();

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
  // Fase 5
  await setDoc(doc(db, `${K1}/comunicados/anuncio1`), { tipo: 'anuncio', texto: 'Hola', creadoAt: 1 });
  await setDoc(doc(db, `${K1}/comunicados/msg1`), {
    tipo: 'mensaje',
    texto: 'Te extraño',
    para: ['eAct'],
    nombres: ['eAct'],
    creadoAt: 1,
  });
  await setDoc(doc(db, `${K1}/estudiantes/eAct/buzon/msg1`), {
    tipo: 'mensaje',
    texto: 'Te extraño',
    creadoAt: 1,
    leidoAt: null,
  });
  await setDoc(doc(db, 'notificaciones/eAct/items/n1'), { tipo: 'anuncio', titulo: 't', leidaAt: null });
  await setDoc(doc(db, `${K1}/estudiantes/eAct/acudiente/datos`), { token: 'tok', correo: 'p@c.co' });
  await setDoc(doc(db, 'enlacesAcudiente/tok'), { colegioId: 'A', cursoId: 'k1', uid: 'eAct' });
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

console.log('\nFase 5 · comunicación');
await si('el profe lee lo que mandó', getDoc(doc(pA, `${K1}/comunicados/msg1`)));
await si(
  'estudiante activo lista los anuncios',
  getDocs(query(collection(eAct, `${K1}/comunicados`), where('tipo', '==', 'anuncio')))
);
await no('pero no los mensajes con destinatarios', getDoc(doc(eAct, `${K1}/comunicados/msg1`)));
await no(
  'ni una lista sin filtrar',
  getDocs(collection(eAct, `${K1}/comunicados`))
);
await no('pendiente no lee anuncios', getDoc(doc(ePend, `${K1}/comunicados/anuncio1`)));
await no('otro profe no', getDoc(doc(pA2, `${K1}/comunicados/anuncio1`)));
await no(
  'nadie escribe comunicados desde el cliente',
  setDoc(doc(pA, `${K1}/comunicados/nuevo`), { tipo: 'anuncio', texto: 'x', creadoAt: 1 })
);
await si(
  'estudiante marca visto un anuncio',
  setDoc(doc(eAct, `${K1}/comunicados/anuncio1/vistos/eAct`), { vistoAt: 5 })
);
await no(
  'no a nombre de otro',
  setDoc(doc(eAct, `${K1}/comunicados/anuncio1/vistos/ePend`), { vistoAt: 5 })
);
await no(
  'ni un mensaje que no es anuncio',
  setDoc(doc(eAct, `${K1}/comunicados/msg1/vistos/eAct`), { vistoAt: 5 })
);
await si('el profe ve quién lo vio', getDocs(collection(pA, `${K1}/comunicados/anuncio1/vistos`)));
await si('estudiante lee su buzón', getDoc(doc(eAct, `${K1}/estudiantes/eAct/buzon/msg1`)));
await no('no el de otro', getDoc(doc(eAct, `${K1}/estudiantes/ePend/buzon/msg1`)));
await si('el profe ve el buzón del estudiante', getDoc(doc(pA, `${K1}/estudiantes/eAct/buzon/msg1`)));
await no(
  'el estudiante no cambia el texto',
  updateDoc(doc(eAct, `${K1}/estudiantes/eAct/buzon/msg1`), { texto: 'otro', leidoAt: 5 })
);
await no(
  'ni le responde al profe',
  setDoc(doc(eAct, `${K1}/estudiantes/eAct/buzon/resp`), { tipo: 'mensaje', texto: 'hola profe' })
);
await si(
  'lo marca como visto',
  updateDoc(doc(eAct, `${K1}/estudiantes/eAct/buzon/msg1`), { leidoAt: 5 })
);
await no(
  'una sola vez',
  updateDoc(doc(eAct, `${K1}/estudiantes/eAct/buzon/msg1`), { leidoAt: 9 })
);
await si('el profe borra un anuncio', deleteDoc(doc(pA, `${K1}/comunicados/anuncio1`)));
await no('pero no un mensaje', deleteDoc(doc(pA, `${K1}/comunicados/msg1`)));
await si('cada uno lee sus avisos', getDoc(doc(eAct, 'notificaciones/eAct/items/n1')));
await no('no los de otro', getDoc(doc(pA, 'notificaciones/eAct/items/n1')));
await si(
  'marca un aviso como leído',
  updateDoc(doc(eAct, 'notificaciones/eAct/items/n1'), { leidaAt: 5 })
);
await no(
  'sin cambiar el aviso',
  updateDoc(doc(eAct, 'notificaciones/eAct/items/n1'), { titulo: 'x' })
);
await no(
  'nadie crea avisos desde el cliente',
  setDoc(doc(eAct, 'notificaciones/eAct/items/n2'), { titulo: 'x' })
);
await si(
  'guarda el token de su celular',
  setDoc(doc(eAct, 'notificaciones/eAct'), { expoTokens: ['ExpoPushToken[x]'], actualizadoAt: 1 })
);
await no(
  'no en la cuenta de otro',
  setDoc(doc(pA, 'notificaciones/eAct'), { expoTokens: [], actualizadoAt: 1 })
);

const comunicacion = (uid, extra = {}) => ({
  alertas: { inactividad: { activa: true, dias: 5 }, tarea: { activa: false }, promedio: { activa: true } },
  actualizadoAt: 1,
  actualizadoPor: uid,
  ...extra,
});
await si(
  'el profe configura sus alertas',
  setDoc(doc(pA, `${K1}/config/comunicacion`), comunicacion('pA'))
);
await si(
  'aunque no tenga plan (el servidor lo revisa al usarla)',
  setDoc(doc(pA2, 'colegios/A/cursos/k2/config/comunicacion'), comunicacion('pA2'))
);
await no(
  'otro profe no',
  setDoc(doc(pA2, `${K1}/config/comunicacion`), comunicacion('pA2'))
);
await no(
  'el estudiante no',
  setDoc(doc(eAct, `${K1}/config/comunicacion`), comunicacion('eAct'))
);
await no(
  'ni con campos de más',
  setDoc(doc(pA, `${K1}/config/comunicacion`), comunicacion('pA', { correoAcudiente: 'x@y.co' }))
);
await no(
  'nadie lee el estado de las alertas',
  getDoc(doc(pA, 'notificaciones/pA/estadoAlertas/k1'))
);

await si('el profe ve el enlace y el correo del acudiente', getDoc(doc(pA, `${K1}/estudiantes/eAct/acudiente/datos`)));
await no('el estudiante no', getDoc(doc(eAct, `${K1}/estudiantes/eAct/acudiente/datos`)));
await no('otro profe no', getDoc(doc(pA2, `${K1}/estudiantes/eAct/acudiente/datos`)));
await no(
  'nadie lo escribe desde el cliente',
  setDoc(doc(pA, `${K1}/estudiantes/eAct/acudiente/datos`), { correo: 'x@y.co' })
);
await no('nadie lee los enlaces', getDoc(doc(pA, 'enlacesAcudiente/tok')));
await no('ni anónimo', getDoc(doc(anon, 'enlacesAcudiente/tok')));

console.log('\nFase 6 · entidades');
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'colegios/A/profes/pA'), { uid: 'pA', nombre: 'Admin', rol: 'admin' });
  await setDoc(doc(db, 'colegios/A/profes/pA2'), { uid: 'pA2', nombre: 'Profe', rol: 'profe' });
  await setDoc(doc(db, 'colegios/A/invitacionesProfe/nuevo@x.co'), { correo: 'nuevo@x.co', rol: 'profe' });
  await setDoc(doc(db, 'colegios/A/config/evaluacion'), { calendario: 'periodos' });
  await setDoc(doc(db, 'colegios/A/biblioteca/m1'), { titulo: 'Mundo', autorUid: 'pA' });
  await setDoc(doc(db, 'colegios/A/agregados/entidad'), { resumen: { profes: 2 } });
  await setDoc(doc(db, 'colegios/A/facturacion/datos'), { nit: '890903938' });
  await setDoc(doc(db, 'colegios/A/cotizaciones/q1'), { numero: 'COT-2026-0001' });
  await setDoc(doc(db, 'invitacionesProfe/A:nuevo@x.co'), { correo: 'nuevo@x.co', colegioId: 'A' });
  // Colegio C con licencia Equipo: su profe edita contenido sin plan propio.
  await setDoc(doc(db, 'colegios/C'), { nombre: 'Academia C', licencia: { plan: 'equipo', hasta: LEJOS, cupo: 3 } });
  await setDoc(doc(db, 'colegios/C/cursos/kc'), { nombre: 'Grupo', grado: '11', profesorUids: ['pC'] });
  await setDoc(doc(db, 'colegios/D'), { nombre: 'U. D', licencia: { plan: 'universidad', hasta: 1, cupo: 300 } });
  await setDoc(doc(db, 'colegios/D/cursos/kd'), { nombre: 'Cátedra', grado: '11', profesorUids: ['pD'] });
});
const pC = como('pC', { role: 'profesor', colegioId: 'C' });
const pD = como('pD', { role: 'profesor', colegioId: 'D' });
await si('los profes de la entidad ven a sus colegas', getDocs(collection(pA2, 'colegios/A/profes')));
await no('un profe de otro colegio no', getDoc(doc(pB, 'colegios/A/profes/pA')));
await no('un estudiante no', getDoc(doc(eAct, 'colegios/A/profes/pA')));
await no('nadie se vuelve admin desde el cliente', updateDoc(doc(pA2, 'colegios/A/profes/pA2'), { rol: 'admin' }));
await si('el admin ve las invitaciones', getDocs(collection(pA, 'colegios/A/invitacionesProfe')));
await no('un profe que no es admin no', getDocs(collection(pA2, 'colegios/A/invitacionesProfe')));
await no('nadie lee la búsqueda de invitaciones por correo', getDoc(doc(pA, 'invitacionesProfe/A:nuevo@x.co')));
await si('los profes leen la escala y los periodos', getDoc(doc(pA2, 'colegios/A/config/evaluacion')));
await no('ni el admin la escribe directo', setDoc(doc(pA, 'colegios/A/config/evaluacion'), { calendario: 'semestres' }));
await no('un estudiante no la lee', getDoc(doc(eAct, 'colegios/A/config/evaluacion')));
await si('los profes ven la biblioteca', getDoc(doc(pA2, 'colegios/A/biblioteca/m1')));
await no('otro colegio no', getDoc(doc(pB, 'colegios/A/biblioteca/m1')));
await no('nadie publica desde el cliente', setDoc(doc(pA, 'colegios/A/biblioteca/m2'), { titulo: 'x' }));
await si('el admin ve el panel de la entidad', getDoc(doc(pA, 'colegios/A/agregados/entidad')));
await no('un profe que no es admin no', getDoc(doc(pA2, 'colegios/A/agregados/entidad')));
await si('el admin ve los datos de factura', getDoc(doc(pA, 'colegios/A/facturacion/datos')));
await no('un profe que no es admin no', getDoc(doc(pA2, 'colegios/A/facturacion/datos')));
await si('el admin ve las cotizaciones', getDoc(doc(pA, 'colegios/A/cotizaciones/q1')));
await no('nadie las escribe desde el cliente', updateDoc(doc(pA, 'colegios/A/cotizaciones/q1'), { estado: 'pagada' }));
await no('nadie toca la licencia', updateDoc(doc(pA, 'colegios/A'), { licencia: { plan: 'colegio', hasta: LEJOS } }));
await si('licencia Equipo: su profe configura mundos', setDoc(doc(pC, 'colegios/C/cursos/kc/config/mundos'), config('pC')));
await no('licencia vencida: no', setDoc(doc(pD, 'colegios/D/cursos/kd/config/mundos'), config('pD')));

console.log('\nFase 7 · prueba de entrada y salida, cierres');
const prueba = (over = {}) => ({ score: 3, total: 12, takenAt: 1, breakdown: { presupuesto: 1 }, totales: { presupuesto: 2 }, ...over });
await no('sin la fase abierta el estudiante no responde', setDoc(doc(eAct, `${K1}/estudiantes/eAct/impactTest/pre`), prueba()));
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, `${K1}/config/prueba`), { pre: { abiertaAt: 1, cerradaAt: null, abiertaPor: 'pA' }, post: { abiertaAt: 1, cerradaAt: 2, abiertaPor: 'pA' } });
  await setDoc(doc(db, 'colegios/A/cierres/2026-p1'), { anio: 2026, huella: 'abc' });
});
await si('con la entrada abierta el estudiante activo la responde', setDoc(doc(eAct, `${K1}/estudiantes/eAct/impactTest/pre`), prueba()));
await no('una sola vez', setDoc(doc(eAct, `${K1}/estudiantes/eAct/impactTest/pre`), prueba({ score: 12 })));
await no('la salida está cerrada', setDoc(doc(eAct, `${K1}/estudiantes/eAct/impactTest/post`), prueba()));
await no('un pendiente de autorización no', setDoc(doc(ePend, `${K1}/estudiantes/ePend/impactTest/pre`), prueba()));
await no('ni por otro estudiante', setDoc(doc(eAct, `${K1}/estudiantes/eMulti/impactTest/pre`), prueba()));
await no('más aciertos que preguntas no', setDoc(doc(eMulti, `${K1}/estudiantes/eMulti/impactTest/pre`), prueba({ score: 13 })));
await no('campos de más no', setDoc(doc(eMulti, `${K1}/estudiantes/eMulti/impactTest/pre`), prueba({ nota: 5 })));
await si('el profe de la clase ve el resultado', getDoc(doc(pA, `${K1}/estudiantes/eAct/impactTest/pre`)));
await no('otro profe no', getDoc(doc(pA2, `${K1}/estudiantes/eAct/impactTest/pre`)));
await no('el profe no la abre directo (es del callable)', setDoc(doc(pA, `${K1}/config/prueba`), { pre: { abiertaAt: 9, cerradaAt: null } }));
await no('ni la borra', deleteDoc(doc(pA, `${K1}/config/prueba`)));
await si('la clase lee si la prueba está abierta', getDoc(doc(eAct, `${K1}/config/prueba`)));
await si('el admin lee los cierres de periodo', getDoc(doc(pA, 'colegios/A/cierres/2026-p1')));
await no('un profe que no es admin no', getDoc(doc(pA2, 'colegios/A/cierres/2026-p1')));
await no('nadie reescribe un cierre', setDoc(doc(pA, 'colegios/A/cierres/2026-p1'), { anio: 2026, huella: 'otra' }));

console.log('\nFase 8 · grupos y adaptaciones');
const grupos = (autor, over = {}) => ({ grupos: [{ id: 'g1', nombre: 'Cóndores', color: '#2F7BE5', uids: ['eAct'] }], actualizadoAt: 1, actualizadoPor: autor, ...over });
const adapt = (autor, over = {}) => ({ masTiempo: true, menosOpciones: false, leerEnVozAlta: true, letraGrande: false, actualizadoAt: 1, actualizadoPor: autor, ...over });
await si('el profe arma grupos (sin plan también)', setDoc(doc(pA2, 'colegios/A/cursos/k2/config/grupos'), grupos('pA2')));
await si('el profe de k1 arma grupos', setDoc(doc(pA, `${K1}/config/grupos`), grupos('pA')));
await no('otro profe no', setDoc(doc(pA2, `${K1}/config/grupos`), grupos('pA2')));
await no('a nombre de otro no', setDoc(doc(pA, `${K1}/config/grupos`), grupos('pA2')));
await no('más de 12 no', setDoc(doc(pA, `${K1}/config/grupos`), grupos('pA', { grupos: Array.from({ length: 13 }, (_, i) => ({ id: `g${i}` })) })));
await no('el estudiante no los edita', setDoc(doc(eAct, `${K1}/config/grupos`), grupos('eAct')));
await si('el estudiante ve su grupo', getDoc(doc(eAct, `${K1}/config/grupos`)));
await si('el profe borra los grupos', deleteDoc(doc(pA2, 'colegios/A/cursos/k2/config/grupos')));
await si('el profe enciende la voz de la clase', setDoc(doc(pA, `${K1}/config/accesibilidad`), { leerEnVozAlta: true, actualizadoAt: 1, actualizadoPor: 'pA' }));
await no('la voz es sí o no', setDoc(doc(pA, `${K1}/config/accesibilidad`), { leerEnVozAlta: 'sí', actualizadoAt: 1, actualizadoPor: 'pA' }));
await si('el profe pone adaptaciones', setDoc(doc(pA, `${K1}/estudiantes/eAct/adaptaciones/actual`), adapt('pA')));
await no('otro profe no', setDoc(doc(pA2, `${K1}/estudiantes/eAct/adaptaciones/actual`), adapt('pA2')));
await no('el estudiante no se las pone', setDoc(doc(eAct, `${K1}/estudiantes/eAct/adaptaciones/actual`), adapt('eAct')));
await no('campos de más no', setDoc(doc(pA, `${K1}/estudiantes/eAct/adaptaciones/actual`), adapt('pA', { nota: 5 })));
await no('solo el doc actual', setDoc(doc(pA, `${K1}/estudiantes/eAct/adaptaciones/otro`), adapt('pA')));
await si('el estudiante ve las suyas', getDoc(doc(eAct, `${K1}/estudiantes/eAct/adaptaciones/actual`)));
await no('no las de otro', getDoc(doc(eMulti, `${K1}/estudiantes/eAct/adaptaciones/actual`)));

console.log('\nFase 8 · certificados e insignias');
const insignia = (over = {}) => ({ insignia: 'constancia', motivo: 'Entró todos los días', dadaPor: 'pA', dadaPorNombre: 'Profe A', dadaAt: 1, ...over });
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'certificados/CETI-AAAA-BBBB'), { uid: 'eAct', colegioId: 'A', cursoId: 'k1' });
  await setDoc(doc(db, `${K1}/estudiantes/eAct/certificados/CETI-AAAA-BBBB`), { nombre: 'eAct' });
});
await no('nadie lee la verificación desde el cliente', getDoc(doc(pA, 'certificados/CETI-AAAA-BBBB')));
await no('ni la escribe', setDoc(doc(pA, 'certificados/CETI-ZZZZ-ZZZZ'), { uid: 'eAct' }));
await si('el estudiante ve su certificado', getDoc(doc(eAct, `${K1}/estudiantes/eAct/certificados/CETI-AAAA-BBBB`)));
await si('el profe lo ve', getDoc(doc(pA, `${K1}/estudiantes/eAct/certificados/CETI-AAAA-BBBB`)));
await no('el profe no lo escribe directo', setDoc(doc(pA, `${K1}/estudiantes/eAct/certificados/CETI-CCCC-DDDD`), { nombre: 'x' }));
await si('el profe da una insignia', setDoc(doc(pA, `${K1}/estudiantes/eAct/insignias/i1`), insignia()));
await si('sin motivo también', setDoc(doc(pA, `${K1}/estudiantes/eAct/insignias/i2`), insignia({ motivo: null })));
await no('una que no existe no', setDoc(doc(pA, `${K1}/estudiantes/eAct/insignias/i3`), insignia({ insignia: 'mejor_de_todos' })));
await no('motivo largo no', setDoc(doc(pA, `${K1}/estudiantes/eAct/insignias/i4`), insignia({ motivo: 'x'.repeat(121) })));
await no('a nombre de otro profe no', setDoc(doc(pA, `${K1}/estudiantes/eAct/insignias/i5`), insignia({ dadaPor: 'pA2' })));
await no('otro profe no', setDoc(doc(pA2, `${K1}/estudiantes/eAct/insignias/i6`), insignia({ dadaPor: 'pA2' })));
await no('a un pendiente no', setDoc(doc(pA, `${K1}/estudiantes/ePend/insignias/i7`), insignia()));
await no('el estudiante no se la da', setDoc(doc(eAct, `${K1}/estudiantes/eAct/insignias/i8`), insignia({ dadaPor: 'eAct' })));
await si('el estudiante ve las suyas', getDocs(collection(eAct, `${K1}/estudiantes/eAct/insignias`)));
await no('no las de otro', getDocs(collection(eMulti, `${K1}/estudiantes/eAct/insignias`)));
await no('no se editan', updateDoc(doc(pA, `${K1}/estudiantes/eAct/insignias/i1`), { motivo: 'otro' }));
await si('el profe la quita', deleteDoc(doc(pA, `${K1}/estudiantes/eAct/insignias/i2`)));

console.log('\nFase 8a · clase en vivo');
const VIVO = `${K1}/vivo/actual`;
const resp = (uid, n, over = {}) => ({ uid, n, r: 1, sesion: 's1', creadoAt: serverTimestamp(), ...over });
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, VIVO), { id: 's1', estado: 'pregunta', actual: 0, pregunta: { n: 0, opciones: ['a', 'b', 'c', 'd'] } });
  await setDoc(doc(db, `${VIVO}/privado/clave`), { preguntas: [] });
  await setDoc(doc(db, `${K1}/sesionesVivo/s0`), { participantes: 3 });
});
await si('el estudiante activo ve la sesión', getDoc(doc(eAct, VIVO)));
await no('un pendiente no', getDoc(doc(ePend, VIVO)));
await si('el profe la ve', getDoc(doc(pA, VIVO)));
await no('otro profe no', getDoc(doc(pA2, VIVO)));
await no('nadie lee la clave', getDoc(doc(pA, `${VIVO}/privado/clave`)));
await no('ni el estudiante', getDoc(doc(eAct, `${VIVO}/privado/clave`)));
await no('el profe no la escribe (es del callable)', updateDoc(doc(pA, VIVO), { estado: 'revelada' }));
await si('el estudiante marca que entró', setDoc(doc(eAct, `${VIVO}/presentes/eAct`), { sesion: 's1', entradaAt: 1 }));
await no('no por otro', setDoc(doc(eAct, `${VIVO}/presentes/eMulti`), { sesion: 's1', entradaAt: 1 }));
await no('ni en otra sesión', setDoc(doc(eMulti, `${VIVO}/presentes/eMulti`), { sesion: 'vieja', entradaAt: 1 }));
await si('el estudiante responde la pregunta abierta', setDoc(doc(eAct, `${VIVO}/respuestas/0_eAct`), resp('eAct', 0)));
await no('una sola vez', setDoc(doc(eAct, `${VIVO}/respuestas/0_eAct`), resp('eAct', 0, { r: 2 })));
await no('no otra pregunta', setDoc(doc(eMulti, `${VIVO}/respuestas/1_eMulti`), resp('eMulti', 1)));
await no('no una opción que no existe', setDoc(doc(eMulti, `${VIVO}/respuestas/0_eMulti`), resp('eMulti', 0, { r: 4 })));
await no('no con otra sesión', setDoc(doc(eMulti, `${VIVO}/respuestas/0_eMulti`), resp('eMulti', 0, { sesion: 'vieja' })));
await no('no con la hora del celular', setDoc(doc(eMulti, `${VIVO}/respuestas/0_eMulti`), resp('eMulti', 0, { creadoAt: 5 })));
await no('no a nombre de otro', setDoc(doc(eMulti, `${VIVO}/respuestas/0_eAct`), resp('eAct', 0)));
await no('un pendiente no responde', setDoc(doc(ePend, `${VIVO}/respuestas/0_ePend`), resp('ePend', 0)));
await si('el profe ve las respuestas', getDocs(collection(pA, `${VIVO}/respuestas`)));
await no('el estudiante no ve las de otros', getDocs(collection(eAct, `${VIVO}/respuestas`)));
await env.withSecurityRulesDisabled(async (ctx) => {
  await updateDoc(doc(ctx.firestore(), VIVO), { estado: 'revelada' });
});
await no('revelada: ya no se responde', setDoc(doc(eMulti, `${VIVO}/respuestas/0_eMulti`), resp('eMulti', 0)));
await si('el profe ve el historial', getDoc(doc(pA, `${K1}/sesionesVivo/s0`)));
await no('el estudiante no', getDoc(doc(eAct, `${K1}/sesionesVivo/s0`)));

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
