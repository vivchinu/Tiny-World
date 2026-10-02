import * as THREE from 'three';

export class TreeGenerator {
  constructor(terrain) {
    this.terrain = terrain;

    this.materials = {
      trunkWood: new THREE.MeshStandardMaterial({
        color: 0x5c4033, // Earthy dark bark
        roughness: 0.9,
        flatShading: true
      }),
      trunkBirch: new THREE.MeshStandardMaterial({
        color: 0xf1f5f9, // Silver-white birch
        roughness: 0.8,
        flatShading: true
      }),
      foliageOak: new THREE.MeshStandardMaterial({
        color: 0x4d7c0f, // Lush olive green
        roughness: 0.75,
        flatShading: true
      }),
      foliagePine: new THREE.MeshStandardMaterial({
        color: 0x1e3a29, // Deep pine forest green
        roughness: 0.8,
        flatShading: true
      }),
      foliageSakura: new THREE.MeshStandardMaterial({
        color: 0xf472b6, // Soft cherry blossom pink
        roughness: 0.7,
        flatShading: true
      }),
      foliageAutumn: new THREE.MeshStandardMaterial({
        color: 0xea580c, // Vibrant orange-amber
        roughness: 0.75,
        flatShading: true
      }),
      foliageBirch: new THREE.MeshStandardMaterial({
        color: 0xa3e635, // Bright lime-gold
        roughness: 0.75,
        flatShading: true
      })
    };
  }

  createAtPoint(point, variation = 'oak', isPreview = false) {
    const groundY = this.terrain.getHeightAt(point.x, point.z);
    return this.generate({
      position: new THREE.Vector3(point.x, groundY, point.z),
      variation,
      isPreview
    });
  }

  generate(params) {
    const { position, variation = 'oak', isPreview = false } = params;

    const treeGroup = new THREE.Group();
    treeGroup.position.copy(position);
    treeGroup.userData = {
      type: 'tree',
      variation,
      position: position.clone(),
      swayOffset: Math.random() * Math.PI * 2
    };

    let trunkMat = this.materials.trunkWood;
    let foliageMat = this.materials.foliageOak;

    if (variation === 'pine') foliageMat = this.materials.foliagePine;
    if (variation === 'sakura') foliageMat = this.materials.foliageSakura;
    if (variation === 'autumn') foliageMat = this.materials.foliageAutumn;
    if (variation === 'birch') {
      trunkMat = this.materials.trunkBirch;
      foliageMat = this.materials.foliageBirch;
    }

    if (variation === 'pine') {
      // -----------------------------------------------------------
      // Pine / Conifer Architecture (Tiered Cones)
      // -----------------------------------------------------------
      const trunkH = 4.2;
      const trunkGeo = new THREE.CylinderGeometry(0.18, 0.32, trunkH, 6);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = trunkH / 2;
      trunk.castShadow = !isPreview;
      treeGroup.add(trunk);

      // 4 tiered needle cones
      const tiers = 4;
      for (let t = 0; t < tiers; t++) {
        const tierRadius = 1.9 - t * 0.35;
        const tierH = 1.5;
        const coneGeo = new THREE.ConeGeometry(tierRadius, tierH, 7);
        const cone = new THREE.Mesh(coneGeo, foliageMat);
        cone.position.y = 1.6 + t * 0.85;
        cone.castShadow = !isPreview;
        cone.receiveShadow = !isPreview;
        treeGroup.add(cone);
      }

    } else {
      // -----------------------------------------------------------
      // Deciduous / Oak / Sakura / Autumn / Birch (Organic Blobs)
      // -----------------------------------------------------------
      const trunkH = (variation === 'birch') ? 4.5 : 3.4;
      const trunkBottomR = (variation === 'birch') ? 0.2 : 0.38;
      const trunkTopR = (variation === 'birch') ? 0.12 : 0.22;

      const trunkGeo = new THREE.CylinderGeometry(trunkTopR, trunkBottomR, trunkH, 6);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = trunkH / 2;
      trunk.castShadow = !isPreview;
      treeGroup.add(trunk);

      // Branch forks
      const branchGeo = new THREE.CylinderGeometry(0.1, 0.18, 1.4, 5);
      const b1 = new THREE.Mesh(branchGeo, trunkMat);
      b1.position.set(0.3, trunkH * 0.72, 0.2);
      b1.rotation.set(0.35, 0, -0.45);
      b1.castShadow = !isPreview;
      treeGroup.add(b1);

      const b2 = new THREE.Mesh(branchGeo, trunkMat);
      b2.position.set(-0.3, trunkH * 0.8, -0.2);
      b2.rotation.set(-0.35, 0, 0.45);
      b2.castShadow = !isPreview;
      treeGroup.add(b2);

      // Foliage Puffs Group
      const foliageGroup = new THREE.Group();
      foliageGroup.position.set(0, trunkH * 0.85, 0);

      // Main central puffy crown
      const mainCrownGeo = new THREE.DodecahedronGeometry(1.6, 1);
      const mainCrown = new THREE.Mesh(mainCrownGeo, foliageMat);
      mainCrown.position.set(0, 0.6, 0);
      mainCrown.castShadow = !isPreview;
      mainCrown.receiveShadow = !isPreview;
      foliageGroup.add(mainCrown);

      // Satellite sub-puffs for organic silhouette
      const puffOffsets = [
        [0.85, 0.3, 0.6, 1.1],
        [-0.8, 0.4, -0.5, 1.0],
        [0.5, 0.8, -0.7, 0.9],
        [-0.6, 0.2, 0.8, 0.95],
        [0.0, 1.4, 0.1, 0.9]
      ];

      puffOffsets.forEach(([px, py, pz, pScale]) => {
        const puffGeo = new THREE.DodecahedronGeometry(pScale, 1);
        const puff = new THREE.Mesh(puffGeo, foliageMat);
        puff.position.set(px, py, pz);
        puff.castShadow = !isPreview;
        puff.receiveShadow = !isPreview;
        foliageGroup.add(puff);
      });

      treeGroup.add(foliageGroup);
      treeGroup.userData.foliageGroup = foliageGroup;
    }

    // Root flares on ground
    const rootGeo = new THREE.BoxGeometry(0.18, 0.25, 0.8);
    const root1 = new THREE.Mesh(rootGeo, trunkMat);
    root1.position.set(0, 0.1, 0);
    root1.rotation.y = 0.4;
    treeGroup.add(root1);

    const root2 = new THREE.Mesh(rootGeo, trunkMat);
    root2.position.set(0, 0.1, 0);
    root2.rotation.y = -0.8;
    treeGroup.add(root2);

    if (isPreview) {
      treeGroup.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0x4ade80,
            transparent: true,
            opacity: 0.45,
            roughness: 0.3
          });
        }
      });
    }

    return treeGroup;
  }
}
