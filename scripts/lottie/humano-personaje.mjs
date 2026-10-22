// Genera los Lottie de los personajes humanos (Tato, Juan, Sofi, ...) leyendo su ilustración validada
// assets/brand/<personaje>/<personaje>-frente.svg (partes: cuerpo, cabeza con ojos, brazo-izq, brazo-der).
// Uso: node scripts/lottie/humano-personaje.mjs <personaje>
import {
  svgReader, svgToGroups, layerFactory, anim, group, shapes, ellipse, fill, stroke, mask, starGroups, writeLottie, hex,
} from './lib.mjs';

const PERSONAJES = {
  // bocaAbierta: superponer una boca abierta al celebrar (si el dibujo ya sonríe con dientes, no hace falta)
  tato: { bocaAbierta: true },
  juan: { bocaAbierta: false },
  sofi: { bocaAbierta: true },
  santiago: { bocaAbierta: true },
};
const NOMBRE = process.argv[2] || 'tato';
const CFG = PERSONAJES[NOMBRE];
if (!CFG) throw new Error(`personaje desconocido: ${NOMBRE}`);
const R = svgReader(`assets/brand/${NOMBRE}/${NOMBRE}-frente.svg`);
const OUT = `assets/brand/${NOMBRE}/lottie`;
const FPS = 60;
const [, , VW, VH] = R.viewBox;
const TOP = 150; // aire arriba para el salto y las estrellas
const W = VW;
const H = VH + TOP;
const C = { maroon: hex('#742F36'), mouth: hex('#6B2A2E'), tongue: hex('#E9877A') };

const pivot = (id) => R.attr(R.groupTag(id), 'data-pivote').split(' ').map(Number);
const PIV = { cabeza: pivot('cabeza'), izq: pivot('brazo-izq'), der: pivot('brazo-der') };
const shadowTag = R.tagById('sombra-piso');
const SHADOW = { c: [R.num(shadowTag, 'cx'), R.num(shadowTag, 'cy')], rx: R.num(shadowTag, 'rx'), ry: R.num(shadowTag, 'ry'), fill: R.attr(shadowTag, 'fill') };
const FEET = [SHADOW.c[0], SHADOW.c[1] - 6]; // el aplastar/estirar nace de los pies
const eyes = ['izq', 'der'].map((s) => {
  const tag = R.groupTag(`ojo-${s}`);
  const html = R.groupInner(`ojo-${s}`);
  // ojo con forma propia (p. ej. Juan): el grupo declara su centro y radio; si no, manda el primer círculo (aro)
  if (R.attr(tag, 'data-centro')) {
    return { s, c: R.attr(tag, 'data-centro').split(' ').map(Number), r: R.num(tag, 'data-radio'), html };
  }
  const ring = [...html.matchAll(/<circle\b[^>]*>/g)].map((m) => m[0])[0];
  return { s, c: [R.num(ring, 'cx'), R.num(ring, 'cy')], r: R.num(ring, 'r'), html };
});
// Sonrisa del calco: entre los ojos y la barbilla, en la línea media de la cara.
const MOUTH = { c: [(eyes[0].c[0] + eyes[1].c[0]) / 2, eyes[0].c[1] + 40], w: (eyes[1].c[0] - eyes[0].c[0]) * 0.86 };

function humanRig({ op, L, root, control, armL = 0, armR = 0, head = 0, blink = [100, 100], happy, shadowScale = [100, 100] }) {
  const parent = control.ind;
  const normal = happy ? anim(happy.map(([t, on]) => [t, on ? 0 : 100, 'hold'])) : 100;
  const joy = happy ? anim(happy.map(([t, on]) => [t, on ? 100 : 0, 'hold'])) : 0;

  const headNull = L.nullLayer('cabeza-control', { a: PIV.cabeza, p: PIV.cabeza, r: head }, op, parent);
  const eyeLayers = eyes.flatMap((e) => {
    const n = L.nullLayer(`ojo-${e.s}`, { a: e.c, p: e.c, s: blink }, op, headNull.ind);
    return [L.shapeLayer(`ojo-${e.s}-forma`, svgToGroups(R, e.html, 'ojo'), { op, parent: n.ind, ks: { o: normal } }), n];
  });
  const happyEyes = eyes.map((e) => `M${e.c[0] - e.r * 0.85} ${e.c[1] + 4} Q${e.c[0]} ${e.c[1] - e.r * 1.15} ${e.c[0] + e.r * 0.85} ${e.c[1] + 4}`);
  const [mx, my] = MOUTH.c;
  const hw = MOUTH.w / 2;
  const openMouth = `M${mx - hw} ${my - 6} Q${mx} ${my + 2} ${mx + hw} ${my - 6} C${mx + hw - 2} ${my + 14} ${mx + hw * 0.45} ${my + 26} ${mx} ${my + 26} C${mx - hw * 0.45} ${my + 26} ${mx - hw + 2} ${my + 14} ${mx - hw} ${my - 6} Z`;
  const headLayers = [
    L.shapeLayer('ojos-felices', [group('ojos-felices', [...happyEyes.flatMap(shapes), stroke(6, C.maroon)])], { op, parent: headNull.ind, ks: { o: joy } }),
    ...eyeLayers,
    ...(CFG.bocaAbierta ? [L.shapeLayer('boca-abierta', [
      group('lengua', [ellipse([mx + 3, my + 22], hw * 1.1, 16), fill(C.tongue)]),
      group('boca', [...shapes(openMouth), fill(C.mouth)]),
    ], { op, parent: headNull.ind, ks: { o: joy }, masks: [mask('boca', { a: 0, k: shapes(openMouth)[0].ks.k })] })] : []),
    L.shapeLayer('cabeza', svgToGroups(R, R.stripSubgroups(R.groupInner('cabeza')), 'cabeza'), { op, parent: headNull.ind }),
    headNull,
  ];
  const layers = [
    L.shapeLayer('brazo-der', svgToGroups(R, R.groupInner('brazo-der'), 'brazo-der'), { op, parent, ks: { a: PIV.der, p: PIV.der, r: armR } }),
    L.shapeLayer('brazo-izq', svgToGroups(R, R.groupInner('brazo-izq'), 'brazo-izq'), { op, parent, ks: { a: PIV.izq, p: PIV.izq, r: armL } }),
    ...headLayers,
    L.shapeLayer('cuerpo', svgToGroups(R, R.groupInner('cuerpo'), 'cuerpo'), { op, parent }),
  ];
  const shadow = L.shapeLayer('sombra-piso', [group('sombra', [ellipse(SHADOW.c, SHADOW.rx * 2, SHADOW.ry * 2), fill(SHADOW.fill)])], {
    op, parent: root.ind, ks: { a: SHADOW.c, p: SHADOW.c, s: shadowScale },
  });
  return { layers, shadow };
}

const comp = (nm, op, layers) => ({ v: '5.7.4', fr: FPS, ip: 0, op, w: W, h: H, nm, ddd: 0, assets: [], layers, markers: [] });

// ---------- Tipo B · espera: quieto en la pose inicial, solo parpadea ----------
function espera() {
  const L = layerFactory();
  const OP = 240;
  const root = L.nullLayer('escena', { p: [0, TOP] }, OP);
  const control = L.nullLayer('control', { a: FEET, p: FEET }, OP, root.ind);
  const { layers, shadow } = humanRig({
    op: OP, L, root, control,
    blink: anim([[0, [100, 100], 'hold'], [180, [100, 100], 'snap'], [185, [100, 8], 'out'], [192, [100, 100], 'hold'], [240, [100, 100]]]),
  });
  return comp(`mascot.${NOMBRE}-espera`, OP, [...layers, shadow, control, root]);
}

// ---------- Tipo B · celebración: puño arriba y salto; empieza y termina en la pose ----------
function celebra() {
  const L = layerFactory();
  const OP = 90; // 1,5 s
  const root = L.nullLayer('escena', { p: [0, TOP] }, OP);
  const top = [FEET[0], FEET[1] - 90];
  const control = L.nullLayer('control', {
    a: FEET,
    p: anim([[0, FEET, 'hold'], [10, FEET, 'out'], [30, top], [44, [top[0], top[1] + 6], 'in'], [60, FEET, 'hold'], [90, FEET]]),
    s: anim([[0, [100, 100]], [10, [106, 93], 'out'], [20, [96, 106]], [32, [100, 100]], [54, [98, 103], 'in'], [61, [107, 93], 'out'], [70, [98, 102]], [80, [100, 100], 'hold'], [90, [100, 100]]]),
    r: anim([[0, 0, 'hold'], [10, 0, 'out'], [30, -3], [46, 2], [62, 0, 'hold'], [90, 0]]),
  }, OP, root.ind);
  const { layers, shadow } = humanRig({
    op: OP, L, root, control,
    // brazo libre: puño al aire con rebote; el brazo de la bolsa casi no se mueve
    armL: anim([[0, 0], [8, -10, 'out'], [22, 160], [30, 146], [40, 156], [58, 150, 'in'], [72, -6, 'out'], [82, 0, 'hold'], [90, 0]]),
    armR: anim([[0, 0], [10, 2], [26, -3], [44, 2], [62, -2], [76, 0, 'hold'], [90, 0]]),
    head: anim([[0, 0], [10, 3, 'out'], [26, -7], [44, -4], [60, 4, 'out'], [74, -1], [84, 0, 'hold'], [90, 0]]),
    happy: [[0, false], [12, true], [68, false], [90, false]],
    shadowScale: anim([[0, [100, 100]], [10, [106, 106], 'out'], [30, [62, 62]], [44, [60, 60], 'in'], [60, [100, 100]], [62, [108, 108], 'out'], [74, [100, 100], 'hold'], [90, [100, 100]]]),
  });
  // estrellas alrededor de la cabeza en la cima del salto
  const head = [PIV.cabeza[0], PIV.cabeza[1] - 110];
  const stars = L.shapeLayer('estrellas', starGroups(head, [
    { t: 20, to: [-120, -70], s: 150 }, { t: 22, to: [110, -90], s: 170 }, { t: 25, to: [-40, -130], s: 120 },
    { t: 27, to: [150, -20], s: 130 }, { t: 29, to: [-150, -10], s: 130 }, { t: 31, to: [40, -140], s: 110 },
  ], { life: 36 }), { op: OP, parent: control.ind });
  return comp(`mascot.${NOMBRE}-celebra`, OP, [stars, ...layers, shadow, control, root]);
}

// ---------- Reposo en loop: respira, se mece y parpadea (para pantallas donde está de fondo) ----------
function reposo() {
  const L = layerFactory();
  const OP = 240; // 4 s
  const root = L.nullLayer('escena', { p: [0, TOP] }, OP);
  const control = L.nullLayer('control', {
    a: FEET, p: FEET,
    s: anim([[0, [100, 100]], [120, [100.6, 101.4]], [240, [100, 100]]]),
    r: anim([[0, -0.8], [120, 0.8], [240, -0.8]]),
  }, OP, root.ind);
  const { layers, shadow } = humanRig({
    op: OP, L, root, control,
    armL: anim([[0, 2], [120, -2], [240, 2]]),
    armR: anim([[0, -1], [120, 1], [240, -1]]),
    head: anim([[0, -1.5], [60, -1.5], [130, 2], [200, 2], [240, -1.5]]),
    blink: anim([[0, [100, 100], 'hold'], [90, [100, 100], 'snap'], [95, [100, 8], 'out'], [102, [100, 100], 'hold'], [200, [100, 100], 'snap'], [205, [100, 8], 'out'], [212, [100, 100], 'hold'], [240, [100, 100]]]),
  });
  return comp(`mascot.${NOMBRE}-reposo`, OP, [...layers, shadow, control, root]);
}

// ---------- Saludo: levanta la mano libre y saluda tres veces ----------
function saludo() {
  const L = layerFactory();
  const OP = 120; // 2 s
  const root = L.nullLayer('escena', { p: [0, TOP] }, OP);
  const control = L.nullLayer('control', {
    a: FEET, p: FEET,
    s: anim([[0, [100, 100]], [10, [102, 98], 'out'], [22, [99, 101.5]], [34, [100, 100], 'hold'], [96, [100, 100]], [108, [101, 99]], [120, [100, 100]]]),
    r: anim([[0, 0], [16, -2], [96, -2], [120, 0]]),
  }, OP, root.ind);
  const { layers, shadow } = humanRig({
    op: OP, L, root, control,
    armL: anim([[0, 0], [6, -8, 'out'], [20, 156], [30, 142], [40, 164], [50, 142], [60, 164], [70, 142], [80, 158], [96, 150, 'in'], [112, -4, 'out'], [120, 0]]),
    armR: anim([[0, 0], [30, -2], [60, 1], [90, -1], [120, 0]]),
    head: anim([[0, 0], [16, 6], [96, 6], [114, 0]]),
    blink: anim([[0, [100, 100], 'hold'], [64, [100, 100], 'snap'], [68, [100, 8], 'out'], [74, [100, 100], 'hold'], [120, [100, 100]]]),
  });
  return comp(`mascot.${NOMBRE}-saludo`, OP, [...layers, shadow, control, root]);
}

writeLottie(`${OUT}/${NOMBRE}-reposo.json`, reposo());
writeLottie(`${OUT}/${NOMBRE}-saludo.json`, saludo());
writeLottie(`${OUT}/${NOMBRE}-espera.json`, espera());
writeLottie(`${OUT}/${NOMBRE}-celebra.json`, celebra());
