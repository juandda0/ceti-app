// Parte un Lottie de tipo C (entrada + reposo en loop, marcados con `markers`) en dos archivos: la entrada
// (se reproduce una vez) y el reposo (en loop). Así cada pantalla usa dos fichas normales del catálogo en
// vez de controlar tramos a mano, que el reproductor web no soporta bien.
// El reposo envuelve la escena original en una precomposición corrida en el tiempo (`st` negativo): recortar
// `ip` directamente rompe dotLottie con precomps.
// Uso: node scripts/lottie/partir-tramos.mjs <origen.json> <salida-entrada.json> <salida-reposo.json>
import { readFileSync } from 'node:fs';
import { writeLottie } from './lib.mjs';

const [, , ORIGEN, SALIDA_ENTRADA, SALIDA_REPOSO] = process.argv;
if (!SALIDA_REPOSO) throw new Error('uso: partir-tramos.mjs <origen> <entrada> <reposo>');

const src = JSON.parse(readFileSync(ORIGEN, 'utf8'));
const marca = (nombre) => {
  const m = (src.markers || []).find((x) => x.cm === nombre);
  if (!m) throw new Error(`falta el marcador "${nombre}"`);
  return m;
};
const entrada = marca('entrada');
const reposo = marca('asomada');
const corte = entrada.tm + entrada.dr;
if (reposo.tm !== corte) throw new Error('la entrada debe terminar donde empieza el reposo');

// Entrada: misma escena, terminando en el corte.
writeLottie(SALIDA_ENTRADA, { ...src, nm: `${src.nm}-entrada`, ip: 0, op: corte, markers: [] });

// Reposo: una sola capa que reproduce la escena original desde el corte. Las capas que terminan antes del corte
// (p. ej. las poses del salto) no se ven en el reposo: se quitan para no cargar su peso.
const vivas = (layers) => layers.filter((l) => !(l.op <= corte && l.st === 0));
src.layers = vivas(src.layers);
for (const a of src.assets || []) if (a.layers) a.layers = vivas(a.layers);
const dur = reposo.dr;
writeLottie(SALIDA_REPOSO, {
  v: src.v, fr: src.fr, ip: 0, op: dur, w: src.w, h: src.h, nm: `${src.nm}-reposo`, ddd: 0, markers: [],
  assets: [...(src.assets || []), { id: 'escena-original', nm: 'escena-original', fr: src.fr, layers: src.layers }],
  layers: [{
    ddd: 0, ind: 1, ty: 0, nm: 'escena', refId: 'escena-original', sr: 1,
    ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
    ao: 0, w: src.w, h: src.h, ip: 0, op: dur, st: -corte, bm: 0,
  }],
});
