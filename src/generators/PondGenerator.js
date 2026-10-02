import * as THREE from 'three';

export class PondGenerator {
  constructor(terrain) {
    this.terrain = terrain;

    this.materials = {
      water: new THREE.MeshStandardMaterial({
        color: 0x38bdf8, // Vibrant sky cyan
        roughness: 0.1,
        metalness: 0.15,
        transparent: true,
        opacity: 0.88,
        flatShading: true
      }),
      shoreStone: new THREE.MeshStandardMaterial({
        color: 0x94a3b8, // River pebbles
        roughness: 0.85,
        flatShading: true
      }),
      lilyPad: new THREE.MeshStandardMaterial({
        color: 0x15803d, // Deep pond leaf green
        roughness: 0.7,
        flatShading: true
      }),
      lotusPetal: new THREE.MeshStandardMaterial({
        color: 0xf472b6, // Lotus blossom pink
        roughness: 0.5
      }),
      reedStem: new THREE.MeshStandardMaterial({
        color: 0x4d7c0f,
        roughness: 0.9
      }),
      duckBody: new THREE.MeshStandardMaterial({
        color: 0xfacc15, // Cheerful duckling yellow
        roughness: 0.5
      }),
      duckBeak: new THREE.MeshStandardMaterial({
        color: 0xf97316, // Orange beak
        roughness: 0.6
      })
    };
  }

  createFromPoints(startPoint, endPoint, variation = 'pond', isPreview = false) {
    const dx = endPoint.x - startPoint.x;
    const dz = endPoint.z - startPoint.z;
    let radius = Math.hypot(dx, dz) / 2;

    if (radius < 1.0) radius = 2.4; // Default pleasant pond size
    radius = Math.min(radius, 6.0); // Clamp maximum pond radius

    const centerX = (startPoint.x + endPoint.x) / 2;
    const centerZ = (startPoint.z + endPoint.z) / 2;
    const groundY = this.terrain.getHeightAt(centerX, centerZ);

    return this.generate({
      position: new THREE.Vector3(centerX, groundY, centerZ),
      radius,
      variation,
      isPreview
    });
  }

  generate(params) {
    const { position, radius = 2.5, variation = 'pond', isPreview = false } = params;

    const pondGroup = new THREE.Group();
    pondGroup.position.copy(position);
    pondGroup.userData = {
      type: 'pond',
      variation,
      radius,
      position: position.clone(),
      ducks: [],
      waterMesh: null
    };

    // 1. Water Surface (Recessed slightly below surrounding terrain)
    const waterGeo = new THREE.CylinderGeometry(radius, radius * 0.9, 0.15, 32, 2);
    const waterMesh = new THREE.Mesh(waterGeo, this.materials.water);
    waterMesh.position.y = 0.05;
    waterMesh.receiveShadow = !isPreview;
    pondGroup.add(waterMesh);
    pondGroup.userData.waterMesh = waterMesh;

    // 2. Shoreline Pebbles and Boulder rim
    const stoneCount = Math.round(radius * 9);
    for (let i = 0; i < stoneCount; i++) {
      const angle = (i / stoneCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const dist = radius * (0.95 + Math.random() * 0.18);
      const sx = Math.cos(angle) * dist;
      const sz = Math.sin(angle) * dist;

      const sRad = 0.15 + Math.random() * 0.18;
      const sGeo = new THREE.DodecahedronGeometry(sRad, 0);
      const stone = new THREE.Mesh(sGeo, this.materials.shoreStone);
      stone.position.set(sx, 0.1, sz);
      stone.rotation.set(Math.random(), Math.random(), Math.random());
      stone.castShadow = !isPreview;
      pondGroup.add(stone);
    }

    // 3. Lily Pads with Lotus Blossoms
    const padCount = Math.max(2, Math.round(radius * 1.5));
    for (let p = 0; p < padCount; p++) {
      const pAngle = Math.random() * Math.PI * 2;
      const pDist = Math.random() * (radius * 0.65);
      const px = Math.cos(pAngle) * pDist;
      const pz = Math.sin(pAngle) * pDist;

      const padGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.03, 8);
      const pad = new THREE.Mesh(padGeo, this.materials.lilyPad);
      pad.position.set(px, 0.13, pz);
      pondGroup.add(pad);

      // Lotus Flower on some pads
      if (p % 2 === 0) {
        const flowerGeo = new THREE.ConeGeometry(0.12, 0.18, 6);
        const flower = new THREE.Mesh(flowerGeo, this.materials.lotusPetal);
        flower.position.set(px, 0.22, pz);
        pondGroup.add(flower);
      }
    }

    // 4. Cattails / Reeds along shore
    const reedClusters = 3;
    for (let c = 0; c < reedClusters; c++) {
      const cAngle = (c / reedClusters) * Math.PI * 2 + 0.8;
      const cx = Math.cos(cAngle) * (radius * 0.9);
      const cz = Math.sin(cAngle) * (radius * 0.9);

      for (let r = 0; r < 4; r++) {
        const rStemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.8 + Math.random() * 0.4, 5);
        const stem = new THREE.Mesh(rStemGeo, this.materials.reedStem);
        stem.position.set(cx + (Math.random() - 0.5) * 0.2, 0.45, cz + (Math.random() - 0.5) * 0.2);
        stem.rotation.z = (Math.random() - 0.5) * 0.15;
        pondGroup.add(stem);
      }
    }

    // 5. Cute Animated Swimming Duckling!
    if (!isPreview) {
      const duck = new THREE.Group();
      // Body
      const dBodyGeo = new THREE.SphereGeometry(0.2, 8, 8);
      dBodyGeo.scale(1.2, 0.8, 0.9);
      const dBody = new THREE.Mesh(dBodyGeo, this.materials.duckBody);
      duck.add(dBody);

      // Head
      const dHeadGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const dHead = new THREE.Mesh(dHeadGeo, this.materials.duckBody);
      dHead.position.set(0.16, 0.14, 0);
      duck.add(dHead);

      // Beak
      const dBeakGeo = new THREE.ConeGeometry(0.06, 0.12, 6);
      dBeakGeo.rotateZ(-Math.PI / 2);
      const dBeak = new THREE.Mesh(dBeakGeo, this.materials.duckBeak);
      dBeak.position.set(0.28, 0.14, 0);
      duck.add(dBeak);

      duck.position.set(radius * 0.4, 0.16, 0);
      duck.userData = {
        orbitAngle: 0,
        orbitRadius: radius * 0.45,
        speed: 0.8 / radius
      };
      pondGroup.add(duck);
      pondGroup.userData.ducks.push(duck);
    }

    if (isPreview) {
      pondGroup.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.5,
            roughness: 0.2
          });
        }
      });
    }

    return pondGroup;
  }
}
