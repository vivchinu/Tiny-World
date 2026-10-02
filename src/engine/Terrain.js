import * as THREE from 'three';

export class Terrain {
  constructor(parentGroup) {
    this.parentGroup = parentGroup;
    this.radius = 16; // Island radius
    this.raycastMesh = null;
    this.terrainGroup = new THREE.Group();

    this.initIsland();
    this.initWaterfall();
    this.initFloatingSatellites();

    this.parentGroup.add(this.terrainGroup);
  }

  // Elevation calculation function for smooth organic terrain
  getHeightAt(x, z) {
    const distSq = x * x + z * z;
    const maxR = this.radius;
    if (distSq > maxR * maxR) return -10; // Outside island

    const dist = Math.sqrt(distSq);
    // Smooth falloff towards rim so buildings and paths sit naturally
    const edgeFactor = Math.max(0, 1 - Math.pow(dist / maxR, 3.0));

    // Gentle rolling hills
    const hill1 = Math.sin(x * 0.16) * Math.cos(z * 0.16) * 0.75;
    const hill2 = Math.sin(x * 0.32 + 1.2) * Math.sin(z * 0.32 + 0.8) * 0.35;
    const hill3 = Math.cos(x * 0.08 - z * 0.08) * 0.3;

    // Center plateau elevation
    const centerMound = Math.exp(-distSq / 65) * 1.1;

    const totalHeight = 1.0 + (hill1 + hill2 + hill3 + centerMound) * edgeFactor;
    return totalHeight;
  }

  initIsland() {
    // -------------------------------------------------------------
    // 1. Lush Green Top Grassy Surface (Concentric Ring Grid)
    // -------------------------------------------------------------
    const ringSegments = 64;
    const thetaSegments = 16;
    const topGeo = new THREE.CircleGeometry(this.radius, ringSegments, 0, Math.PI * 2);
    topGeo.rotateX(-Math.PI / 2);

    // Convert to indexed buffer with subdivisions along radius
    // Better yet: construct an explicit concentric radial mesh for clean rings
    const vertices = [];
    const indices = [];
    const uvs = [];

    // Center vertex
    vertices.push(0, this.getHeightAt(0, 0), 0);
    uvs.push(0.5, 0.5);

    const radialRings = 16;
    for (let r = 1; r <= radialRings; r++) {
      const radiusRatio = r / radialRings;
      const currentR = this.radius * radiusRatio;

      for (let s = 0; s < ringSegments; s++) {
        const theta = (s / ringSegments) * Math.PI * 2;
        const vx = Math.cos(theta) * currentR;
        const vz = Math.sin(theta) * currentR;
        const vy = this.getHeightAt(vx, vz);

        vertices.push(vx, vy, vz);
        uvs.push(0.5 + Math.cos(theta) * radiusRatio * 0.5, 0.5 + Math.sin(theta) * radiusRatio * 0.5);
      }
    }

    // Correct counter-clockwise winding so normal points up (+Y)
    for (let s = 0; s < ringSegments; s++) {
      const nextS = (s + 1) % ringSegments;
      indices.push(0, 1 + nextS, 1 + s);
    }

    // Indices for intermediate rings
    for (let r = 0; r < radialRings - 1; r++) {
      const ringStart = 1 + r * ringSegments;
      const nextRingStart = 1 + (r + 1) * ringSegments;

      for (let s = 0; s < ringSegments; s++) {
        const nextS = (s + 1) % ringSegments;

        const currentA = ringStart + s;
        const currentB = ringStart + nextS;
        const nextA = nextRingStart + s;
        const nextB = nextRingStart + nextS;

        indices.push(currentA, currentB, nextA);
        indices.push(currentB, nextB, nextA);
      }
    }

    const grassBufferGeo = new THREE.BufferGeometry();
    grassBufferGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    grassBufferGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    grassBufferGeo.setIndex(indices);
    grassBufferGeo.computeVertexNormals();

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x7cb342, // Lush vibrant meadow green
      roughness: 0.75,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide
    });

    this.topMesh = new THREE.Mesh(grassBufferGeo, grassMat);
    this.topMesh.receiveShadow = true;
    this.topMesh.castShadow = true;
    this.topMesh.name = 'terrain_ground';
    this.terrainGroup.add(this.topMesh);

    // Primary raycasting target
    this.raycastMesh = this.topMesh;

    // -------------------------------------------------------------
    // 2. Vertical Cliff Edge & Tapering Rocky Underbelly
    // -------------------------------------------------------------
    const cliffVerts = [];
    const cliffIndices = [];

    for (let s = 0; s < ringSegments; s++) {
      const theta = (s / ringSegments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const vx = cosT * this.radius;
      const vz = sinT * this.radius;
      const topY = this.getHeightAt(vx, vz);

      // Level 0 (Just below rim edge)
      cliffVerts.push(vx, topY - 0.08, vz);

      // Level 1 (Cliff drop)
      const noise1 = (Math.sin(vx * 0.6) + Math.cos(vz * 0.6)) * 0.25;
      cliffVerts.push(vx * (1.0 + noise1 * 0.04), -0.8 + noise1, vz * (1.0 + noise1 * 0.04));

      // Level 2 (Mid-rock strata)
      const noise2 = (Math.sin(vx * 0.4) + Math.sin(vz * 0.5)) * 0.6;
      const r2 = this.radius * (0.68 + noise2 * 0.05);
      cliffVerts.push(cosT * r2, -4.5 + noise2 * 0.4, sinT * r2);
    }

    // Tip vertex at bottom
    const tipIndex = ringSegments * 3;
    cliffVerts.push(0, -12, 0);

    // Connect quads between rows
    for (let s = 0; s < ringSegments; s++) {
      const nextS = (s + 1) % ringSegments;

      // Row 0 -> Row 1
      const l0_a = s * 3 + 0;
      const l0_b = nextS * 3 + 0;
      const l1_a = s * 3 + 1;
      const l1_b = nextS * 3 + 1;
      cliffIndices.push(l0_a, l1_a, l0_b);
      cliffIndices.push(l0_b, l1_a, l1_b);

      // Row 1 -> Row 2
      const l2_a = s * 3 + 2;
      const l2_b = nextS * 3 + 2;
      cliffIndices.push(l1_a, l2_a, l1_b);
      cliffIndices.push(l1_b, l2_a, l2_b);

      // Row 2 -> Tip
      cliffIndices.push(l2_a, tipIndex, l2_b);
    }

    const cliffGeo = new THREE.BufferGeometry();
    cliffGeo.setAttribute('position', new THREE.Float32BufferAttribute(cliffVerts, 3));
    cliffGeo.setIndex(cliffIndices);
    cliffGeo.computeVertexNormals();

    const cliffMat = new THREE.MeshStandardMaterial({
      color: 0x4a4036, // Deep earthy rock
      roughness: 0.95,
      metalness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide
    });

    this.cliffMesh = new THREE.Mesh(cliffGeo, cliffMat);
    this.cliffMesh.castShadow = true;
    this.cliffMesh.receiveShadow = true;
    this.terrainGroup.add(this.cliffMesh);

    // 3. Hanging Roots and Vines underneath
    this.initVines();

    // 4. Wildflower scatter on grass
    this.initScatterProps();
  }

  initVines() {
    const vineMat = new THREE.MeshStandardMaterial({
      color: 0x3f6212,
      roughness: 0.9,
      flatShading: true
    });

    const vineCount = 14;
    for (let i = 0; i < vineCount; i++) {
      const angle = (i / vineCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const dist = this.radius * (0.8 + Math.random() * 0.15);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const len = 3.0 + Math.random() * 4.5;

      const vineGeo = new THREE.CylinderGeometry(0.08, 0.02, len, 5);
      const vine = new THREE.Mesh(vineGeo, vineMat);
      vine.position.set(x, -len / 2 - 0.5, z);
      vine.rotation.z = (Math.random() - 0.5) * 0.3;
      vine.rotation.x = (Math.random() - 0.5) * 0.3;
      this.terrainGroup.add(vine);
    }
  }

  initScatterProps() {
    // Flower blossoms on the grass
    const flowerColors = [0xffffff, 0xfef08a, 0xf472b6, 0x60a5fa, 0xf87171];
    const flowerGeo = new THREE.DodecahedronGeometry(0.12, 0);

    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (this.radius * 0.88);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.getHeightAt(x, z);

      const col = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      const fMat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.8,
        flatShading: true
      });

      const flower = new THREE.Mesh(flowerGeo, fMat);
      flower.position.set(x, y + 0.08, z);
      flower.rotation.set(Math.random(), Math.random(), Math.random());
      flower.castShadow = true;
      this.terrainGroup.add(flower);
    }
  }

  initWaterfall() {
    const fallGroup = new THREE.Group();
    const fallAngle = Math.PI * 0.78;
    const edgeDist = this.radius * 0.96;
    const edgeX = Math.cos(fallAngle) * edgeDist;
    const edgeZ = Math.sin(fallAngle) * edgeDist;

    // Waterfall cascade sheet
    const waterGeo = new THREE.PlaneGeometry(2.4, 9, 8, 12);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide
    });

    this.waterfallMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterfallMesh.position.set(edgeX * 1.02, -4.5, edgeZ * 1.02);
    this.waterfallMesh.rotation.y = -fallAngle + Math.PI / 2;
    this.waterfallMesh.rotation.x = 0.08;
    fallGroup.add(this.waterfallMesh);

    // Mist cloud at bottom of fall
    const mistGeo = new THREE.DodecahedronGeometry(1.6, 1);
    const mistMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      transparent: true,
      opacity: 0.5,
      flatShading: true
    });
    const mist = new THREE.Mesh(mistGeo, mistMat);
    mist.position.set(edgeX * 1.05, -9, edgeZ * 1.05);
    fallGroup.add(mist);

    this.terrainGroup.add(fallGroup);
  }

  initFloatingSatellites() {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.9,
      flatShading: true
    });

    const satCount = 6;
    for (let i = 0; i < satCount; i++) {
      const angle = (i / satCount) * Math.PI * 2 + 0.4;
      const dist = this.radius + 4 + Math.random() * 6;
      const y = -1 + (Math.random() - 0.5) * 5;

      const satGeo = new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.8, 1);
      const sat = new THREE.Mesh(satGeo, rockMat);
      sat.position.set(Math.cos(angle) * dist, y, Math.sin(angle) * dist);
      sat.rotation.set(Math.random(), Math.random(), Math.random());
      sat.castShadow = true;
      this.terrainGroup.add(sat);
    }
  }

  update(time) {
    if (this.waterfallMesh) {
      const pos = this.waterfallMesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const wave = Math.sin(y * 2.0 - time * 6.0) * 0.08;
        pos.setZ(i, wave);
      }
      pos.needsUpdate = true;
    }
  }
}
