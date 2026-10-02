import * as THREE from 'three';

export class PropGenerator {
  constructor(terrain) {
    this.terrain = terrain;

    this.materials = {
      woodDark: new THREE.MeshStandardMaterial({
        color: 0x5c4033,
        roughness: 0.8,
        flatShading: true
      }),
      woodPlank: new THREE.MeshStandardMaterial({
        color: 0xa16207,
        roughness: 0.7,
        flatShading: true
      }),
      ironMetal: new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.5,
        metalness: 0.6
      }),
      lanternGlow: new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.0,
        roughness: 0.1
      }),
      stoneCobble: new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.9,
        flatShading: true
      }),
      fireLog: new THREE.MeshStandardMaterial({
        color: 0x3b1c0b,
        roughness: 0.95
      }),
      fireFlame: new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xef4444,
        emissiveIntensity: 0.9,
        roughness: 0.2
      })
    };
  }

  createAtPoint(point, variation = 'lantern', isPreview = false) {
    const groundY = this.terrain.getHeightAt(point.x, point.z);
    return this.generate({
      position: new THREE.Vector3(point.x, groundY, point.z),
      variation,
      isPreview
    });
  }

  generate(params) {
    const { position, variation = 'lantern', isPreview = false } = params;

    const propGroup = new THREE.Group();
    propGroup.position.copy(position);
    propGroup.userData = {
      type: 'prop',
      variation,
      position: position.clone(),
      flickerLight: null
    };

    if (variation === 'lantern') {
      // -----------------------------------------------------------
      // Cozy Street Lamp / Lantern Post
      // -----------------------------------------------------------
      const postH = 2.4;
      const postGeo = new THREE.CylinderGeometry(0.08, 0.12, postH, 6);
      const post = new THREE.Mesh(postGeo, this.materials.woodDark);
      post.position.y = postH / 2;
      post.castShadow = !isPreview;
      propGroup.add(post);

      // Arm bracket
      const armGeo = new THREE.BoxGeometry(0.5, 0.08, 0.08);
      const arm = new THREE.Mesh(armGeo, this.materials.ironMetal);
      arm.position.set(0.2, postH - 0.1, 0);
      propGroup.add(arm);

      // Hanging Lantern Body
      const lampGeo = new THREE.DodecahedronGeometry(0.2, 0);
      const lamp = new THREE.Mesh(lampGeo, this.materials.lanternGlow);
      lamp.position.set(0.4, postH - 0.35, 0);
      propGroup.add(lamp);

      // Lantern Top Cap
      const capGeo = new THREE.ConeGeometry(0.25, 0.18, 5);
      const cap = new THREE.Mesh(capGeo, this.materials.ironMetal);
      cap.position.set(0.4, postH - 0.2, 0);
      propGroup.add(cap);

      // Real Point Light emitting cozy warm glow
      if (!isPreview) {
        const light = new THREE.PointLight(0xfbbf24, 1.2, 8, 1.5);
        light.position.set(0.4, postH - 0.35, 0);
        propGroup.add(light);
        propGroup.userData.flickerLight = light;
      }

    } else if (variation === 'bench') {
      // -----------------------------------------------------------
      // Wooden Park Bench
      // -----------------------------------------------------------
      const seatW = 1.4;
      const seatGeo = new THREE.BoxGeometry(seatW, 0.08, 0.5);
      const seat = new THREE.Mesh(seatGeo, this.materials.woodPlank);
      seat.position.y = 0.45;
      seat.castShadow = !isPreview;
      propGroup.add(seat);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.08, 0.45, 0.45);
      const leftLeg = new THREE.Mesh(legGeo, this.materials.woodDark);
      leftLeg.position.set(-seatW / 2 + 0.15, 0.22, 0);
      leftLeg.castShadow = !isPreview;
      propGroup.add(leftLeg);

      const rightLeg = leftLeg.clone();
      rightLeg.position.x = seatW / 2 - 0.15;
      propGroup.add(rightLeg);

      // Backrest
      const backGeo = new THREE.BoxGeometry(seatW, 0.35, 0.08);
      const back = new THREE.Mesh(backGeo, this.materials.woodPlank);
      back.position.set(0, 0.72, -0.22);
      back.castShadow = !isPreview;
      propGroup.add(back);

    } else if (variation === 'campfire') {
      // -----------------------------------------------------------
      // Campfire with Firelight and Embers
      // -----------------------------------------------------------
      // Stone ring
      const stoneCount = 8;
      for (let s = 0; s < stoneCount; s++) {
        const sAngle = (s / stoneCount) * Math.PI * 2;
        const sx = Math.cos(sAngle) * 0.6;
        const sz = Math.sin(sAngle) * 0.6;
        const sGeo = new THREE.DodecahedronGeometry(0.14, 0);
        const stone = new THREE.Mesh(sGeo, this.materials.stoneCobble);
        stone.position.set(sx, 0.1, sz);
        stone.castShadow = !isPreview;
        propGroup.add(stone);
      }

      // Crossed logs
      for (let l = 0; l < 3; l++) {
        const logGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.9, 5);
        const log = new THREE.Mesh(logGeo, this.materials.fireLog);
        log.position.set(0, 0.15, 0);
        log.rotation.set(0.2, (l * Math.PI) / 3, 0.2);
        log.castShadow = !isPreview;
        propGroup.add(log);
      }

      // Fire Flame cones
      const flameGeo = new THREE.ConeGeometry(0.25, 0.6, 6);
      const flame = new THREE.Mesh(flameGeo, this.materials.fireFlame);
      flame.position.y = 0.45;
      propGroup.add(flame);
      propGroup.userData.flameMesh = flame;

      if (!isPreview) {
        const fireLight = new THREE.PointLight(0xf97316, 1.8, 7, 2.0);
        fireLight.position.set(0, 0.5, 0);
        propGroup.add(fireLight);
        propGroup.userData.flickerLight = fireLight;
      }

    } else if (variation === 'well') {
      // -----------------------------------------------------------
      // Village Wishing Well
      // -----------------------------------------------------------
      const wellBaseGeo = new THREE.CylinderGeometry(0.7, 0.75, 0.7, 10, 1, true);
      const wellBase = new THREE.Mesh(wellBaseGeo, this.materials.stoneCobble);
      wellBase.position.y = 0.35;
      wellBase.castShadow = !isPreview;
      propGroup.add(wellBase);

      // Water surface inside well
      const innerWaterGeo = new THREE.CircleGeometry(0.65, 10);
      innerWaterGeo.rotateX(-Math.PI / 2);
      const innerWater = new THREE.Mesh(innerWaterGeo, new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1 }));
      innerWater.position.y = 0.25;
      propGroup.add(innerWater);

      // Posts
      const postGeo = new THREE.BoxGeometry(0.12, 1.6, 0.12);
      const p1 = new THREE.Mesh(postGeo, this.materials.woodDark);
      p1.position.set(-0.6, 0.8, 0);
      propGroup.add(p1);

      const p2 = p1.clone();
      p2.position.x = 0.6;
      propGroup.add(p2);

      // Canopy roof
      const roofGeo = new THREE.ConeGeometry(0.95, 0.65, 4);
      roofGeo.rotateY(Math.PI / 4);
      const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8, flatShading: true }));
      roof.position.y = 1.8;
      roof.castShadow = !isPreview;
      propGroup.add(roof);

    } else if (variation === 'flowers') {
      // -----------------------------------------------------------
      // Flower Garden Patch
      // -----------------------------------------------------------
      const fCount = 14;
      const fColors = [0xf43f5e, 0xec4899, 0xa855f7, 0xfacc15, 0x38bdf8];
      for (let f = 0; f < fCount; f++) {
        const fx = (Math.random() - 0.5) * 1.4;
        const fz = (Math.random() - 0.5) * 1.4;
        const fH = 0.35 + Math.random() * 0.25;

        // Stem
        const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, fH, 4);
        const stem = new THREE.Mesh(stemGeo, new THREE.MeshStandardMaterial({ color: 0x4d7c0f }));
        stem.position.set(fx, fH / 2, fz);
        propGroup.add(stem);

        // Blossom
        const col = fColors[f % fColors.length];
        const bGeo = new THREE.DodecahedronGeometry(0.09, 0);
        const blossom = new THREE.Mesh(bGeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }));
        blossom.position.set(fx, fH + 0.05, fz);
        propGroup.add(blossom);
      }
    }

    if (isPreview) {
      propGroup.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: 0.45,
            roughness: 0.3
          });
        }
      });
    }

    return propGroup;
  }
}
