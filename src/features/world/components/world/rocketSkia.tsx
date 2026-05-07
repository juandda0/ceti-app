// rocketSkia.tsx — Cohete 2D dibujado en Skia con 3 variantes narrativas
import React, { useMemo } from 'react';
import {
  Group,
  Circle,
  Path,
  Rect,
  Line,
  LinearGradient,
  RadialGradient,
  BlurMask,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { PAL } from './palette';

export type RocketVariant = 'rocky' | 'sprout' | 'metro';

export interface RocketSkiaProps {
  variant: RocketVariant;
  cx: number; // Centro X del cohete en coordenadas del canvas
  baseY: number; // Y de la base del cohete
  canTravel: boolean;
  bobOffset: SharedValue<number>;
  flameScale: SharedValue<number>;
  reduceMotion: boolean;
}

// Dimensiones del cohete en coordenadas locales (cx=0, base=0)
const BODY_W = 22; // Semiancho del cuerpo más ancho
const NOSE_W = 7; // Semiancho en la nariz
const BODY_H = 80; // Altura total nariz→base
const CABIN_Y = -52; // Y del centro de la cabina
const CABIN_R = 10; // Radio de la cabina
const FIN_W = 14; // Extensión lateral de las aletas
const FIN_H = 22; // Altura de las aletas
const NOZZLE_R = 6; // Radio de la tobera principal
const NOZZLE_SIDE_R = 4; // Radio de toberas laterales
const FLAME_H = 32; // Altura máxima de la llama

// ── Cuerpo base del cohete (bala asimétrica) ─────────────────────────────────
function buildBodyPath(lean: number = 0) {
  const path = Skia.Path.Make();
  // Nariz (punta)
  path.moveTo(lean, -BODY_H);
  // Hombros izquierdo-derecho (cóncavos hacia arriba)
  path.cubicTo(lean - NOSE_W, -BODY_H + 8, -BODY_W * 0.6, -BODY_H * 0.7, -BODY_W, -BODY_H * 0.45);
  // Cintura izquierda y base izquierda (levemente ensanchada)
  path.cubicTo(-BODY_W * 1.05, -BODY_H * 0.3, -BODY_W * 0.95, -BODY_H * 0.12, -BODY_W, 0);
  // Base plana
  path.lineTo(BODY_W, 0);
  // Subida base derecha
  path.cubicTo(BODY_W * 0.95, -BODY_H * 0.12, BODY_W * 1.05, -BODY_H * 0.3, BODY_W, -BODY_H * 0.45);
  // Hombro derecho → nariz
  path.cubicTo(BODY_W * 0.6, -BODY_H * 0.7, lean + NOSE_W, -BODY_H + 8, lean, -BODY_H);
  path.close();
  return path;
}

// ── Aleta izquierda ───────────────────────────────────────────────────────────
function buildFinLeft(tiltDeg: number = 0) {
  const path = Skia.Path.Make();
  const tilt = (tiltDeg * Math.PI) / 180;
  const tipX = -BODY_W - FIN_W + FIN_H * Math.sin(tilt);
  const tipY = FIN_H * Math.cos(tilt);
  path.moveTo(-BODY_W, -FIN_H * 0.5);
  path.lineTo(tipX, tipY);
  path.lineTo(-BODY_W, 2);
  path.close();
  return path;
}

// ── Aleta derecha ─────────────────────────────────────────────────────────────
function buildFinRight(tiltDeg: number = 0) {
  const path = Skia.Path.Make();
  const tilt = (tiltDeg * Math.PI) / 180;
  const tipX = BODY_W + FIN_W - FIN_H * Math.sin(tilt);
  const tipY = FIN_H * Math.cos(tilt);
  path.moveTo(BODY_W, -FIN_H * 0.5);
  path.lineTo(tipX, tipY);
  path.lineTo(BODY_W, 2);
  path.close();
  return path;
}

// ── Llama (gota) ─────────────────────────────────────────────────────────────
function buildFlamePath(h: number) {
  const path = Skia.Path.Make();
  path.moveTo(-NOZZLE_R, 0);
  path.cubicTo(-NOZZLE_R * 1.3, h * 0.4, -NOZZLE_R * 0.6, h * 0.85, 0, h);
  path.cubicTo(NOZZLE_R * 0.6, h * 0.85, NOZZLE_R * 1.3, h * 0.4, NOZZLE_R, 0);
  path.close();
  return path;
}

// ── Candado (estado disabled) ─────────────────────────────────────────────────
function buildLockPath() {
  const p = Skia.Path.Make();
  // Cuerpo del candado (rectángulo)
  p.moveTo(-7, -6);
  p.lineTo(7, -6);
  p.lineTo(7, 5);
  p.lineTo(-7, 5);
  p.close();
  // Arco superior (gancho)
  p.moveTo(-5, -6);
  p.cubicTo(-5, -14, 5, -14, 5, -6);
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANTE ROCKY
// ─────────────────────────────────────────────────────────────────────────────
function RockyRocket({
  canTravel,
  flameScale,
}: {
  canTravel: boolean;
  flameScale: SharedValue<number>;
}) {
  const p = PAL.rocky;
  const bodyPath = useMemo(() => buildBodyPath(0), []);
  const finL = useMemo(() => buildFinLeft(0), []);
  const finR = useMemo(() => buildFinRight(8), []); // aleta derecha torcida 8°
  const lockPath = useMemo(() => buildLockPath(), []);

  // Paths de parche oxidado (asimétricos)
  const patchPaths = useMemo(() => {
    const patches: ReturnType<typeof Skia.Path.Make>[] = [];
    const pData = [
      { x: -14, y: -60, w: 12, h: 14 },
      { x: 4, y: -40, w: 10, h: 10 },
      { x: -18, y: -30, w: 8, h: 16 },
    ];
    for (const pd of pData) {
      const pp = Skia.Path.Make();
      pp.moveTo(pd.x, pd.y);
      pp.lineTo(pd.x + pd.w, pd.y);
      pp.lineTo(pd.x + pd.w, pd.y + pd.h);
      pp.lineTo(pd.x, pd.y + pd.h);
      pp.close();
      patches.push(pp);
    }
    return patches;
  }, []);

  const flameTransform = useDerivedValue(() => [{ scaleY: flameScale.value }, { translateY: 2 }]);
  const flameH = FLAME_H * 0.85;
  const flamePath = useMemo(() => buildFlamePath(flameH), [flameH]);
  const flameSidePath = useMemo(() => {
    // 2 columnas de humo laterales
    const sp = Skia.Path.Make();
    sp.moveTo(-NOZZLE_SIDE_R - 4, 0);
    sp.cubicTo(
      -NOZZLE_SIDE_R - 6,
      flameH * 0.4,
      -NOZZLE_SIDE_R - 2,
      flameH * 0.8,
      -2,
      flameH * 1.1
    );
    sp.moveTo(NOZZLE_SIDE_R + 4, 0);
    sp.cubicTo(NOZZLE_SIDE_R + 6, flameH * 0.4, NOZZLE_SIDE_R + 2, flameH * 0.8, 2, flameH * 1.1);
    return sp;
  }, [flameH]);

  return (
    <Group>
      {/* Aletas */}
      <Path path={finL} color="#7A4A2A" />
      <Path path={finR} color="#7A4A2A" />
      {/* Sombra cuerpo */}
      <Path
        path={bodyPath}
        color="rgba(0,0,0,0.28)"
        transform={[{ translateX: 3 }, { translateY: 3 }]}
      />
      {/* Cuerpo base */}
      <Path path={bodyPath} color={p.rocketBody} />
      {/* Manchas de óxido */}
      {patchPaths.map((pp, i) => (
        <Path key={`patch_${i}`} path={pp} color={p.rocketPatch} opacity={0.85} />
      ))}
      {/* Remaches */}
      {[-12, -4, 4, 12, -8, 6].map((rx, ri) => (
        <Circle key={`rivet_${ri}`} cx={rx} cy={-20 - ri * 9} r={2.5} color="#888090" />
      ))}
      {/* Cabina con grieta */}
      <Circle cx={0} cy={CABIN_Y} r={CABIN_R} color={p.rocketGlass}>
        <RadialGradient c={vec(-3, CABIN_Y - 4)} r={CABIN_R} colors={['#B0C0D8', '#6070A0']} />
      </Circle>
      <Circle
        cx={0}
        cy={CABIN_Y}
        r={CABIN_R}
        color="transparent"
        style="stroke"
        strokeWidth={2}
        opacity={canTravel ? 0.6 : 0.3}
      />
      {/* Grieta del vidrio */}
      <Line
        p1={vec(-3, CABIN_Y - 6)}
        p2={vec(5, CABIN_Y + 3)}
        color="rgba(255,255,255,0.50)"
        strokeWidth={1.5}
      />
      <Line
        p1={vec(2, CABIN_Y + 0)}
        p2={vec(7, CABIN_Y + 6)}
        color="rgba(255,255,255,0.35)"
        strokeWidth={1}
      />
      {/* Reflejo cabina */}
      <Circle cx={-4} cy={CABIN_Y - 4} r={4} color="rgba(255,255,255,0.18)" />
      {/* Toberas */}
      <Circle cx={0} cy={2} r={NOZZLE_R} color="#665A50" />
      <Circle cx={-NOZZLE_SIDE_R * 2 - 3} cy={1} r={NOZZLE_SIDE_R} color="#665A50" />
      <Circle cx={NOZZLE_SIDE_R * 2 + 3} cy={1} r={NOZZLE_SIDE_R} color="#665A50" />
      {/* Llama con humo */}
      {canTravel && (
        <Group transform={flameTransform}>
          <Path path={flamePath}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, flameH)}
              colors={['#BB8A70', '#6644AA']}
            />
          </Path>
          <Path
            path={flameSidePath}
            color={p.rocketSmoke}
            style="stroke"
            strokeWidth={8}
            strokeCap="round"
          />
        </Group>
      )}
      {/* Candado si disabled */}
      {!canTravel && (
        <Group transform={[{ translateX: 0 }, { translateY: CABIN_Y }]}>
          <Path path={lockPath} color="#334" opacity={0.8} />
          <Path path={lockPath} color="rgba(255,255,255,0.20)" style="stroke" strokeWidth={1} />
        </Group>
      )}
    </Group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANTE SPROUT
// ─────────────────────────────────────────────────────────────────────────────
function SproutRocket({
  canTravel,
  flameScale,
}: {
  canTravel: boolean;
  flameScale: SharedValue<number>;
}) {
  const p = PAL.sprout;
  const bodyPath = useMemo(() => buildBodyPath(0), []);
  const finL = useMemo(() => buildFinLeft(0), []);
  const finR = useMemo(() => buildFinRight(0), []);
  const flamePath = useMemo(() => buildFlamePath(FLAME_H), []);
  const lockPath = useMemo(() => buildLockPath(), []);

  const flameTransform = useDerivedValue(() => [{ scaleY: flameScale.value }, { translateY: 2 }]);

  // Franja vertical central naranja
  const stripeW = 6;

  return (
    <Group>
      {/* Aletas verdes */}
      <Path path={finL} color={p.rocketFin} />
      <Path path={finR} color={p.rocketFin} />
      {/* Banderines verdes en aletas */}
      <Rect
        x={-BODY_W - FIN_W + 4}
        y={-FIN_H * 0.3}
        width={10}
        height={7}
        color={p.rocketFin}
        opacity={0.85}
      />
      <Rect
        x={BODY_W + FIN_W - 14}
        y={-FIN_H * 0.3}
        width={10}
        height={7}
        color={p.rocketFin}
        opacity={0.85}
      />
      {/* Sombra */}
      <Path
        path={bodyPath}
        color="rgba(0,0,0,0.18)"
        transform={[{ translateX: 3 }, { translateY: 3 }]}
      />
      {/* Cuerpo blanco/crema */}
      <Path path={bodyPath} color={p.rocketBody} />
      {/* Franja naranja vertical */}
      <Rect
        x={-stripeW / 2}
        y={-BODY_H + 10}
        width={stripeW}
        height={BODY_H - 12}
        color={p.rocketStripe}
        opacity={0.9}
      />
      {/* Cinturón de luz dorado (en el centro) */}
      <Rect
        x={-BODY_W}
        y={-BODY_H * 0.45}
        width={BODY_W * 2}
        height={4}
        color={p.rocketBand}
        opacity={0.8}
      />
      {/* Cabina cristalina */}
      <Circle cx={0} cy={CABIN_Y} r={CABIN_R} color={p.rocketGlass}>
        <RadialGradient c={vec(-3, CABIN_Y - 4)} r={CABIN_R} colors={['#E8F8FF', '#5AC8F0']} />
      </Circle>
      <Circle
        cx={0}
        cy={CABIN_Y}
        r={CABIN_R}
        color="transparent"
        style="stroke"
        strokeWidth={2}
        opacity={0.5}
      />
      <Circle cx={-4} cy={CABIN_Y - 4} r={4} color="rgba(255,255,255,0.35)" />
      {/* Antena con bola dorada */}
      <Line p1={vec(3, -BODY_H)} p2={vec(8, -BODY_H - 16)} color="#B0B8C8" strokeWidth={2} />
      <Circle cx={8} cy={-BODY_H - 18} r={4} color="#E8B84B" />
      <Circle cx={6} cy={-BODY_H - 20} r={1.5} color="rgba(255,255,255,0.45)" />
      {/* Toberas */}
      <Circle cx={0} cy={2} r={NOZZLE_R + 1} color="#C0B8A8" />
      <Circle cx={0} cy={2} r={NOZZLE_R} color="#9A9288" />
      <Circle cx={-NOZZLE_SIDE_R * 2 - 3} cy={1} r={NOZZLE_SIDE_R} color="#9A9288" />
      <Circle cx={NOZZLE_SIDE_R * 2 + 3} cy={1} r={NOZZLE_SIDE_R} color="#9A9288" />
      {/* Llama amarillo→naranja */}
      {canTravel && (
        <Group transform={flameTransform}>
          <Path path={flamePath}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, FLAME_H)}
              colors={['#FFEE44', '#FF6600']}
            />
          </Path>
          <Path path={buildFlamePath(FLAME_H * 0.6)}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, FLAME_H * 0.6)}
              colors={['#FFFFFF', '#FFCC00']}
            />
          </Path>
        </Group>
      )}
      {!canTravel && (
        <Group transform={[{ translateX: 0 }, { translateY: CABIN_Y }]}>
          <Path path={lockPath} color="#334" opacity={0.8} />
          <Path path={lockPath} color="rgba(255,255,255,0.20)" style="stroke" strokeWidth={1} />
        </Group>
      )}
    </Group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANTE METRO
// ─────────────────────────────────────────────────────────────────────────────
function MetroRocket({
  canTravel,
  flameScale,
}: {
  canTravel: boolean;
  flameScale: SharedValue<number>;
}) {
  const p = PAL.metro;
  const bodyPath = useMemo(() => buildBodyPath(0), []);
  const finL = useMemo(() => buildFinLeft(0), []);
  const finR = useMemo(() => buildFinRight(0), []);
  const flamePath = useMemo(() => buildFlamePath(FLAME_H), []);
  const flameMidPath = useMemo(() => buildFlamePath(FLAME_H * 0.65), []);
  const flameCorrPath = useMemo(() => buildFlamePath(FLAME_H * 0.35), []);
  const lockPath = useMemo(() => buildLockPath(), []);

  const flameTransform = useDerivedValue(() => [{ scaleY: flameScale.value }, { translateY: 2 }]);

  return (
    <Group>
      {/* Aletas con LED cyan */}
      <Path path={finL} color="#5C6268" />
      <Path
        path={finL}
        color="transparent"
        style="stroke"
        strokeWidth={2}
        opacity={canTravel ? 1 : 0.3}
      >
        <BlurMask blur={3} style="normal" />
      </Path>
      <Path path={finR} color="#5C6268" />
      <Path
        path={finR}
        color="transparent"
        style="stroke"
        strokeWidth={2}
        opacity={canTravel ? 1 : 0.3}
      >
        <BlurMask blur={3} style="normal" />
      </Path>

      {/* Sombra */}
      <Path
        path={bodyPath}
        color="rgba(0,0,0,0.32)"
        transform={[{ translateX: 4 }, { translateY: 4 }]}
      />
      {/* Cuerpo acero */}
      <Path path={bodyPath}>
        <LinearGradient
          start={vec(-BODY_W, -BODY_H)}
          end={vec(BODY_W, 0)}
          colors={['#9AA0AA', '#6A7078']}
        />
      </Path>
      {/* Acentos neón a los lados */}
      <Rect
        x={-BODY_W - 1}
        y={-BODY_H * 0.65}
        width={3}
        height={BODY_H * 0.5}
        color={p.neonCyan}
        opacity={canTravel ? 0.9 : 0.3}
      >
        <BlurMask blur={4} style="normal" />
      </Rect>
      <Rect
        x={BODY_W - 2}
        y={-BODY_H * 0.65}
        width={3}
        height={BODY_H * 0.5}
        color={p.neonPink}
        opacity={canTravel ? 0.9 : 0.3}
      >
        <BlurMask blur={4} style="normal" />
      </Rect>
      {/* Cabina doble: anillo exterior + cristal interior oscuro con HUD */}
      <Circle
        cx={0}
        cy={CABIN_Y}
        r={CABIN_R + 3}
        color="transparent"
        style="stroke"
        strokeWidth={2.5}
        opacity={canTravel ? 0.7 : 0.25}
      >
        <BlurMask blur={3} style="normal" />
      </Circle>
      <Circle cx={0} cy={CABIN_Y} r={CABIN_R} color={p.rocketGlass}>
        <RadialGradient c={vec(0, CABIN_Y)} r={CABIN_R} colors={['#002244', '#001030']} />
      </Circle>
      {/* HUD lines */}
      {[-4, 0, 4].map((ly, li) => (
        <Line
          key={`hud_${li}`}
          p1={vec(-6, CABIN_Y + ly)}
          p2={vec(6, CABIN_Y + ly)}
          color={p.neonCyan}
          strokeWidth={0.8}
          opacity={canTravel ? 0.6 : 0.2}
        />
      ))}
      <Circle cx={-4} cy={CABIN_Y - 4} r={3.5} color="rgba(0,229,255,0.20)" />
      {/* Toberas con anillo metálico */}
      <Circle cx={0} cy={2} r={NOZZLE_R + 2} color="#50585F" />
      <Circle cx={0} cy={2} r={NOZZLE_R} color="#30383F" />
      <Circle cx={0} cy={2} r={NOZZLE_R - 1} color="rgba(0,229,255,0.25)" />
      <Circle cx={-NOZZLE_SIDE_R * 2 - 3} cy={1} r={NOZZLE_SIDE_R + 1} color="#50585F" />
      <Circle cx={-NOZZLE_SIDE_R * 2 - 3} cy={1} r={NOZZLE_SIDE_R} color="#30383F" />
      <Circle cx={NOZZLE_SIDE_R * 2 + 3} cy={1} r={NOZZLE_SIDE_R + 1} color="#50585F" />
      <Circle cx={NOZZLE_SIDE_R * 2 + 3} cy={1} r={NOZZLE_SIDE_R} color="#30383F" />
      {/* Llama tricapa: exterior cyan, media magenta, núcleo blanco */}
      {canTravel && (
        <Group transform={flameTransform}>
          <Path path={flamePath}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, FLAME_H)}
              colors={['rgba(0,255,255,0.90)', 'transparent']}
            />
          </Path>
          <Path path={flamePath}>
            <BlurMask blur={6} style="normal" />
          </Path>
          <Path path={flameMidPath}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, FLAME_H * 0.65)}
              colors={['rgba(255,80,220,0.85)', 'transparent']}
            />
          </Path>
          <Path path={flameCorrPath}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, FLAME_H * 0.35)}
              colors={['#FFFFFF', 'rgba(200,255,255,0.60)']}
            />
          </Path>
        </Group>
      )}
      {!canTravel && (
        <Group transform={[{ translateX: 0 }, { translateY: CABIN_Y }]}>
          <Path path={lockPath} color="#334" opacity={0.8} />
          <Path path={lockPath} color="rgba(255,255,255,0.20)" style="stroke" strokeWidth={1} />
        </Group>
      )}
    </Group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export const ROCKET_HEIGHT = BODY_H + FLAME_H + 4; // Para cálculo de posición

export default function RocketSkia({
  variant,
  cx,
  baseY,
  canTravel,
  bobOffset,
  flameScale,
  reduceMotion,
}: RocketSkiaProps) {
  const rocketTransform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: baseY + (reduceMotion ? 0 : bobOffset.value) },
  ]);

  const opacity = canTravel ? 1 : 0.55;

  return (
    <Group transform={rocketTransform} opacity={opacity}>
      {variant === 'rocky' && <RockyRocket canTravel={canTravel} flameScale={flameScale} />}
      {variant === 'sprout' && <SproutRocket canTravel={canTravel} flameScale={flameScale} />}
      {variant === 'metro' && <MetroRocket canTravel={canTravel} flameScale={flameScale} />}
    </Group>
  );
}

// Exportamos dimensiones para que WorldRocket posicione el Pressable
export const ROCKET_DIMS = {
  width: (BODY_W + FIN_W) * 2 + 8,
  height: BODY_H + 8,
  bodyH: BODY_H,
};
