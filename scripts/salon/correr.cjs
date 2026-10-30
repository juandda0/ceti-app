/**
 * Lanzador de los scripts del Salón demo (TypeScript sin compilar): registra
 * ts-node (solo transpilar) y los alias @features/@shared de
 * tsconfig.scripts.json. Uso: node scripts/salon/correr.cjs <sembrar|simular|alertas|acudientes> [args]
 */
const path = require('path');

const raiz = path.resolve(__dirname, '../..');
const proyecto = path.join(raiz, 'tsconfig.scripts.json');
process.env.TS_NODE_PROJECT = proyecto;

// TypeScript 6 marca como error las opciones viejas de tsconfig.scripts.json.
require('ts-node').register({
  project: proyecto,
  transpileOnly: true,
  compilerOptions: { ignoreDeprecations: '6.0', rootDir: raiz },
});
require('tsconfig-paths').register({
  baseUrl: raiz,
  paths: { '@features/*': ['src/features/*'], '@shared/*': ['src/shared/*'] },
});

const [, , comando, ...resto] = process.argv;
const permitidos = ['sembrar', 'simular', 'alertas', 'acudientes'];
if (!permitidos.includes(comando)) {
  console.error(`Uso: node scripts/salon/correr.cjs <${permitidos.join('|')}> [args]`);
  process.exit(1);
}
process.argv = [process.argv[0], path.join(__dirname, `${comando}.ts`), ...resto];
require(`./${comando}.ts`);
