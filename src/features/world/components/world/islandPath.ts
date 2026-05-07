// islandPath.ts — Geometría orgánica de la isla flotante
//
// Diseño inspirado en floating-island art: silueta asimétrica, top con bumps
// (no es una cúpula simple), un bulge lateral por lado, base que tapera a una
// sola punta off-center con pequeñas irregularidades. Además se exponen
// helpers para "trozos flotantes" debajo de la isla y "rocas laterales" que
// sobresalen del costado.
import { Skia } from '@shopify/react-native-skia';
import type { RocketPadZone } from './rocketPadZone';
import { rectOverlapsRocketZone } from './rocketPadZone';

export type SkPath = ReturnType<typeof Skia.Path.Make>;

export function prng(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5;
  return s - Math.floor(s);
}

export interface IslandConfig {
  cx: number;
  cy: number;
  islandW: number;
  domeH: number;
  stalH: number;
  stalCount: number;
  seed: number;
}

interface Pt {
  x: number;
  y: number;
}

interface TopAnchors {
  topL: Pt;
  a1: Pt;
  a2: Pt;
  a3: Pt;
  topR: Pt;
  /** -1 izquierda más alta, +1 derecha más alta */
  tiltDir: number;
  tiltAmt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANCHORS — 5 puntos del borde superior con jitter determinista
// ─────────────────────────────────────────────────────────────────────────────
function genTopAnchors(cfg: IslandConfig): TopAnchors {
  const { cx, cy, islandW, domeH, seed } = cfg;
  const hw = islandW / 2;

  const tiltDir = prng(seed * 1.3) > 0.5 ? 1 : -1;
  const tiltAmt = domeH * (0.16 + prng(seed * 0.7) * 0.16);

  const topL: Pt = {
    x: cx - hw + 6,
    y: cy + (tiltDir < 0 ? -tiltAmt * 0.3 : tiltAmt * 0.45),
  };
  const topR: Pt = {
    x: cx + hw - 8,
    y: cy + (tiltDir < 0 ? tiltAmt * 0.45 : -tiltAmt * 0.3),
  };
  const a1: Pt = {
    x: cx - hw * (0.5 + prng(seed * 2.1) * 0.1),
    y: cy - domeH * (0.62 + prng(seed * 2.3) * 0.16) + (tiltDir < 0 ? -tiltAmt * 0.3 : 0),
  };
  const a2: Pt = {
    x: cx + hw * (prng(seed * 2.5) - 0.5) * 0.22,
    y: cy - domeH * (0.92 + prng(seed * 2.7) * 0.06),
  };
  const a3: Pt = {
    x: cx + hw * (0.4 + prng(seed * 3.1) * 0.1),
    y: cy - domeH * (0.68 + prng(seed * 3.3) * 0.18) + (tiltDir < 0 ? 0 : -tiltAmt * 0.3),
  };

  return { topL, a1, a2, a3, topR, tiltDir, tiltAmt };
}

/** Añade el borde superior al path desde topL → topR usando 4 cubics. */
function strokeTopForward(p: SkPath, a: TopAnchors, dy: number, hw: number, domeH: number) {
  p.cubicTo(
    a.topL.x + hw * 0.2,
    a.topL.y + dy - domeH * 0.45,
    a.a1.x - hw * 0.18,
    a.a1.y + dy + 8,
    a.a1.x,
    a.a1.y + dy
  );
  p.cubicTo(
    a.a1.x + hw * 0.16,
    a.a1.y + dy - 6,
    a.a2.x - hw * 0.16,
    a.a2.y + dy + 4,
    a.a2.x,
    a.a2.y + dy
  );
  p.cubicTo(
    a.a2.x + hw * 0.16,
    a.a2.y + dy + 4,
    a.a3.x - hw * 0.16,
    a.a3.y + dy - 6,
    a.a3.x,
    a.a3.y + dy
  );
  p.cubicTo(
    a.a3.x + hw * 0.18,
    a.a3.y + dy + 8,
    a.topR.x - hw * 0.2,
    a.topR.y + dy - domeH * 0.4,
    a.topR.x,
    a.topR.y + dy
  );
}

/** Variante reversa para cerrar el surface ribbon. */
function strokeTopBackward(p: SkPath, a: TopAnchors, dy: number, hw: number, domeH: number) {
  p.cubicTo(
    a.topR.x - hw * 0.2,
    a.topR.y + dy - domeH * 0.4,
    a.a3.x + hw * 0.18,
    a.a3.y + dy + 8,
    a.a3.x,
    a.a3.y + dy
  );
  p.cubicTo(
    a.a3.x - hw * 0.16,
    a.a3.y + dy - 6,
    a.a2.x + hw * 0.16,
    a.a2.y + dy + 4,
    a.a2.x,
    a.a2.y + dy
  );
  p.cubicTo(
    a.a2.x - hw * 0.16,
    a.a2.y + dy + 4,
    a.a1.x + hw * 0.16,
    a.a1.y + dy - 6,
    a.a1.x,
    a.a1.y + dy
  );
  p.cubicTo(
    a.a1.x - hw * 0.18,
    a.a1.y + dy + 8,
    a.topL.x + hw * 0.2,
    a.topL.y + dy - domeH * 0.45,
    a.topL.x,
    a.topL.y + dy
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SILUETA — top irregular + bulges laterales + cono inferior con bumps
// ─────────────────────────────────────────────────────────────────────────────
export function buildIslandSilhouette(cfg: IslandConfig): SkPath {
  const { cx, cy, islandW, domeH, stalH, seed } = cfg;
  const hw = islandW / 2;
  const path = Skia.Path.Make();
  const a = genTopAnchors(cfg);

  // ── TOP ──
  path.moveTo(a.topL.x, a.topL.y);
  strokeTopForward(path, a, 0, hw, domeH);

  // ── Lado derecho con bulto outward ──
  const rightBulgeOut = 8 + prng(seed * 5.1) * 14;
  const rightBulgeY = cy + stalH * (0.1 + prng(seed * 5.3) * 0.12);
  const rightDescentX = cx + hw * (0.78 + prng(seed * 5.7) * 0.06);
  const rightDescentY = cy + stalH * (0.32 + prng(seed * 5.9) * 0.06);
  path.cubicTo(
    a.topR.x + 14,
    a.topR.y + stalH * 0.1,
    cx + hw + rightBulgeOut,
    rightBulgeY,
    rightDescentX,
    rightDescentY
  );

  // ── Cono inferior asimétrico — UNA punta off-center ──
  const tipX = cx + hw * ((prng(seed * 6.1) - 0.5) * 0.4);
  const tipY = cy + stalH * (0.95 + prng(seed * 6.3) * 0.08);

  // Bumps lado derecho descendiendo hacia la punta
  bumpedSegment(path, rightDescentX, rightDescentY, tipX, tipY, 3, seed * 7);

  // Bumps lado izquierdo subiendo desde la punta
  const leftRiseX = cx - hw * (0.8 + prng(seed * 11.5) * 0.06);
  const leftRiseY = cy + stalH * (0.28 + prng(seed * 11.7) * 0.06);
  bumpedSegment(path, tipX, tipY, leftRiseX, leftRiseY, 4, seed * 9);

  // ── Lado izquierdo subiendo con bulto ──
  const leftBulgeOut = 8 + prng(seed * 11.1) * 12;
  const leftBulgeY = cy + stalH * (0.12 + prng(seed * 11.3) * 0.1);
  path.cubicTo(
    cx - hw * 0.85,
    cy + stalH * 0.18,
    cx - hw - leftBulgeOut,
    leftBulgeY,
    a.topL.x,
    a.topL.y
  );

  path.close();
  return path;
}

/**
 * Conecta (x0,y0) → (x1,y1) con N quadTos, donde cada control se desplaza
 * hacia abajo de ambos extremos (siempre crea bumps inferiores aunque la
 * dirección del segmento sea ascendente). Cierra dibujando hasta (x1,y1).
 */
function bumpedSegment(
  p: SkPath,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  steps: number,
  rngSeed: number
) {
  let prevX = x0;
  let prevY = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    const nX = x0 + (x1 - x0) * t;
    const nY = y0 + (y1 - y0) * t;
    const cX = (prevX + nX) / 2 + (prng(rngSeed + i * 1.7) - 0.5) * 18;
    const cY = Math.max(prevY, nY) + 5 + prng(rngSeed + i * 2.3) * 14;
    p.quadTo(cX, cY, nX, nY);
    prevX = nX;
    prevY = nY;
  }
  // Final hasta (x1,y1) con bump
  const fcX = (prevX + x1) / 2 + (prng(rngSeed + 17.7) - 0.5) * 16;
  const fcY = Math.max(prevY, y1) + 4 + prng(rngSeed + 19.1) * 12;
  p.quadTo(fcX, fcY, x1, y1);
}

// ─────────────────────────────────────────────────────────────────────────────
// FACETAS — fracturas internas (curvas, no líneas rectas)
// ─────────────────────────────────────────────────────────────────────────────
export function buildRockFacets(cfg: IslandConfig): SkPath[] {
  const { cx, cy, islandW, stalH, seed } = cfg;
  const hw = islandW / 2;
  const out: SkPath[] = [];

  const fractures = [
    { x1: -0.4, y1: 0.1, cxf: -0.3, cyf: 0.2, x2: -0.18, y2: 0.32 },
    { x1: -0.2, y1: 0.06, cxf: -0.3, cyf: 0.18, x2: -0.36, y2: 0.26 },
    { x1: 0.06, y1: 0.1, cxf: 0.18, cyf: 0.22, x2: 0.3, y2: 0.34 },
    { x1: 0.24, y1: 0.06, cxf: 0.32, cyf: 0.16, x2: 0.42, y2: 0.2 },
    { x1: -0.04, y1: 0.2, cxf: 0.06, cyf: 0.32, x2: 0.16, y2: 0.42 },
    { x1: -0.42, y1: 0.28, cxf: -0.32, cyf: 0.4, x2: -0.2, y2: 0.5 },
  ];

  for (const f of fractures) {
    const j = (prng(seed + f.x1 * 77) - 0.5) * 6;
    const p = Skia.Path.Make();
    p.moveTo(cx + hw * f.x1 + j, cy + stalH * f.y1);
    p.quadTo(cx + hw * f.cxf + j, cy + stalH * f.cyf, cx + hw * f.x2 + j, cy + stalH * f.y2);
    out.push(p);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE — ribbon de grosor T que sigue el top irregular
// ─────────────────────────────────────────────────────────────────────────────
const SURFACE_T = 14;

export function buildSurface(cfg: IslandConfig): SkPath {
  const { domeH } = cfg;
  const hw = cfg.islandW / 2;
  const a = genTopAnchors(cfg);
  const p = Skia.Path.Make();

  p.moveTo(a.topL.x, a.topL.y);
  strokeTopForward(p, a, 0, hw, domeH);
  p.lineTo(a.topR.x, a.topR.y + SURFACE_T);
  strokeTopBackward(p, a, SURFACE_T, hw, domeH);
  p.lineTo(a.topL.x, a.topL.y);
  p.close();
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// RIM GLOW — borde superior brillante (no cerrado)
// ─────────────────────────────────────────────────────────────────────────────
export function buildRimGlow(cfg: IslandConfig): SkPath {
  const { domeH } = cfg;
  const hw = cfg.islandW / 2;
  const a = genTopAnchors(cfg);
  const p = Skia.Path.Make();
  p.moveTo(a.topL.x, a.topL.y - 1);
  strokeTopForward(p, a, -1, hw, domeH);
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// MESETAS (plataformas elevadas en la superficie)
// ─────────────────────────────────────────────────────────────────────────────
export interface MesaDef {
  path: SkPath;
  xCenter: number;
  yTop: number;
}

export function buildMesas(cfg: IslandConfig, rocketZone?: RocketPadZone): MesaDef[] {
  const { cx, cy, islandW, domeH, seed } = cfg;
  const hw = islandW / 2;
  const surface = cy - domeH * 0.06;
  const mesas: MesaDef[] = [];

  const mesaConfigs = [
    { xf: -0.34, w: islandW * 0.17, h: 10 },
    { xf: 0.28, w: islandW * 0.22, h: 9 },
  ];

  for (const mc of mesaConfigs) {
    const mx = cx + hw * mc.xf - mc.w / 2;
    const my = surface - mc.h + prng(seed + mc.xf * 13) * 4 - 2;
    if (rocketZone && rectOverlapsRocketZone(mx, my, mx + mc.w, my + mc.h, rocketZone)) {
      continue;
    }
    const p = Skia.Path.Make();
    p.moveTo(mx, my + mc.h);
    p.lineTo(mx + mc.w * 0.06, my + 2);
    p.lineTo(mx + mc.w * 0.94, my + 2);
    p.lineTo(mx + mc.w, my + mc.h);
    p.close();
    mesas.push({ path: p, xCenter: mx + mc.w / 2, yTop: my + 2 });
  }

  return mesas;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDE ROCKS — roca jagged que sobresale por el costado de la isla
// ─────────────────────────────────────────────────────────────────────────────
export interface SideRockDef {
  path: SkPath;
  cx: number;
  cy: number;
}

export function buildSideRocks(cfg: IslandConfig, rocketZone?: RocketPadZone): SideRockDef[] {
  const { cx, cy, islandW, stalH, seed } = cfg;
  const hw = islandW / 2;
  const out: SideRockDef[] = [];

  const cfgs = [
    { side: -1, yf: 0.18, w: 18, h: 12, sk: seed * 13.1 },
    { side: -1, yf: 0.5, w: 22, h: 14, sk: seed * 13.5 },
    { side: 1, yf: 0.22, w: 16, h: 11, sk: seed * 14.1 },
    { side: 1, yf: 0.42, w: 20, h: 13, sk: seed * 14.5 },
  ];

  for (const r of cfgs) {
    const baseX = cx + r.side * (hw - 2);
    const ry = cy + stalH * r.yf + (prng(r.sk * 1.7) - 0.5) * 8;
    const rx = baseX + r.side * r.w * 0.55;

    if (rocketZone && rectOverlapsRocketZone(rx - r.w, ry - r.h, rx + r.w, ry + r.h, rocketZone)) {
      continue;
    }

    const p = Skia.Path.Make();
    const points = 7;
    for (let i = 0; i < points; i++) {
      const ang = (i / points) * Math.PI * 2 + prng(r.sk + i) * 0.3;
      const radius = (i % 2 === 0 ? 1.0 : 0.62) * r.w * 0.6;
      const px = rx + Math.cos(ang) * radius;
      const py = ry + Math.sin(ang) * radius * (r.h / r.w);
      if (i === 0) p.moveTo(px, py);
      else p.lineTo(px, py);
    }
    p.close();
    out.push({ path: p, cx: rx, cy: ry });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING CHUNKS — pequeños trozos de roca flotando bajo la isla principal
// ─────────────────────────────────────────────────────────────────────────────
export interface FloatingChunkDef {
  path: SkPath;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export function buildFloatingChunks(cfg: IslandConfig): FloatingChunkDef[] {
  const { cx, cy, islandW, stalH, seed } = cfg;
  const hw = islandW / 2;
  const out: FloatingChunkDef[] = [];

  const chunkCfgs = [
    { xf: -0.62, yo: 36, w: 42 },
    { xf: 0.66, yo: 18, w: 30 },
    { xf: -0.1, yo: 70, w: 22 },
  ];

  for (const c of chunkCfgs) {
    const ccx = cx + hw * c.xf;
    const ccy = cy + stalH + 24 + c.yo;
    const j = prng(seed * 17 + c.xf * 11);
    const w = c.w + j * 8;
    const h = w * (0.55 + prng(seed * 18 + c.xf * 13) * 0.2);

    const p = Skia.Path.Make();
    // Top: curva convexa con bumps suaves
    p.moveTo(ccx - w / 2, ccy);
    p.cubicTo(
      ccx - w * 0.32,
      ccy - h * 0.65 - prng(seed * 19 + c.xf) * 4,
      ccx + w * 0.32,
      ccy - h * 0.6 - prng(seed * 20 + c.xf) * 4,
      ccx + w / 2,
      ccy
    );
    // Bajada derecha
    p.lineTo(ccx + w * 0.42, ccy + h * 0.18);
    // Bottom: tip jagged off-center
    const tipDx = (prng(seed * 21 + c.xf) - 0.5) * w * 0.3;
    p.quadTo(ccx + w * 0.18, ccy + h * 0.42, ccx + tipDx, ccy + h * 0.85);
    p.quadTo(ccx - w * 0.18, ccy + h * 0.5, ccx - w * 0.42, ccy + h * 0.18);
    p.lineTo(ccx - w / 2, ccy);
    p.close();

    out.push({ path: p, cx: ccx, cy: ccy, w, h });
  }
  return out;
}
