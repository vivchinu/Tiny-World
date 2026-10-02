import * as THREE from 'three';

export class HouseGenerator {
  constructor(terrain) {
    this.terrain = terrain;

    // Shared Palette Materials
    this.materials = {
      stoneBase: new THREE.MeshStandardMaterial({
        color: 0x64748b, // Slate foundation
        roughness: 0.85,
        flatShading: true
      }),
      wallPlaster: new THREE.MeshStandardMaterial({
        color: 0xfef3c7, // Warm ivory plaster
        roughness: 0.9,
        flatShading: true
      }),
      wallTimber: new THREE.MeshStandardMaterial({
        color: 0x78350f, // Deep oak timber
        roughness: 0.75,
        flatShading: true
      }),
      roofTerracotta: new THREE.MeshStandardMaterial({
        color: 0xc2410c, // Warm clay orange
        roughness: 0.7,
        flatShading: true
      }),
      roofSlate: new THREE.MeshStandardMaterial({
        color: 0x334155, // Deep slate blue
        roughness: 0.65,
        flatShading: true
      }),
      roofMoss: new THREE.MeshStandardMaterial({
        color: 0x4d7c0f, // Cozy moss green
        roughness: 0.8,
        flatShading: true
      }),
      doorWood: new THREE.MeshStandardMaterial({
        color: 0x92400e, // Warm amber oak
        roughness: 0.65,
        flatShading: true
      }),
      windowGlass: new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.1
      }),
      flowerBox: new THREE.MeshStandardMaterial({
        color: 0x9a3412,
        roughness: 0.8
      }),
      chimneyStone: new THREE.MeshStandardMaterial({
        color: 0x52525b,
        roughness: 0.9,
        flatShading: true
      })
    };
  }

  createFromPoints(startPoint, endPoint, variation = 'cottage', isPreview = false) {
    // Calculate bounding box on the XZ plane
    const minX = Math.min(startPoint.x, endPoint.x);
    const maxX = Math.max(startPoint.x, endPoint.x);
    const minZ = Math.min(startPoint.z, endPoint.z);
    const maxZ = Math.max(startPoint.z, endPoint.z);

    let width = Math.max(2.4, maxX - minX);
    let depth = Math.max(2.4, maxZ - minZ);

    // If click without drag, provide cozy default dimensions
    if (width < 2.5 && depth < 2.5) {
      width = 3.6;
      depth = 4.2;
    }

    const centerX = (startPoint.x + endPoint.x) / 2;
    const centerZ = (startPoint.z + endPoint.z) / 2;
    const groundY = this.terrain.getHeightAt(centerX, centerZ);

    return this.generate({
      position: new THREE.Vector3(centerX, groundY, centerZ),
      width,
      depth,
      height: 2.8 + Math.min(width, depth) * 0.25,
      rotation: 0,
      variation,
      isPreview
    });
  }

  generate(params) {
    const { position, width, depth, height, rotation = 0, variation = 'cottage', isPreview = false } = params;

    const houseGroup = new THREE.Group();
    houseGroup.position.copy(position);
    houseGroup.rotation.y = rotation;
    houseGroup.userData = {
      type: 'house',
      variation,
      width,
      depth,
      height,
      position: position.clone(),
      smokeParticles: []
    };

    // Roof material selection
    let roofMat = this.materials.roofTerracotta;
    if (variation === 'manor') roofMat = this.materials.roofSlate;
    if (variation === 'mossy') roofMat = this.materials.roofMoss;

    // Sub-groups for multi-stage build animation:
    // 1. Foundation
    // 2. Walls
    // 3. Roof
    // 4. Details (door, windows, chimney)
    const foundationGroup = new THREE.Group();
    const wallsGroup = new THREE.Group();
    const roofGroup = new THREE.Group();
    const detailsGroup = new THREE.Group();

    houseGroup.add(foundationGroup);
    houseGroup.add(wallsGroup);
    houseGroup.add(roofGroup);
    houseGroup.add(detailsGroup);

    houseGroup.userData.animStages = {
      foundation: foundationGroup,
      walls: wallsGroup,
      roof: roofGroup,
      details: detailsGroup
    };

    // -------------------------------------------------------------
    // 1. Foundation (Stone Plinth)
    // -------------------------------------------------------------
    const fHeight = 0.5;
    const fGeo = new THREE.BoxGeometry(width + 0.35, fHeight, depth + 0.35);
    const foundationMesh = new THREE.Mesh(fGeo, this.materials.stoneBase);
    foundationMesh.position.y = fHeight / 2;
    foundationMesh.castShadow = !isPreview;
    foundationMesh.receiveShadow = !isPreview;
    foundationGroup.add(foundationMesh);

    // -------------------------------------------------------------
    // 2. Walls (Timber framed or stone)
    // -------------------------------------------------------------
    const wallGeo = new THREE.BoxGeometry(width, height, depth);
    const wallMesh = new THREE.Mesh(wallGeo, this.materials.wallPlaster);
    wallMesh.position.y = fHeight + height / 2;
    wallMesh.castShadow = !isPreview;
    wallMesh.receiveShadow = !isPreview;
    wallsGroup.add(wallMesh);

    // Timber Corner Beams
    const beamThick = 0.18;
    const beamGeo = new THREE.BoxGeometry(beamThick, height, beamThick);
    const corners = [
      [-width / 2 + beamThick / 2, -depth / 2 + beamThick / 2],
      [width / 2 - beamThick / 2, -depth / 2 + beamThick / 2],
      [-width / 2 + beamThick / 2, depth / 2 - beamThick / 2],
      [width / 2 - beamThick / 2, depth / 2 - beamThick / 2],
    ];

    corners.forEach(([cx, cz]) => {
      const beam = new THREE.Mesh(beamGeo, this.materials.wallTimber);
      beam.position.set(cx, fHeight + height / 2, cz);
      beam.castShadow = !isPreview;
      wallsGroup.add(beam);
    });

    // Horizontal top beam
    const topBeamGeo = new THREE.BoxGeometry(width + 0.05, beamThick, depth + 0.05);
    const topBeam = new THREE.Mesh(topBeamGeo, this.materials.wallTimber);
    topBeam.position.set(0, fHeight + height - beamThick / 2, 0);
    wallsGroup.add(topBeam);

    // -------------------------------------------------------------
    // 3. Pitched Roof with Eaves
    // -------------------------------------------------------------
    const roofOverhang = 0.45;
    const roofW = width + roofOverhang * 2;
    const roofD = depth + roofOverhang * 2;
    const roofH = 1.6 + Math.min(width, depth) * 0.28;

    // Pitched Gable Roof using Prism Extrusion
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-roofW / 2, 0);
    roofShape.lineTo(0, roofH);
    roofShape.lineTo(roofW / 2, 0);
    roofShape.closePath();

    const extrudeSettings = {
      depth: roofD,
      bevelEnabled: false
    };

    const roofGeo = new THREE.ExtrudeGeometry(roofShape, extrudeSettings);
    // Center extrusion along Z
    roofGeo.translate(0, 0, -roofD / 2);

    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.set(0, fHeight + height, 0);
    roofMesh.castShadow = !isPreview;
    roofMesh.receiveShadow = !isPreview;
    roofGroup.add(roofMesh);

    // Roof bargeboard trim (gable edges)
    const trimGeo = new THREE.BoxGeometry(roofW * 0.55, 0.12, 0.12);
    const leftTrim = new THREE.Mesh(trimGeo, this.materials.wallTimber);
    leftTrim.position.set(-roofW / 4, fHeight + height + roofH / 2, roofD / 2 + 0.06);
    leftTrim.rotation.z = Math.atan2(roofH, roofW / 2);
    roofGroup.add(leftTrim);

    const rightTrim = leftTrim.clone();
    rightTrim.position.x = roofW / 4;
    rightTrim.rotation.z = -leftTrim.rotation.z;
    roofGroup.add(rightTrim);

    // -------------------------------------------------------------
    // 4. Details: Door, Windows, Chimney
    // -------------------------------------------------------------
    // Front Wooden Door
    const doorW = 0.9;
    const doorH = 1.6;
    const doorGeo = new THREE.BoxGeometry(doorW, doorH, 0.1);
    const doorMesh = new THREE.Mesh(doorGeo, this.materials.doorWood);
    doorMesh.position.set(0, fHeight + doorH / 2, depth / 2 + 0.05);
    doorMesh.castShadow = !isPreview;
    detailsGroup.add(doorMesh);

    // Stone doorstep
    const stepGeo = new THREE.BoxGeometry(doorW + 0.3, 0.15, 0.4);
    const step = new THREE.Mesh(stepGeo, this.materials.stoneBase);
    step.position.set(0, 0.08, depth / 2 + 0.25);
    detailsGroup.add(step);

    // Windows on Front and Sides
    const winW = 0.7;
    const winH = 0.8;
    const winGeo = new THREE.BoxGeometry(winW, winH, 0.08);

    // Left front window if wide enough
    if (width > 3.8) {
      const winLeft = new THREE.Mesh(winGeo, this.materials.windowGlass);
      winLeft.position.set(-width / 3.2, fHeight + height * 0.55, depth / 2 + 0.04);
      detailsGroup.add(winLeft);

      // Flower box under window
      const fbGeo = new THREE.BoxGeometry(winW + 0.15, 0.2, 0.25);
      const fb = new THREE.Mesh(fbGeo, this.materials.flowerBox);
      fb.position.set(-width / 3.2, fHeight + height * 0.55 - winH / 2 - 0.1, depth / 2 + 0.12);
      detailsGroup.add(fb);

      // Colorful flowers in box
      const flGeo = new THREE.DodecahedronGeometry(0.08, 0);
      const flMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.5 });
      for (let f = 0; f < 3; f++) {
        const flower = new THREE.Mesh(flGeo, flMat);
        flower.position.set(-width / 3.2 + (f - 1) * 0.25, fHeight + height * 0.55 - winH / 2 + 0.08, depth / 2 + 0.14);
        detailsGroup.add(flower);
      }
    }

    // Side windows
    const sideWin = new THREE.Mesh(winGeo, this.materials.windowGlass);
    sideWin.rotation.y = Math.PI / 2;
    sideWin.position.set(width / 2 + 0.04, fHeight + height * 0.55, 0);
    detailsGroup.add(sideWin);

    // Stone Chimney with Smoke
    const chimW = 0.6;
    const chimH = roofH + 0.8;
    const chimGeo = new THREE.BoxGeometry(chimW, chimH, chimW);
    const chimney = new THREE.Mesh(chimGeo, this.materials.chimneyStone);
    chimney.position.set(width / 3, fHeight + height + chimH / 2 - 0.3, -depth / 4);
    chimney.castShadow = !isPreview;
    detailsGroup.add(chimney);

    // Animated Smoke Puffs setup (only for committed houses)
    if (!isPreview) {
      const smokeCount = 5;
      const smokePuffs = [];
      const smokeMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        transparent: true,
        opacity: 0.65,
        roughness: 1.0,
        flatShading: true
      });

      for (let s = 0; s < smokeCount; s++) {
        const rad = 0.2 + s * 0.08;
        const sGeo = new THREE.DodecahedronGeometry(rad, 1);
        const puff = new THREE.Mesh(sGeo, smokeMat);
        puff.position.copy(chimney.position);
        puff.position.y += chimH / 2 + 0.2 + s * 0.6;
        puff.userData = {
          baseY: chimney.position.y + chimH / 2 + 0.2,
          offsetY: s * 0.6,
          speed: 0.7 + Math.random() * 0.3,
          maxHeight: 3.2
        };
        detailsGroup.add(puff);
        smokePuffs.push(puff);
      }
      houseGroup.userData.smokeParticles = smokePuffs;
    }

    // Windmill Variation: Add rotating blades
    if (variation === 'windmill') {
      const rotorGroup = new THREE.Group();
      rotorGroup.position.set(0, fHeight + height + roofH * 0.5, depth / 2 + 0.3);

      const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8);
      hubGeo.rotateX(Math.PI / 2);
      const hub = new THREE.Mesh(hubGeo, this.materials.wallTimber);
      rotorGroup.add(hub);

      // 4 blades
      for (let b = 0; b < 4; b++) {
        const bladeArm = new THREE.Group();
        bladeArm.rotation.z = (b * Math.PI) / 2;

        const sparGeo = new THREE.BoxGeometry(0.08, 2.6, 0.06);
        sparGeo.translate(0, 1.3, 0);
        const spar = new THREE.Mesh(sparGeo, this.materials.wallTimber);
        bladeArm.add(spar);

        const sailGeo = new THREE.PlaneGeometry(0.65, 2.0);
        sailGeo.translate(0.35, 1.3, 0);
        const sailMat = new THREE.MeshStandardMaterial({
          color: 0xfef9c3,
          side: THREE.DoubleSide,
          roughness: 0.9
        });
        const sail = new THREE.Mesh(sailGeo, sailMat);
        bladeArm.add(sail);

        rotorGroup.add(bladeArm);
      }

      roofGroup.add(rotorGroup);
      houseGroup.userData.rotorGroup = rotorGroup;
    }

    // Ghost preview material override
    if (isPreview) {
      houseGroup.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: 0.45,
            wireframe: false,
            roughness: 0.3
          });
        }
      });
    }

    return houseGroup;
  }
}
