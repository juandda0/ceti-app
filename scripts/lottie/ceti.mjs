// Genera los Lottie de Ceti a partir de la misma geometría del logo (assets/brand/ceti-mark.svg),
// así animación y logo nunca divergen. Uso: node scripts/lottie/ceti.mjs
import { writeFileSync } from 'node:fs';

const FPS = 60;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1);
const INK = hex('#1E1A18');
const WHITE = hex('#FFFFFF');
const BELLY = hex('#FFE0B8');

// ---------- Geometría (coordenadas del SVG del logo) ----------
const HEAD =
  'M140 300 C130 240 175 190 240 186 C300 182 345 210 380 232 C420 256 460 270 470 298 C478 330 440 370 395 400 C350 430 290 440 240 430 C190 420 155 380 145 345 C142 330 140 315 140 300 Z';
const BELLY_POLY =
  'M138 298 C160 304 185 310 205 312 C228 366 284 384 340 370 L390 430 L390 520 L90 520 L90 298 Z';
const MOUTH = 'M138 298 C160 304 185 310 205 312';
const SMILE = 'M138 298 C160 314 188 318 205 312';
const BELLY_LINE = 'M205 312 C228 366 284 384 340 370';
const GROOVES = ['M174 361 C182 384 195 402 208 414', 'M215 382 C226 404 246 420 278 431'];
const FLIPPER = 'M340 370 L376 418 M300 408 L374 420';
const EYE = [252, 314];
const SPARK = 'M0 -10 C1.2 -3 3 -1.2 10 0 C3 1.2 1.2 3 0 10 C-1.2 3 -3 1.2 -10 0 C-3 -1.2 -1.2 -3 0 -10 Z';
const TAIL = [
  'M430 300 C470 282 505 258 528 226 L552 238 C532 276 498 306 452 326 Z',
  'M538 230 C524 206 528 182 546 166 C558 188 556 210 546 232 Z',
  'M546 234 C566 220 592 218 610 226 C594 244 570 248 548 240 Z',
];
const HOLE = { c: [286, 336], rx: 214, ry: 108, rot: -25 };
const STARS = [
  { spark: true, p: [126, 432], s: 1.3, t: 34 },
  { spark: true, p: [436, 238], s: 1.3, t: 42 },
  { spark: true, p: [200, 446], s: 0.8, t: 50 },
  { p: [150, 392], r: 3.5, t: 38 },
  { p: [236, 448], r: 3, t: 54 },
  { p: [455, 248], r: 3.5, t: 46 },
  { p: [398, 219], r: 2.5, t: 30 },
  { p: [164, 440], r: 2.5, t: 58 },
];

// ---------- SVG path -> forma Lottie ----------
function parsePath(d, [ox, oy]) {
  const tok = d.match(/[MLCQZ]|-?\d*\.?\d+/gi);
  const subs = [];
  let cur, last, cmd, k = 0;
  const pt = () => [parseFloat(tok[k++]) - ox, parseFloat(tok[k++]) - oy];
  const pushCurve = (c1, c2, p) => {
    cur.o[cur.o.length - 1] = [c1[0] - last[0], c1[1] - last[1]];
    cur.v.push(p);
    cur.i.push([c2[0] - p[0], c2[1] - p[1]]);
    cur.o.push([0, 0]);
    last = p;
  };
  while (k < tok.length) {
    if (/[A-Z]/i.test(tok[k])) cmd = tok[k++].toUpperCase();
    if (cmd === 'M') {
      last = pt();
      cur = { v: [last], i: [[0, 0]], o: [[0, 0]], c: false };
      subs.push(cur);
      cmd = 'L';
    } else if (cmd === 'L') {
      const p = pt();
      pushCurve(last, p, p);
    } else if (cmd === 'C') {
      pushCurve(pt(), pt(), pt());
    } else if (cmd === 'Q') {
      const q = pt();
      const p = pt();
      const lerp = (a, b) => [a[0] + (2 / 3) * (b[0] - a[0]), a[1] + (2 / 3) * (b[1] - a[1])];
      pushCurve(lerp(last, q), lerp(p, q), p);
    } else if (cmd === 'Z') {
      cur.c = true;
      const n = cur.v.length;
      const [a, b] = [cur.v[0], cur.v[n - 1]];
      if (n > 1 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01) {
        cur.i[0] = cur.i[n - 1];
        cur.v.pop();
        cur.i.pop();
        cur.o.pop();
      }
      cmd = null;
    }
  }
  return subs;
}

// ---------- Helpers Lottie ----------
const EASE = {
  inOut: [[0.45, 0], [0.55, 1]],
  out: [[0.22, 1], [0.36, 1]],
  in: [[0.55, 0], [0.9, 0.4]],
};
const val = (k) => ({ a: 0, k });
// keys: [[frame, value, ease?], ...] — ease aplica al tramo que empieza en ese frame.
function anim(keys) {
  return {
    a: 1,
    k: keys.map(([t, v, ease = 'inOut'], idx) => {
      const s = Array.isArray(v) ? v : [v];
      if (idx === keys.length - 1) return { t, s };
      const [[ox, oy], [ix, iy]] = EASE[ease];
      const n = s.length;
      return { t, s, o: { x: Array(n).fill(ox), y: Array(n).fill(oy) }, i: { x: Array(n).fill(ix), y: Array(n).fill(iy) } };
    }),
  };
}
const prop = (v) => (v && v.a !== undefined ? v : val(v));
const tr = ({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) => ({
  ty: 'tr', p: prop(p), a: prop(a), s: prop(s), r: prop(r), o: prop(o), sk: val(0), sa: val(0),
});
const shapes = (d, off) => parsePath(d, off).map((ks) => ({ ty: 'sh', ks: val(ks) }));
const fill = (c) => ({ ty: 'fl', c: val(c), o: val(100), r: 1 });
const stroke = (w, c = INK) => ({ ty: 'st', c: val(c), o: val(100), w: val(w), lc: 2, lj: 2, ml: 4 });
const group = (nm, items, t) => ({ ty: 'gr', nm, it: [...items, tr(t)] });
const layerKs = ({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) => ({
  o: prop(o), r: prop(r), p: prop(p), a: prop(a), s: prop(s),
});
let IND = 0;
const shapeLayer = (nm, shapesArr, extra = {}) => ({
  ddd: 0, ind: ++IND, ty: 4, nm, sr: 1, ks: layerKs(extra.ks), ao: 0, shapes: shapesArr,
  ip: 0, op: extra.op, st: 0, bm: 0,
  ...(extra.parent ? { parent: extra.parent } : {}),
  ...(extra.masks ? { hasMask: true, masksProperties: extra.masks } : {}),
});
const nullLayer = (nm, ks, op) => ({ ddd: 0, ind: ++IND, ty: 3, nm, sr: 1, ks: layerKs(ks), ao: 0, ip: 0, op, st: 0, bm: 0 });
const mask = (nm, pt) => ({ inv: false, mode: 'a', nm, pt, o: val(100), x: val(0) });

// Elipse rotada como bezier (para máscaras). lowerOnly: media elipse inferior + caja enorme arriba.
function holeRegion({ c, rx, ry, rot }, off, lowerOnly = false) {
  const K = 0.5523;
  const th = (rot * Math.PI) / 180;
  const toComp = ([x, y]) => [c[0] + x * Math.cos(th) - y * Math.sin(th) - off[0], c[1] + x * Math.sin(th) + y * Math.cos(th) - off[1]];
  const rotV = ([x, y]) => [x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th)];
  // puntos locales con tangentes locales (in, out)
  const pts = lowerOnly
    ? [
        [[-rx, 0], [0, 0], [0, ry * K]],
        [[0, ry], [-rx * K, 0], [rx * K, 0]],
        [[rx, 0], [0, ry * K], [0, 0]],
        [[rx + 600, 0], [0, 0], [0, 0]],
        [[rx + 600, -900], [0, 0], [0, 0]],
        [[-rx - 600, -900], [0, 0], [0, 0]],
        [[-rx - 600, 0], [0, 0], [0, 0]],
      ]
    : [
        [[-rx, 0], [0, -ry * K], [0, ry * K]],
        [[0, ry], [-rx * K, 0], [rx * K, 0]],
        [[rx, 0], [0, ry * K], [0, -ry * K]],
        [[0, -ry], [rx * K, 0], [-rx * K, 0]],
      ];
  return { v: pts.map(([p]) => toComp(p)), i: pts.map(([, i]) => rotV(i)), o: pts.map(([, , o]) => rotV(o)), c: true };
}

function writeLottie(file, json) {
  writeFileSync(file, JSON.stringify(json, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));
  console.log(`${file}: ${(JSON.stringify(json).length / 1024).toFixed(0)} KB`);
}

// ---------- Capas de Ceti (compartidas) ----------
function cetiLayers({ off, op, parent, smile = false, blinkAt }) {
  const eye = [EYE[0] - off[0], EYE[1] - off[1]];
  const blink = blinkAt
    ? anim([[blinkAt, [100, 100]], [blinkAt + 4, [100, 10]], [blinkAt + 8, [100, 100]]])
    : [100, 100];
  const lines = shapeLayer('ceti-lineas', [
    group('ojo', [{ ty: 'el', p: val(eye), s: val([24, 24]), d: 1 }, fill(INK)], { a: eye, p: eye, s: blink }),
    group('boca', [...shapes(smile ? SMILE : MOUTH, off), stroke(14)]),
    group('panza-linea', [...shapes(BELLY_LINE, off), stroke(14)]),
    group('surcos', [...GROOVES.flatMap((d) => shapes(d, off)), stroke(8)]),
    group('aleta', [...shapes(FLIPPER, off), stroke(14)]),
    group('contorno', [...shapes(HEAD, off), stroke(14)]),
  ], { op, parent });
  const headMask = mask('cabeza', val(parsePath(HEAD, off)[0]));
  const belly = shapeLayer('ceti-panza', [group('panza', [...shapes(BELLY_POLY, off), fill(BELLY)])], { op, parent, masks: [headMask] });
  const head = shapeLayer('ceti-cuerpo', [group('cuerpo', [...shapes(HEAD, off), fill(WHITE)])], { op, parent });
  return [lines, belly, head];
}

// ---------- 1 · brand.ceti-portal: Ceti sale del agujero ----------
function portal() {
  IND = 0;
  const off = [60, 100];
  const OP = 132;
  const hc = [HOLE.c[0] - off[0], HOLE.c[1] - off[1]];

  // Precomp con Ceti moviéndose; el layer del precomp lleva la máscara del agujero (fija en pantalla).
  const ctrl = nullLayer('ceti-control', {
    a: [240, 220],
    p: anim([[24, [367, 492], 'out'], [56, [234, 207]], [72, [240, 220]]]),
    s: anim([[24, [70, 70], 'out'], [46, [92, 112]], [58, [108, 94]], [74, [100, 100]]]),
    r: anim([[24, 14, 'out'], [56, -5], [76, 0]]),
  }, OP);
  const whale = [...cetiLayers({ off, op: OP, parent: ctrl.ind, blinkAt: 104 }), ctrl];

  IND = 100;
  const tight = holeRegion({ ...HOLE, rx: 200, ry: 96 }, off, true);
  const loose = holeRegion({ ...HOLE, rx: 240, ry: 140 }, off, true);
  const cetiPre = {
    ddd: 0, ind: ++IND, ty: 0, nm: 'ceti', refId: 'ceti', sr: 1, ks: layerKs(), ao: 0,
    w: 450, h: 450, ip: 22, op: OP, st: 0, bm: 0, hasMask: true,
    masksProperties: [mask('salida', anim([[0, [tight]], [54, [tight], 'out'], [70, [loose]]]))],
  };

  const stars = shapeLayer('estrellas', STARS.map((st, n) => {
    const p = [st.p[0] - off[0], st.p[1] - off[1]];
    const base = (st.s ?? 1) * 100;
    const pop = anim([[st.t, [0, 0], 'out'], [st.t + 12, [base * 1.3, base * 1.3]], [st.t + 22, [base, base]]]);
    const shape = st.spark ? shapes(SPARK, [0, 0]) : [{ ty: 'el', p: val([0, 0]), s: val([st.r * 2, st.r * 2]), d: 1 }];
    return group(`estrella-${n}`, [...shape, fill(WHITE)], { p, s: pop, r: st.spark ? anim([[st.t, -90, 'out'], [st.t + 22, 0]]) : 0 });
  }), { op: OP, masks: [mask('agujero', val(holeRegion({ ...HOLE, rx: 206, ry: 100 }, off)))] });

  const hole = shapeLayer('agujero', [
    group('elipse', [{ ty: 'el', p: val([0, 0]), s: val([HOLE.rx * 2, HOLE.ry * 2]), d: 1 }, fill(INK)], { r: HOLE.rot }),
  ], { op: OP, ks: { p: hc, s: anim([[0, [0, 0], 'out'], [20, [112, 112]], [32, [100, 100]]]) } });

  return {
    v: '5.7.4', fr: FPS, ip: 0, op: OP, w: 450, h: 450, nm: 'brand.ceti-portal', ddd: 0,
    assets: [{ id: 'ceti', layers: whale }],
    layers: [cetiPre, stars, hole],
    markers: [],
  };
}

// ---------- 2 · mascot.ceti-idle: Ceti flotando en loop ----------
function idle() {
  IND = 0;
  const off = [85, 90];
  const OP = 180;
  const c = [300 - off[0], 300 - off[1]];
  const ctrl = nullLayer('ceti-control', {
    a: c,
    p: anim([[0, c], [90, [c[0], c[1] - 9]], [180, c]]),
    s: anim([[0, [100, 100]], [90, [101.5, 98.5]], [180, [100, 100]]]),
    r: anim([[0, -1.5], [90, 1.5], [180, -1.5]]),
  }, OP);
  const base = [440 - off[0], 312 - off[1]];
  const tail = shapeLayer('ceti-cola', TAIL.map((d, n) => group(`cola-${n}`, [...shapes(d, off), stroke(14), fill(WHITE)])), {
    op: OP, parent: ctrl.ind,
    ks: { a: base, p: base, r: anim([[0, 0], [45, -9], [90, 0], [135, 7], [180, 0]]) },
  });
  return {
    v: '5.7.4', fr: FPS, ip: 0, op: OP, w: 570, h: 400, nm: 'mascot.ceti-idle', ddd: 0,
    assets: [],
    layers: [...cetiLayers({ off, op: OP, parent: ctrl.ind, smile: true, blinkAt: 120 }), tail, ctrl],
    markers: [],
  };
}

writeLottie('assets/animations/brand/ceti-portal.json', portal());
writeLottie('assets/animations/mascot/ceti-idle.json', idle());
