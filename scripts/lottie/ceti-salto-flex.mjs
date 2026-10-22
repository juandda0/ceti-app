// Salto de Ceti con un solo dibujo de perfil que se curva a lo largo de la columna (en vez de cambiar de pose):
// misma topología en todos los fotogramas clave -> Lottie interpola los vértices y el movimiento sale fluido.
// Dibujo: assets/brand/ceti/salto/ceti-perfil.json (scripts/marca/ceti_perfil.py, pose 1 de ceti-06-salto-poses-limpia).
// Coordenadas del perfil: cabeza arriba, panza a la derecha (+x), espalda a la izquierda.
import { readFileSync } from 'node:fs';

const PERFIL = JSON.parse(readFileSync('assets/brand/ceti/salto/ceti-perfil.json', 'utf8'));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1);
const r1 = (x) => Math.round(x * 10) / 10;

// ---------- Simplificación (RDP) ----------
function rdp(pts, tol) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  let best = -1, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / L;
    if (d > best) { best = d; idx = i; }
  }
  if (best <= tol) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), tol).slice(0, -1), ...rdp(pts.slice(idx), tol)];
}
// Cerrada: se parte en el punto más lejano al primero para que RDP no pierda el arranque.
function rdpCerrada(pts, tol) {
  let far = 0, dmax = 0;
  pts.forEach((p, i) => { const d = Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]); if (d > dmax) { dmax = d; far = i; } });
  const a = rdp(pts.slice(0, far + 1), tol);
  const b = rdp([...pts.slice(far), pts[0]], tol);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

// ---------- Columna del dibujo en reposo ----------
const sil = PERFIL.silueta;
const [ANCHO, ALTO] = PERFIL.tam;
const ys = sil.map((p) => p[1]);
const Y0 = Math.min(...ys), Y1 = Math.max(...ys);
const N = Math.ceil(Y1 - Y0) + 1;
// Centro de cada fila (entre el borde izquierdo y el derecho), suavizado: es la línea media del cuerpo.
const centro = new Array(N).fill(null).map(() => [Infinity, -Infinity]);
for (let i = 0; i < sil.length; i++) {
  const [p, q] = [sil[i], sil[(i + 1) % sil.length]];
  const steps = Math.max(1, Math.ceil(Math.abs(q[1] - p[1]) * 2));
  for (let k = 0; k <= steps; k++) {
    const x = p[0] + ((q[0] - p[0]) * k) / steps, y = p[1] + ((q[1] - p[1]) * k) / steps;
    const r = Math.round(y - Y0);
    centro[r][0] = Math.min(centro[r][0], x); centro[r][1] = Math.max(centro[r][1], x);
  }
}
let cx = centro.map(([a, b]) => (a + b) / 2);
const suaviza = (arr, rad) => arr.map((_, i) => {
  let s = 0, w = 0;
  for (let k = -rad; k <= rad; k++) { const j = Math.min(arr.length - 1, Math.max(0, i + k)); const wk = Math.exp(-(k * k) / (2 * (rad / 2) ** 2)); s += arr[j] * wk; w += wk; }
  return s / w;
});
cx = suaviza(suaviza(cx, 60), 60);
// Ángulo de la columna en reposo (0 = vertical hacia abajo; + = la cola se va hacia la espalda, -x) y longitud de arco.
const phi0 = cx.map((_, i) => { const j0 = Math.max(0, i - 1), j1 = Math.min(N - 1, i + 1); return -Math.atan2(cx[j1] - cx[j0], j1 - j0); });
const ds = phi0.map((p) => 1 / Math.cos(p));

// Centroide de la silueta (ancla de la capa).
const CENTROIDE = (() => {
  let A = 0, X = 0, Y = 0;
  for (let i = 0; i < sil.length; i++) {
    const [x0, y0] = sil[i], [x1, y1] = sil[(i + 1) % sil.length];
    const c = x0 * y1 - x1 * y0; A += c; X += (x0 + x1) * c; Y += (y0 + y1) * c;
  }
  return { area: Math.abs(A / 2), c: [X / (3 * A), Y / (3 * A)] };
})();
const S0 = Math.round(CENTROIDE.c[1] - Y0);

// Curvar: dphi(s) = curvatura extra acumulada (rad) en cada fila; la columna se reconstruye desde S0, que no se
// mueve ni gira (el giro global lo pone la capa). Devuelve una función punto -> punto curvado.
function deformador(kappa) {
  const phi = new Float64Array(N);
  const extra = new Float64Array(N);
  for (let i = S0 + 1; i < N; i++) extra[i] = extra[i - 1] + kappa(i / (N - 1)) ;
  for (let i = S0 - 1; i >= 0; i--) extra[i] = extra[i + 1] - kappa(i / (N - 1));
  for (let i = 0; i < N; i++) phi[i] = phi0[i] + extra[i];
  const P = new Array(N);
  P[S0] = [cx[S0], S0 + Y0];
  const dir = (f) => [-Math.sin(f), Math.cos(f)];
  for (let i = S0 + 1; i < N; i++) { const d = dir((phi[i] + phi[i - 1]) / 2); const l = (ds[i] + ds[i - 1]) / 2; P[i] = [P[i - 1][0] + d[0] * l, P[i - 1][1] + d[1] * l]; }
  for (let i = S0 - 1; i >= 0; i--) { const d = dir((phi[i] + phi[i + 1]) / 2); const l = (ds[i] + ds[i + 1]) / 2; P[i] = [P[i + 1][0] - d[0] * l, P[i + 1][1] - d[1] * l]; }
  const at = (y) => {
    const t = Math.min(N - 1, Math.max(0, y - Y0)); const i = Math.min(N - 2, Math.floor(t)); const f = t - i;
    return { P: [P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f], phi: phi[i] + (phi[i + 1] - phi[i]) * f, phi0: phi0[i] + (phi0[i + 1] - phi0[i]) * f, c: cx[i] + (cx[i + 1] - cx[i]) * f };
  };
  const punto = ([x, y]) => {
    const a = at(y);
    // El desvío horizontal respecto a la línea media gira con la columna (en reposo queda igual).
    const n = x - a.c, g = a.phi - a.phi0;
    return [a.P[0] + n * Math.cos(g), a.P[1] + n * Math.sin(g)];
  };
  return { punto, giro: (y) => at(y).phi - at(y).phi0 };
}

// ---------- Trazos (Catmull-Rom no uniforme -> Bézier de Lottie) ----------
function bezier(pts, cerrada) {
  const n = pts.length;
  const v = [], i = [], o = [];
  for (let k = 0; k < n; k++) {
    const p = pts[k];
    const a = cerrada ? pts[(k - 1 + n) % n] : pts[Math.max(0, k - 1)];
    const b = cerrada ? pts[(k + 1) % n] : pts[Math.min(n - 1, k + 1)];
    const dp = Math.hypot(p[0] - a[0], p[1] - a[1]), dn = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const T = [(b[0] - a[0]) / (dp + dn || 1), (b[1] - a[1]) / (dp + dn || 1)];
    v.push([r1(p[0]), r1(p[1])]);
    i.push(!cerrada && k === 0 ? [0, 0] : [r1((-T[0] * dp) / 3), r1((-T[1] * dp) / 3)]);
    o.push(!cerrada && k === n - 1 ? [0, 0] : [r1((T[0] * dn) / 3), r1((T[1] * dn) / 3)]);
  }
  return { c: cerrada, v, i, o };
}

// La panza llega hasta el contorno: se mete medio trazo hacia adentro para poder pintarla encima del cuerpo
// (relleno + contorno en un solo grupo) sin tapar el trazo. Así la silueta va una sola vez en el archivo.
function panzaAdentro(panza, margen) {
  const nrm = sil.map((p, i) => {
    const a = sil[(i - 1 + sil.length) % sil.length], b = sil[(i + 1) % sil.length];
    let n = [b[1] - a[1], a[0] - b[0]]; const L = Math.hypot(...n) || 1; n = [n[0] / L, n[1] / L];
    const toC = [CENTROIDE.c[0] - p[0], CENTROIDE.c[1] - p[1]];
    return n[0] * toC[0] + n[1] * toC[1] < 0 ? [-n[0], -n[1]] : n; // hacia adentro
  });
  return panza.map((p) => {
    let best = Infinity, j = 0;
    sil.forEach((q, k) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < best) { best = d; j = k; } });
    if (best >= margen) return p;
    const q = sil[j], n = nrm[j];
    return [q[0] + n[0] * margen, q[1] + n[1] * margen];
  });
}

const TOL = 0.45;
const PIEZAS = {
  silueta: rdpCerrada(sil, TOL),
  panza: rdpCerrada(panzaAdentro(PERFIL.panza, PERFIL.contorno / 2 + 0.2), TOL),
  lineas: PERFIL.lineas.map((l) => rdp(l, TOL)),
  surcos: PERFIL.surcos.map((l) => rdp(l, TOL * 1.5)),
};

const lineal = (keys) => ({
  a: 1,
  k: keys.map(([t, s], idx) => (idx === keys.length - 1 ? { t, s } : { t, s, o: { x: 0.33, y: 0.33 }, i: { x: 0.67, y: 0.67 } })),
});
const linealVec = (keys) => ({
  a: 1,
  k: keys.map(([t, s], idx) => (idx === keys.length - 1 ? { t, s } : { t, s, o: { x: s.map(() => 0.33), y: s.map(() => 0.33) }, i: { x: s.map(() => 0.67), y: s.map(() => 0.67) } })),
});
const v0 = (k) => ({ a: 0, k });
const trG = (p = [0, 0], r = 0) => ({ ty: 'tr', p: typeof p[0] === 'number' ? v0(p) : p, a: v0([0, 0]), s: v0([100, 100]), r: typeof r === 'number' ? v0(r) : r, o: v0(100), sk: v0(0), sa: v0(0) });
const grupo = (nm, it, t = trG()) => ({ ty: 'gr', nm, it: [...it, t] });
const relleno = (c) => ({ ty: 'fl', c: v0(hex(c)), o: v0(100), r: 1 });
const trazo = (w, c, lc = 2) => ({ ty: 'st', c: v0(hex(c)), o: v0(100), w: v0(r1(w)), lc, lj: 2, ml: 4 });

// Capa del salto. `curva(u)` -> { arco, cola } por fotograma (u de 0 a 1 en el salto); `pasos` = fotogramas clave.
export function saltoFlex({ frames, curva, ks, parent, nm = 'ceti-salto' }) {
  const C = PERFIL.colores, w = PERFIL.contorno;
  const claves = frames.map((f) => {
    const { arco, cola, cabeza = 0 } = curva(f);
    // Perfil de curvatura a lo largo del cuerpo (0 = cabeza, 1 = cola): el arco se reparte por el tronco y la
    // cola suma un latigazo propio; la cabeza casi no se dobla.
    const kappa = (s) => {
      const tronco = Math.exp(-(((s - 0.52) / 0.24) ** 2));
      const latigo = s > 0.62 ? ((s - 0.62) / 0.38) ** 1.5 : 0;
      const nuca = Math.exp(-(((s - 0.18) / 0.08) ** 2));
      return (arco * tronco + cola * latigo + cabeza * nuca) / N;
    };
    return { f, def: deformador(kappa) };
  });
  const forma = (pts, cerrada) => ({
    ty: 'sh',
    ks: { a: 1, k: claves.map(({ f, def }, idx) => {
      const s = [bezier(pts.map(def.punto), cerrada)];
      return idx === claves.length - 1 ? { t: f, s } : { t: f, s, o: { x: 0.33, y: 0.33 }, i: { x: 0.67, y: 0.67 } };
    }) },
  });
  // Ojo, pupila, brillo y mejilla: no se deforman, viajan pegados al punto de la cabeza donde están.
  const pegado = ([x, y]) => ({
    p: linealVec(claves.map(({ f, def }) => [f, def.punto([x, y]).map(r1)])),
    r: lineal(claves.map(({ f, def }) => [f, [r1((def.giro(y) * 180) / Math.PI)]])),
  });
  const circulo = (nm2, [x, y, r], c) => { const t = pegado([x, y]); return grupo(nm2, [{ ty: 'el', p: v0([0, 0]), s: v0([r1(2 * r), r1(2 * r)]), d: 1 }, relleno(c)], trG(t.p, t.r)); };
  const it = [];
  if (PERFIL.brillo) it.push(circulo('brillo', PERFIL.brillo, C.ojo));
  if (PERFIL.pupila) it.push(circulo('pupila', PERFIL.pupila, C.pupila));
  if (PERFIL.ojo) it.push(circulo('ojo', PERFIL.ojo, C.ojo));
  it.push(grupo('lineas', [...PIEZAS.lineas.map((l) => forma(l, false)), trazo(w * 0.85, C.linea)]));
  if (PERFIL.mejilla) {
    const [x, y, rx, ry, ang] = PERFIL.mejilla;
    const t = pegado([x, y]);
    t.r.k.forEach((k) => { k.s = [r1(k.s[0] + ang)]; });
    it.push(grupo('mejilla', [{ ty: 'el', p: v0([0, 0]), s: v0([r1(2 * rx), r1(2 * ry)]), d: 1 }, relleno(C.mejilla)], trG(t.p, t.r)));
  }
  it.push(grupo('surcos', [...PIEZAS.surcos.map((l) => forma(l, false)), trazo(w * 0.55, C.surco)]));
  it.push(grupo('panza', [forma(PIEZAS.panza, true), relleno(C.panza)]));
  it.push(grupo('cuerpo', [forma(PIEZAS.silueta, true), trazo(w, C.contorno), relleno(C.naranja)]));
  return {
    ddd: 0, ty: 4, nm, sr: 1, ao: 0, bm: 0, st: 0, shapes: it,
    ks: { o: v0(100), a: v0(CENTROIDE.c.map(r1)), ...ks },
    ...(parent ? { parent } : {}),
  };
}

export const PERFIL_MEDIDAS = { area: CENTROIDE.area, centroide: CENTROIDE.c, alto: Y1 - Y0, ancho: ANCHO, altoLienzo: ALTO,
  puntos: Object.fromEntries(Object.entries(PIEZAS).map(([k, v]) => [k, Array.isArray(v[0][0]) ? v.reduce((s, l) => s + l.length, 0) : v.length])) };
