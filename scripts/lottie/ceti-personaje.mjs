// Genera los Lottie de Ceti (personaje v2) leyendo la ilustración validada
// assets/brand/ceti/ceti-frente.svg: cada capa del SVG se vuelve una capa animable,
// así ilustración y animación nunca divergen.
// Uso: node scripts/lottie/ceti-personaje.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { saltoFlex, PERFIL_MEDIDAS } from './ceti-salto-flex.mjs';

const SVG = readFileSync('assets/brand/ceti/ceti-frente.svg', 'utf8');
const OUT = 'assets/brand/ceti/lottie';
const FPS = 60;
const W = 640;
const TOP = 150; // aire arriba para saltos y estrellas
const H = 620 + TOP;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1);
const C = { gold: hex('#F7C95F'), tongue: hex('#F08F74'), mouth: hex('#8C3230'), mouthLine: hex('#BD4919'), maroon: hex('#732C30') };

// ---------- Lectura del SVG ----------
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const num = (tag, name) => parseFloat(attr(tag, name));
function groupInner(id) {
  const start = SVG.indexOf(`<g id="${id}"`);
  if (start < 0) throw new Error(`falta <g id="${id}">`);
  let depth = 0;
  const re = /<g\b|<\/g>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(SVG))) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return SVG.slice(SVG.indexOf('>', start) + 1, m.index);
  }
  throw new Error(`grupo sin cerrar: ${id}`);
}
const tagById = (id) => (SVG.match(new RegExp(`<[a-z]+ id="${id}"[^>]*>`)) || [])[0];
// <path> visibles de un fragmento (excluye los de <clipPath>)
const pathsIn = (html) => [...html.replace(/<clipPath[\s\S]*?<\/clipPath>/g, '').matchAll(/<path\b[^>]*>/g)].map((m) => m[0]);
const circle = (id) => { const t = tagById(id); return { c: [num(t, 'cx'), num(t, 'cy')], r: num(t, 'r'), fill: attr(t, 'fill') }; };

// ---------- SVG path -> forma Lottie ----------
function parsePath(d) {
  const tok = d.match(/[MLCQZ]|-?\d*\.?\d+/gi);
  const subs = [];
  let cur, last, cmd, k = 0;
  const pt = () => [parseFloat(tok[k++]), parseFloat(tok[k++])];
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
  snap: [[0.2, 0], [0.1, 1]],
};
const val = (k) => ({ a: 0, k });
// keys: [[frame, value, ease?], ...] — ease aplica al tramo que empieza en ese frame; 'hold' = sin interpolar.
function anim(keys) {
  return {
    a: 1,
    k: keys.map(([t, v, ease = 'inOut'], idx) => {
      const s = Array.isArray(v) ? v : [v];
      if (idx === keys.length - 1) return { t, s };
      if (ease === 'hold') return { t, s, h: 1 };
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
const shapes = (d) => parsePath(d).map((ks) => ({ ty: 'sh', ks: val(ks) }));
const ellipse = (c, w, h = w) => ({ ty: 'el', p: val(c), s: val([w, h]), d: 1 });
const fill = (c) => ({ ty: 'fl', c: val(typeof c === 'string' ? hex(c) : c), o: val(100), r: 1 });
const stroke = (w, c) => ({ ty: 'st', c: val(typeof c === 'string' ? hex(c) : c), o: val(100), w: val(w), lc: 2, lj: 2, ml: 4 });
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
const nullLayer = (nm, ks, op, parent) => ({ ddd: 0, ind: ++IND, ty: 3, nm, sr: 1, ks: layerKs(ks), ao: 0, ip: 0, op, st: 0, bm: 0, ...(parent ? { parent } : {}) });
const mask = (nm, pt) => ({ inv: false, mode: 'a', nm, pt, o: val(100), x: val(0) });
const circlePath = ([cx, cy], r) => {
  const k = r * 0.5523;
  return { c: true, v: [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]], i: [[-k, 0], [0, -k], [k, 0], [0, k]], o: [[k, 0], [0, k], [-k, 0], [0, -k]] };
};

// <path> de un grupo del SVG -> grupos Lottie (relleno o trazo). Lottie pinta el primero arriba: se invierte el orden.
function svgPathsToGroups(html, prefix) {
  return pathsIn(html).map((t, n) => {
    const d = attr(t, 'd');
    const f = attr(t, 'fill');
    const items = f && f !== 'none' ? [...shapes(d), fill(f)] : [...shapes(d), stroke(num(t, 'stroke-width'), attr(t, 'stroke'))];
    return group(`${prefix}-${n}`, items);
  }).reverse();
}

// ---------- Geometría y pivotes del rig (del SVG) ----------
const shadowTag = tagById('sombra-piso');
const SHADOW = { c: [num(shadowTag, 'cx'), num(shadowTag, 'cy')], rx: num(shadowTag, 'rx'), ry: num(shadowTag, 'ry'), fill: attr(shadowTag, 'fill') };
const BELLY = pathsIn(groupInner('panza'))[0];
const BELLY_D = attr(BELLY, 'd');
const SMILE = tagById('boca');
const EYES = ['izq', 'der'].map((s) => ({
  s,
  aro: circle(`aro-${s}`), esclera: circle(`esclera-${s}`), pupila: circle(`pupila-${s}`), brillo: circle(`brillo-${s}`),
  parpado: attr(tagById(`parpado-${s}`), 'd'), parpadoFill: attr(tagById(`parpado-${s}`), 'fill'),
}));
const BASE = [319, 516]; // pedúnculo: el aplastar/estirar nace de la cola
const SHOULDER_L = [190, 300];
const SHOULDER_R = [449, 300];
const BLOWHOLE = [318, 62];
const smilePts = parsePath(attr(SMILE, 'd'))[0].v;
const S0 = smilePts[0];
const S1 = smilePts[smilePts.length - 1];
const SMID = [(S0[0] + S1[0]) / 2, Math.max(...smilePts.map((p) => p[1]))];

// ---------- Gestos de tristeza ----------
// Boca: la misma línea de la sonrisa, más corta y volteada (comisuras abajo). Mismos vértices: se interpola.
const SMILE_SHAPE = parsePath(attr(SMILE, 'd'))[0];
const FROWN = {
  c: false,
  v: SMILE_SHAPE.v.map(([x, y]) => [SMID[0] + (x - SMID[0]) * 0.5, 236 - (y - S0[1]) * 0.7]),
  i: SMILE_SHAPE.i.map(([x, y]) => [x * 0.5, -y * 0.7]),
  o: SMILE_SHAPE.o.map(([x, y]) => [x * 0.5, -y * 0.7]),
};
// Claves de forma con suavizado escalar (rlottie y lottie-ios no aceptan listas en las formas).
function shapeAnim(keys) {
  return {
    a: 1,
    k: keys.map(([t, v, ease = 'inOut'], idx) => {
      if (idx === keys.length - 1) return { t, s: [v] };
      if (ease === 'hold') return { t, s: [v], h: 1 };
      const [[ox, oy], [ix, iy]] = EASE[ease];
      return { t, s: [v], o: { x: ox, y: oy }, i: { x: ix, y: iy } };
    }),
  };
}
// Cejas de preocupación: cada una gira sobre su centro y sube la punta de adentro.
function sadBrows(tilt) {
  return pathsIn(groupInner('cejas')).map((t, n) => {
    const pts = parsePath(attr(t, 'd'))[0].v;
    const c = [(pts[0][0] + pts.at(-1)[0]) / 2, (pts[0][1] + pts.at(-1)[1]) / 2];
    const dir = n === 0 ? -1 : 1; // izquierda: antihorario sube su punta interna (derecha); derecha: al revés
    return group(`ceja-${n}`, [...shapes(attr(t, 'd')), stroke(num(t, 'stroke-width'), attr(t, 'stroke'))], {
      a: c, p: c, r: anim(tilt.map(([f, deg, ease]) => [f, deg * dir, ease])),
    });
  }).reverse();
}
// Párpado superior del color del cuerpo: baja desde arriba del ojo, más caído hacia afuera (mirada triste).
function upperLid(e, drop) {
  const [cx, cy] = e.esclera.c;
  const r = e.esclera.r + 4;
  const out = e.s === 'izq' ? -1 : 1;
  const xo = cx + out * r;
  const xi = cx - out * r;
  const d = `M${xo} ${cy - r - 70} L${xi} ${cy - r - 70} L${xi} ${cy - r - 4} C${(xi + cx) / 2} ${cy - r - 2} ${(xo + cx) / 2} ${cy - r + 4} ${xo} ${cy - r + 14} Z`;
  return group('parpado-sup', [...shapes(d), fill(e.parpadoFill)], { p: anim(drop.map(([f, y, ease]) => [f, [0, y], ease])) });
}
// Lágrima: se asoma bajo el ojo izquierdo, rueda por la mejilla y se desvanece.
function tearLayer(t0, op, parent) {
  const e = EYES[0];
  const from = [e.esclera.c[0] - 12, e.esclera.c[1] + e.esclera.r - 2];
  const to = [from[0] - 6, from[1] + 74];
  const DROP = 'M0 -13 C5 -6 9 -1 9 5 C9 10 5 13 0 13 C-5 13 -9 10 -9 5 C-9 -1 -5 -6 0 -13 Z';
  return shapeLayer('lagrima', [
    group('brillo', [ellipse([-3, 4], 4, 6), fill('#FFFFFF')]),
    group('gota', [...shapes(DROP), fill('#7CC8F8')]),
  ], {
    op, parent,
    ks: {
      p: anim([[0, from, 'hold'], [t0 + 14, from, 'in'], [t0 + 50, to, 'hold'], [op, to]]),
      s: anim([[0, [0, 0], 'hold'], [t0, [0, 0], 'out'], [t0 + 12, [100, 115], 'inOut'], [t0 + 18, [100, 100], 'hold'], [op, [100, 100]]]),
      o: anim([[0, 100, 'hold'], [t0 + 40, 100, 'inOut'], [t0 + 52, 0, 'hold'], [op, 0]]),
    },
  });
}

// ---------- Rig ----------
function cetiRig({ op, root, control, finL = 0, finR = 0, tail = 0, blink = [100, 100], look = [0, 0], brow = [0, 0], happy, shadowScale = [100, 100], sad }) {
  const parent = control.ind;
  const normal = happy ? anim(happy.map(([t, on]) => [t, on ? 0 : 100, 'hold'])) : 100;
  const joy = happy ? anim(happy.map(([t, on]) => [t, on ? 100 : 0, 'hold'])) : 0;

  const eyeLayers = EYES.flatMap((e) => {
    const eyeNull = nullLayer(`ojo-${e.s}`, { a: e.esclera.c, p: e.esclera.c, s: blink }, op, parent);
    const iris = shapeLayer(`ojo-${e.s}-iris`, [
      ...(sad ? [upperLid(e, sad.lid)] : []),
      group('parpado', [...shapes(e.parpado), fill(e.parpadoFill)]),
      group('mirada', [
        group('brillo', [ellipse(e.brillo.c, e.brillo.r * 2), fill(e.brillo.fill)]),
        group('pupila', [ellipse(e.pupila.c, e.pupila.r * 2), fill(e.pupila.fill)]),
      ], { p: look }),
    ], { op, parent: eyeNull.ind, ks: { o: normal }, masks: [mask('ojo', val(circlePath(e.esclera.c, e.esclera.r + 2)))] });
    const base = shapeLayer(`ojo-${e.s}-base`, [
      group('esclera', [ellipse(e.esclera.c, e.esclera.r * 2), fill(e.esclera.fill)]),
      group('aro', [ellipse(e.aro.c, e.aro.r * 2), fill(e.aro.fill)]),
    ], { op, parent: eyeNull.ind, ks: { o: normal } });
    return [iris, base, eyeNull];
  });
  const happyEyes = EYES.map((e) => {
    const [cx, cy] = e.esclera.c;
    const r = e.esclera.r;
    return `M${cx - r * 0.78} ${cy + 6} Q${cx} ${cy - r * 1.05} ${cx + r * 0.78} ${cy + 6}`;
  });
  // Boca abierta (como en la hoja de modelo): una "D" acostada. Arriba, la misma sonrisa;
  // abajo, una curva amplia y redonda. Interior vinotinto, lengua salmón abajo y delineado fino.
  // La sonrisa sigue visible encima, así las comisuras quedan redondeadas y la boca nace un poco adentro.
  // Arriba sigue exactamente la sonrisa (que queda visible encima y redondea las comisuras); abajo, una curva amplia.
  const mw = S1[0] - S0[0];
  const mBottom = SMID[1] + mw * 0.21;
  const lower = `C${S1[0] - 10} ${S1[1] + mw * 0.3} ${SMID[0] + mw * 0.34} ${mBottom} ${SMID[0]} ${mBottom} C${SMID[0] - mw * 0.34} ${mBottom} ${S0[0] + 10} ${S0[1] + mw * 0.3} ${S0[0]} ${S0[1]}`;
  const mouthBottom = `M${S1[0]} ${S1[1]} ${lower}`;
  const openMouth = `${attr(SMILE, 'd')} ${lower} Z`;

  const layers = [
    shapeLayer('cejas', [group('cejas', sad ? sadBrows(sad.brow) : svgPathsToGroups(groupInner('cejas'), 'ceja'), { p: brow })], { op, parent, ks: { o: normal } }),
    shapeLayer('ojos-felices', [group('ojos-felices', [...happyEyes.flatMap(shapes), stroke(9, C.maroon)])], { op, parent, ks: { o: joy } }),
    ...eyeLayers,
    shapeLayer('boca', [group('boca', [
      ...(sad ? [{ ty: 'sh', ks: shapeAnim(sad.mouth.map(([t, frown, ease]) => [t, frown ? FROWN : SMILE_SHAPE, ease])) }] : shapes(attr(SMILE, 'd'))),
      stroke(num(SMILE, 'stroke-width'), attr(SMILE, 'stroke')),
    ])], { op, parent }),
    ...(sad?.tear ? [tearLayer(sad.tear, op, parent)] : []),
    shapeLayer('boca-abierta-borde', [group('borde', [...shapes(mouthBottom), stroke(4.5, C.mouthLine)])], { op, parent, ks: { o: joy } }),
    shapeLayer('boca-abierta', [
      group('lengua', [ellipse([SMID[0] + 6, mBottom + 3], mw * 0.5, mw * 0.24), fill(C.tongue)]),
      group('boca', [...shapes(openMouth), fill(C.mouth)]),
    ], { op, parent, ks: { o: joy }, masks: [mask('boca', val(parsePath(openMouth)[0]))] }),
    shapeLayer('rubor', svgPathsToGroups(groupInner('rubor'), 'rubor'), { op, parent }),
    shapeLayer('surcos', svgPathsToGroups(groupInner('surcos'), 'surco'), { op, parent, masks: [mask('panza', val(parsePath(BELLY_D)[0]))] }),
    shapeLayer('panza', [group('panza', [...shapes(BELLY_D), fill(attr(BELLY, 'fill'))])], { op, parent }),
    shapeLayer('cuerpo', svgPathsToGroups(groupInner('cuerpo'), 'cuerpo'), { op, parent }),
    shapeLayer('aleta-izq', svgPathsToGroups(groupInner('aleta-izq'), 'aleta'), { op, parent, ks: { a: SHOULDER_L, p: SHOULDER_L, r: finL } }),
    shapeLayer('aleta-der', svgPathsToGroups(groupInner('aleta-der'), 'aleta'), { op, parent, ks: { a: SHOULDER_R, p: SHOULDER_R, r: finR } }),
    shapeLayer('cola', svgPathsToGroups(groupInner('cola'), 'cola'), { op, parent, ks: { a: BASE, p: BASE, r: tail } }),
  ];
  const shadow = shapeLayer('sombra-piso', [group('sombra', [ellipse(SHADOW.c, SHADOW.rx * 2, SHADOW.ry * 2), fill(SHADOW.fill)])], {
    op, parent: root.ind, ks: { a: SHADOW.c, p: SHADOW.c, s: shadowScale },
  });
  return { layers, shadow };
}

// Estrellas doradas que salen del espiráculo. bursts: [{ t, to: [dx, dy], s }]
function starLayer(nm, bursts, { op, parent, life = 34 }) {
  const SPARK = 'M0 -10 C1.2 -3 3 -1.2 10 0 C3 1.2 1.2 3 0 10 C-1.2 3 -3 1.2 -10 0 C-3 -1.2 -1.2 -3 0 -10 Z';
  return shapeLayer(nm, bursts.map((b, n) => {
    const end = [BLOWHOLE[0] + b.to[0], BLOWHOLE[1] + b.to[1]];
    const size = b.s ?? 100;
    return group(`estrella-${n}`, [...shapes(SPARK), fill(C.gold)], {
      p: anim([[b.t, BLOWHOLE, 'out'], [b.t + life, end]]),
      s: anim([[0, [0, 0], 'hold'], [b.t, [0, 0], 'out'], [b.t + 10, [size * 1.2, size * 1.2]], [b.t + life * 0.6, [size, size], 'in'], [b.t + life, [0, 0]]]),
      r: anim([[b.t, -60, 'out'], [b.t + life, 45]]),
    });
  }), { op, parent });
}

const scene = (op) => nullLayer('escena', { p: [0, TOP] }, op);
const comp = (nm, op, layers) => ({ v: '5.7.4', fr: FPS, ip: 0, op, w: W, h: H, nm, ddd: 0, assets: [], layers, markers: [] });

// ---------- Tipo A · reposo: flota en loop, suave y constante ----------
function reposo() {
  IND = 0;
  const OP = 240; // 4 s
  const root = scene(OP);
  const control = nullLayer('ceti-control', {
    a: BASE,
    p: anim([[0, BASE], [120, [BASE[0], BASE[1] - 12]], [240, BASE]]),
    s: anim([[0, [101, 99]], [120, [99, 101.5]], [240, [101, 99]]]),
    r: anim([[0, -1.2], [120, 1.2], [240, -1.2]]),
  }, OP, root.ind);
  // Aletas: dos remadas por ciclo; la cola va a contratiempo del cuerpo (superposición).
  const paddle = (amp) => anim([[0, amp], [60, -amp], [120, amp], [180, -amp], [240, amp]]);
  const { layers, shadow } = cetiRig({
    op: OP, root, control,
    finL: paddle(-4), finR: paddle(4),
    tail: anim([[0, 3], [120, -3], [240, 3]]),
    blink: anim([[0, [100, 100], 'hold'], [150, [100, 100], 'snap'], [155, [100, 8], 'out'], [162, [100, 100], 'hold'], [240, [100, 100]]]),
    look: anim([[0, [0, 0], 'hold'], [40, [0, 0], 'snap'], [46, [3, -2], 'hold'], [128, [3, -2], 'snap'], [134, [-3, 0], 'hold'], [200, [-3, 0], 'snap'], [206, [0, 0], 'hold'], [240, [0, 0]]]),
    brow: anim([[0, [0, 0], 'hold'], [40, [0, 0], 'snap'], [46, [0, -3], 'hold'], [128, [0, -3], 'snap'], [134, [0, 0], 'hold'], [240, [0, 0]]]),
    shadowScale: anim([[0, [100, 100]], [120, [92, 92]], [240, [100, 100]]]),
  });
  const stars = starLayer('estrellas', [
    { t: 176, to: [-34, -56], s: 110 },
    { t: 184, to: [30, -64], s: 90 },
  ], { op: OP, parent: control.ind, life: 40 });
  return comp('mascot.ceti-reposo', OP, [stars, ...layers, shadow, control, root]);
}

// ---------- Tipo B · celebración: salto, empieza y termina en la pose ----------
function celebra() {
  IND = 0;
  const OP = 90; // 1,5 s
  const root = scene(OP);
  const top = [BASE[0], BASE[1] - 110];
  const control = nullLayer('ceti-control', {
    a: BASE,
    p: anim([[0, BASE, 'hold'], [10, BASE, 'out'], [30, top], [44, [top[0], top[1] + 6], 'in'], [60, BASE, 'hold'], [90, BASE]]),
    s: anim([[0, [100, 100]], [10, [110, 90], 'out'], [20, [92, 110]], [32, [100, 100]], [54, [97, 104], 'in'], [61, [112, 88], 'out'], [70, [97, 103]], [80, [100, 100], 'hold'], [90, [100, 100]]]),
    r: anim([[0, 0, 'hold'], [10, 0, 'out'], [30, -4], [46, 4], [62, 0, 'hold'], [90, 0]]),
  }, OP, root.ind);
  const raise = (dir) => anim([[0, 0], [10, -8 * dir, 'out'], [24, 58 * dir], [34, 42 * dir], [44, 60 * dir], [60, 16 * dir, 'out'], [72, -4 * dir], [84, 0, 'hold'], [90, 0]]);
  const { layers, shadow } = cetiRig({
    op: OP, root, control,
    finL: raise(1), finR: raise(-1),
    tail: anim([[0, 0], [10, -6], [24, 10], [40, -8], [60, 6], [74, -3], [86, 0, 'hold'], [90, 0]]),
    happy: [[0, false], [12, true], [68, false], [90, false]],
    shadowScale: anim([[0, [100, 100]], [10, [108, 108], 'out'], [30, [64, 64]], [44, [62, 62], 'in'], [60, [100, 100]], [62, [110, 110], 'out'], [74, [100, 100], 'hold'], [90, [100, 100]]]),
  });
  const stars = starLayer('estrellas', [
    { t: 20, to: [-100, -96], s: 190 },
    { t: 22, to: [92, -112], s: 220 },
    { t: 25, to: [-36, -146], s: 150 },
    { t: 27, to: [140, -54], s: 160 },
    { t: 29, to: [-146, -40], s: 160 },
    { t: 31, to: [34, -156], s: 130 },
  ], { op: OP, parent: control.ind, life: 36 });
  return comp('mascot.ceti-celebra', OP, [stars, ...layers, shadow, control, root]);
}

// ---------- Tipo B · espera: quieta en la pose inicial, solo parpadea ----------
function espera() {
  IND = 0;
  const OP = 240;
  const root = scene(OP);
  const control = nullLayer('ceti-control', { a: BASE, p: BASE }, OP, root.ind);
  const { layers, shadow } = cetiRig({
    op: OP, root, control,
    blink: anim([[0, [100, 100], 'hold'], [180, [100, 100], 'snap'], [185, [100, 8], 'out'], [192, [100, 100], 'hold'], [240, [100, 100]]]),
  });
  return comp('mascot.ceti-espera', OP, [...layers, shadow, control, root]);
}

// ---------- Tipo B · triste: perdió todas las vidas. Suspira, se desinfla y suelta una lágrima. Una sola vez ----------
// Empieza en la pose neutra (empalma con cualquier pantalla) y termina quieta en la pose triste.
function triste() {
  IND = 0;
  const OP = 150; // 2,5 s
  const root = scene(OP);
  const control = nullLayer('ceti-control', {
    a: BASE,
    p: anim([[0, BASE, 'hold'], [10, BASE, 'inOut'], [30, [BASE[0], BASE[1] - 10], 'inOut'], [64, [BASE[0], BASE[1] + 4], 'inOut'], [84, [BASE[0], BASE[1] + 2], 'inOut'], [110, [BASE[0], BASE[1] + 4], 'hold'], [OP, [BASE[0], BASE[1] + 4]]]),
    s: anim([[0, [100, 100], 'hold'], [10, [100, 100], 'inOut'], [30, [97, 105], 'inOut'], [64, [105, 93], 'inOut'], [84, [102, 96], 'inOut'], [110, [103, 95], 'hold'], [OP, [103, 95]]]),
    r: anim([[0, 0, 'hold'], [30, 0, 'inOut'], [64, -2, 'inOut'], [110, -1.5, 'hold'], [OP, -1.5]]),
  }, OP, root.ind);
  // Aletas: suben un poco al inhalar y caen sin fuerza al soltar el aire (la derecha llega tarde: superposición).
  const droop = (dir, lag) => anim([[0, 0, 'hold'], [10, 0, 'inOut'], [30, 8 * dir, 'inOut'], [62 + lag, -18 * dir, 'inOut'], [80 + lag, -14 * dir, 'inOut'], [100 + lag, -16 * dir, 'hold'], [OP, -16 * dir]]);
  const { layers, shadow } = cetiRig({
    op: OP, root, control,
    finL: droop(1, 0), finR: droop(-1, 5),
    tail: anim([[0, 0, 'hold'], [30, 3, 'inOut'], [66, -6, 'inOut'], [90, -4, 'hold'], [OP, -4]]),
    look: anim([[0, [0, 0], 'hold'], [34, [0, 0], 'inOut'], [48, [-2, 7], 'hold'], [OP, [-2, 7]]]),
    blink: anim([[0, [100, 100], 'hold'], [112, [100, 100], 'in'], [118, [100, 12], 'out'], [128, [100, 100], 'hold'], [OP, [100, 100]]]),
    brow: anim([[0, [0, 0], 'hold'], [18, [0, 0], 'inOut'], [40, [0, -4], 'hold'], [OP, [0, -4]]]),
    shadowScale: anim([[0, [100, 100], 'hold'], [10, [100, 100], 'inOut'], [30, [94, 94], 'inOut'], [64, [106, 106], 'inOut'], [84, [103, 103], 'hold'], [OP, [103, 103]]]),
    sad: {
      mouth: [[0, false, 'hold'], [32, false, 'inOut'], [50, true, 'hold'], [OP, true]],
      brow: [[0, 0, 'hold'], [18, 0, 'inOut'], [40, 16, 'hold'], [OP, 16]],
      lid: [[0, 0, 'hold'], [34, 0, 'inOut'], [52, 9, 'hold'], [OP, 9]],
      tear: 76,
    },
  });
  return comp('mascot.ceti-triste', OP, [...layers, shadow, control, root]);
}

// ---------- Salto de perfil (poses de Gemini vectorizadas) ----------
// El salto es balístico de verdad: el centro de Ceti sigue una parábola en el tiempo (sale disparada del portal,
// frena arriba y cae acelerando), y la misma fuerza la hace girar hacia atrás: cada pose de perfil ya trae la
// orientación y la curva del cuerpo, y dentro de su tramo sigue girando un poco para empalmar con la siguiente.
// Salto: un solo dibujo de perfil (assets/brand/ceti/salto/ceti-perfil.json) que se curva a lo largo de la columna
// (scripts/lottie/ceti-salto-flex.mjs). Física: sale disparada del portal, el mismo impulso la hace dar una voltereta
// hacia atrás (cabeza a la izquierda y panza arriba en la cima) y entra de cabeza; el cuerpo se arquea en el aire.
const SALTO = { inicio: 40, fin: 84 }; // 0,73 s en el aire: salto rápido y con fuerza
const SALTO_X = [312, 286]; // deriva hacia la espalda (coordenadas del SVG de Ceti; el portal está en x 319)
const SALTO_Y = { inicio: 680, cima: 150, fin: 950 }; // centroide: la cabeza arranca donde estaba la del muñeco; al final, toda bajo el borde
const AREA = 76000; // área de la silueta de perfil: lo más grande que cabe en el lienzo (640) con el cuerpo arqueado en la voltereta
const PASO = 3; // fotogramas entre claves de forma (la curva es suave: lineal entre claves no se nota)
// Curvatura en el tiempo (u = 0..1 del salto): [u, arco del tronco, latigazo de la cola, nuca].
const CURVA = [
  [0, 0, 0, 0], [0.1, 0.5, -1.1, 0], [0.28, 1.7, 0.6, 0.2], [0.46, 2.5, 1.3, 0.45],
  [0.64, 2.1, -0.2, 0.2], [0.84, 0.6, 0.5, 0], [1, -0.15, 0, 0],
];
function saltoLayer(op, parent) {
  const T = SALTO.fin - SALTO.inicio;
  const { inicio: yA, cima: yC, fin: yB } = SALTO_Y;
  const ta = T * Math.sqrt(yA - yC) / (Math.sqrt(yA - yC) + Math.sqrt(yB - yC)); // cima: misma gravedad de subida y bajada
  const g = (yA - yC) / (ta * ta);
  const pos = (f) => { const t = f - SALTO.inicio; return [SALTO_X[0] + ((SALTO_X[1] - SALTO_X[0]) * t) / T, yC + g * (t - ta) ** 2]; };
  // Giro: arranca con el impulso, es más rápido cerca de la cima y al bajar ya va casi de cabeza (como la velocidad);
  // termina cabeza abajo (-180).
  const uC = ta / T, SIG = 0.2;
  const F = (u) => Math.tanh((u - uC) / SIG);
  const giro = (f) => { const u = (f - SALTO.inicio) / T; return (-180 * (F(u) - F(0))) / (F(1) - F(0)); };
  const curva = (f) => {
    const u = (f - SALTO.inicio) / T;
    const j = Math.min(CURVA.length - 2, CURVA.findIndex((c, n) => n > 0 && u <= c[0]) - 1);
    const [a, b] = [CURVA[Math.max(0, j)], CURVA[Math.max(0, j) + 1]];
    const x = (u - a[0]) / (b[0] - a[0]); const e = x * x * (3 - 2 * x);
    const v = (k) => a[k] + (b[k] - a[k]) * e;
    return { arco: v(1), cola: v(2), cabeza: v(3) };
  };
  const frames = [];
  for (let f = SALTO.inicio; f < SALTO.fin; f += PASO) frames.push(f);
  frames.push(SALTO.fin);
  const k = 100 * Math.sqrt(AREA / PERFIL_MEDIDAS.area);
  const lin = (keys) => ({ a: 1, k: keys.map(([t, v], i) => (i === keys.length - 1 ? { t, s: v } : { t, s: v, o: { x: v.map(() => 0.33), y: v.map(() => 0.33) }, i: { x: v.map(() => 0.67), y: v.map(() => 0.67) } })) });
  const cada = (fn) => { const out = []; for (let f = SALTO.inicio; f <= SALTO.fin; f += 2) out.push([f, fn(f)]); return out; };
  // Estira al salir disparada y se aplasta un poco al entrar (en el eje del cuerpo: la capa escala antes de girar).
  const esc = (f) => { const u = (f - SALTO.inicio) / T; const e = 0.12 * Math.max(0, 1 - u / 0.18) - 0.05 * Math.max(0, (u - 0.85) / 0.15); return [k * (1 - e / 2), k * (1 + e)]; };
  const layer = saltoFlex({
    frames, curva, parent,
    ks: { p: lin(cada(pos)), r: lin(cada((f) => [giro(f)])), s: lin(cada(esc)) },
  });
  // Cuándo la cabeza toca el portal (para las ondas y la ráfaga de la caída).
  const CABEZA = (PERFIL_MEDIDAS.centroide[1] - 8) * (k / 100);
  let choque = SALTO.fin;
  for (let f = SALTO.inicio + T / 2; f <= SALTO.fin; f += 1) {
    const th = (giro(f) * Math.PI) / 180;
    if (pos(f)[1] - CABEZA * Math.cos(th) >= 557) { choque = Math.round(f); break; }
  }
  return { layer: { ...layer, ind: ++IND, ip: SALTO.inicio, op: SALTO.fin + 1 }, choque };
}

// ---------- Tipo C · entrada desde el portal + asomada en loop ----------
// Un solo archivo con dos marcadores: 'entrada' (una vez) y 'asomada' (loop).
// Ceti sale del portal de un salto, vuelve a caer y se queda asomada como una ballena en el mar;
// el portal permanece abierto con sus estrellas titilando. El final de la entrada empalma con el loop.
const shift = (keys, dt) => keys.map(([t, ...rest]) => [t + dt, ...rest]);
function portal() {
  IND = 0;
  const INTRO = SALTO.fin + 35;
  const LOOP = 240;
  const OP = INTRO + LOOP;
  const PC = [319, 470]; // centro del portal (coordenadas de la escena)
  const PR = [300, 92];
  const PROT = -6;
  const SPARK = 'M0 -10 C1.2 -3 3 -1.2 10 0 C3 1.2 1.2 3 0 10 C-1.2 3 -3 1.2 -10 0 C-3 -1.2 -1.2 -3 0 -10 Z';
  const at = (dy) => [BASE[0], BASE[1] + dy];

  // --- Ceti dentro de un precomp, recortada por el borde delantero del portal ---
  const root = scene(OP);
  const SURF = 150; // asomada: el borde del portal le corta la panza
  const hidden = at(560);
  const peek = at(322);
  const apex = at(-130);
  const idleP = [[0, at(SURF)], [120, at(SURF - 12)], [240, at(SURF)]];
  const idleR = [[0, -1.5], [120, 1.5], [240, -1.5]];
  // El muñeco de frente solo hace la anticipación (asoma, mira, se agacha) y la asomada final. El salto lo
  // hacen las poses de perfil (abajo): mientras tanto el muñeco espera escondido bajo el borde del portal.
  const control = nullLayer('ceti-control', {
    a: BASE,
    p: anim([[0, hidden, 'hold'], [12, hidden, 'out'], [26, peek], [33, at(332)], [39, at(340), 'hold'], [SALTO.inicio, hidden, 'hold'], [SALTO.fin + 2, hidden, 'out'], [SALTO.fin + 14, at(SURF - 14)], [SALTO.fin + 22, at(SURF + 6)], [SALTO.fin + 29, at(SURF), 'hold'], ...shift(idleP, INTRO)]),
    s: anim([[0, [100, 100], 'hold'], [33, [100, 100]], [39, [108, 92], 'hold'], [SALTO.inicio, [100, 100], 'hold'], [SALTO.fin + 2, [90, 112], 'out'], [SALTO.fin + 16, [104, 96]], [SALTO.fin + 26, [100, 100], 'hold'], [OP, [100, 100]]]),
    r: anim([[0, 0, 'hold'], [22, 0], [28, -6], [35, 5], [39, 0, 'hold'], [SALTO.fin + 2, 0], [SALTO.fin + 14, 3], [SALTO.fin + 31, -1.5], ...shift(idleR, INTRO)]),
  }, OP, root.ind);
  const flip = nullLayer('ceti-giro', { a: [319, 300], p: [319, 300] }, OP, control.ind);
  const paddle = (amp) => [[0, amp], [60, -amp], [120, amp], [180, -amp], [240, amp]];
  // En el agua las aletas descansan hacia abajo (bajo la superficie) y reman suave.
  const rest = (amp, base) => [[0, base + amp], [60, base - amp], [120, base + amp], [180, base - amp], [240, base + amp]];
  const fin = (dir) => anim([[0, -24 * dir, 'hold'], [SALTO.fin + 2, -24 * dir, 'out'], [SALTO.fin + 16, 22 * dir], [SALTO.fin + 24, -8 * dir], [SALTO.fin + 31, 3 * dir], ...shift(rest(4 * dir, 0), INTRO)]);
  const { layers } = cetiRig({
    op: OP, root, control: flip,
    finL: fin(1), finR: fin(-1),
    tail: anim([[0, 0, 'hold'], [SALTO.fin + 2, 0], [SALTO.fin + 14, 10], [SALTO.fin + 24, -6], [SALTO.fin + 31, 0, 'hold'], [OP, 0]]),
    happy: [[0, false], [SALTO.fin + 4, true], [SALTO.fin + 31, false], [OP, false]],
    blink: anim([[0, [100, 100], 'hold'], [27, [100, 100], 'snap'], [30, [100, 8], 'out'], [35, [100, 100], 'hold'], ...shift([[0, [100, 100], 'hold'], [150, [100, 100], 'snap'], [155, [100, 8], 'out'], [162, [100, 100], 'hold'], [240, [100, 100]]], INTRO)]),
    look: anim([[0, [0, 0], 'hold'], [26, [0, 0], 'snap'], [29, [-4, -3], 'hold'], [32, [-4, -3], 'snap'], [35, [4, -3], 'hold'], [37, [4, -3], 'snap'], [39, [0, 0], 'hold'], ...shift([[0, [0, 0], 'hold'], [40, [0, 0], 'snap'], [46, [3, -2], 'hold'], [128, [3, -2], 'snap'], [134, [-3, 0], 'hold'], [200, [-3, 0], 'snap'], [206, [0, 0], 'hold'], [240, [0, 0]]], INTRO)]),
  });
  const { layer: saltoCeti, choque } = saltoLayer(OP, root.ind);
  console.log('choque con el portal en', choque);
  // Estrellas por el espiráculo: celebración en el salto y, en el loop, un chorro como el de una ballena.
  const spout = [{ t: 176, to: [-30, -70], s: 120 }, { t: 180, to: [22, -86], s: 140 }, { t: 185, to: [-6, -104], s: 110 }, { t: 190, to: [40, -60], s: 90 }];
  const cetiStars = starLayer('estrellas-espiraculo', spout.map((b) => ({ ...b, t: b.t + INTRO })), { op: OP, parent: flip.ind, life: 40 });
  const asset = { id: 'ceti', layers: [cetiStars, saltoCeti, ...layers, flip, control, root] };

  // --- Escena principal ---
  IND = 100;
  const sceneRoot = scene(OP);
  const K = 0.5523;
  const th = (PROT * Math.PI) / 180;
  const rot = ([x, y]) => [x * Math.cos(th) - y * Math.sin(th), x * Math.sin(th) + y * Math.cos(th)];
  const toComp = ([x, y]) => { const [rx, ry] = rot([x, y]); return [PC[0] + rx, PC[1] + ry + TOP]; };
  // Región visible de Ceti: todo lo que queda por encima del borde delantero del portal.
  const lip = (() => {
    const rx = PR[0] * 0.95, ry = PR[1] * 0.95;
    const pts = [
      [[-rx, 0], [0, 0], [0, ry * K]], [[0, ry], [-rx * K, 0], [rx * K, 0]], [[rx, 0], [0, ry * K], [0, 0]],
      [[rx + 900, 0], [0, 0], [0, 0]], [[rx + 900, -1400], [0, 0], [0, 0]], [[-rx - 900, -1400], [0, 0], [0, 0]], [[-rx - 900, 0], [0, 0], [0, 0]],
    ];
    return { c: true, v: pts.map(([p]) => toComp(p)), i: pts.map(([, i]) => rot(i)), o: pts.map(([, , o]) => rot(o)) };
  })();
  const cetiLayer = {
    ddd: 0, ind: ++IND, ty: 0, nm: 'ceti', refId: 'ceti', sr: 1, ks: layerKs(), ao: 0, w: W, h: H, ip: 0, op: OP, st: 0, bm: 0,
    hasMask: true, masksProperties: [mask('borde-del-portal', val(lip))],
  };
  // Ondas en la superficie del portal: una al caer y luego un pulso suave en loop.
  const ripple = (nm, t0, scale0, scale1, o0) => group(nm, [ellipse([0, 0], 380, 80), { ...stroke(4, '#FFFFFF') }], {
    s: anim([[0, [scale0, scale0], 'hold'], [t0, [scale0, scale0], 'out'], [t0 + 40, [scale1, scale1], 'hold'], [OP, [scale1, scale1]]]),
    o: anim([[0, 0, 'hold'], [t0, o0, 'out'], [t0 + 40, 0, 'hold'], [OP, 0]]),
  });
  const pulse = (nm, phase) => group(nm, [ellipse([0, 0], 360, 72), { ...stroke(3, '#FFFFFF') }], {
    s: anim([[0, [80, 80], 'hold'], [INTRO + phase, [80, 80]], [INTRO + phase + 120, [118, 118], 'hold'], [OP, [118, 118]]]),
    o: anim([[0, 0, 'hold'], [INTRO + phase, 0], [INTRO + phase + 20, 35], [INTRO + phase + 120, 0, 'hold'], [OP, 0]]),
  });
  const waves = shapeLayer('ondas', [
    ripple('onda-caida-1', choque, 70, 135, 70), ripple('onda-caida-2', choque + 10, 60, 120, 50),
    pulse('onda-1', 0), pulse('onda-2', 120),
  ], { op: OP, parent: sceneRoot.ind, ks: { p: [PC[0], PC[1] + 34], r: PROT } });
  // Portal: se abre con rebote y se queda abierto; las estrellas titilan sin parar (loop perfecto en 'asomada').
  const twinkle = (t, s, phase) => {
    const big = [s * 120, s * 120];
    const small = [s * 60, s * 60];
    const [a, b] = phase ? [small, big] : [big, small];
    return anim([[0, [0, 0], 'hold'], [t, [0, 0], 'out'], [t + 12, [s * 130, s * 130]], [INTRO, a], [INTRO + 60, b], [INTRO + 120, a], [INTRO + 180, b], [OP, a]]);
  };
  const inner = [
    [-150, -14, 1.5, 8, 0], [120, -26, 1.2, 14, 1], [-60, 30, 0.9, 20, 1], [180, 18, 0.8, 26, 0], [30, -34, 0.7, 12, 0], [-190, 12, 0.7, 30, 1],
    [80, 34, 1.0, 22, 0], [-20, -6, 0.6, 16, 1], [-110, -40, 0.6, 18, 0], [150, -44, 0.5, 24, 1],
    [-250, -10, 1.1, 10, 1], [245, -4, 1.2, 28, 0], [-225, 40, 0.8, 32, 0], [225, 44, 0.7, 14, 1], [-265, 26, 0.6, 20, 0], [262, 22, 0.6, 34, 1],
  ].map(([x, y, s, t, ph], n) => group(`chispa-${n}`, [...shapes(SPARK), fill('#FFFFFF')], {
    p: [x, y], s: twinkle(t, s, ph), r: anim([[t, -90, 'out'], [t + 24, 0, 'hold'], [OP, 0]]),
  }));
  const dots = [[-100, 20, 6, 0], [60, -10, 5, 1], [150, -6, 4, 0], [-170, -22, 4, 1], [10, 40, 4, 0], [-40, -40, 3, 1], [200, -30, 3, 0], [-210, 30, 3, 1], [-240, -40, 4, 0], [250, -40, 4, 1], [270, 6, 3, 0], [-275, 0, 3, 1]].map(([x, y, r, ph], n) =>
    group(`punto-${n}`, [ellipse([x, y], r * 2), fill('#FFFFFF')], {
      o: anim([[0, 100, 'hold'], [INTRO, ph ? 40 : 100], [INTRO + 60, ph ? 100 : 40], [INTRO + 120, ph ? 40 : 100], [INTRO + 180, ph ? 100 : 40], [OP, ph ? 40 : 100]]),
    }));
  const portalLayer = shapeLayer('portal', [
    group('estrellas', [...inner, ...dots]),
    group('fondo', [ellipse([0, 0], PR[0] * 2 - 26, PR[1] * 2 - 14), fill('#2A2320')]),
    group('borde', [ellipse([0, 0], PR[0] * 2, PR[1] * 2), fill('#1E1A18')]),
  ], {
    op: OP, parent: sceneRoot.ind,
    ks: {
      p: PC, r: PROT,
      s: anim([[0, [0, 0], 'out'], [16, [112, 112]], [26, [96, 96]], [34, [100, 100]], [SALTO.inicio - 1, [100, 100]], [SALTO.inicio + 3, [108, 92]], [SALTO.inicio + 11, [100, 100]], [choque - 2, [100, 100]], [choque + 4, [105, 96]], [choque + 12, [100, 100], 'hold'], [OP, [100, 100]]]),
    },
  });
  // Ráfagas de chispas: al despegar y al volver a caer al portal.
  const burstGroups = (t0, list, tag) => list.map(([dx, dy, s], n) => group(`${tag}-${n}`, [...shapes(SPARK), fill('#FFFFFF')], {
    p: anim([[0, [0, 0], 'hold'], [t0, [0, 0], 'out'], [t0 + 32, [dx, dy], 'hold'], [OP, [dx, dy]]]),
    s: anim([[0, [0, 0], 'hold'], [t0, [0, 0], 'out'], [t0 + 8, [s * 140, s * 140]], [t0 + 28, [s * 80, s * 80], 'in'], [t0 + 40, [0, 0], 'hold'], [OP, [0, 0]]]),
    r: anim([[t0, 0, 'out'], [t0 + 40, 180, 'hold'], [OP, 180]]),
  }));
  const burst = shapeLayer('rafagas', [
    ...burstGroups(SALTO.inicio, [[-120, -260, 1.4], [-40, -330, 1.0], [60, -300, 1.2], [140, -240, 0.9], [-170, -170, 0.8], [190, -150, 1.1]], 'despegue'),
    ...burstGroups(choque, [[-230, -60, 1.1], [-150, -110, 0.9], [160, -100, 1.0], [240, -50, 1.2], [-60, -140, 0.7], [80, -150, 0.8]], 'caida'),
  ], { op: OP, parent: sceneRoot.ind, ks: { p: PC } });
  return {
    ...comp('mascot.ceti-portal', OP, [burst, cetiLayer, waves, portalLayer, sceneRoot]),
    assets: [asset],
    markers: [{ tm: 0, cm: 'entrada', dr: INTRO }, { tm: INTRO, cm: 'asomada', dr: LOOP }],
  };
}

mkdirSync(OUT, { recursive: true });
for (const [file, json] of [['ceti-reposo', reposo()], ['ceti-celebra', celebra()], ['ceti-espera', espera()], ['ceti-triste', triste()], ['ceti-portal', portal()]]) {
  writeFileSync(`${OUT}/${file}.json`, JSON.stringify(json, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));
  console.log(`${OUT}/${file}.json: ${(JSON.stringify(json).length / 1024).toFixed(0)} KB`);
}
