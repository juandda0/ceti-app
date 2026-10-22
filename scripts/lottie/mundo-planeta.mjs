// Genera el Lottie de reposo (tipo A, loop) de un planeta de la familia de mundos, leyendo lo que deja
// scripts/marca/mundos/<planeta>.py en assets/brand/mundos/<planeta>/:
//   <planeta>.svg            grupos planeta y, si tiene órbita, anillo-atras, anillo-frente y planeta-tapa
//   <planeta>.json           órbita, satélites y animación
//   <planeta>-satelite.svg   un satélite (moneda, gema) centrado en (0, 0) a escala 1
// Movimiento: el planeta flota y se balancea (un vaivén cada `periodo` s), los satélites recorren la órbita
// bamboleándose y aparecen destellos alrededor. En un loop los satélites avanzan `avance` de vuelta (1/n = una
// posición), así que el último fotograma empalma con el primero.
// Uso: node scripts/lottie/mundo-planeta.mjs <planeta>
import { readFileSync, existsSync } from 'node:fs';
import { svgReader, svgToGroups, layerFactory, layerKs, anim, writeLottie, group, shapes, fill, SPARK } from './lib.mjs';

const NOMBRE = process.argv[2] || 'naranja';
const DIR = `assets/brand/mundos/${NOMBRE}`;
const R = svgReader(`${DIR}/${NOMBRE}.svg`);
const P = JSON.parse(readFileSync(`${DIR}/${NOMBRE}.json`, 'utf8'));
const S = existsSync(`${DIR}/${NOMBRE}-satelite.svg`) ? svgReader(`${DIR}/${NOMBRE}-satelite.svg`) : null;
const OUT = `${DIR}/lottie`;

const FPS = 60;
const DUR = P.animacion?.duracion ?? 6;
const OP = DUR * FPS;
const FLOTAR = P.animacion?.flotar ?? 12; // px que sube el planeta
const PERIODO = (P.animacion?.periodo ?? 3) * FPS; // un vaivén (sube y baja) en fotogramas; divide al loop
const INCLINAR = P.animacion?.inclinar ?? 2.5; // grados que se balancea el planeta (con todo su anillo)
const BAMBOLEO = P.animacion?.bamboleo ?? 7; // grados que se mece cada satélite
const DESTELLOS = P.animacion?.destellos ?? Math.round(DUR / 1.5); // destellos por loop
if (OP % PERIODO) throw new Error(`el periodo (${PERIODO / FPS} s) debe dividir la duración (${DUR} s)`);
// fotogramas entre claves de órbita (el arco va en las tangentes); si avanzan poco por loop, bastan menos claves
const PASO = (P.satelites?.avance ?? 0) >= 0.25 ? 20 : 60;
const [, , W, H] = R.viewBox;
const DOS_PI = 2 * Math.PI;
const norm = (t) => ((t % DOS_PI) + DOS_PI) % DOS_PI;

// ---------- Órbita (la misma geometría que scripts/marca/mundos/planeta.py) ----------
const O = P.orbita;
const SAT = P.satelites;
const giro = O ? (O.giro * Math.PI) / 180 : 0;
const punto = (t) => {
  const x = O.a * Math.cos(t);
  const y = O.b * Math.sin(t);
  return [O.c[0] + x * Math.cos(giro) - y * Math.sin(giro), O.c[1] + x * Math.sin(giro) + y * Math.cos(giro)];
};
const derivada = (t) => {
  const x = -O.a * Math.sin(t);
  const y = O.b * Math.cos(t);
  return [x * Math.cos(giro) - y * Math.sin(giro), x * Math.sin(giro) + y * Math.cos(giro)];
};
let parametro = null;
if (O) {
  const PASOS = 2000;
  const TS = Array.from({ length: PASOS + 1 }, (_, k) => (DOS_PI * k) / PASOS);
  const LARGO = [0];
  for (let k = 1; k <= PASOS; k++) {
    const [a, b] = [punto(TS[k - 1]), punto(TS[k])];
    LARGO.push(LARGO[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  // t para la fracción u de la vuelta, mezclando espaciado en t y por longitud de arco (`reparto`)
  parametro = (u) => {
    u = ((u % 1) + 1) % 1;
    const objetivo = u * LARGO[PASOS];
    let k = 1;
    while (LARGO[k] < objetivo) k++;
    const tArco = TS[k - 1] + ((TS[k] - TS[k - 1]) * (objetivo - LARGO[k - 1])) / (LARGO[k] - LARGO[k - 1]);
    return (1 - O.reparto) * DOS_PI * u + O.reparto * tArco;
  };
}

// Estado del satélite i en el fotograma f: avanza en el sentido del recorrido (t decreciente).
function estado(i, f) {
  const t = norm(parametro(SAT.fase + i / SAT.n - (SAT.avance * f) / OP));
  const s = Math.sin(t - ((SAT.fase_escala ?? 0) * Math.PI) / 180);
  return { t, c: punto(t), esc: 100 * (SAT.escala_atras + ((1 - SAT.escala_atras) * (s + 1)) / 2) };
}

// Posición sobre la órbita: claves lineales en el tiempo con tangentes espaciales (arco de cúbica entre claves).
function posicion(i) {
  const fs = [];
  for (let f = 0; f <= OP; f += PASO) fs.push(f);
  if (fs[fs.length - 1] !== OP) fs.push(OP);
  const es = fs.map((f) => estado(i, f));
  return {
    a: 1,
    k: fs.map((f, n) => {
      if (n === fs.length - 1) return { t: f, s: es[n].c };
      let dt = es[n + 1].t - es[n].t;
      if (dt > Math.PI) dt -= DOS_PI;
      if (dt < -Math.PI) dt += DOS_PI;
      const [da, db] = [derivada(es[n].t), derivada(es[n + 1].t)];
      return {
        t: f, s: es[n].c, o: { x: 0, y: 0 }, i: { x: 1, y: 1 },
        to: [(da[0] * dt) / 3, (da[1] * dt) / 3], ti: [(-db[0] * dt) / 3, (-db[1] * dt) / 3],
      };
    }),
  };
}

// Onda senoidal muestreada (claves lineales): empalma en el loop porque el periodo divide la duración.
function seno(amp, partes = 12, fase = () => 0) {
  const k = [];
  for (let f = 0; f <= OP; f += PERIODO / partes) k.push([f, [amp * Math.sin(DOS_PI * (f / PERIODO + fase(f)))]]);
  return lineal(k);
}

const lineal = (keys) => ({
  a: 1,
  k: keys.map(([t, v], idx) =>
    idx === keys.length - 1
      ? { t, s: v }
      : { t, s: v, o: { x: v.map(() => 0), y: v.map(() => 0) }, i: { x: v.map(() => 1), y: v.map(() => 1) } }),
});

// El satélite se define una vez (precomposición de MON × MON con la pieza en el centro) y lo usan todas las capas.
const MON = 320; // de sobra para la moneda más grande (r ≈ 130 con canto y contorno)
// Variantes (p. ej. gemas de colores): grupos satelite-0, satelite-1...; el satélite i usa la variante i % V.
const V = S ? (S.SVG.match(/<g id="satelite-\d+"/g) || []).length : 0;
function assetsSatelite() {
  return Array.from({ length: V }, (_, k) => {
    const L = layerFactory();
    const capa = L.shapeLayer('satelite', svgToGroups(S, S.groupInner(`satelite-${k}`), `satelite-${k}`), {
      op: OP, ks: { p: [MON / 2, MON / 2] },
    });
    return { id: `satelite-${k}`, nm: `satelite-${k}`, fr: FPS, layers: [capa] };
  });
}

function capaSatelite(ind, i) {
  const esc = [];
  // la escala solo cambia con la profundidad: con muchos satélites bastan menos claves (peso del archivo)
  const pasoEsc = SAT.n > 30 ? OP / 4 : OP / 8;
  for (let f = 0; f <= OP; f += pasoEsc) esc.push([f, [estado(i, f).esc, estado(i, f).esc]]);
  // Bamboleo: la fase depende del punto de la órbita (una ola de `olas` crestas fija en el espacio), así que la
  // pieza que llega al final del loop a un sitio queda igual que la que empieza ahí.
  const olas = SAT.n >= 6 ? 3 : 0;
  const u = (f) => SAT.fase + i / SAT.n - (SAT.avance * f) / OP;
  const r = BAMBOLEO ? seno(BAMBOLEO, 12, (f) => olas * u(f)) : { a: 0, k: 0 };
  return {
    ddd: 0, ind, ty: 0, nm: `satelite-${String(i).padStart(2, '0')}`, refId: `satelite-${i % V}`, sr: 1,
    ks: { o: { a: 0, k: 100 }, r, p: posicion(i), a: { a: 0, k: [MON / 2, MON / 2] }, s: lineal(esc) },
    ao: 0, w: MON, h: MON, ip: 0, op: OP, st: 0, bm: 0,
  };
}

// El anillo (línea fija + satélites) se pinta dos veces: detrás del planeta y delante; encima de la de adelante
// va `planeta-tapa`, que tapa lo que pasa por detrás (sin máscaras: rlottie las dibuja mal al escalar). Orden de
// los satélites: cada uno tapa al que va delante en el recorrido (t mayor encima); el corte de ese orden
// circular va en t = 3π/2, detrás del planeta.
const CORTE = 1.5 * Math.PI;
function assetAnillo() {
  const capas = [];
  let ind = 0;
  if (SAT) {
    const orden = [...Array(SAT.n).keys()].sort((a, b) => norm(estado(b, 0).t - CORTE) - norm(estado(a, 0).t - CORTE));
    for (const i of orden) capas.push(capaSatelite(++ind, i));
  }
  const fijo = R.groupInner('anillo-atras-fijo');
  if (fijo.trim()) {
    const L = layerFactory();
    capas.push({ ...L.shapeLayer('anillo-fijo', svgToGroups(R, fijo, 'fijo'), { op: OP }), ind: ++ind });
  }
  return { id: 'anillo', nm: 'anillo', fr: FPS, layers: capas };
}

function reposo() {
  const L = layerFactory();
  const centro = [W / 2, H / 2];
  const arriba = [centro[0], centro[1] - FLOTAR];
  const flotar = [[0, centro]];
  for (let f = 0; f < OP; f += PERIODO) flotar.push([f + PERIODO / 2, arriba], [f + PERIODO, centro]);
  // se inclina a un lado al subir y al otro al bajar: un vaivén de barca, no un sube y baja rígido
  const control = L.nullLayer('flotar', { a: centro, p: anim(flotar), r: seno(INCLINAR) }, OP);
  const p = control.ind;
  const planeta = L.shapeLayer('planeta', svgToGroups(R, R.groupInner('planeta'), 'planeta'), { op: OP, parent: p });
  const assets = [];
  let layers = [control, planeta];
  // Formas propias encima del disco (pepitas...): se mecen alrededor del centro del planeta.
  if (R.SVG.includes('<g id="planeta-extras"')) {
    const c = P.anima_extras?.pivote ?? P.planeta.c;
    const g = P.anima_extras?.mecer ?? 0;
    const e = P.anima_extras?.estirar ?? 0;
    let ks = { a: c, p: c };
    // mecer: péndulo alrededor del centro (rápido al centro, lento en las puntas)
    const vaiven = (a, b) => {
      const k = [[0, a]];
      for (let f = 0; f < OP; f += PERIODO) k.push([f + PERIODO / 2, b], [f + PERIODO, a]);
      return anim(k);
    };
    if (g) ks.r = vaiven(-g, g);
    // estirar: se alarga hacia abajo desde la cima del planeta y vuelve (oro que chorrea)
    if (e) {
      const cima = [P.planeta.c[0], P.planeta.c[1] - P.planeta.r];
      ks = { a: cima, p: cima, s: vaiven([100, 100], [100, 100 + e]) };
    }
    const extras = L.shapeLayer('planeta-extras', svgToGroups(R, R.groupInner('planeta-extras'), 'extra'), {
      op: OP, parent: p, ks,
    });
    layers = [control, extras, planeta];
  }
  if (O && P.desfile) {
    // Desfile: cada pieza avanza un puesto (paso grados de órbita) por loop, siempre delante del planeta. La
    // primera nace (crece desde 0) y la última se desvanece; el resto solo cambia de tamaño con la onda medida.
    const D = P.desfile;
    const rad = (g) => (g * Math.PI) / 180;
    const radio = (t) => D.r_media + D.r_onda * Math.sin(t - rad(D.fase_r));
    assets.push(...assetsSatelite());
    const piezas = [];
    for (let k = D.n - 1; k >= 0; k--) {  // la de t mayor (más cerca) arriba
      const tk = (f) => rad(D.t0 + D.paso * (k + f / OP));
      const fs = [0, OP / 4, OP / 2, (3 * OP) / 4, OP];
      const pos = {
        a: 1,
        k: fs.map((f, n) => {
          if (n === fs.length - 1) return { t: f, s: punto(tk(f)) };
          const dt = tk(fs[n + 1]) - tk(f);
          const [da, db] = [derivada(tk(f)), derivada(tk(fs[n + 1]))];
          return { t: f, s: punto(tk(f)), o: { x: 0, y: 0 }, i: { x: 1, y: 1 },
            to: [(da[0] * dt) / 3, (da[1] * dt) / 3], ti: [(-db[0] * dt) / 3, (-db[1] * dt) / 3] };
        }),
      };
      const nace = (f) => (k === 0 ? Math.min(1, f / (OP * 0.6)) : 1);
      // la última pasa junto a la cámara: crece un poco más y se desvanece rápido
      const sale = (f) => (k === D.n - 1 ? 1 + 0.3 * Math.min(1, f / (OP * 0.6)) : 1);
      const esc = lineal(fs.map((f) => {
        const v = (100 * radio(tk(f)) * nace(f) * sale(f)) / D.r_max;
        return [f, [v, v]];
      }));
      const o = k === D.n - 1 ? anim([[0, 100], [OP * 0.25, 100, 'in'], [OP * 0.55, 0], [OP, 0]]) : { a: 0, k: 100 };
      piezas.push({
        ddd: 0, ind: 200 + k, ty: 0, nm: `desfile-${k}`, refId: `satelite-${k % V}`, sr: 1,
        ks: { o, r: { a: 0, k: 0 }, p: pos, a: { a: 0, k: [MON / 2, MON / 2] }, s: esc },
        ao: 0, w: MON, h: MON, ip: 0, op: OP, st: 0, bm: 0, parent: p,
      });
    }
    layers = [control, ...piezas, ...layers.slice(1)];
  } else if (O) {
    if (SAT) assets.push(...assetsSatelite());
    assets.push(assetAnillo());
    let ind = 100;
    const anillo = (nm) => ({
      ddd: 0, ind: ++ind, ty: 0, nm, refId: 'anillo', sr: 1, ks: layerKs(), ao: 0, w: W, h: H,
      ip: 0, op: OP, st: 0, bm: 0, parent: p,
    });
    const tapa = L.shapeLayer('planeta-tapa', svgToGroups(R, R.groupInner('planeta-tapa'), 'tapa'), { op: OP, parent: p });
    // Lottie pinta la primera capa arriba: tapa, anillo de adelante, planeta, anillo de atrás.
    layers = [control, tapa, anillo('anillo-frente'), planeta, anillo('anillo-atras')];
  }
  if (DESTELLOS) layers = [capaDestellos(L), ...layers];
  return { v: '5.7.4', fr: FPS, ip: 0, op: OP, w: W, h: H, nm: `${NOMBRE}-reposo`, ddd: 0, assets, layers };
}

// Destellos dorados que se encienden y apagan alrededor del planeta, uno tras otro y alternando de lado. Van
// fijos en el espacio (no flotan con el planeta).
function capaDestellos(L) {
  const { c, r } = P.planeta;
  const angulos = [-135, 40, 150, -40, -95, 100, 175, -10];
  const VIDA = 0.75 * FPS;
  const grupos = Array.from({ length: DESTELLOS }, (_, k) => {
    const a = (angulos[k % angulos.length] * Math.PI) / 180;
    const d = r + 60 + (k % 2) * 30;
    const p = [c[0] + d * Math.cos(a), c[1] + d * Math.sin(a)].map((v) => Math.min(W - 50, Math.max(50, v)));
    const t = Math.round(((k + 0.2) * OP) / DESTELLOS);
    const tam = k % 2 ? 210 : 290;
    return group(`destello-${k}`, [...shapes(SPARK), fill('#F7C95F')], {
      p,
      s: anim([[0, [0, 0], 'hold'], [t, [0, 0], 'out'], [t + VIDA * 0.35, [tam, tam], 'in'], [t + VIDA, [0, 0]], [OP, [0, 0]]]),
      r: anim([[0, 0, 'hold'], [t, -30, 'out'], [t + VIDA, 40], [OP, 40]]),
    });
  });
  return L.shapeLayer('destellos', grupos, { op: OP });
}

writeLottie(`${OUT}/${NOMBRE}-reposo.json`, reposo());
