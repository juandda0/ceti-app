// components/world/BuildingFactory.ts
// Rediseñado para presentación: modelos detallados, posicionamiento armónico

import * as THREE from 'three';

export interface WorldMaterials {
  asteroid: THREE.MeshStandardMaterial;
  skin: THREE.MeshPhongMaterial;
  clothes: THREE.MeshPhongMaterial;
  grass: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  house: THREE.MeshStandardMaterial;
  window: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  bank: THREE.MeshStandardMaterial;
}

export function createWorldMaterials(): WorldMaterials {
  return {
    asteroid: new THREE.MeshStandardMaterial({
      color: 0x4CAF50,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    }),
    skin:    new THREE.MeshPhongMaterial({ color: 0xFFDBAC, shininess: 10 }),
    clothes: new THREE.MeshPhongMaterial({ color: 0x3498DB, shininess: 10 }),
    grass:   new THREE.MeshStandardMaterial({ color: 0x56C26A, roughness: 0.8, flatShading: true }),
    wood:    new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.95, flatShading: true }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x2E8B57, roughness: 0.8, flatShading: true }),
    house:   new THREE.MeshStandardMaterial({ color: 0xF4A261, roughness: 0.7, flatShading: true }),
    window:  new THREE.MeshStandardMaterial({ color: 0xADD8E6, roughness: 0.1, metalness: 0.9, emissive: 0x334455 }),
    roof:    new THREE.MeshStandardMaterial({ color: 0xC0392B, flatShading: true }),
    bank:    new THREE.MeshStandardMaterial({ color: 0xECF0F1, roughness: 0.4, flatShading: true }),
  };
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

/** Crea una ventana rectangular y la añade al grupo padre */
function addWindow(
  parent: THREE.Group | THREE.Mesh,
  mat: THREE.MeshStandardMaterial,
  x: number, y: number, z: number,
  w = 0.12, h = 0.1,
  rotY = 0
) {
  const win = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  win.position.set(x, y, z);
  win.rotation.y = rotY;
  (parent as THREE.Group).add(win);
}

// ─── ÁRBOL LOW-POLY (mejorado, más volumen) ──────────────────────────────────
export function createTree(m: WorldMaterials): THREE.Group {
  const g = new THREE.Group();

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 6), m.wood);
  trunk.position.y = 0.25;
  g.add(trunk);

  // Tres capas de follaje para aspecto tupido
  const sizes = [
    { r: 0.35, h: 0.45, y: 0.6 },
    { r: 0.28, h: 0.38, y: 0.85 },
    { r: 0.18, h: 0.3,  y: 1.05 },
  ];
  sizes.forEach(({ r, h, y }) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), m.foliage);
    cone.position.y = y;
    g.add(cone);
  });

  return g;
}

// ─── PARCHE DE CÉSPED ────────────────────────────────────────────────────────
export function createGrassPatch(m: WorldMaterials): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.12 + Math.random() * 0.08, 3),
      m.grass
    );
    blade.position.set(
      (Math.random() - 0.5) * 0.22,
      0.06,
      (Math.random() - 0.5) * 0.22
    );
    blade.rotation.x = (Math.random() - 0.5) * 0.4;
    blade.rotation.z = (Math.random() - 0.5) * 0.4;
    g.add(blade);
  }
  return g;
}

// ─── CASA ACOGEDORA ──────────────────────────────────────────────────────────
export function createHouse(m: WorldMaterials): THREE.Group {
  const g = new THREE.Group();

  // Cuerpo principal
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.5, 0.55), m.house);
  body.position.y = 0.25;
  g.add(body);

  // Techo a dos aguas
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 0.35, 4),
    m.roof
  );
  roof.position.y = 0.675;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  // Puerta
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.22, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, flatShading: true })
  );
  door.position.set(0, 0.11, 0.28);
  g.add(door);

  // Ventanas frontales
  addWindow(g, m.window, -0.2, 0.28, 0.281, 0.13, 0.13);
  addWindow(g, m.window,  0.2, 0.28, 0.281, 0.13, 0.13);

  // Chimenea
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.25, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, flatShading: true })
  );
  chimney.position.set(0.2, 0.82, 0.05);
  g.add(chimney);

  return g;
}

// ─── EDIFICIO ALTO / RASCACIELOS ─────────────────────────────────────────────
export function createTallBuilding(m: WorldMaterials): THREE.Group {
  const g = new THREE.Group();

  const towerMat = new THREE.MeshStandardMaterial({ color: 0x607D8B, roughness: 0.3, metalness: 0.4, flatShading: true });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x546E7A, roughness: 0.2, metalness: 0.5, flatShading: true });

  // Base ancha
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.35, 0.65), towerMat);
  base.position.y = 0.175;
  g.add(base);

  // Torre central
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 0.45), towerMat);
  tower.position.y = 0.90;
  g.add(tower);

  // Torre secundaria más delgada
  const spire = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.2), accentMat);
  spire.position.y = 1.675;
  g.add(spire);

  // Aguja
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.04, 0.3, 5), accentMat);
  needle.position.y = 2.05;
  g.add(needle);

  // Ventanas en cuadrícula (4 filas × 2 columnas por cara frontal)
  for (let row = 0; row < 5; row++) {
    for (let col = -1; col <= 1; col += 2) {
      addWindow(g, m.window, col * 0.14, 0.45 + row * 0.2, 0.231, 0.1, 0.12);
    }
  }

  return g;
}

// ─── CAFETERÍA / COFFEE SHOP ─────────────────────────────────────────────────
export function createCafeteria(m: WorldMaterials): THREE.Group {
  const g = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.7, flatShading: true });
  const awningMat = new THREE.MeshStandardMaterial({ color: 0xE53935, roughness: 0.6, flatShading: true });

  // Cuerpo
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.6), wallMat);
  body.position.y = 0.225;
  g.add(body);

  // Techo plano con borde
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.65), awningMat);
  roof.position.y = 0.475;
  g.add(roof);

  // Toldo / marquesina inclinada
  const awning = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.25), awningMat);
  awning.position.set(0, 0.3, 0.35);
  awning.rotation.x = -0.3;
  g.add(awning);

  // Ventana escaparate grande
  const shopWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.2),
    m.window
  );
  shopWindow.position.set(0, 0.28, 0.311);
  g.add(shopWindow);

  // Puerta
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.25, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.8 })
  );
  door.position.set(0.25, 0.125, 0.311);
  g.add(door);

  // Letrero
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.1, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xFFCC02, roughness: 0.5, emissive: 0x332200 })
  );
  sign.position.set(0, 0.52, 0.32);
  g.add(sign);

  return g;
}

// ─── BANCO NEOCLÁSICO ────────────────────────────────────────────────────────
export function createBank(m: WorldMaterials): THREE.Group {
  const g = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xECEFF1, roughness: 0.5, flatShading: true });
  const darkMat  = new THREE.MeshStandardMaterial({ color: 0xB0BEC5, roughness: 0.4, flatShading: true });

  // Escalones
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.06, 0.82), darkMat);
  step1.position.y = 0.03;
  g.add(step1);
  const step2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.75), stoneMat);
  step2.position.y = 0.09;
  g.add(step2);

  // Cuerpo principal
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.7), stoneMat);
  body.position.y = 0.395;
  g.add(body);

  // Frontón triangular (techo clásico)
  const pediment = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 0.22, 4),
    darkMat
  );
  pediment.position.y = 0.83;
  pediment.rotation.y = Math.PI / 4;
  pediment.scale.set(1.1, 1, 0.65);
  g.add(pediment);

  // Columnas frontales (4 columnas)
  const colPositions = [-0.28, -0.09, 0.09, 0.28];
  colPositions.forEach((x) => {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.55, 7),
      stoneMat
    );
    col.position.set(x, 0.395, 0.33);
    g.add(col);
  });

  // Ventana frontal con arco (simulado)
  addWindow(g, m.window, 0, 0.48, 0.382, 0.25, 0.18);

  // Puerta doble
  const doorL = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.22, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x546E7A, roughness: 0.5 })
  );
  doorL.position.set(-0.05, 0.22, 0.382);
  g.add(doorL);
  const doorR = doorL.clone();
  doorR.position.x = 0.05;
  g.add(doorR);

  return g;
}

// ─── PARQUE / PLAZA VERDE ────────────────────────────────────────────────────
export function createPark(m: WorldMaterials): THREE.Group {
  const g = new THREE.Group();

  // Base de césped hexagonal
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.7, 8), m.grass);
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.005;
  g.add(base);

  // Sendero circular decorativo
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xD4C5A9, roughness: 0.9, flatShading: true });
  const path = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 10), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.01;
  g.add(path);

  // Fuente central
  const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.1, 8), pathMat);
  fountainBase.position.y = 0.05;
  g.add(fountainBase);

  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.04, 8),
    new THREE.MeshStandardMaterial({ color: 0x4FC3F7, roughness: 0.0, metalness: 0.3, transparent: true, opacity: 0.85 })
  );
  fountainWater.position.y = 0.12;
  g.add(fountainWater);

  const fountainPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.18, 5), pathMat);
  fountainPillar.position.y = 0.19;
  g.add(fountainPillar);

  // 2 bancos enfrentados
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C, roughness: 0.85, flatShading: true });
  [0, Math.PI].forEach((angle) => {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.08), benchMat);
    seat.position.y = 0.07;
    bench.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.03), benchMat);
    back.position.set(0, 0.115, -0.04);
    bench.add(back);
    bench.position.set(Math.sin(angle) * 0.5, 0, Math.cos(angle) * 0.5);
    bench.rotation.y = angle;
    g.add(bench);
  });

  return g;
}

// ─── FAROLA ──────────────────────────────────────────────────────────────────
export function createLampPost(m: WorldMaterials): THREE.Group {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x37474F, roughness: 0.6, metalness: 0.5 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xFFF176, emissive: 0x887700, roughness: 0.3 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.55, 5), poleMat);
  pole.position.y = 0.275;
  g.add(pole);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 4), poleMat);
  arm.position.set(0.08, 0.56, 0);
  arm.rotation.z = Math.PI / 2;
  g.add(arm);

  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 4), lightMat);
  lamp.position.set(0.17, 0.56, 0);
  g.add(lamp);

  return g;
}

// ─── KIOSCO / TIENDA ─────────────────────────────────────────────────────────
export function createKiosk(m: WorldMaterials): THREE.Group {
  const g = new THREE.Group();
  const kioMat = new THREE.MeshStandardMaterial({ color: 0xFF7043, roughness: 0.7, flatShading: true });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xFFF9C4, roughness: 0.6, flatShading: true });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.38, 6), kioMat);
  body.position.y = 0.19;
  g.add(body);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.22, 6), roofMat);
  roof.position.y = 0.49;
  g.add(roof);

  return g;
}

// ─── NUBE LOW-POLY ──────────────────────────────────────────────────────────
export function createCloud(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    roughness: 0.1,
    flatShading: true,
    transparent: true,
    opacity: 0.9,
  });

  const puff1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat);
  g.add(puff1);

  const puff2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), mat);
  puff2.position.set(0.18, -0.05, 0);
  g.add(puff2);

  const puff3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat);
  puff3.position.set(-0.15, -0.05, 0.05);
  g.add(puff3);

  return g;
}