// Utilidades compartidas para generar Lottie de los personajes a partir de sus SVG calcados.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1);

// ---------- Lectura de SVG ----------
export function svgReader(file) {
  const SVG = readFileSync(file, 'utf8');
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
  const groupTag = (id) => (SVG.match(new RegExp(`<g id="${id}"[^>]*>`)) || [])[0];
  const tagById = (id) => (SVG.match(new RegExp(`<[a-z]+ id="${id}"[^>]*>`)) || [])[0];
  // quita los subgrupos con id (p. ej. los ojos dentro de la cabeza) para tratarlos aparte
  const stripSubgroups = (html) => {
    let out = html;
    for (const m of html.matchAll(/<g id="([^"]+)"/g)) out = out.replace(`<g id="${m[1]}"` + groupInnerWithTag(out, m[1]), '');
    return out;
  };
  function groupInnerWithTag(html, id) {
    const start = html.indexOf(`<g id="${id}"`);
    let depth = 0;
    const re = /<g\b|<\/g>/g;
    re.lastIndex = start;
    let m;
    while ((m = re.exec(html))) {
      depth += m[0] === '</g>' ? -1 : 1;
      if (depth === 0) return html.slice(start + `<g id="${id}"`.length, m.index + 4);
    }
    return '';
  }
  const viewBox = attr(SVG.match(/<svg[^>]*>/)[0], 'viewBox').split(/\s+/).map(Number);
  return { SVG, attr, num, groupInner, groupTag, tagById, stripSubgroups, viewBox };
}

// ---------- SVG path -> forma Lottie ----------
export function parsePath(d) {
  const tok = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
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

// ---------- Constructores Lottie ----------
export const EASE = {
  inOut: [[0.45, 0], [0.55, 1]],
  out: [[0.22, 1], [0.36, 1]],
  in: [[0.55, 0], [0.9, 0.4]],
  snap: [[0.2, 0], [0.1, 1]],
};
export const val = (k) => ({ a: 0, k });
// keys: [[frame, value, ease?], ...] — ease aplica al tramo que empieza en ese frame; 'hold' = sin interpolar.
export function anim(keys) {
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
export const shift = (keys, dt) => keys.map(([t, ...rest]) => [t + dt, ...rest]);
const prop = (v) => (v && v.a !== undefined ? v : val(v));
export const tr = ({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) => ({
  ty: 'tr', p: prop(p), a: prop(a), s: prop(s), r: prop(r), o: prop(o), sk: val(0), sa: val(0),
});
export const shapes = (d) => parsePath(d).map((ks) => ({ ty: 'sh', ks: val(ks) }));
export const ellipse = (c, w, h = w) => ({ ty: 'el', p: val(c), s: val([w, h]), d: 1 });
export const fill = (c, evenOdd = false) => ({ ty: 'fl', c: val(typeof c === 'string' ? hex(c) : c), o: val(100), r: evenOdd ? 2 : 1 });
export const stroke = (w, c) => ({ ty: 'st', c: val(typeof c === 'string' ? hex(c) : c), o: val(100), w: val(w), lc: 2, lj: 2, ml: 4 });
export const group = (nm, items, t) => ({ ty: 'gr', nm, it: [...items, tr(t)] });
export const layerKs = ({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) => ({
  o: prop(o), r: prop(r), p: prop(p), a: prop(a), s: prop(s),
});
export const mask = (nm, pt) => ({ inv: false, mode: 'a', nm, pt, o: val(100), x: val(0) });
export const SPARK = 'M0 -10 C1.2 -3 3 -1.2 10 0 C3 1.2 1.2 3 0 10 C-1.2 3 -3 1.2 -10 0 C-3 -1.2 -1.2 -3 0 -10 Z';

// Contador de índices de capa por composición.
export function layerFactory() {
  let ind = 0;
  const shapeLayer = (nm, shapesArr, extra = {}) => ({
    ddd: 0, ind: ++ind, ty: 4, nm, sr: 1, ks: layerKs(extra.ks), ao: 0, shapes: shapesArr,
    ip: 0, op: extra.op, st: 0, bm: 0,
    ...(extra.parent ? { parent: extra.parent } : {}),
    ...(extra.masks ? { hasMask: true, masksProperties: extra.masks } : {}),
  });
  const nullLayer = (nm, ks, op, parent) => ({ ddd: 0, ind: ++ind, ty: 3, nm, sr: 1, ks: layerKs(ks), ao: 0, ip: 0, op, st: 0, bm: 0, ...(parent ? { parent } : {}) });
  return { shapeLayer, nullLayer };
}

// Elementos de un fragmento SVG (path, circle, ellipse) -> grupos Lottie. Lottie pinta el primero arriba: se invierte.
export function svgToGroups(reader, html, prefix) {
  const { attr, num } = reader;
  const tags = [...html.replace(/<clipPath[\s\S]*?<\/clipPath>/g, '').matchAll(/<(path|circle|ellipse)\b[^>]*>/g)];
  return tags.map((m, n) => {
    const t = m[0];
    const f = attr(t, 'fill');
    const st = attr(t, 'stroke');
    const paint = [];
    // Lottie pinta en orden inverso dentro del grupo: el trazo va primero para quedar encima del relleno
    if (st && st !== 'none') paint.push(stroke(num(t, 'stroke-width'), st));
    if (f && f !== 'none') paint.push(fill(f, attr(t, 'fill-rule') === 'evenodd'));
    if (m[1] === 'path') return group(`${prefix}-${n}`, [...shapes(attr(t, 'd')), ...paint]);
    const c = [num(t, 'cx'), num(t, 'cy')];
    const [rx, ry] = m[1] === 'circle' ? [num(t, 'r'), num(t, 'r')] : [num(t, 'rx'), num(t, 'ry')];
    const rot = (attr(t, 'transform') || '').match(/rotate\(([-\d.]+)/);
    return group(`${prefix}-${n}`, [ellipse([0, 0], rx * 2, ry * 2), ...paint], { p: c, r: rot ? parseFloat(rot[1]) : 0 });
  }).reverse();
}

// Estrellas doradas que salen de un punto. bursts: [{ t, to: [dx, dy], s }]
export function starGroups(origin, bursts, { life = 34, color = '#F7C95F' } = {}) {
  return bursts.map((b, n) => {
    const end = [origin[0] + b.to[0], origin[1] + b.to[1]];
    const size = b.s ?? 100;
    return group(`estrella-${n}`, [...shapes(SPARK), fill(color)], {
      p: anim([[b.t, origin, 'out'], [b.t + life, end]]),
      s: anim([[0, [0, 0], 'hold'], [b.t, [0, 0], 'out'], [b.t + 10, [size * 1.2, size * 1.2]], [b.t + life * 0.6, [size, size], 'in'], [b.t + life, [0, 0]]]),
      r: anim([[b.t, -60, 'out'], [b.t + life, 45]]),
    });
  });
}

export function writeLottie(file, json) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(json, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));
  console.log(`${file}: ${(JSON.stringify(json).length / 1024).toFixed(0)} KB`);
}
