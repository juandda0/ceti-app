// terrains.tsx — Decoraciones por bioma (Skia, dentro de <Canvas>)
// Cada terreno respeta la zona de despeje del cohete (rocketZone).
import React, { useEffect, useMemo } from 'react';
import { Dimensions } from 'react-native';
import {
  Group,
  Circle,
  Path,
  Rect,
  Oval,
  Line,
  LinearGradient,
  RadialGradient,
  BlurMask,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PAL } from './palette';
import { prng } from './islandPath';
import { circleHitsRocketZone, rectOverlapsRocketZone } from './rocketPadZone';
import type { RocketPadZone } from './rocketPadZone';

const { width: W, height: H } = Dimensions.get('window');

interface TerrainProps {
  cx: number;
  cy: number;
  islandW: number;
  reduceMotion: boolean;
  rocketZone: RocketPadZone;
}

// ═════════════════════════════════════════════════════════════════════════════
// ROCKY · superficie rocosa con cráteres, antena y cristales
// ═════════════════════════════════════════════════════════════════════════════
export function RockyTerrain({ cx, cy, islandW, reduceMotion, rocketZone }: TerrainProps) {
  const p = PAL.rocky;
  const surface = cy - 8;

  const satX = useSharedValue(-60);
  const transPulse = useSharedValue(0.4);
  const dustY = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      satX.value = cx * 0.5;
      transPulse.value = 0.4;
      dustY.value = 0;
      return;
    }
    satX.value = withRepeat(withTiming(W + 60, { duration: 22000 }), -1, false);
    transPulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 600 }), withTiming(0.2, { duration: 600 })),
      -1,
      true
    );
    dustY.value = withRepeat(
      withSequence(withTiming(-6, { duration: 3000 }), withTiming(0, { duration: 3000 })),
      -1,
      true
    );
  }, [reduceMotion]);

  const satT = useDerivedValue(() => [{ translateX: satX.value }]);
  const dustT = useDerivedValue(() => [{ translateY: dustY.value }]);
  const transPulseHalf = useDerivedValue(() => transPulse.value * 0.5);

  // Cráteres distribuidos por toda la superficie, filtrando los que invaden la zona
  const craters = useMemo(
    () =>
      [
        { x: cx - islandW * 0.4, y: surface + 6, r: 18 },
        { x: cx - islandW * 0.18, y: surface + 4, r: 11 },
        { x: cx + islandW * 0.04, y: surface + 7, r: 14 },
        { x: cx + islandW * 0.2, y: surface + 5, r: 9 },
      ].filter((c) => !circleHitsRocketZone(c.x, c.y, c.r + 6, rocketZone)),
    [cx, surface, islandW, rocketZone]
  );

  // Rocas dispersas
  const rocks = useMemo(
    () =>
      [
        { x: cx - islandW * 0.46, y: surface + 4, rx: 13, ry: 8 },
        { x: cx - islandW * 0.3, y: surface + 3, rx: 10, ry: 6 },
        { x: cx - islandW * 0.06, y: surface + 5, rx: 11, ry: 7 },
        { x: cx + islandW * 0.12, y: surface + 4, rx: 9, ry: 6 },
      ].filter((r) => !circleHitsRocketZone(r.x, r.y, Math.max(r.rx, r.ry) + 4, rocketZone)),
    [cx, surface, islandW, rocketZone]
  );

  // Antena rota — siempre al lado opuesto del cohete (izquierda)
  const antX = cx - islandW * 0.34;
  const antY = surface;
  const antennaPath = useMemo(() => {
    const ap = Skia.Path.Make();
    ap.moveTo(antX, antY);
    ap.lineTo(antX + 2, antY - 36);
    ap.lineTo(antX - 14, antY - 56);
    ap.moveTo(antX + 2, antY - 30);
    ap.quadTo(antX + 14, antY - 22, antX + 22, antY - 14);
    return ap;
  }, [antX, antY]);

  // Cristales en la base inferior, lejos de la zona del cohete
  const crystals = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const bx = cx - islandW * 0.4 + i * islandW * 0.1;
        const bh = 20 + prng(i * 7 + 42) * 28;
        const bw = 6 + prng(i * 5 + 33) * 8;
        const by = cy + 32 + prng(i * 3 + 11) * 40;
        return { x: bx, y: by, h: bh, w: bw, ci: i % 3 };
      }).filter(
        (cr) => !rectOverlapsRocketZone(cr.x - cr.w, cr.y, cr.x + cr.w, cr.y + cr.h, rocketZone)
      ),
    [cx, cy, islandW, rocketZone]
  );

  // Polvo flotante, evitando el cohete
  const dustParticles = useMemo(() => {
    const out: { x: number; y: number; r: number; op: number }[] = [];
    let seed = 1;
    while (out.length < 8 && seed < 60) {
      const x = cx + (prng(seed * 11 + 5) - 0.5) * islandW * 0.85;
      const y = surface - 8 - prng(seed * 7 + 3) * 30;
      if (!circleHitsRocketZone(x, y, 6, rocketZone)) {
        out.push({
          x,
          y,
          r: 1.4 + prng(seed * 3 + 1) * 1.8,
          op: 0.1 + prng(seed * 9 + 7) * 0.2,
        });
      }
      seed++;
    }
    return out;
  }, [cx, surface, islandW, rocketZone]);

  return (
    <Group>
      {/* Cráteres con eyecta */}
      {craters.map((c, i) => (
        <Group key={`crater_${i}`}>
          <Circle cx={c.x} cy={c.y} r={c.r + 5} color={p.craterRim} opacity={0.45} />
          <Circle cx={c.x} cy={c.y} r={c.r} color={p.craterColor} />
          <Circle cx={c.x - c.r * 0.18} cy={c.y - c.r * 0.18} r={c.r * 0.52} color={p.craterDark} />
        </Group>
      ))}

      {/* Rocas con sombra */}
      {rocks.map((r, i) => (
        <Group key={`rock_${i}`}>
          <Oval
            rect={{ x: r.x - r.rx + 2, y: r.y - r.ry + 3, width: r.rx * 2, height: r.ry * 2 }}
            color="rgba(0,0,0,0.25)"
          />
          <Oval
            rect={{ x: r.x - r.rx, y: r.y - r.ry, width: r.rx * 2, height: r.ry * 2 }}
            color={p.surfaceColor}
          />
          <Oval
            rect={{ x: r.x - r.rx + 2, y: r.y - r.ry + 2, width: r.rx * 0.8, height: r.ry * 0.5 }}
            color="rgba(255,255,255,0.12)"
          />
        </Group>
      ))}

      {/* Antena rota con LED parpadeante */}
      <Path
        path={antennaPath}
        color="#7080A0"
        style="stroke"
        strokeWidth={3}
        strokeCap="round"
        strokeJoin="round"
      />
      <Circle cx={antX - 14} cy={antY - 56} r={4} color="#556688" />
      <Line
        p1={vec(antX - 14, antY - 56)}
        p2={vec(antX - 14, antY - 48)}
        color={p.accent}
        strokeWidth={2}
        opacity={transPulse}
      />

      {/* Polvo flotante */}
      <Group transform={dustT}>
        {dustParticles.map((dp, i) => (
          <Circle
            key={`dust_${i}`}
            cx={dp.x}
            cy={dp.y}
            r={dp.r}
            color={p.dustColor}
            opacity={dp.op}
          />
        ))}
      </Group>

      {/* Cristales con brillo interior */}
      {crystals.map((cr, i) => {
        const cp = Skia.Path.Make();
        cp.moveTo(cr.x, cr.y);
        cp.lineTo(cr.x - cr.w / 2, cr.y + cr.h * 0.58);
        cp.lineTo(cr.x, cr.y + cr.h);
        cp.lineTo(cr.x + cr.w / 2, cr.y + cr.h * 0.58);
        cp.close();
        const glowPath = Skia.Path.Make();
        glowPath.moveTo(cr.x - cr.w * 0.15, cr.y + cr.h * 0.05);
        glowPath.lineTo(cr.x + cr.w * 0.15, cr.y + cr.h * 0.4);
        return (
          <Group key={`crystal_${i}`}>
            <Path path={cp} color={p.crystalColors[cr.ci % 3]} opacity={0.78} />
            <Path
              path={glowPath}
              color="rgba(255,255,255,0.28)"
              style="stroke"
              strokeWidth={2}
              strokeCap="round"
            />
          </Group>
        );
      })}

      {/* Satélite con bandera y transmisión */}
      <Group transform={satT}>
        <Oval rect={{ x: -26, y: H * 0.1 - 6, width: 52, height: 12 }} color="#7A8090" />
        <Circle cx={0} cy={H * 0.1 - 6} r={7} color="#A8B0C8" />
        <Rect x={-18} y={H * 0.1 - 2} width={10} height={5} color="#3A7ACC" />
        <Rect x={8} y={H * 0.1 - 2} width={10} height={5} color="#3A7ACC" />
        <Line
          p1={vec(0, H * 0.1 - 13)}
          p2={vec(0, H * 0.1 - 22)}
          color="#C0C8DC"
          strokeWidth={1.5}
        />
        <Circle cx={0} cy={H * 0.1 - 25} r={3} color={p.accent} opacity={transPulse} />
        <Rect x={0} y={H * 0.1 - 22} width={8} height={5} color={p.rocketBody} opacity={0.9} />
        <Circle
          cx={0}
          cy={H * 0.1 - 25}
          r={8}
          color="transparent"
          style="stroke"
          strokeWidth={1}
          opacity={transPulse}
        />
        <Circle
          cx={0}
          cy={H * 0.1 - 25}
          r={14}
          color="transparent"
          style="stroke"
          strokeWidth={0.8}
          opacity={transPulseHalf}
        />
      </Group>
    </Group>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SPROUT · jardín con árbol, casas, flores y riachuelo
// ═════════════════════════════════════════════════════════════════════════════
export function SproutTerrain({ cx, cy, islandW, reduceMotion, rocketZone }: TerrainProps) {
  const p = PAL.sprout;
  const surface = cy - 6;

  const cloud1X = useSharedValue(-120);
  const cloud2X = useSharedValue(W * 0.6);
  const leafShake = useSharedValue(0);
  const smokeY = useSharedValue(0);
  const smokeOp = useSharedValue(0.6);

  useEffect(() => {
    if (reduceMotion) {
      cloud1X.value = W * 0.25;
      cloud2X.value = W * 0.7;
      leafShake.value = 0;
      smokeY.value = -20;
      smokeOp.value = 0.3;
      return;
    }
    cloud1X.value = withRepeat(withTiming(W + 120, { duration: 28000 }), -1, false);
    cloud2X.value = withRepeat(withTiming(W + 80, { duration: 22000 }), -1, false);
    leafShake.value = withRepeat(
      withSequence(withTiming(3.5, { duration: 2000 }), withTiming(-3.5, { duration: 2000 })),
      -1,
      true
    );
    smokeY.value = withRepeat(withTiming(-40, { duration: 2500 }), -1, false);
    smokeOp.value = withRepeat(
      withSequence(withTiming(0.55, { duration: 1200 }), withTiming(0.05, { duration: 1300 })),
      -1,
      false
    );
  }, [reduceMotion]);

  const cloud1T = useDerivedValue(() => [{ translateX: cloud1X.value }]);
  const cloud2T = useDerivedValue(() => [{ translateX: cloud2X.value }]);
  const leafT = useDerivedValue(() => [{ rotate: (leafShake.value * Math.PI) / 180 }]);
  const smokeT = useDerivedValue(() => [{ translateY: smokeY.value }]);

  // Casas: una a la izquierda + una pequeña en el centro (sin invadir el cohete a la derecha)
  const houses = useMemo(
    () =>
      [
        { x: cx - islandW * 0.46, w: 38, h: 32, wallC: '#FF9FAA', roofC: '#CC3355' },
        { x: cx - islandW * 0.1, w: 32, h: 26, wallC: '#AADDFF', roofC: '#2277AA' },
      ].filter(
        (h) =>
          !rectOverlapsRocketZone(h.x - 6, surface - h.h - 22, h.x + h.w + 6, surface, rocketZone)
      ),
    [cx, islandW, surface, rocketZone]
  );

  // Árbol grande a la izquierda, lejos del cohete
  const treeX = cx - islandW * 0.3;
  const treeY = surface;
  const treeBlocked = circleHitsRocketZone(treeX, treeY - 60, 32, rocketZone);

  // Flores distribuidas en la parte central-izquierda
  const flowers = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        x: cx - islandW * 0.46 + i * islandW * 0.12,
        color: p.flowerColors[i % 4],
        stemH: 8 + prng(i * 5 + 3) * 8,
      })).filter((fl) => !circleHitsRocketZone(fl.x, surface - fl.stemH, 8, rocketZone)),
    [cx, islandW, surface, p.flowerColors, rocketZone]
  );

  // Riachuelo en el centro-izquierda
  const streamPath = useMemo(() => {
    const sp = Skia.Path.Make();
    const sx = cx - islandW * 0.04;
    sp.moveTo(sx, surface + 2);
    sp.cubicTo(sx - 12, surface + 14, sx + 14, surface + 26, sx + 4, surface + 40);
    sp.cubicTo(sx - 8, surface + 52, sx + 12, surface + 64, sx + 2, surface + 80);
    return sp;
  }, [cx, islandW, surface]);

  // Raíces colgantes solo donde no estorben al cohete
  const roots = useMemo(
    () =>
      [
        { x: cx - islandW * 0.42, len: 38 + prng(77) * 50, bend: (prng(55) - 0.5) * 22 },
        { x: cx - islandW * 0.12, len: 30 + prng(78) * 42, bend: (prng(56) - 0.5) * 24 },
        { x: cx + islandW * 0.16, len: 28 + prng(79) * 38, bend: (prng(57) - 0.5) * 20 },
      ].filter(
        (r) =>
          !rectOverlapsRocketZone(r.x - 12, cy + 10, r.x + 12, cy + 10 + r.len + 20, rocketZone)
      ),
    [cx, cy, islandW, rocketZone]
  );

  return (
    <Group>
      {/* Nubes */}
      <Group transform={cloud1T}>
        <Circle cx={0} cy={H * 0.13} r={22} color="rgba(255,255,255,0.82)" />
        <Circle cx={26} cy={H * 0.13 - 8} r={28} color="rgba(255,255,255,0.82)" />
        <Circle cx={56} cy={H * 0.13} r={20} color="rgba(255,255,255,0.82)" />
        <Rect x={-10} y={H * 0.13} width={68} height={20} color="rgba(255,255,255,0.82)" />
      </Group>
      <Group transform={cloud2T}>
        <Circle cx={0} cy={H * 0.09} r={14} color="rgba(255,255,255,0.60)" />
        <Circle cx={18} cy={H * 0.09 - 5} r={18} color="rgba(255,255,255,0.60)" />
        <Circle cx={36} cy={H * 0.09} r={13} color="rgba(255,255,255,0.60)" />
        <Rect x={-6} y={H * 0.09} width={44} height={13} color="rgba(255,255,255,0.60)" />
      </Group>

      {/* Flores con pétalos */}
      {flowers.map((fl, i) => (
        <Group key={`flower_${i}`}>
          <Rect x={fl.x - 1.5} y={surface - fl.stemH} width={3} height={fl.stemH} color="#3A7A40" />
          {[0, 72, 144, 216, 288].map((angle, j) => {
            const rad = (angle * Math.PI) / 180;
            const px = fl.x + Math.cos(rad) * 5.5;
            const py = surface - fl.stemH * 0.15 + Math.sin(rad) * 3.5;
            return <Circle key={`petal_${i}_${j}`} cx={px} cy={py} r={3.5} color={fl.color} />;
          })}
          <Circle cx={fl.x} cy={surface - fl.stemH * 0.15} r={3} color="#FFDD44" />
        </Group>
      ))}

      {/* Árbol con corteza, follaje en 3 capas y frutos */}
      {!treeBlocked && (
        <>
          <Rect x={treeX - 4} y={treeY - 48} width={8} height={48} color={p.rootColor} />
          <Line
            p1={vec(treeX - 3, treeY - 12)}
            p2={vec(treeX - 3, treeY - 38)}
            color="rgba(40,25,15,0.35)"
            strokeWidth={1.5}
          />
          <Line
            p1={vec(treeX + 2, treeY - 8)}
            p2={vec(treeX + 2, treeY - 42)}
            color="rgba(40,25,15,0.25)"
            strokeWidth={1.5}
          />
          <Group transform={leafT} origin={vec(treeX, treeY - 48)}>
            <Circle cx={treeX} cy={treeY - 70} r={28} color="#2E8B57" />
            <Circle cx={treeX - 20} cy={treeY - 56} r={20} color="#3AAA60" />
            <Circle cx={treeX + 20} cy={treeY - 56} r={20} color="#3AAA60" />
            <Circle cx={treeX} cy={treeY - 58} r={16} color="#52C478" />
            {[
              { ox: -10, oy: -72 },
              { ox: 8, oy: -68 },
              { ox: -4, oy: -60 },
            ].map((ft, fi) => (
              <Group key={`fruit_${fi}`}>
                <Circle cx={treeX + ft.ox} cy={treeY + ft.oy} r={6}>
                  <RadialGradient
                    c={vec(treeX + ft.ox - 2, treeY + ft.oy - 2)}
                    r={6}
                    colors={['#FF6666', '#AA2222']}
                  />
                </Circle>
                <Circle
                  cx={treeX + ft.ox - 2}
                  cy={treeY + ft.oy - 2}
                  r={2}
                  color="rgba(255,255,255,0.45)"
                />
              </Group>
            ))}
          </Group>
        </>
      )}

      {/* Casas detalladas */}
      {houses.map(({ x, w, h, wallC, roofC }, idx) => {
        const hy = surface;
        const roofPath = Skia.Path.Make();
        roofPath.moveTo(x - 5, hy - h);
        roofPath.lineTo(x + w + 5, hy - h);
        roofPath.lineTo(x + w / 2, hy - h - 20);
        roofPath.close();
        const tilesData = [
          { tx: x - 4, ty: hy - h - 5, tw: (w + 10) * 0.5 },
          { tx: x - 1, ty: hy - h - 11, tw: (w + 10) * 0.32 },
        ];
        const chimneyX = x + w * 0.78;
        return (
          <Group key={`house_${idx}`}>
            <Rect x={x + 3} y={hy - h + 4} width={w} height={h} color="rgba(0,0,0,0.18)" />
            <Rect x={x} y={hy - h} width={w} height={h} color={wallC} />
            <Path path={roofPath} color={roofC} />
            {tilesData.map((tile, ti) => (
              <Rect
                key={`tile_${ti}`}
                x={tile.tx}
                y={tile.ty}
                width={tile.tw}
                height={6}
                color="rgba(0,0,0,0.12)"
              />
            ))}
            <Rect x={x + w / 2 - 5} y={hy - 14} width={10} height={14} color="#5C3D2E" />
            <Circle cx={x + w / 2 + 3} cy={hy - 7} r={2} color="#E8B84B" />
            <Rect x={x + 5} y={hy - h + 8} width={8} height={8} color="#B8E4F9" />
            <Rect x={x + 6} y={hy - h + 9} width={6} height={6} color="#DDEEFF" />
            <Rect x={x + w - 13} y={hy - h + 8} width={8} height={8} color="#B8E4F9" />
            <Rect x={x + w - 12} y={hy - h + 9} width={6} height={6} color="#DDEEFF" />
            <Rect x={chimneyX} y={hy - h - 14} width={5} height={14} color="#AA6644" />
            <Group transform={smokeT}>
              <Circle
                cx={chimneyX + 2.5}
                cy={hy - h - 16}
                r={4}
                color="rgba(255,255,255,0.50)"
                opacity={smokeOp}
              />
              <Circle
                cx={chimneyX + 6}
                cy={hy - h - 24}
                r={6}
                color="rgba(255,255,255,0.35)"
                opacity={smokeOp}
              />
              <Circle
                cx={chimneyX + 2.5}
                cy={hy - h - 32}
                r={7}
                color="rgba(255,255,255,0.20)"
                opacity={smokeOp}
              />
            </Group>
          </Group>
        );
      })}

      {/* Riachuelo */}
      <Path path={streamPath} style="stroke" strokeWidth={5} strokeCap="round">
        <BlurMask blur={2} style="normal" />
      </Path>
      <Path path={streamPath} color="#5AC8E0" style="stroke" strokeWidth={4} strokeCap="round" />
      <Path
        path={streamPath}
        color="rgba(200,240,255,0.60)"
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
      />

      {/* Raíces colgantes con hoja terminal */}
      {roots.map((r, i) => {
        const rootPath = Skia.Path.Make();
        const startY = cy + 10;
        rootPath.moveTo(r.x, startY);
        rootPath.quadTo(r.x + r.bend, startY + r.len * 0.6, r.x + r.bend * 0.5, startY + r.len);
        const leafPath = Skia.Path.Make();
        const lx = r.x + r.bend * 0.5;
        const ly = startY + r.len;
        leafPath.moveTo(lx, ly);
        leafPath.cubicTo(lx - 8, ly + 8, lx + 2, ly + 18, lx + 5, ly + 14);
        leafPath.cubicTo(lx + 12, ly + 8, lx + 6, ly - 4, lx, ly);
        return (
          <Group key={`root_${i}`}>
            <Path
              path={rootPath}
              color={p.rootColor}
              style="stroke"
              strokeWidth={3}
              strokeCap="round"
            />
            <Path path={leafPath} color="#3AAA60" />
          </Group>
        );
      })}
    </Group>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// METRO · skyline contenido y limpio (4 edificios bien separados)
// ═════════════════════════════════════════════════════════════════════════════
// 4 edificios espaciados, alturas diferenciadas para que se distingan
const METRO_BUILDINGS = [
  { xf: -0.42, wf: 0.13, hf: 0.42, ci: 0, neonI: 0, hasAntenna: false },
  { xf: -0.24, wf: 0.11, hf: 0.62, ci: 1, neonI: 1, hasAntenna: true },
  { xf: -0.06, wf: 0.14, hf: 0.34, ci: 2, neonI: 2, hasAntenna: false },
  { xf: 0.14, wf: 0.1, hf: 0.5, ci: 3, neonI: 0, hasAntenna: true },
] as const;

const METRO_BUILD_COLORS = ['#12122A', '#0E1C38', '#0A2040', '#101030'] as const;

export function MetroTerrain({ cx, cy, islandW, reduceMotion, rocketZone }: TerrainProps) {
  const p = PAL.metro;
  const surface = cy - 6;

  const ufoX = useSharedValue(-90);
  const balloonY = useSharedValue(surface - 30);
  const neonPulse = useSharedValue(0);
  const antennaWave = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      ufoX.value = W * 0.4;
      balloonY.value = surface - 90;
      neonPulse.value = 0;
      antennaWave.value = 0;
      return;
    }
    ufoX.value = withRepeat(withTiming(W + 90, { duration: 18000 }), -1, false);
    balloonY.value = withRepeat(
      withSequence(
        withTiming(surface - 155, { duration: 14000 }),
        withTiming(surface - 30, { duration: 0 })
      ),
      -1,
      false
    );
    neonPulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 850 }), withTiming(0, { duration: 850 })),
      -1,
      true
    );
    antennaWave.value = withRepeat(
      withSequence(withTiming(1, { duration: 600 }), withTiming(0, { duration: 600 })),
      -1,
      false
    );
  }, [reduceMotion, surface]);

  const ufoT = useDerivedValue(() => [{ translateX: ufoX.value }]);
  const balloonT = useDerivedValue(() => [{ translateY: balloonY.value }]);
  const neonOp = useDerivedValue(() => 0.45 + neonPulse.value * 0.55);
  const waveOp1 = useDerivedValue(() => antennaWave.value * 0.8);
  const waveOp2 = useDerivedValue(() => antennaWave.value * 0.45);

  // Cristales pequeños en la parte inferior, solo un par a cada lado
  const crystals = useMemo(
    () =>
      [
        { x: cx - islandW * 0.38, h: 36, w: 12, ci: 0 },
        { x: cx - islandW * 0.16, h: 26, w: 9, ci: 2 },
        { x: cx + islandW * 0.04, h: 32, w: 11, ci: 1 },
        { x: cx + islandW * 0.3, h: 24, w: 9, ci: 0 },
      ]
        .map((cr) => ({
          ...cr,
          y: cy + 38 + prng(cr.x * 0.1) * 26,
        }))
        .filter(
          (cr) => !rectOverlapsRocketZone(cr.x - cr.w, cr.y, cr.x + cr.w, cr.y + cr.h, rocketZone)
        ),
    [cx, cy, islandW, rocketZone]
  );

  // Edificios filtrados por la zona del cohete
  const buildings = useMemo(
    () =>
      METRO_BUILDINGS.map((b) => {
        const bx = cx + islandW * b.xf;
        const bw = islandW * b.wf;
        const bh = 220 * b.hf;
        const by = surface - bh;
        return { ...b, bx, bw, bh, by };
      }).filter((b) => !rectOverlapsRocketZone(b.bx, b.by - 24, b.bx + b.bw, surface, rocketZone)),
    [cx, islandW, surface, rocketZone]
  );

  return (
    <Group>
      {/* Edificios — capas claras, ventanas estructuradas */}
      {buildings.map((b, idx) => {
        const buildColor = METRO_BUILD_COLORS[b.ci % 4];
        const neon = ([p.neonCyan, p.neonPink, p.neonYellow, p.neonCyan] as const)[b.neonI % 4];

        // Parrilla de ventanas con padding fijo (más legible que un random ruidoso)
        const padX = 6;
        const padY = 8;
        const winW = 5;
        const winH = 8;
        const gapX = 5;
        const gapY = 6;
        const winCols = Math.max(1, Math.floor((b.bw - padX * 2 + gapX) / (winW + gapX)));
        const winRows = Math.max(1, Math.floor((b.bh - padY * 2 + gapY) / (winH + gapY)));

        return (
          <Group key={`mb_${idx}`}>
            {/* Sombra */}
            <Rect
              x={b.bx + 3}
              y={b.by + 4}
              width={b.bw}
              height={b.bh + 16}
              color="rgba(0,0,0,0.40)"
            />
            {/* Cuerpo */}
            <Rect x={b.bx} y={b.by} width={b.bw} height={b.bh + 16} color={buildColor} />
            {/* Banda lateral neón */}
            <Rect x={b.bx} y={b.by + 4} width={2} height={b.bh - 8} color={neon} opacity={neonOp} />
            {/* Terraza neón */}
            <Rect x={b.bx} y={b.by} width={b.bw} height={3} color={neon} opacity={neonOp}>
              <BlurMask blur={4} style="normal" />
            </Rect>

            {/* Ventanas en cuadrícula determinista */}
            {Array.from({ length: winRows }).map((_, r) =>
              Array.from({ length: winCols }).map((__, c) => {
                const wx = b.bx + padX + c * (winW + gapX);
                const wy = b.by + padY + r * (winH + gapY);
                const seed = idx * 37 + r * 13 + c * 7;
                const lit = prng(seed) > 0.32;
                const bright = lit && prng(seed * 1.7) > 0.78;
                return (
                  <Group key={`mw_${r}_${c}`}>
                    <Rect x={wx} y={wy} width={winW} height={winH} color="#04070E" />
                    <Rect
                      x={wx + 1}
                      y={wy + 1}
                      width={winW - 2}
                      height={winH - 2}
                      color={lit ? (bright ? '#FFFFFF' : '#FFD060') : '#0A1828'}
                    />
                  </Group>
                );
              })
            )}

            {/* Antena holográfica solo en algunos edificios */}
            {b.hasAntenna && (
              <Group>
                <Line
                  p1={vec(b.bx + b.bw / 2, b.by)}
                  p2={vec(b.bx + b.bw / 2, b.by - 24)}
                  color={p.neonCyan}
                  strokeWidth={1.5}
                  opacity={neonOp}
                />
                <Circle cx={b.bx + b.bw / 2} cy={b.by - 24} r={3} color="#FF2200" opacity={neonOp}>
                  <BlurMask blur={3} style="normal" />
                </Circle>
                <Circle
                  cx={b.bx + b.bw / 2}
                  cy={b.by - 24}
                  r={10}
                  color="transparent"
                  style="stroke"
                  strokeWidth={1}
                  opacity={waveOp1}
                >
                  <BlurMask blur={2} style="normal" />
                </Circle>
                <Circle
                  cx={b.bx + b.bw / 2}
                  cy={b.by - 24}
                  r={20}
                  color="transparent"
                  style="stroke"
                  strokeWidth={0.8}
                  opacity={waveOp2}
                />
              </Group>
            )}
          </Group>
        );
      })}

      {/* Cristales púrpura — pocos y separados */}
      {crystals.map((cr, i) => {
        const cp = Skia.Path.Make();
        cp.moveTo(cr.x, cr.y);
        cp.lineTo(cr.x - cr.w / 2, cr.y + cr.h * 0.55);
        cp.lineTo(cr.x, cr.y + cr.h);
        cp.lineTo(cr.x + cr.w / 2, cr.y + cr.h * 0.55);
        cp.close();
        const reflPath = Skia.Path.Make();
        reflPath.moveTo(cr.x - cr.w * 0.1, cr.y + cr.h * 0.05);
        reflPath.lineTo(cr.x + cr.w * 0.15, cr.y + cr.h * 0.38);
        return (
          <Group key={`mc_${i}`}>
            <Path path={cp}>
              <LinearGradient
                start={vec(cr.x, cr.y)}
                end={vec(cr.x, cr.y + cr.h)}
                colors={[p.crystalColors[cr.ci % 3], '#5A1F88']}
              />
            </Path>
            <Path
              path={reflPath}
              color="rgba(255,255,255,0.22)"
              style="stroke"
              strokeWidth={2}
              strokeCap="round"
            />
          </Group>
        );
      })}

      {/* OVNI lejano (en el cielo, lejos de la isla) */}
      <Group transform={ufoT}>
        <Oval rect={{ x: -32, y: H * 0.16 - 7, width: 64, height: 14 }}>
          <LinearGradient
            start={vec(-32, H * 0.16 - 7)}
            end={vec(32, H * 0.16 + 7)}
            colors={['#8080AA', '#3C3C66']}
          />
        </Oval>
        <Circle cx={0} cy={H * 0.16 - 14} r={12} color="rgba(60,180,255,0.45)" />
        <Circle cx={0} cy={H * 0.16 - 14} r={7} color="rgba(180,230,255,0.30)" />
        {[-22, -8, 8, 22].map((lx, li) => (
          <Circle
            key={`ul_${li}`}
            cx={lx}
            cy={H * 0.16 + 5}
            r={2.5}
            color={li % 2 === 0 ? p.neonYellow : p.neonCyan}
            opacity={neonOp}
          />
        ))}
      </Group>

      {/* Globo aerostático (lado izquierdo del cielo, no compite con el cohete) */}
      <Group transform={balloonT}>
        <Circle cx={W * 0.18} cy={0} r={26} color={p.neonPink} opacity={0.85} />
        <Circle cx={W * 0.18} cy={0} r={26}>
          <LinearGradient
            start={vec(W * 0.18 - 26, -26)}
            end={vec(W * 0.18 + 26, 26)}
            colors={['rgba(255,255,255,0.18)', 'transparent']}
          />
        </Circle>
        <Line
          p1={vec(W * 0.18 - 10, 22)}
          p2={vec(W * 0.18 - 9, 38)}
          color="#AA8850"
          strokeWidth={1.5}
        />
        <Line
          p1={vec(W * 0.18 + 10, 22)}
          p2={vec(W * 0.18 + 9, 38)}
          color="#AA8850"
          strokeWidth={1.5}
        />
        <Rect x={W * 0.18 - 11} y={38} width={22} height={12} color="#8B6343" />
        <Rect x={W * 0.18 - 11} y={38} width={22} height={3} color="#AA8055" />
        <Rect
          x={W * 0.18 - 11}
          y={50}
          width={22}
          height={1.5}
          color={p.neonCyan}
          opacity={neonOp}
        />
      </Group>
    </Group>
  );
}
