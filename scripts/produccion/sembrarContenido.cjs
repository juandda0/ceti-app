/**
 * Siembra el contenido por defecto de content/ en Firestore:
 *   content/bancos/{g}_{mundo}_{tipo}.json → bancos/{g}_{mundo}_{tipo}
 *   content/bancos/{g}_{mundo}.json        → bancosEligeCamino/{g}_{mundo}
 *   content/microteoria/{g}_{mundo}.json   → microteoria/{g}_{mundo}
 * (mismo mapeo que scripts/salon/sembrar.ts y los repositorios del cliente:
 * bancoDocRef / eligeCaminoDocRef / microteoriaDocRef en src/shared/lib/firebase/paths.ts).
 *
 * Por defecto NO escribe (dry-run): imprime qué crearía, actualizaría o dejaría igual.
 *
 *   node scripts/produccion/sembrarContenido.cjs --proyecto <id> [--dry-run]
 *   node scripts/produccion/sembrarContenido.cjs --proyecto <id> --escribir [--confirmo-produccion]
 *
 * Opciones:
 *   --proyecto <id>          obligatorio. demo-* solo existe en el emulador (FIRESTORE_EMULATOR_HOST).
 *   --escribir               escribe de verdad. Sin esto es dry-run.
 *   --dry-run                explícito (es lo que pasa por defecto).
 *   --confirmo-produccion    obligatorio para escribir en un proyecto que no sea demo-*.
 *   --solo <prefijo>         solo los documentos cuyo id empieza así (p. ej. 1_ , 9_world_6).
 *   --sin-conexion           planea sin leer Firestore (todo sale como «crear»).
 *   --detalle                lista también los documentos que quedan iguales.
 *
 * Reglas:
 *   - Valida todo content/ con validarContenido.ts antes de nada; si algo falla, aborta.
 *   - Idempotente: compara el JSON normalizado (claves ordenadas) con lo que hay y solo
 *     escribe lo que cambió. Escribe el documento completo con set() (sin merge), en lotes.
 *   - Nunca borra. Los documentos que están en Firestore y no en content/ solo se listan.
 *   - Credenciales: ADC (GOOGLE_APPLICATION_CREDENTIALS o `gcloud auth application-default
 *     login`). Se niega a usar una clave guardada dentro del repo.
 *   - content/approved y content/validation no se suben: la app no los lee (eran registros
 *     de los gates del arnés retirado y no existen para las celdas de la Fase 7).
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const RAIZ = path.resolve(__dirname, '../..');
const TIPOS_BANCO = ['multiple_choice', 'true_false', 'ordenar'];
const COLECCIONES = ['bancos', 'bancosEligeCamino', 'microteoria'];
const TAMANO_LOTE = 400;
const ESPERA_LECTURA_MS = 20000;

// ---------------------------------------------------------------------------
// Lógica pura (exportada y probada en sembrarContenido.test.ts)
// ---------------------------------------------------------------------------

/** Colección e id de destino de un archivo de content/. null si no es contenido. */
function destinoDeArchivo(carpeta, nombre) {
  if (!nombre.endsWith('.json')) return null;
  const id = nombre.slice(0, -'.json'.length);
  if (carpeta === 'microteoria') return { coleccion: 'microteoria', id };
  if (carpeta === 'bancos') {
    const esQuiz = TIPOS_BANCO.some((t) => id.endsWith(`_${t}`));
    return { coleccion: esQuiz ? 'bancos' : 'bancosEligeCamino', id };
  }
  return null;
}

/**
 * Lee content/bancos y content/microteoria. Devuelve los documentos destino
 * ordenados por ruta y los archivos con JSON inválido.
 */
function leerContenido(raiz = RAIZ) {
  const docs = [];
  const invalidos = [];
  for (const carpeta of ['bancos', 'microteoria']) {
    const dir = path.join(raiz, 'content', carpeta);
    for (const nombre of fs.readdirSync(dir).sort()) {
      const destino = destinoDeArchivo(carpeta, nombre);
      if (!destino) continue;
      const archivo = path.join(dir, nombre);
      try {
        const datos = JSON.parse(fs.readFileSync(archivo, 'utf8'));
        docs.push({
          ...destino,
          ruta: `${destino.coleccion}/${destino.id}`,
          carpeta,
          nombre,
          datos,
        });
      } catch (e) {
        invalidos.push(`${carpeta}/${nombre}: JSON inválido (${e.message})`);
      }
    }
  }
  docs.sort((a, b) => (a.ruta < b.ruta ? -1 : a.ruta > b.ruta ? 1 : 0));
  return { docs, invalidos };
}

/** Errores de validación de todos los documentos (validarArchivo de validarContenido.ts). */
function validarDocumentos(docs, validarArchivo) {
  return docs.flatMap((d) =>
    validarArchivo(d.nombre, d.datos, d.carpeta).map((e) => `${d.carpeta}/${e}`)
  );
}

/** Archivos que pide el runtime (archivosEsperados()) y no están. */
function faltantes(docs, esperados) {
  const hay = new Set(docs.map((d) => `${d.carpeta}/${d.nombre}`));
  return [
    ...esperados.bancos.map((f) => `bancos/${f}`),
    ...esperados.microteoria.map((f) => `microteoria/${f}`),
  ].filter((f) => !hay.has(f));
}

function filtrarSolo(docs, prefijo) {
  return prefijo ? docs.filter((d) => d.id.startsWith(prefijo)) : docs;
}

/**
 * Forma estable para comparar: claves ordenadas, Timestamps de Firestore como
 * {__timestamp: ISO}, referencias como {__ref: ruta}. JSON y Firestore dan los
 * mismos números en JS (1 y 1.0 son iguales).
 */
function normalizar(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(normalizar);
  if (typeof v === 'object') {
    if (typeof v.toDate === 'function' && typeof v.toMillis === 'function') {
      return { __timestamp: v.toDate().toISOString() };
    }
    if (typeof v.path === 'string' && v.firestore) return { __ref: v.path };
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (v[k] !== undefined) out[k] = normalizar(v[k]);
    }
    return out;
  }
  return v;
}

function hashContenido(datos) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalizar(datos)))
    .digest('hex');
}

/** Campos de primer nivel que difieren (para explicar una actualización). */
function camposDistintos(nuevo, viejo) {
  const a = normalizar(nuevo) || {};
  const b = normalizar(viejo) || {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .sort();
}

/**
 * Plan por colección contra lo que ya hay. `existentes`: Map ruta → datos, o
 * null si no se pudo leer (entonces todo es «crear»). `extras`: rutas que hay
 * en Firestore y no en content/ (dentro del prefijo); nunca se tocan.
 */
function planear(docs, existentes) {
  const plan = {};
  for (const c of COLECCIONES) plan[c] = { crear: [], actualizar: [], igual: [], extras: [] };
  const deseadas = new Set(docs.map((d) => d.ruta));
  for (const d of docs) {
    const viejo = existentes ? existentes.get(d.ruta) : undefined;
    const p = plan[d.coleccion];
    if (viejo === undefined) p.crear.push(d);
    else if (hashContenido(viejo) === hashContenido(d.datos)) p.igual.push(d);
    else p.actualizar.push({ ...d, campos: camposDistintos(d.datos, viejo) });
  }
  if (existentes) {
    for (const ruta of existentes.keys()) {
      const [c] = ruta.split('/');
      if (plan[c] && !deseadas.has(ruta)) plan[c].extras.push(ruta);
    }
    for (const c of COLECCIONES) plan[c].extras.sort();
  }
  return plan;
}

function aEscribir(plan) {
  return COLECCIONES.flatMap((c) => [...plan[c].crear, ...plan[c].actualizar]);
}

function lotes(lista, tamano = TAMANO_LOTE) {
  const out = [];
  for (let i = 0; i < lista.length; i += tamano) out.push(lista.slice(i, i + tamano));
  return out;
}

function parsearArgs(argv) {
  const o = {
    proyecto: null,
    escribir: false,
    dryRun: false,
    confirmoProduccion: false,
    solo: '',
    sinConexion: false,
    detalle: false,
    ayuda: false,
  };
  const errores = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        errores.push(`${a} necesita un valor`);
        return null;
      }
      i++;
      return v;
    };
    if (a === '--proyecto') o.proyecto = valor();
    else if (a.startsWith('--proyecto=')) o.proyecto = a.slice('--proyecto='.length);
    else if (a === '--solo') o.solo = valor() || '';
    else if (a.startsWith('--solo=')) o.solo = a.slice('--solo='.length);
    else if (a === '--escribir') o.escribir = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--confirmo-produccion') o.confirmoProduccion = true;
    else if (a === '--sin-conexion') o.sinConexion = true;
    else if (a === '--detalle') o.detalle = true;
    else if (a === '--ayuda' || a === '-h' || a === '--help') o.ayuda = true;
    else errores.push(`opción desconocida: ${a}`);
  }
  if (o.escribir && o.dryRun) errores.push('--escribir y --dry-run no van juntos');
  if (o.escribir && o.sinConexion)
    errores.push('--escribir necesita leer lo que hay (quita --sin-conexion)');
  return { opciones: o, errores };
}

const esDemo = (proyecto) => /^demo-/.test(proyecto);

/**
 * Decide cómo conectarse y qué está prohibido. Devuelve { errores, avisos,
 * modo: 'sin-conexion' | 'emulador' | 'adc' }.
 */
function revisarSeguridad(o, env, raiz = RAIZ) {
  const errores = [];
  const avisos = [];
  if (!o.proyecto) errores.push('falta --proyecto <id> (no hay proyecto por defecto)');
  else if (!/^[a-z][a-z0-9-]{4,29}$/.test(o.proyecto))
    errores.push(`--proyecto «${o.proyecto}» no parece un id de proyecto`);
  if (errores.length) return { errores, avisos, modo: null };

  const emulador = env.FIRESTORE_EMULATOR_HOST || '';
  let modo;
  if (o.sinConexion) {
    avisos.push('--sin-conexion: no se lee Firestore, el plan trata todo como «crear»');
    modo = 'sin-conexion';
  } else if (emulador) modo = 'emulador';
  else if (esDemo(o.proyecto)) {
    if (o.escribir)
      errores.push(
        `${o.proyecto} es un proyecto demo: solo existe en el emulador (define FIRESTORE_EMULATOR_HOST)`
      );
    else
      avisos.push(
        'sin FIRESTORE_EMULATOR_HOST no hay de dónde leer un proyecto demo: el plan trata todo como «crear»'
      );
    modo = 'sin-conexion';
  } else modo = 'adc';

  if (o.escribir && !esDemo(o.proyecto) && !o.confirmoProduccion) {
    errores.push(`${o.proyecto} no es demo-*: para escribir agrega --confirmo-produccion`);
  }
  if (modo === 'emulador' && !esDemo(o.proyecto)) {
    avisos.push(
      `FIRESTORE_EMULATOR_HOST=${emulador}: se usa el emulador, no el proyecto real ${o.proyecto}`
    );
  }
  if (modo === 'adc') {
    const clave = env.GOOGLE_APPLICATION_CREDENTIALS;
    if (clave) {
      const rel = path.relative(raiz, path.resolve(clave));
      if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        errores.push(
          `GOOGLE_APPLICATION_CREDENTIALS apunta dentro del repo (${rel}): nunca guardes claves aquí`
        );
      }
    }
  }
  return { errores, avisos, modo };
}

function lineasPlan(plan, { detalle = false } = {}) {
  const out = [];
  for (const c of COLECCIONES) {
    const p = plan[c];
    out.push(
      `${c}: crear ${p.crear.length} · actualizar ${p.actualizar.length} · igual ${p.igual.length}` +
        (p.extras.length ? ` · solo en Firestore ${p.extras.length} (no se tocan)` : '')
    );
    for (const d of p.crear) out.push(`  + ${d.ruta}`);
    for (const d of p.actualizar) out.push(`  ~ ${d.ruta}  (${d.campos.join(', ')})`);
    if (detalle) for (const d of p.igual) out.push(`  = ${d.ruta}`);
    for (const r of p.extras) out.push(`  ? ${r}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entrada / salida
// ---------------------------------------------------------------------------

function cargarValidador() {
  const proyecto = path.join(RAIZ, 'tsconfig.scripts.json');
  process.env.TS_NODE_PROJECT = proyecto;
  require('ts-node').register({
    project: proyecto,
    transpileOnly: true,
    compilerOptions: { ignoreDeprecations: '6.0', rootDir: RAIZ },
  });
  require('tsconfig-paths').register({
    baseUrl: RAIZ,
    paths: { '@/*': ['*'], '@features/*': ['src/features/*'], '@shared/*': ['src/shared/*'] },
  });
  return require(path.join(RAIZ, 'src/features/learning/data/validarContenido.ts'));
}

function conectar(proyecto) {
  process.env.GCLOUD_PROJECT = proyecto;
  process.env.GOOGLE_CLOUD_PROJECT = proyecto;
  // Con el emulador no hay que buscar el servidor de metadatos de GCE (solo da avisos).
  if (process.env.FIRESTORE_EMULATOR_HOST) process.env.METADATA_SERVER_DETECTION = 'none';
  const req = createRequire(path.join(RAIZ, 'package.json'));
  const { initializeApp, applicationDefault } = req('firebase-admin/app');
  const { getFirestore } = req('firebase-admin/firestore');
  const app = process.env.FIRESTORE_EMULATOR_HOST
    ? initializeApp({ projectId: proyecto }, 'siembra')
    : initializeApp({ projectId: proyecto, credential: applicationDefault() }, 'siembra');
  return { app, db: getFirestore(app) };
}

function conTiempo(promesa, ms, que) {
  let t;
  return Promise.race([
    promesa,
    new Promise((_, rechazar) => {
      t = setTimeout(() => rechazar(new Error(`${que}: sin respuesta en ${ms / 1000} s`)), ms);
    }),
  ]).finally(() => clearTimeout(t));
}

/** Lee las 3 colecciones completas (pocos cientos de documentos). */
async function leerExistentes(db, prefijo) {
  const existentes = new Map();
  for (const c of COLECCIONES) {
    const snap = await conTiempo(db.collection(c).get(), ESPERA_LECTURA_MS, `leer ${c}`);
    for (const d of snap.docs) {
      if (!prefijo || d.id.startsWith(prefijo)) existentes.set(`${c}/${d.id}`, d.data());
    }
  }
  return existentes;
}

async function escribir(db, docs) {
  let n = 0;
  for (const lote of lotes(docs)) {
    const batch = db.batch();
    for (const d of lote) batch.set(db.doc(d.ruta), d.datos); // set completo, sin merge
    await batch.commit();
    n += lote.length;
    console.log(`  lote confirmado: ${n}/${docs.length}`);
  }
  return n;
}

const AYUDA = `Uso: node scripts/produccion/sembrarContenido.cjs --proyecto <id> [--dry-run | --escribir [--confirmo-produccion]] [--solo <prefijo>] [--sin-conexion] [--detalle]`;

async function main(argv = process.argv.slice(2), env = process.env) {
  const { opciones: o, errores: errArgs } = parsearArgs(argv);
  if (o.ayuda) {
    console.log(AYUDA);
    return 0;
  }
  const seg = errArgs.length
    ? { errores: errArgs, avisos: [], modo: null }
    : revisarSeguridad(o, env);
  if (seg.errores.length) {
    for (const e of seg.errores) console.error(`✗ ${e}`);
    console.error(AYUDA);
    return 1;
  }

  const modoTexto = o.escribir ? 'ESCRIBIR' : 'dry-run (no escribe)';
  const destinoTexto =
    seg.modo === 'emulador'
      ? `emulador ${env.FIRESTORE_EMULATOR_HOST}`
      : seg.modo === 'adc'
        ? 'Firestore real con ADC'
        : 'sin conexión';
  console.log(
    `Proyecto ${o.proyecto} · ${modoTexto} · ${destinoTexto}${o.solo ? ` · solo «${o.solo}»` : ''}`
  );
  for (const a of seg.avisos) console.log(`! ${a}`);

  // 1. Leer y validar todo content/ (aunque se use --solo).
  const { docs: todos, invalidos } = leerContenido(RAIZ);
  const validador = cargarValidador();
  const errores = [
    ...invalidos,
    ...validarDocumentos(todos, validador.validarArchivo),
    ...faltantes(todos, validador.archivosEsperados()).map((f) => `falta ${f}`),
  ];
  if (errores.length) {
    console.error(
      `✗ El contenido no pasa la validación (${errores.length} errores). No se escribe nada.`
    );
    for (const e of errores.slice(0, 50)) console.error(`    ${e}`);
    if (errores.length > 50) console.error(`    … y ${errores.length - 50} más`);
    return 1;
  }
  const docs = filtrarSolo(todos, o.solo);
  console.log(`Contenido válido: ${todos.length} archivos; ${docs.length} en esta corrida.`);
  if (!docs.length) {
    console.error(`✗ Ningún documento empieza por «${o.solo}».`);
    return 1;
  }

  // 2. Leer lo que hay.
  let conexion = null;
  let existentes = null;
  let codigo = 0;
  try {
    if (seg.modo !== 'sin-conexion') {
      conexion = conectar(o.proyecto);
      try {
        existentes = await leerExistentes(conexion.db, o.solo);
      } catch (e) {
        if (o.escribir) {
          console.error(`✗ No se pudo leer Firestore: ${e.message}. No se escribe nada.`);
          return 1;
        }
        console.log(`! No se pudo leer Firestore (${e.message}): el plan trata todo como «crear».`);
        codigo = 2;
      }
    }

    // 3. Plan.
    const plan = planear(docs, existentes);
    console.log('');
    for (const l of lineasPlan(plan, { detalle: o.detalle })) console.log(l);
    const pendientes = aEscribir(plan);
    console.log('');
    if (!o.escribir) {
      console.log(`dry-run: se escribirían ${pendientes.length} documentos. Nada se escribió.`);
      return codigo;
    }
    if (!pendientes.length) {
      console.log('Todo está igual: no se escribe nada.');
      return 0;
    }

    // 4. Escribir y comprobar.
    console.log(`Escribiendo ${pendientes.length} documentos en lotes de ${TAMANO_LOTE}…`);
    await escribir(conexion.db, pendientes);
    const despues = planear(docs, await leerExistentes(conexion.db, o.solo));
    const quedan = aEscribir(despues);
    if (quedan.length) {
      console.error(
        `✗ Tras escribir, ${quedan.length} documentos siguen distintos: ${quedan.map((d) => d.ruta).join(', ')}`
      );
      return 1;
    }
    console.log(
      `Listo: ${pendientes.length} escritos; comprobado que los ${docs.length} quedaron iguales a content/.`
    );
    return 0;
  } finally {
    if (conexion) await conexion.app.delete().catch(() => {});
  }
}

module.exports = {
  COLECCIONES,
  TIPOS_BANCO,
  TAMANO_LOTE,
  destinoDeArchivo,
  leerContenido,
  validarDocumentos,
  faltantes,
  filtrarSolo,
  normalizar,
  hashContenido,
  camposDistintos,
  planear,
  aEscribir,
  lotes,
  parsearArgs,
  revisarSeguridad,
  lineasPlan,
  main,
};

if (require.main === module) {
  main().then(
    (c) => process.exit(c),
    (e) => {
      console.error(`✗ ${e && e.stack ? e.stack : e}`);
      process.exit(1);
    }
  );
}
