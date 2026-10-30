/**
 * Valida a mano el contenido por defecto (lo mismo que contenidoBancos.test.ts).
 *   node scripts/contenido/validar.cjs                 # todo content/
 *   node scripts/contenido/validar.cjs 1_world_2       # solo los archivos que empiezan así
 * Sale con código 1 si algo no pasa.
 */
const path = require('path');
const fs = require('fs');

const raiz = path.resolve(__dirname, '../..');
const proyecto = path.join(raiz, 'tsconfig.scripts.json');
process.env.TS_NODE_PROJECT = proyecto;
require('ts-node').register({
  project: proyecto,
  transpileOnly: true,
  compilerOptions: { ignoreDeprecations: '6.0', rootDir: raiz },
});
require('tsconfig-paths').register({
  baseUrl: raiz,
  paths: { '@/*': ['*'], '@features/*': ['src/features/*'], '@shared/*': ['src/shared/*'] },
});

const { validarArchivo } = require(path.join(raiz, 'src/features/learning/data/validarContenido.ts'));

const filtro = process.argv[2] ?? '';
let malos = 0;
let total = 0;
for (const carpeta of ['bancos', 'microteoria']) {
  const dir = path.join(raiz, 'content', carpeta);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x.startsWith(filtro))) {
    total += 1;
    let errs;
    try {
      errs = validarArchivo(f, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), carpeta);
    } catch (e) {
      errs = [`${f}: JSON inválido (${e.message})`];
    }
    if (errs.length) {
      malos += 1;
      console.log(`✗ ${carpeta}/${f}`);
      for (const e of errs) console.log(`    ${e}`);
    }
  }
}
console.log(`${total - malos}/${total} archivos válidos${filtro ? ` (filtro ${filtro})` : ''}`);
process.exit(malos ? 1 : 0);
