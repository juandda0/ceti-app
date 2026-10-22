// Genera assets/animations/lives/corazon.json: el corazón de vida que se pierde al fallar una pregunta.
// Es el espejo del fueguito de racha (mismo lienzo, ritmo y lenguaje): aparece, late dos veces, se vacía como un
// líquido mientras tiembla, se raja y estalla en pedazos; queda partido en dos, gris, y gotea.
// Uso: node scripts/lottie/corazon.mjs
import { anim, ellipse, fill, group, layerFactory, mask, shapes, stroke, val, writeLottie } from './lib.mjs';

const OUT = 'assets/animations/lives/corazon.json';
const FPS = 60;
const W = 512;
const OP = 210; // 3,5 s, igual que el fueguito
const C = [256, 262]; // centro del corazón en el lienzo
const T = { aparece: 0, late1: 22, late2: 44, vacia: 60, rompe: 84, reposo: 126 };

const RED = '#FF4B4B';
const RED_DARK = '#EA2B2B';
const PINK = '#FF8A8A';
const GRAY = '#D2D2D2';
const GRAY_DARK = '#BDBDBD';
const DROP = '#9FB6C9';

// Corazón centrado en (0, 0): lóbulos arriba, punta abajo. La grieta lo parte en dos por el medio.
const HEART = 'M0 -46 C-22 -96 -124 -100 -124 -16 C-124 44 -52 82 0 116 C52 82 124 44 124 -16 C124 -100 22 -96 0 -46 Z';
const CRACK = [[0, -46], [-14, -8], [12, 26], [-10, 62], [0, 116]];
const crackD = CRACK.map(([x, y], n) => `${n ? 'L' : 'M'}${x} ${y}`).join(' ');
const crackBack = [...CRACK].reverse().map(([x, y]) => `L${x} ${y}`).join(' ');
const HALF_L = `M0 -46 C-22 -96 -124 -100 -124 -16 C-124 44 -52 82 0 116 ${crackBack.replace(/^L0 116 /, '')} Z`;
const HALF_R = `M0 116 C52 82 124 44 124 -16 C124 -100 22 -96 0 -46 ${CRACK.slice(1).map(([x, y]) => `L${x} ${y}`).join(' ')} Z`;
const SHINE = { c: [-70, -40], w: 26, h: 46, r: -32 };

// Pseudoaleatorio determinista: el JSON sale igual en cada corrida.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const visibleUntil = (t) => anim([[0, 100, 'hold'], [t, 0, 'hold'], [OP, 0]]);
const visibleFrom = (t) => anim([[0, 0, 'hold'], [t, 100, 'hold'], [OP, 100]]);

const { shapeLayer, nullLayer } = layerFactory();

// ---------- Corazón entero: aparece, late, se vacía temblando ----------
const shake = [];
for (let t = T.vacia, n = 0; t < T.rompe; t += 2, n++) {
  const amp = 1 + (4 * (t - T.vacia)) / (T.rompe - T.vacia);
  shake.push([t, n % 2 ? -amp : amp, 'inOut']);
}
const beat = (t, big, small) => [[t, [100, 100], 'out'], [t + 5, [big, big], 'inOut'], [t + 10, [100, 100], 'out'], [t + 14, [small, small], 'inOut'], [t + 20, [100, 100], 'inOut']];
const heartNull = nullLayer('corazon', {
  p: C,
  s: anim([
    [0, [0, 0], 'out'], [10, [118, 118], 'inOut'], [15, [95, 95], 'inOut'], [19, [100, 100], 'hold'],
    ...beat(T.late1, 114, 107), ...beat(T.late2, 116, 108),
    [T.vacia, [100, 100], 'in'], [T.rompe - 1, [93, 93], 'out'], [T.rompe, [100, 100], 'hold'], [OP, [100, 100]],
  ]),
  r: anim([[0, 0, 'hold'], ...shake, [T.rompe, 0, 'hold'], [OP, 0]]),
}, OP);

// Superficie ondulada del líquido: arriba del corazón (lleno) hasta debajo de la punta (vacío), acelerando.
const surface = (level, wobble) => ({
  c: true,
  v: [[150, 200], [-150, 200], [-150, level + wobble[0]], [-50, level + wobble[1]], [50, level + wobble[2]], [150, level + wobble[3]]],
  i: [[0, 0], [0, 0], [-33, 0], [-33, 0], [-33, 0], [-33, 0]],
  o: [[0, 0], [0, 0], [33, 0], [33, 0], [33, 0], [33, 0]],
});
const FULL = -130;
const EMPTY = 128;
const drainKeys = [{ t: 0, s: [surface(FULL, [0, 0, 0, 0])], h: 1 }];
for (let t = T.vacia; t < T.rompe; t += 3) {
  const p = (t - T.vacia) / (T.rompe - T.vacia);
  const level = FULL + (EMPTY - FULL) * p * p;
  const w = () => (rnd() - 0.5) * 22 * (1 - p * 0.5);
  drainKeys.push({ t, s: [surface(level, [w(), w(), w(), w()])], o: { x: 0, y: 0 }, i: { x: 1, y: 1 } });
}
drainKeys.push({ t: T.rompe, s: [surface(EMPTY + 80, [0, 0, 0, 0])], h: 1 }, { t: OP, s: [surface(EMPTY + 80, [0, 0, 0, 0])] });

const shine = group('brillo', [ellipse([0, 0], SHINE.w, SHINE.h), { ...fill('#FFFFFF'), o: val(55) }], { p: SHINE.c, r: SHINE.r });
const heartRed = shapeLayer('corazon-rojo', [
  shine,
  group('sombra', [...shapes('M-124 -16 C-124 44 -52 82 0 116 C52 82 124 44 124 -16 C110 30 50 66 0 94 C-50 66 -110 30 -124 -16 Z'), fill(RED_DARK)]),
  group('corazon', [...shapes(HEART), fill(RED)]),
], { op: OP, parent: heartNull.ind, ks: { o: visibleUntil(T.rompe) }, masks: [mask('liquido', { a: 1, k: drainKeys })] });
const heartGray = shapeLayer('corazon-gris', [
  group('brillo', [ellipse([0, 0], SHINE.w, SHINE.h), { ...fill('#FFFFFF'), o: val(70) }], { p: SHINE.c, r: SHINE.r }),
  group('corazon', [...shapes(HEART), fill(GRAY)]),
], { op: OP, parent: heartNull.ind, ks: { o: visibleUntil(T.rompe) } });

// La grieta se dibuja en los últimos fotogramas del temblor.
const crack = shapeLayer('grieta', [
  group('grieta', [
    ...shapes(crackD),
    stroke(9, '#FFFFFF'),
    { ty: 'tm', s: val(0), e: anim([[0, 0, 'hold'], [T.rompe - 10, 0, 'in'], [T.rompe, 100, 'hold'], [OP, 100]]), o: val(0), m: 1 },
  ]),
], { op: OP, parent: heartNull.ind, ks: { o: visibleUntil(T.rompe) } });

// ---------- Corazón roto: dos mitades grises que se separan y se mecen tristes ----------
const sway = (dir, base) => {
  const k = [];
  for (let t = T.reposo, n = 0; t <= OP; t += 21, n++) k.push([t, base + dir * (n % 2 ? -2 : 2), 'inOut']);
  return k;
};
const half = (nm, d, dir) => shapeLayer(nm, [
  ...(dir < 0 ? [group('brillo', [ellipse([0, 0], SHINE.w, SHINE.h), { ...fill('#FFFFFF'), o: val(70) }], { p: SHINE.c, r: SHINE.r })] : []),
  group('mitad', [...shapes(d), fill(GRAY)]),
], {
  op: OP,
  ks: {
    a: [0, 116], // gira desde la punta, como si se desplomara
    p: anim([[0, [C[0], C[1] + 116], 'hold'], [T.rompe, [C[0], C[1] + 116], 'out'], [T.rompe + 14, [C[0] + dir * 26, C[1] + 122], 'inOut'], [T.rompe + 28, [C[0] + dir * 18, C[1] + 120], 'hold'], [OP, [C[0] + dir * 18, C[1] + 120]]]),
    r: anim([[0, 0, 'hold'], [T.rompe, 0, 'out'], [T.rompe + 14, dir * 13, 'inOut'], [T.rompe + 28, dir * 8, 'inOut'], ...sway(dir, 8)]),
    o: visibleFrom(T.rompe),
  },
});
const halfL = half('mitad-izq', HALF_L, -1);
const halfR = half('mitad-der', HALF_R, 1);

// ---------- Estallido: destello, aro y pedazos ----------
const flash = shapeLayer('destello', [group('flash', [ellipse([0, 0], 300), fill('#FFFFFF')])], {
  op: OP,
  ks: {
    p: C,
    o: anim([[0, 0, 'hold'], [T.rompe, 85, 'out'], [T.rompe + 10, 0, 'hold'], [OP, 0]]),
    s: anim([[0, [0, 0], 'hold'], [T.rompe, [30, 30], 'out'], [T.rompe + 10, [140, 140], 'hold'], [OP, [140, 140]]]),
  },
});
const ring = (nm, t, color, w, to) => shapeLayer(nm, [group('aro', [ellipse([0, 0], 220), { ...stroke(w, color), w: anim([[t, w, 'out'], [t + 26, 2, 'hold'], [OP, 2]]) }])], {
  op: OP,
  ks: {
    p: C,
    o: anim([[0, 0, 'hold'], [t, 100, 'out'], [t + 26, 0, 'hold'], [OP, 0]]),
    s: anim([[0, [0, 0], 'hold'], [t, [40, 40], 'out'], [t + 26, [to, to], 'hold'], [OP, [to, to]]]),
  },
});
const SHARD = 'M0 -14 L13 9 L-12 11 Z';
const pieces = Array.from({ length: 14 }, (_, n) => {
  const ang = (n / 14) * Math.PI * 2 + rnd() * 0.3;
  const dist = 120 + rnd() * 60;
  const t0 = T.rompe + (n % 3);
  const from = [C[0] + Math.cos(ang) * 40, C[1] + Math.sin(ang) * 40];
  const out = [C[0] + Math.cos(ang) * dist, C[1] + Math.sin(ang) * dist];
  const fall = [out[0] + Math.cos(ang) * 8, out[1] + 46]; // la gravedad los tira hacia abajo
  const isShard = n % 2 === 0;
  const color = isShard ? (n % 4 === 0 ? RED : GRAY_DARK) : n % 4 === 1 ? PINK : RED;
  const size = isShard ? 100 + rnd() * 40 : 100;
  return shapeLayer(`pedazo-${n + 1}`, [
    group(isShard ? 'pedazo' : 'chispa', [...(isShard ? shapes(SHARD) : [ellipse([0, 0], n % 3 ? 14 : 20)]), fill(color)]),
  ], {
    op: OP,
    ks: {
      p: anim([[0, from, 'hold'], [t0, from, 'out'], [t0 + 20, out, 'inOut'], [t0 + 36, fall, 'hold'], [OP, fall]]),
      r: anim([[0, 0, 'hold'], [t0, rnd() * 360, 'out'], [t0 + 36, rnd() * 360 + 180, 'hold'], [OP, 0]]),
      s: anim([[0, [0, 0], 'hold'], [t0, [0, 0], 'out'], [t0 + 5, [size * 1.1, size * 1.1], 'inOut'], [t0 + 20, [size * 0.95, size * 0.95], 'in'], [t0 + 36, [0, 0], 'hold'], [OP, [0, 0]]]),
    },
  });
});

// ---------- Reposo: gotas grises caen de la grieta (el espejo de las brasas que suben) ----------
const DROP_D = 'M0 -12 C4 -6 8 -1 8 4 C8 9 4 12 0 12 C-4 12 -8 9 -8 4 C-8 -1 -4 -6 0 -12 Z';
const drops = [[-6, 0], [8, 18], [-2, 34]].map(([dx, delay], n) => {
  const x = C[0] + dx;
  const top = C[1] + 96;
  const bottom = C[1] + 196;
  const keys = [];
  const scales = [];
  for (let t = T.reposo + delay; t + 40 <= OP + 40; t += 42) {
    keys.push([t, [x, top], 'in'], [t + 40, [x, bottom], 'hold']);
    scales.push([t, [0, 0], 'out'], [t + 10, [100, 100], 'hold'], [t + 32, [100, 100], 'in'], [t + 40, [0, 0], 'hold']);
  }
  return shapeLayer(`gota-${n + 1}`, [group('gota', [...shapes(DROP_D), fill(DROP)])], {
    op: OP,
    ks: {
      p: anim([[0, [x, top], 'hold'], ...keys.filter(([t]) => t < OP), [OP, [x, top]]]),
      s: anim([[0, [0, 0], 'hold'], ...scales.filter(([t]) => t < OP), [OP, [0, 0]]]),
    },
  });
});

// Halo rojo detrás del corazón: se enciende con cada latido y se apaga al vaciarse.
const glow = shapeLayer('halo', [group('halo', [ellipse([0, 0], 300), fill(RED)])], {
  op: OP,
  ks: {
    p: C,
    o: anim([
      [0, 0, 'hold'], [T.late1, 0, 'out'], [T.late1 + 5, 22, 'inOut'], [T.late1 + 20, 6, 'inOut'],
      [T.late2, 6, 'out'], [T.late2 + 5, 26, 'inOut'], [T.late2 + 20, 8, 'inOut'], [T.rompe - 4, 0, 'hold'], [OP, 0],
    ]),
    s: anim([[0, [80, 80], 'hold'], [T.late1, [80, 80], 'out'], [T.late1 + 5, [100, 100], 'inOut'], [T.late2, [86, 86], 'out'], [T.late2 + 5, [104, 104], 'inOut'], [T.rompe, [70, 70], 'hold'], [OP, [70, 70]]]),
  },
});

const layers = [
  flash,
  ...pieces,
  crack,
  heartRed,
  heartGray,
  halfR,
  halfL,
  ...drops,
  ring('aro-1', T.rompe, GRAY_DARK, 22, 190),
  ring('aro-2', T.rompe + 5, PINK, 14, 230),
  glow,
  heartNull,
];

writeLottie(OUT, { v: '5.7.4', fr: FPS, ip: 0, op: OP, w: W, h: W, nm: 'lives-corazon', ddd: 0, assets: [], layers, markers: [] });
