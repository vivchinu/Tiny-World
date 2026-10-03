import * as THREE from 'three';

export class WallGenerator {
  constructor(terrain) {
    this.terrain = terrain;

    this.materials = {
      stoneWall: new THREE.MeshStandardMaterial({
        color: 0x78716c, // Warm stone grey
        roughness: 0.9,
        flatShading: true
      }),
      stoneCap: new THREE.MeshStandardMaterial({
        color: 0xa8a29e, // Lighter stone cap
        roughness: 0.8,
        flatShading: true
      }),
      woodFence: new THREE.MeshStandardMaterial({
        color: 0x854d0e, // Rustic wood
        roughness: 0.7,
        flatShading: true
      }),
      hedgeLeaf: new THREE.MeshStandardMaterial({
        color: 0x2e7d32, // Deep hedge green
        roughness: 0.95,
        flatShading: true
      })
    };
  }

  createFromPoints(startPoint, endPoint, variation = 'stone', isPreview = false, pointsPath = null) {
    if (pointsPath && Array.isArray(pointsPath) && pointsPath.length > 2) {
      return this.generateFromPath({
        pointsPath,
        variation,
        isPreview
      });
    }

    const dx = endPoint.x - startPoint.x;
    const dz = endPoint.z - startPoint.z;
    const length = Math.hypot(dx, dz);

    if (length < 0.6) {
      // Very short tap, create a short standalone wall or post
      return this.generate({
        startPoint,
        endPoint: new THREE.Vector3(startPoint.x + 2.0, startPoint.y, startPoint.z),
        variation,
        isPreview
      });
    }

    return this.generate({
      startPoint,
      endPoint,
      variation,
      isPreview
    });
  }

  generateFromPath(params) {
    const { pointsPath, variation = 'stone', isPreview = false } = params;

    const wallGroup = new THREE.Group();
    wallGroup.userData = {
      type: 'wall',
      variation,
      pointsPath: pointsPath.map(p => p.clone()),
      segments: []
    };

    // Create a smooth 3D spline curve through all sampled points
    const curve = new THREE.CatmullRomCurve3(pointsPath);
    const totalLength = curve.getLength();

    if (totalLength < 0.4) return wallGroup;

    const segmentLen = 1.2;
    const count = Math.max(1, Math.round(totalLength / segmentLen));
    const wallHeight = (variation === 'wood') ? 1.0 : 1.35;
    const wallThick = (variation === 'wood') ? 0.15 : 0.45;

    // Start Pillar
    const startPos = curve.getPointAt(0);
    this.addPillar(wallGroup, startPos.x, startPos.z, wallHeight, wallThick, variation, isPreview);

    for (let i = 0; i < count; i++) {
      const tStart = i / count;
      const tEnd = (i + 1) / count;
      const tMid = (tStart + tEnd) / 2;

      const pStart = curve.getPointAt(tStart);
      const pEnd = curve.getPointAt(tEnd);
      const pMid = curve.getPointAt(tMid);
      const tangent = curve.getTangentAt(tMid);

      const midX = pMid.x;
      const midZ = pMid.z;
      const groundY = this.terrain.getHeightAt(midX, midZ);
      const dist = pStart.distanceTo(pEnd);
      const angle = Math.atan2(tangent.x, tangent.z);

      const segGroup = new THREE.Group();
      segGroup.position.set(midX, groundY, midZ);
      segGroup.rotation.y = angle;

      if (variation === 'stone') {
        const bodyGeo = new THREE.BoxGeometry(wallThick, wallHeight, dist);
        const body = new THREE.Mesh(bodyGeo, this.materials.stoneWall);
        body.position.y = wallHeight / 2;
        body.castShadow = !isPreview;
        body.receiveShadow = !isPreview;
        segGroup.add(body);

        const crenelGeo = new THREE.BoxGeometry(wallThick + 0.05, 0.35, dist * 0.38);
        const crenel = new THREE.Mesh(crenelGeo, this.materials.stoneCap);
        crenel.position.set(0, wallHeight + 0.175, 0);
        crenel.castShadow = !isPreview;
        segGroup.add(crenel);

      } else if (variation === 'wood') {
        const railGeo = new THREE.BoxGeometry(wallThick, 0.1, dist);
        const topRail = new THREE.Mesh(railGeo, this.materials.woodFence);
        topRail.position.y = wallHeight * 0.85;
        topRail.castShadow = !isPreview;
        segGroup.add(topRail);

        const botRail = new THREE.Mesh(railGeo, this.materials.woodFence);
        botRail.position.y = wallHeight * 0.45;
        botRail.castShadow = !isPreview;
        segGroup.add(botRail);

      } else if (variation === 'hedge') {
        const hedgeGeo = new THREE.BoxGeometry(wallThick * 1.4, wallHeight * 0.9, dist * 0.98);
        const hedge = new THREE.Mesh(hedgeGeo, this.materials.hedgeLeaf);
        hedge.position.y = wallHeight * 0.45;
        hedge.castShadow = !isPreview;
        segGroup.add(hedge);
      }

      wallGroup.add(segGroup);
      wallGroup.userData.segments.push(segGroup);

      // Pillar at joint
      this.addPillar(wallGroup, pEnd.x, pEnd.z, wallHeight, wallThick, variation, isPreview);
    }

    if (isPreview) {
      wallGroup.traverse((child) => {
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

    return wallGroup;
  }

  generate(params) {
    const { startPoint, endPoint, variation = 'stone', isPreview = false } = params;

    const wallGroup = new THREE.Group();
    wallGroup.userData = {
      type: 'wall',
      variation,
      startPoint: startPoint.clone(),
      endPoint: endPoint.clone(),
      segments: []
    };

    const dx = endPoint.x - startPoint.x;
    const dz = endPoint.z - startPoint.z;
    const totalDist = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);

    const segmentLen = 1.2;
    const count = Math.max(1, Math.round(totalDist / segmentLen));
    const stepX = dx / count;
    const stepZ = dz / count;

    const wallHeight = (variation === 'wood') ? 1.0 : 1.35;
    const wallThick = (variation === 'wood') ? 0.15 : 0.45;

    // Pillar at start
    this.addPillar(wallGroup, startPoint.x, startPoint.z, wallHeight, wallThick, variation, isPreview);

    // Build segments along the line
    for (let i = 0; i < count; i++) {
      const segStartX = startPoint.x + stepX * i;
      const segStartZ = startPoint.z + stepZ * i;
      const segEndX = startPoint.x + stepX * (i + 1);
      const segEndZ = startPoint.z + stepZ * (i + 1);

      const midX = (segStartX + segEndX) / 2;
      const midZ = (segStartZ + segEndZ) / 2;
      const groundY = this.terrain.getHeightAt(midX, midZ);
      const dist = Math.hypot(segEndX - segStartX, segEndZ - segStartZ);

      const segGroup = new THREE.Group();
      segGroup.position.set(midX, groundY, midZ);
      segGroup.rotation.y = angle;

      if (variation === 'stone') {
        // Main Stone Wall Body
        const bodyGeo = new THREE.BoxGeometry(wallThick, wallHeight, dist);
        const body = new THREE.Mesh(bodyGeo, this.materials.stoneWall);
        body.position.y = wallHeight / 2;
        body.castShadow = !isPreview;
        body.receiveShadow = !isPreview;
        segGroup.add(body);

        // Crenellations (Battlements on top)
        const crenelGeo = new THREE.BoxGeometry(wallThick + 0.05, 0.35, dist * 0.38);
        const crenel = new THREE.Mesh(crenelGeo, this.materials.stoneCap);
        crenel.position.set(0, wallHeight + 0.175, 0);
        crenel.castShadow = !isPreview;
        segGroup.add(crenel);

      } else if (variation === 'wood') {
        // Wooden Rail Fence
        const railGeo = new THREE.BoxGeometry(wallThick, 0.1, dist);
        const topRail = new THREE.Mesh(railGeo, this.materials.woodFence);
        topRail.position.y = wallHeight * 0.85;
        topRail.castShadow = !isPreview;
        segGroup.add(topRail);

        const botRail = new THREE.Mesh(railGeo, this.materials.woodFence);
        botRail.position.y = wallHeight * 0.45;
        botRail.castShadow = !isPreview;
        segGroup.add(botRail);

      } else if (variation === 'hedge') {
        // Lush Leafy Hedge
        const hedgeGeo = new THREE.BoxGeometry(wallThick * 1.4, wallHeight * 0.9, dist * 0.98);
        const hedge = new THREE.Mesh(hedgeGeo, this.materials.hedgeLeaf);
        hedge.position.y = wallHeight * 0.45;
        hedge.castShadow = !isPreview;
        segGroup.add(hedge);
      }

      wallGroup.add(segGroup);
      wallGroup.userData.segments.push(segGroup);

      // Pillar at end of segment
      this.addPillar(wallGroup, segEndX, segEndZ, wallHeight, wallThick, variation, isPreview);
    }

    if (isPreview) {
      wallGroup.traverse((child) => {
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

    return wallGroup;
  }

  addPillar(parent, x, z, height, wallThick, variation, isPreview) {
    const groundY = this.terrain.getHeightAt(x, z);
    const pillarGroup = new THREE.Group();
    pillarGroup.position.set(x, groundY, z);

    if (variation === 'stone') {
      const pThick = wallThick * 1.35;
      const pGeo = new THREE.BoxGeometry(pThick, height + 0.3, pThick);
      const pillar = new THREE.Mesh(pGeo, this.materials.stoneWall);
      pillar.position.y = (height + 0.3) / 2;
      pillar.castShadow = !isPreview;
      pillarGroup.add(pillar);

      // Capstone pyramid
      const capGeo = new THREE.ConeGeometry(pThick * 0.8, 0.3, 4);
      capGeo.rotateY(Math.PI / 4);
      const cap = new THREE.Mesh(capGeo, this.materials.stoneCap);
      cap.position.y = height + 0.45;
      pillarGroup.add(cap);

    } else if (variation === 'wood') {
      const pGeo = new THREE.CylinderGeometry(0.1, 0.12, height + 0.2, 6);
      const pillar = new THREE.Mesh(pGeo, this.materials.woodFence);
      pillar.position.y = (height + 0.2) / 2;
      pillar.castShadow = !isPreview;
      pillarGroup.add(pillar);
    }

    parent.add(pillarGroup);
  }
}
