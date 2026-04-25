// components/world/WorldScene.tsx
// Distribución de edificios rediseñada para presentación: barrios, escala y profundidad

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeStore } from '@shared/store/useThemeStore';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import {
  createWorldMaterials,
  WorldMaterials,
  createTree,
  createHouse,
  createGrassPatch,
  createTallBuilding,
  createCafeteria,
  createBank,
  createPark,
  createLampPost,
  createKiosk,
  createCloud,
} from './BuildingFactory';

// ─── Constantes ──────────────────────────────────────────────────────────────
const SKY_BG_DARK  = new THREE.Color(0x08081A);
const SKY_BG_LIGHT = new THREE.Color(0xA3D1FF); // Un azul cielo claro premium
const PLANET_RADIUS = 3.5;

// ─── Helpers de deformación ──────────────────────────────────────────────────
function deformGeo(
  geo: THREE.BufferGeometry,
  amplitude: number,
  frequency: number,
  seed = 0
) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v   = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * frequency + seed) * 0.5 +
      Math.sin(v.y * frequency * 1.3 + seed) * 0.3 +
      Math.sin(v.z * frequency * 0.9 + seed) * 0.2;
    v.multiplyScalar(1 + n * amplitude);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
}

function rockMaterial(baseColor: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.95,
    metalness: 0.02,
    flatShading: true,
  });
}

function createCrater(
  radius: number,
  depth: number,
  wallColor: number,
  floorColor: number
): THREE.Group {
  const group  = new THREE.Group();
  const rimGeo = new THREE.TorusGeometry(radius * 0.9, radius * 0.18, 6, 12);
  deformGeo(rimGeo, 0.2, 3);
  const rim = new THREE.Mesh(rimGeo, rockMaterial(wallColor));
  rim.rotation.x = Math.PI / 2;
  rim.scale.z    = 0.4;
  group.add(rim);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.75, 8),
    rockMaterial(floorColor)
  );
  floor.position.z = -depth * 0.6;
  group.add(floor);
  return group;
}

// ─── Posicionador sobre la superficie del planeta ────────────────────────────
/**
 * Coloca `object` sobre la superficie esférica del planeta.
 * @param object   Objeto Three.js a posicionar
 * @param body     Mesh del planeta (para añadir como hijo)
 * @param phi      Ángulo azimutal  (0 → 2π)  — "longitud"
 * @param theta    Ángulo polar     (0 → π)    — "latitud": π/2 = ecuador
 * @param scale    Escala uniforme del objeto
 * @param radiusOffset Cuánto despegar de la superficie (default 0)
 */
function placeOnPlanet(
  object: THREE.Group,
  body: THREE.Mesh,
  phi: number,
  theta: number,
  scale = 1,
  radiusOffset = 0.02
) {
  const r = PLANET_RADIUS + radiusOffset;
  object.position.set(
    r * Math.sin(theta) * Math.cos(phi),
    r * Math.sin(theta) * Math.sin(phi),
    r * Math.cos(theta)
  );
  object.scale.setScalar(scale);
  // Orientar "up" del objeto hacia afuera del planeta
  object.lookAt(0, 0, 0);
  object.rotateX(-Math.PI / 2);
  body.add(object);
}

// ─── Construcción del mundo ───────────────────────────────────────────────────
function buildWorld(m: WorldMaterials): THREE.Group {
  const worldGroup  = new THREE.Group();
  const asteroidGrp = new THREE.Group();

  // ── Planeta base ──
  const geo = new THREE.IcosahedronGeometry(PLANET_RADIUS, 4);
  geo.scale(1.08, 0.95, 1.0);
  deformGeo(geo, 0.08, 2.5, 0);
  deformGeo(geo, 0.04, 5.0, 42);
  deformGeo(geo, 0.02, 10.0, 99);
  const body = new THREE.Mesh(geo, m.asteroid);
  asteroidGrp.add(body);

  // ── Cráteres decorativos ──
  const craterDefs = [
    { phi: 0.8,  theta: 1.1, r: 0.6 },
    { phi: 2.5,  theta: 0.9, r: 0.5 },
    { phi: 4.2,  theta: 1.6, r: 0.4 },
    { phi: 5.5,  theta: 2.2, r: 0.35 },
  ];
  craterDefs.forEach(({ phi, theta, r }) => {
    const crater = createCrater(r, 0.1, 0x5a5448, 0x2a2820);
    const dir    = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta)
    );
    crater.position
      .copy(dir.multiply(new THREE.Vector3(1.08, 0.95, 1.0)).normalize())
      .multiplyScalar(PLANET_RADIUS);
    crater.lookAt(0, 0, 0);
    crater.rotateX(Math.PI);
    body.add(crater);
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  DISTRIBUCIÓN DE EDIFICIOS
  //  Estrategia: 4 "barrios" en distintas latitudes + longitudes bien separadas
  //  para que al girar el planeta siempre haya algo interesante a la vista.
  //
  //  Sistema de coordenadas:
  //    phi   (0 → 2π)  = longitud
  //    theta (0 → π)   = latitud polar  (π/2 = ecuador, 0/π = polos)
  //
  //  Barrios:
  //   A – Centro Financiero   theta ≈ 1.15  (ligeramente sobre ecuador)
  //   B – Barrio Residencial  theta ≈ 1.45  (bajo, zona templada)
  //   C – Plaza / Parque      theta ≈ 0.85  (alto, zona fresca)
  //   D – Zona Comercial      theta ≈ 1.65  (sur, zona cálida)
  // ══════════════════════════════════════════════════════════════════════════

  const TAU = Math.PI * 2;

  // ── BARRIO A: Centro Financiero ──────────────────────────────────────────
  // Banco grandioso al centro, rascacielos flanqueantes, farolas y kiosco
  {
    const centerPhi   = 0.0;
    const centerTheta = 1.1;

    // Banco — protagonista, escala grande
    placeOnPlanet(createBank(m), body, centerPhi, centerTheta, 0.85);

    // Rascacielos izquierdo
    placeOnPlanet(
      createTallBuilding(m), body,
      centerPhi - 0.38, centerTheta + 0.08,
      0.65
    );
    // Rascacielos derecho
    placeOnPlanet(
      createTallBuilding(m), body,
      centerPhi + 0.38, centerTheta - 0.06,
      0.58
    );

    // Rascacielos pequeño de fondo
    placeOnPlanet(
      createTallBuilding(m), body,
      centerPhi + 0.1, centerTheta - 0.28,
      0.42
    );

    // Farolas flanqueando el banco
    [-0.2, 0.2].forEach((dphi) => {
      placeOnPlanet(createLampPost(m), body, centerPhi + dphi, centerTheta + 0.22, 0.7);
    });

    // Kiosco esquina
    placeOnPlanet(createKiosk(m), body, centerPhi + 0.55, centerTheta + 0.18, 0.6);

    // Césped alrededor
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * TAU + centerPhi;
      placeOnPlanet(
        createGrassPatch(m), body,
        angle, centerTheta + 0.35,
        0.6
      );
    }
  }

  // ── BARRIO B: Barrio Residencial ─────────────────────────────────────────
  // 3 casas de distintos tamaños, jardines y árboles
  {
    const centerPhi   = TAU * 0.38;
    const centerTheta = 1.42;

    // Casa principal (grande)
    placeOnPlanet(createHouse(m), body, centerPhi, centerTheta, 0.75);

    // Casa mediana a la derecha
    placeOnPlanet(createHouse(m), body, centerPhi + 0.42, centerTheta - 0.1, 0.62);

    // Casa pequeña fondo izquierdo
    placeOnPlanet(createHouse(m), body, centerPhi - 0.35, centerTheta - 0.18, 0.5);

    // Árboles dispersos entre casas
    const treePositions = [
      [centerPhi + 0.22, centerTheta + 0.28],
      [centerPhi - 0.2,  centerTheta + 0.22],
      [centerPhi + 0.6,  centerTheta + 0.2 ],
      [centerPhi - 0.55, centerTheta - 0.05],
      [centerPhi + 0.18, centerTheta - 0.35],
    ] as [number, number][];

    treePositions.forEach(([phi, theta]) => {
      const treeScale = 0.45 + Math.random() * 0.25;
      placeOnPlanet(createTree(m), body, phi, theta, treeScale);
    });

    // Farola frente a cada casa
    [centerPhi - 0.15, centerPhi + 0.25].forEach((phi) => {
      placeOnPlanet(createLampPost(m), body, phi, centerTheta + 0.35, 0.55);
    });

    // Parches de césped abundantes
    for (let i = 0; i < 7; i++) {
      placeOnPlanet(
        createGrassPatch(m), body,
        centerPhi + (Math.random() - 0.5) * 0.9,
        centerTheta + (Math.random() - 0.5) * 0.55,
        0.5 + Math.random() * 0.3
      );
    }
  }

  // ── BARRIO C: Plaza Cívica / Parque ──────────────────────────────────────
  // Parque central con fuente, cafetería y ambiente de ocio
  {
    const centerPhi   = TAU * 0.62;
    const centerTheta = 0.82;

    // Parque — centrado y escala generosa
    placeOnPlanet(createPark(m), body, centerPhi, centerTheta, 0.9);

    // Cafetería adyacente
    placeOnPlanet(createCafeteria(m), body, centerPhi + 0.45, centerTheta + 0.1, 0.72);

    // Kiosco al otro lado del parque
    placeOnPlanet(createKiosk(m), body, centerPhi - 0.4, centerTheta - 0.05, 0.65);

    // Corona de árboles alrededor del parque
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * TAU + centerPhi;
      const dist  = 0.55 + (i % 2) * 0.08;
      placeOnPlanet(
        createTree(m), body,
        angle, centerTheta + dist * Math.sin((i * TAU) / 6 + 0.5),
        0.5 + (i % 3) * 0.12
      );
    }

    // Farolas bordeando el parque (4 esquinas)
    [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.25], [-0.3, -0.25]].forEach(([dp, dt]) => {
      placeOnPlanet(createLampPost(m), body, centerPhi + dp, centerTheta + dt, 0.6);
    });

    // Césped alrededor
    for (let i = 0; i < 5; i++) {
      placeOnPlanet(
        createGrassPatch(m), body,
        centerPhi + (Math.random() - 0.5) * 0.7,
        centerTheta + (Math.random() - 0.5) * 0.5,
        0.55
      );
    }
  }

  // ── BARRIO D: Zona Comercial ─────────────────────────────────────────────
  // Segunda cafetería, kiosco, casa-tienda, muchos árboles
  {
    const centerPhi   = TAU * 0.82;
    const centerTheta = 1.62;

    placeOnPlanet(createCafeteria(m), body, centerPhi, centerTheta, 0.68);
    placeOnPlanet(createHouse(m), body, centerPhi - 0.4, centerTheta - 0.15, 0.55);
    placeOnPlanet(createKiosk(m), body, centerPhi + 0.35, centerTheta + 0.08, 0.6);

    for (let i = 0; i < 4; i++) {
      placeOnPlanet(
        createTree(m), body,
        centerPhi + (i - 1.5) * 0.28,
        centerTheta + 0.32,
        0.4 + i * 0.08
      );
    }

    placeOnPlanet(createLampPost(m), body, centerPhi + 0.18, centerTheta - 0.3, 0.55);

    for (let i = 0; i < 4; i++) {
      placeOnPlanet(
        createGrassPatch(m), body,
        centerPhi + (Math.random() - 0.5) * 0.6,
        centerTheta + (Math.random() - 0.5) * 0.45,
        0.5
      );
    }
  }

  worldGroup.add(asteroidGrp);
  return worldGroup;
}

// ─── Componente ──────────────────────────────────────────────────────────────
export default function WorldScene() {
  const sceneRef    = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const cameraRef   = useRef<THREE.OrthographicCamera | null>(null);
  const worldRef    = useRef<THREE.Group | null>(null);

  const timeRef = useRef(0);
  const rafRef  = useRef<number>(0);

  const dustRef      = useRef<THREE.Points | null>(null);
  const asteroidsRef = useRef<THREE.Mesh[]>([]);
  const cloudsRef    = useRef<THREE.Group[]>([]);
  const shootingStarsRef = useRef<THREE.Group[]>([]);
  const twinklingStarsRef = useRef<THREE.Points | null>(null);

  const [isReady, setIsReady] = useState(false);

  // Inercia de rotación
  const rotY = useRef(0);
  const rotX = useRef(0.35);
  const velX = useRef(0);
  const velY = useRef(0);

  const gesture = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((e) => {
      velY.current = e.velocityX / 15000;
      velX.current = e.velocityY / 15000;
    });

  // ── GL Context ────────────────────────────────────────────────────────────
  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    const mode = useThemeStore.getState().mode;
    const initialSkyColor = mode === 'light' ? SKY_BG_LIGHT : SKY_BG_DARK;

    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(initialSkyColor);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const camera = new THREE.OrthographicCamera(
      -12 * aspect, 12 * aspect, 12, -12, 0.1, 1000
    );
    camera.position.set(0, 6, 22);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Iluminación cinematográfica: luz principal + relleno suave + rim light
    scene.add(new THREE.AmbientLight(0xB0C4DE, 0.55));

    const sunLight = new THREE.DirectionalLight(0xFFF8E0, 1.4);
    sunLight.position.set(12, 10, 8);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x4466AA, 0.4);
    rimLight.position.set(-10, -5, -8);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x88AACC, 0.25);
    fillLight.position.set(-8, 8, 0);
    scene.add(fillLight);

    // Mundo
    const m     = createWorldMaterials();
    const world = buildWorld(m);
    worldRef.current = world;
    scene.add(world);

    // Niebla espacial suave
    scene.fog = new THREE.FogExp2(0x08081A, 0.012);

    // Polvo / partículas espaciales
    const dustVerts: number[] = [];
    for (let i = 0; i < 60; i++) {
      dustVerts.push(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        Math.random() * 20 + 5
      );
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustVerts, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xCCDDFF,
      size: 0.12,
      transparent: true,
      opacity: 0.35,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);
    dustRef.current = dust;

    // Asteroides de fondo (instanciados, geometría compartida)
    const sharedAstGeo = new THREE.IcosahedronGeometry(0.18, 0);
    const sharedAstMat = new THREE.MeshStandardMaterial({
      color: 0x8B7D6B,
      flatShading: true,
    });
    for (let i = 0; i < 6; i++) {
      const ast = new THREE.Mesh(sharedAstGeo, sharedAstMat);
      const sc  = 0.4 + Math.random() * 1.1;
      ast.scale.setScalar(sc);
      ast.position.set(
        (Math.random() - 0.5) * 55,
        (Math.random() - 0.5) * 35,
        Math.random() * 8 + 8
      );
      ast.userData = {
        velX: (Math.random() - 0.5) * 0.04,
        velY: (Math.random() - 0.5) * 0.02,
        rotX: Math.random() * 0.04,
        rotY: Math.random() * 0.04,
      };
      scene.add(ast);
      asteroidsRef.current.push(ast);
    }

    // ─── ESTRELLAS DE FONDO MEJORADAS ──────────────────────────────────────────
    const starLayers = [
      { count: 400, size: 0.05, opacity: 0.3, color: 0xAAAAAA }, // Fondo tenue
      { count: 150, size: 0.12, opacity: 0.7, color: 0xFFFFFF }, // Estrellas normales
      { count: 40,  size: 0.25, opacity: 0.9, color: 0xFFF9C4 }, // Estrellas brillantes
    ];

    starLayers.forEach((layer) => {
      const starGeo = new THREE.BufferGeometry();
      const starVerts = [];
      for (let i = 0; i < layer.count; i++) {
        // Posicionar en una esfera gigante lejana
        const r = 80 + Math.random() * 20;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starVerts.push(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        );
      }
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
      const starMat = new THREE.PointsMaterial({
        color: layer.color,
        size: layer.size,
        transparent: true,
        opacity: layer.opacity,
        sizeAttenuation: true,
      });
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);
      
      // La capa más brillante parpadeará
      if (layer.size > 0.2) {
        twinklingStarsRef.current = stars;
      }
    });

    // ─── ESTRELLAS FUGACES ──────────────────────────────────────────────────────
    const shootingStarMat = new THREE.LineBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0,
    });
    for (let i = 0; i < 3; i++) {
      const starGrp = new THREE.Group();
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-1.5, 0, 0),
      ]);
      const line = new THREE.Line(lineGeo, shootingStarMat.clone());
      starGrp.add(line);
      
      // Datos de animación
      starGrp.userData = {
        active: false,
        timer: Math.random() * 500,
        speed: 0.4 + Math.random() * 0.4,
      };
      
      scene.add(starGrp);
      shootingStarsRef.current.push(starGrp);
    }

    // ─── NUBES ORBITANDO ────────────────────────────────────────────────────────
    for (let i = 0; i < 5; i++) {
      const cloud = createCloud();
      const radius = PLANET_RADIUS + 1.2 + Math.random() * 0.8;
      const angle = (i / 5) * Math.PI * 2;
      cloud.position.set(radius * Math.cos(angle), radius * Math.sin(angle), 0);
      cloud.userData = {
        angle,
        radius,
        speed: 0.002 + Math.random() * 0.003,
        yOffset: (Math.random() - 0.5) * 2,
      };
      scene.add(cloud);
      cloudsRef.current.push(cloud);
    }

    setIsReady(true);

    // ── Loop de animación ──────────────────────────────────────────────────
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      timeRef.current += 0.01;

      // Actualizar color de fondo según el tema
      const currentMode = useThemeStore.getState().mode;
      const targetSkyColor = currentMode === 'light' ? SKY_BG_LIGHT : SKY_BG_DARK;
      if (rendererRef.current) {
        rendererRef.current.setClearColor(targetSkyColor);
      }

      // Rotación con inercia
      rotY.current += velY.current;
      rotX.current += velX.current;
      velX.current *= 0.9;
      velY.current *= 0.9;

      // Rotación automática muy suave cuando no hay interacción
      if (Math.abs(velX.current) < 0.0001 && Math.abs(velY.current) < 0.0001) {
        rotY.current += 0.0012;
      }

      if (worldRef.current) {
        worldRef.current.rotation.set(rotX.current, rotY.current, 0);
      }

      // Animación polvo
      if (dustRef.current) {
        dustRef.current.rotation.y  = timeRef.current * 0.04;
        dustRef.current.position.y  = Math.sin(timeRef.current * 0.15) * 0.4;
      }

      // Asteroides de fondo
      asteroidsRef.current.forEach((ast) => {
        ast.position.x += ast.userData.velX;
        ast.position.y += ast.userData.velY;
        ast.rotation.x += ast.userData.rotX;
        ast.rotation.y += ast.userData.rotY;
        if (Math.abs(ast.position.x) > 45) ast.userData.velX *= -1;
        if (Math.abs(ast.position.y) > 28) ast.userData.velY *= -1;
      });

      // Animación de Nubes
      cloudsRef.current.forEach((cloud) => {
        cloud.userData.angle += cloud.userData.speed;
        cloud.position.x = cloud.userData.radius * Math.cos(cloud.userData.angle);
        cloud.position.z = cloud.userData.radius * Math.sin(cloud.userData.angle);
        cloud.position.y = cloud.userData.yOffset + Math.sin(timeRef.current * 0.5) * 0.2;
        cloud.rotation.y = -cloud.userData.angle + Math.PI / 2;
      });

      // Animación de Estrellas Fugaces
      shootingStarsRef.current.forEach((star) => {
        if (!star.userData.active) {
          star.userData.timer--;
          if (star.userData.timer <= 0) {
            star.userData.active = true;
            // Reiniciar posición aleatoria al azar
            star.position.set(
              (Math.random() - 0.5) * 40,
              10 + Math.random() * 10,
              -10 - Math.random() * 10
            );
            star.rotation.z = -Math.PI / 4 + (Math.random() - 0.5) * 0.5;
            const line = star.children[0] as THREE.Line;
            (line.material as THREE.LineBasicMaterial).opacity = 0.8;
          }
        } else {
          star.position.x += star.userData.speed;
          star.position.y -= star.userData.speed * 0.8;
          const line = star.children[0] as THREE.Line;
          (line.material as THREE.LineBasicMaterial).opacity *= 0.96;
          
          if ((line.material as THREE.LineBasicMaterial).opacity < 0.01) {
            star.userData.active = false;
            star.userData.timer = 200 + Math.random() * 600;
          }
        }
      });
      
      // Efecto Twinkle en estrellas brillantes
      if (twinklingStarsRef.current) {
        (twinklingStarsRef.current.material as THREE.PointsMaterial).opacity = 
          0.6 + Math.sin(timeRef.current * 4) * 0.4;
      }


      try {
        renderer.render(scene, camera);
        gl.endFrameEXP();
      } catch (e) {
        console.warn('GL Render Error:', e);
      }
    };
    animate();
  }, []);

  // ── Limpieza ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      sceneRef.current?.traverse((obj: any) => {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat: any) => mat.dispose());
        } else {
          obj.material?.dispose();
        }
      });
      rendererRef.current?.dispose();
    };
  }, []);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <GLView style={styles.glView} onContextCreate={onContextCreate} />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glView:    { flex: 1 },
});