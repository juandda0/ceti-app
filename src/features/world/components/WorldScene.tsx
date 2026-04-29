// components/world/WorldScene.tsx
// Distribución de edificios rediseñada para presentación: barrios, escala y profundidad

import { useRef, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
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
const SKY_BG_LIGHT = new THREE.Color(0xA3D1FF); 
const PLANET_RADIUS = 3.5;

// ─── Helpers de deformación ──────────────────────────────────────────────────
function deformGeo(geo: THREE.BufferGeometry, amplitude: number, frequency: number, seed = 0) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v   = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * frequency + seed) * 0.5 + Math.sin(v.y * frequency * 1.3 + seed) * 0.3 + Math.sin(v.z * frequency * 0.9 + seed) * 0.2;
    v.multiplyScalar(1 + n * amplitude);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
}

function rockMaterial(baseColor: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.95, metalness: 0.02, flatShading: true });
}

function createCrater(radius: number, depth: number, wallColor: number, floorColor: number): THREE.Group {
  const group  = new THREE.Group();
  const rimGeo = new THREE.TorusGeometry(radius * 0.9, radius * 0.18, 6, 12);
  deformGeo(rimGeo, 0.2, 3);
  const rim = new THREE.Mesh(rimGeo, rockMaterial(wallColor));
  rim.rotation.x = Math.PI / 2;
  rim.scale.z    = 0.4;
  group.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.75, 8), rockMaterial(floorColor));
  floor.position.z = -depth * 0.6;
  group.add(floor);
  return group;
}

function placeOnPlanet(object: THREE.Group, body: THREE.Mesh, phi: number, theta: number, scale = 1, radiusOffset = 0.02) {
  const r = PLANET_RADIUS + radiusOffset;
  object.position.set(r * Math.sin(theta) * Math.cos(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta));
  object.scale.setScalar(scale);
  object.lookAt(0, 0, 0);
  object.rotateX(-Math.PI / 2);
  body.add(object);
}

function buildWorld(m: WorldMaterials): THREE.Group {
  const worldGroup  = new THREE.Group();
  const asteroidGrp = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(PLANET_RADIUS, 4);
  geo.scale(1.08, 0.95, 1.0);
  deformGeo(geo, 0.08, 2.5, 0);
  const body = new THREE.Mesh(geo, m.asteroid);
  asteroidGrp.add(body);

  const craterDefs = [{ phi: 0.8, theta: 1.1, r: 0.6 }, { phi: 2.5, theta: 0.9, r: 0.5 }];
  craterDefs.forEach(({ phi, theta, r }) => {
    const crater = createCrater(r, 0.1, 0x5a5448, 0x2a2820);
    const dir = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta));
    crater.position.copy(dir.multiply(new THREE.Vector3(1.08, 0.95, 1.0)).normalize()).multiplyScalar(PLANET_RADIUS);
    crater.lookAt(0, 0, 0);
    crater.rotateX(Math.PI);
    body.add(crater);
  });

  const TAU = Math.PI * 2;
  // Barrio A
  {
    const centerPhi = 0.0; const centerTheta = 1.1;
    placeOnPlanet(createBank(m), body, centerPhi, centerTheta, 0.85);
    placeOnPlanet(createTallBuilding(m), body, centerPhi - 0.38, centerTheta + 0.08, 0.65);
    placeOnPlanet(createTallBuilding(m), body, centerPhi + 0.38, centerTheta - 0.06, 0.58);
  }
  // Barrio B
  {
    const centerPhi = TAU * 0.38; const centerTheta = 1.42;
    placeOnPlanet(createHouse(m), body, centerPhi, centerTheta, 0.75);
    placeOnPlanet(createTree(m), body, centerPhi + 0.22, centerTheta + 0.28, 0.5);
  }

  worldGroup.add(asteroidGrp);
  return worldGroup;
}

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
  const twinklingStarsRef = useRef<THREE.Points | null>(null);

  // Inercia de rotación
  const rotY = useRef(0);
  const rotX = useRef(0.35);
  const velX = useRef(0);
  const velY = useRef(0);

  const gesture = Gesture.Pan().runOnJS(true).onUpdate((e) => {
    velY.current = e.velocityX / 12000;
    velX.current = e.velocityY / 12000;
  });

  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    console.log('GL INIT:', gl.drawingBufferWidth, 'x', gl.drawingBufferHeight);
    const mode = useThemeStore.getState().mode;
    const initialSkyColor = mode === 'light' ? SKY_BG_LIGHT : SKY_BG_DARK;

    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(initialSkyColor);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const camera = new THREE.OrthographicCamera(-12 * aspect, 12 * aspect, 12, -12, 0.1, 1000);
    camera.position.set(0, 6, 22);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xB0C4DE, 0.8));
    const sunLight = new THREE.DirectionalLight(0xFFF8E0, 1.4);
    sunLight.position.set(12, 10, 8);
    scene.add(sunLight);

    const m = createWorldMaterials();
    const world = buildWorld(m);
    worldRef.current = world;
    scene.add(world);

    // Partículas
    const dustVerts: number[] = [];
    for (let i = 0; i < 40; i++) dustVerts.push((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, Math.random() * 20 + 5);
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustVerts, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xCCDDFF, size: 0.15, transparent: true, opacity: 0.5 }));
    scene.add(dust);
    dustRef.current = dust;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      timeRef.current += 0.015;
      const currentMode = useThemeStore.getState().mode;
      renderer.setClearColor(currentMode === 'light' ? SKY_BG_LIGHT : SKY_BG_DARK);

      rotY.current += velY.current;
      rotX.current += velX.current;
      velX.current *= 0.94;
      velY.current *= 0.94;
      if (Math.abs(velX.current) < 0.0001 && Math.abs(velY.current) < 0.0001) rotY.current += 0.002;
      if (worldRef.current) worldRef.current.rotation.set(rotX.current, rotY.current, 0);
      if (dustRef.current) dustRef.current.rotation.y = timeRef.current * 0.06;

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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
  container: { flex: 1, backgroundColor: '#000' },
  glView:    { flex: 1 },
});