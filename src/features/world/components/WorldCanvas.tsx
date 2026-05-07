// WorldCanvas.tsx — Canvas Skia principal: cosmos → isla → terrenos → cohete → interacciones → partículas
import React, { useEffect, useMemo, memo, forwardRef, useImperativeHandle } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Fill,
  Group,
  LinearGradient,
  RadialGradient,
  Path,
  Rect,
  Oval,
  BlurMask,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  useDerivedValue,
} from 'react-native-reanimated';

import { PAL } from './world/palette';
import {
  buildIslandSilhouette,
  buildRockFacets,
  buildSurface,
  buildRimGlow,
  buildMesas,
  buildSideRocks,
  buildFloatingChunks,
  prng,
} from './world/islandPath';
import { RockyTerrain, SproutTerrain, MetroTerrain } from './world/terrains';
import RocketSkia, { ROCKET_DIMS } from './world/rocketSkia';
import { computeRocketPadZone } from './world/rocketPadZone';
import type { WorldId } from '../data/worlds';
import { WORLDS } from '../data/worlds';

const { width: W, height: H } = Dimensions.get('window');

// ── Datos de estrella ─────────────────────────────────────────────────────────
interface StarDef {
  x: number;
  y: number;
  r: number;
  delay: number;
  base: number;
  layer: number;
}

function buildStars(count: number, seed: number): StarDef[] {
  return Array.from({ length: count }, (_, i) => ({
    x: prng(i * 7.7 + seed) * W,
    y: prng(i * 3.1 + seed + 1) * H * 0.72,
    r: 0.5 + prng(i * 5.3 + seed + 2) * 2.0,
    delay: Math.round(prng(i * 11.1 + seed + 3) * 3500),
    base: 0.22 + prng(i * 9.9 + seed + 4) * 0.78,
    layer: Math.floor(prng(i * 13 + seed + 5) * 3),
  }));
}

const ROCKY_STARS = buildStars(45, 0);
const SPROUT_STARS = buildStars(12, 100);
const METRO_STARS = buildStars(65, 200);

// ── TwinkleStar con parallax ─────────────────────────────────────────────────
function TwinkleStar({
  def,
  reduceMotion,
  parallaxOffset,
}: {
  def: StarDef;
  reduceMotion: boolean;
  parallaxOffset: ReturnType<typeof useSharedValue<number>>;
}) {
  const opacity = useSharedValue(def.base);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = def.base;
      return;
    }
    opacity.value = withDelay(
      def.delay,
      withRepeat(
        withSequence(
          withTiming(def.base * 0.08, { duration: 600 + (def.delay % 500) }),
          withTiming(def.base, { duration: 700 + (def.delay % 400) })
        ),
        -1,
        true
      )
    );
  }, [reduceMotion]);

  // Parallax por layer: layer 0 = movimiento lento, layer 2 = rápido
  const speed = [0.15, 0.35, 0.65][def.layer];
  const transform = useDerivedValue(() => [{ translateX: parallaxOffset.value * speed }]);

  return (
    <Circle cx={def.x} cy={def.y} r={def.r} color="white" opacity={opacity} transform={transform} />
  );
}

// ── Configuración por mundo ───────────────────────────────────────────────────
const WORLD_CONFIG = {
  rocky: { widthFactor: 0.7, domeH: 60, stalH: 110, stalCount: 7, seed: 42 },
  sprout: { widthFactor: 0.8, domeH: 80, stalH: 130, stalCount: 8, seed: 77 },
  metro: { widthFactor: 0.88, domeH: 95, stalH: 150, stalCount: 9, seed: 113 },
} as const;

// ── Ref handle (expone SharedValues de animación del cohete) ─────────────────
export interface WorldCanvasHandle {
  bobOffset: ReturnType<typeof useSharedValue<number>>;
  flameScale: ReturnType<typeof useSharedValue<number>>;
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface WorldCanvasProps {
  worldId: WorldId;
  canTravel: boolean;
  reduceMotion: boolean;
}

const WorldCanvas = memo(
  forwardRef<WorldCanvasHandle, WorldCanvasProps>(function WorldCanvas(
    { worldId, canTravel, reduceMotion },
    ref
  ) {
    const cfg = WORLD_CONFIG[worldId];
    const pal = PAL[worldId];
    const world = WORLDS[worldId];

    // Posición de la isla
    const islandCX = W / 2;
    const islandCY = H * 0.48;
    const islandW = W * cfg.widthFactor;

    // ── Animaciones del cosmos ──
    const parallaxX = useSharedValue(0);
    const nebulaShift = useSharedValue(0);
    const asteroideX = useSharedValue(-120);

    // ── Animaciones del cohete ──
    const bobOffset = useSharedValue(0);
    const flameScale = useSharedValue(1);

    useImperativeHandle(ref, () => ({ bobOffset, flameScale }), [bobOffset, flameScale]);

    useEffect(() => {
      if (reduceMotion) {
        parallaxX.value = 0;
        nebulaShift.value = 0;
        asteroideX.value = W + 200;
        bobOffset.value = 0;
        flameScale.value = 1;
        return;
      }
      // Parallax lento de fondo (oscila ±8px en 12s)
      parallaxX.value = withRepeat(
        withSequence(withTiming(8, { duration: 12000 }), withTiming(-8, { duration: 12000 })),
        -1,
        true
      );
      // Nebulosas que se desplazan lentamente
      nebulaShift.value = withRepeat(
        withSequence(withTiming(6, { duration: 9000 }), withTiming(-6, { duration: 9000 })),
        -1,
        true
      );
      // Asteroide (solo Rocky)
      if (worldId === 'rocky') {
        asteroideX.value = withRepeat(withTiming(W + 120, { duration: 18000 }), -1, false);
      }
      // Cohete bobbing
      bobOffset.value = withRepeat(
        withSequence(withTiming(-9, { duration: 900 }), withTiming(0, { duration: 900 })),
        -1,
        true
      );
      // Llama del cohete
      flameScale.value = withRepeat(
        withSequence(withTiming(1.35, { duration: 380 }), withTiming(0.82, { duration: 380 })),
        -1,
        true
      );
    }, [reduceMotion, worldId]);

    // Nebulosas con desplazamiento
    const neb1T = useDerivedValue(() => [
      { translateX: nebulaShift.value * 0.8 },
      { translateY: nebulaShift.value * 0.5 },
    ]);
    const neb2T = useDerivedValue(() => [
      { translateX: -nebulaShift.value * 0.6 },
      { translateY: nebulaShift.value * 0.3 },
    ]);
    const asteroideT = useDerivedValue(() => [{ translateX: asteroideX.value }]);

    // ── Geometría de isla (memoized) ──
    const islandCfg = useMemo(
      () => ({
        cx: islandCX,
        cy: islandCY,
        islandW,
        domeH: cfg.domeH,
        stalH: cfg.stalH,
        stalCount: cfg.stalCount,
        seed: cfg.seed,
      }),
      [islandCX, islandCY, islandW, cfg.domeH, cfg.stalH, cfg.stalCount, cfg.seed]
    );

    // Zona de despeje del cohete (todas las decoraciones la respetan)
    const rocketZone = useMemo(
      () => computeRocketPadZone(islandCX, islandCY, islandW, worldId),
      [islandCX, islandCY, islandW, worldId]
    );

    const silhouette = useMemo(() => buildIslandSilhouette(islandCfg), [islandCfg]);
    const facetPaths = useMemo(() => buildRockFacets(islandCfg), [islandCfg]);
    const surfacePath = useMemo(() => buildSurface(islandCfg), [islandCfg]);
    const rimGlowPath = useMemo(() => buildRimGlow(islandCfg), [islandCfg]);
    const mesas = useMemo(() => buildMesas(islandCfg, rocketZone), [islandCfg, rocketZone]);
    const sideRocks = useMemo(() => buildSideRocks(islandCfg, rocketZone), [islandCfg, rocketZone]);
    const floatingChunks = useMemo(() => buildFloatingChunks(islandCfg), [islandCfg]);

    // Colores de isla
    const islandColors = [pal.islandTop, pal.islandMid, pal.islandBot] as [string, string, string];

    // Sombra doble
    const shadowCY = islandCY + cfg.stalH + 18;
    const shadowW = islandW * 0.72;

    // Posición del cohete (margen extra + rocketYOffset negativo = más separado del suelo y vecinos)
    const rocketX = islandCX + (world.sprites.rocketX - 0.5) * islandW;
    const rocketBaseY = islandCY - ROCKET_DIMS.bodyH - 18 + world.sprites.rocketYOffset;

    // Stars
    const stars =
      worldId === 'rocky' ? ROCKY_STARS : worldId === 'sprout' ? SPROUT_STARS : METRO_STARS;

    return (
      <Canvas style={styles.canvas}>
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 1. FONDO CIELO                                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Rect x={0} y={0} width={W} height={H}>
          <LinearGradient start={vec(0, 0)} end={vec(0, H)} colors={[pal.skyTop, pal.skyBottom]} />
        </Rect>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 2. NEBULOSAS (doble por mundo, se desplazan) */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Group transform={neb1T}>
          <Circle cx={W * 0.22} cy={H * 0.2} r={170}>
            <RadialGradient
              c={vec(W * 0.22, H * 0.2)}
              r={170}
              colors={[pal.nebulaA, 'transparent']}
            />
          </Circle>
        </Group>
        <Group transform={neb2T}>
          <Circle cx={W * 0.78} cy={H * 0.32} r={120}>
            <RadialGradient
              c={vec(W * 0.78, H * 0.32)}
              r={120}
              colors={[pal.nebulaB, 'transparent']}
            />
          </Circle>
          <Circle cx={W * 0.55} cy={H * 0.55} r={90}>
            <RadialGradient
              c={vec(W * 0.55, H * 0.55)}
              r={90}
              colors={[pal.nebulaA, 'transparent']}
            />
          </Circle>
        </Group>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 3. ESTRELLAS CON PARALLAX (3 capas)                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {stars.map((def, i) => (
          <TwinkleStar
            key={`star_${i}`}
            def={def}
            reduceMotion={reduceMotion}
            parallaxOffset={parallaxX}
          />
        ))}

        {/* Asteroide tenue (Rocky) */}
        {worldId === 'rocky' && (
          <Group transform={asteroideT}>
            <Circle cx={0} cy={H * 0.28} r={8} color="#8A8070" opacity={0.55} />
            <Circle cx={3} cy={H * 0.28 - 3} r={4} color="#5A5048" opacity={0.55} />
            <Circle cx={-3} cy={H * 0.28 + 2} r={3} color="#AAA090" opacity={0.25} />
          </Group>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 4. HALO RADIAL ALREDEDOR DE LA ISLA                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Circle cx={islandCX} cy={islandCY + cfg.stalH / 2} r={islandW * 0.65}>
          <RadialGradient
            c={vec(islandCX, islandCY + cfg.stalH / 2)}
            r={islandW * 0.65}
            colors={[pal.rimGlow, 'transparent']}
          />
        </Circle>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 5. TROZOS FLOTANTES (atrás, con sombra propia)              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {floatingChunks.map((c, i) => (
          <Group key={`chunk_${i}`}>
            <Path
              path={c.path}
              color={pal.shadowColor}
              opacity={0.3}
              transform={[{ translateX: 4 }, { translateY: 6 }]}
            >
              <BlurMask blur={6} style="normal" />
            </Path>
            <Path path={c.path}>
              <LinearGradient
                start={vec(c.cx, c.cy - c.h * 0.6)}
                end={vec(c.cx, c.cy + c.h * 0.8)}
                colors={[pal.islandMid, pal.islandBot]}
              />
            </Path>
            <Path
              path={c.path}
              color={pal.surfaceColor}
              opacity={0.55}
              transform={[{ translateY: -1 }]}
              style="stroke"
              strokeWidth={1.5}
            />
          </Group>
        ))}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 6. SOMBRA TEÑIDA DE ISLA (doble oval)                      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Oval
          rect={{ x: islandCX - shadowW / 2, y: shadowCY, width: shadowW, height: 22 }}
          color={pal.shadowColor}
          opacity={0.55}
        >
          <BlurMask blur={12} style="normal" />
        </Oval>
        <Oval
          rect={{ x: islandCX - shadowW * 0.4, y: shadowCY + 8, width: shadowW * 0.8, height: 12 }}
          color={pal.shadowColor}
          opacity={0.35}
        />

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 7. ROCAS LATERALES (detrás de la silueta principal)         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {sideRocks.map((r, i) => (
          <Group key={`sr_${i}`}>
            <Path
              path={r.path}
              color={pal.shadowColor}
              opacity={0.35}
              transform={[{ translateX: 2 }, { translateY: 3 }]}
            />
            <Path path={r.path} color={pal.islandMid} />
            <Path path={r.path} color="rgba(255,255,255,0.10)" style="stroke" strokeWidth={1} />
          </Group>
        ))}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 8. SILHOUETTE DE ISLA                                       */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Path path={silhouette}>
          <LinearGradient
            start={vec(islandCX, islandCY - cfg.domeH)}
            end={vec(islandCX, islandCY + cfg.stalH)}
            colors={islandColors}
          />
        </Path>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 9. FACETAS ROCOSAS (líneas de fractura, opacidad baja)      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {facetPaths.map((fp, i) => (
          <Path
            key={`facet_${i}`}
            path={fp}
            color={pal.islandFacet}
            style="stroke"
            strokeWidth={1.5}
            opacity={0.45}
          />
        ))}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 10. SUPERFICIE DEL BIOMA (ribbon que sigue el top)          */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Path path={surfacePath} color={pal.surfaceColor} />
        <Path path={surfacePath} color={pal.highlight} opacity={0.8} />

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 11. MESETAS                                                 */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {mesas.map((mesa, i) => (
          <Path key={`mesa_${i}`} path={mesa.path} color={pal.surfaceColor} opacity={0.75} />
        ))}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 12. RIM GLOW (borde superior brillante)                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Path path={rimGlowPath} color={pal.accent} style="stroke" strokeWidth={3} opacity={0.5}>
          <BlurMask blur={5} style="normal" />
        </Path>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 13. DECORACIONES DE BIOMA                                   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {worldId === 'rocky' && (
          <RockyTerrain
            cx={islandCX}
            cy={islandCY}
            islandW={islandW}
            reduceMotion={reduceMotion}
            rocketZone={rocketZone}
          />
        )}
        {worldId === 'sprout' && (
          <SproutTerrain
            cx={islandCX}
            cy={islandCY}
            islandW={islandW}
            reduceMotion={reduceMotion}
            rocketZone={rocketZone}
          />
        )}
        {worldId === 'metro' && (
          <MetroTerrain
            cx={islandCX}
            cy={islandCY}
            islandW={islandW}
            reduceMotion={reduceMotion}
            rocketZone={rocketZone}
          />
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 14. COHETE (capa final, encima de la decoración)            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <RocketSkia
          variant={worldId}
          cx={rocketX}
          baseY={rocketBaseY}
          canTravel={canTravel}
          bobOffset={bobOffset}
          flameScale={flameScale}
          reduceMotion={reduceMotion}
        />
      </Canvas>
    );
  })
);

const styles = StyleSheet.create({
  canvas: { ...StyleSheet.absoluteFillObject },
});

export default WorldCanvas;

// ── Exportar posición de isla (usada por WorldRocket e WorldInteractions) ─────
export function getIslandLayout(worldId: WorldId) {
  const cfg = WORLD_CONFIG[worldId];
  return {
    cx: W / 2,
    cy: H * 0.48,
    islandW: W * cfg.widthFactor,
    domeH: cfg.domeH,
  };
}
