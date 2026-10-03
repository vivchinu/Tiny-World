import * as THREE from 'three';

export class PathGenerator {
  constructor(terrain) {
    this.terrain = terrain;

    this.materials = {
      stonePaver1: new THREE.MeshStandardMaterial({
        color: 0x94a3b8, // Slate paver
        roughness: 0.9,
        flatShading: true
      }),
      stonePaver2: new THREE.MeshStandardMaterial({
        color: 0xcbd5e1, // Light granite
        roughness: 0.85,
        flatShading: true
      }),
      dirtTrail: new THREE.MeshStandardMaterial({
        color: 0x78553d, // Warm soil
        roughness: 0.95,
        flatShading: true
      }),
      grassTuft: new THREE.MeshStandardMaterial({
        color: 0x65a30d,
        roughness: 0.8,
        flatShading: true
      })
    };
  }

  createFromPoints(startPoint, endPoint, variation = 'cobble', isPreview = false, pointsPath = null) {
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
    const { pointsPath, variation = 'cobble', isPreview = false } = params;

    const pathGroup = new THREE.Group();
    pathGroup.userData = {
      type: 'path',
      variation,
      pointsPath: pointsPath.map(p => p.clone()),
      stones: []
    };

    const curve = new THREE.CatmullRomCurve3(pointsPath);
    const totalLength = curve.getLength();

    if (totalLength < 0.4) return pathGroup;

    const stoneSpacing = 0.55;
    const count = Math.max(2, Math.round(totalLength / stoneSpacing));

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);

      // Normal perpendicular to tangent vector on XZ plane
      const normX = -tangent.z;
      const normZ = tangent.x;

      const stonesInRow = (variation === 'stepping') ? 1 : 2;

      for (let s = 0; s < stonesInRow; s++) {
        const offsetDist = (variation === 'stepping')
          ? (Math.random() - 0.5) * 0.25
          : (s === 0 ? -0.32 : 0.32) + (Math.random() - 0.5) * 0.18;

        const stoneX = point.x + normX * offsetDist;
        const stoneZ = point.z + normZ * offsetDist;
        const groundY = this.terrain.getHeightAt(stoneX, stoneZ);

        const radX = (variation === 'stepping') ? 0.35 + Math.random() * 0.1 : 0.24 + Math.random() * 0.12;
        const radZ = (variation === 'stepping') ? 0.35 + Math.random() * 0.1 : 0.22 + Math.random() * 0.1;
        const thickness = 0.08;

        const stoneGeo = new THREE.CylinderGeometry(radX, radZ, thickness, 6);
        const mat = (Math.random() > 0.5) ? this.materials.stonePaver1 : this.materials.stonePaver2;
        const stone = new THREE.Mesh(stoneGeo, mat);

        stone.position.set(stoneX, groundY + thickness / 2 + 0.01, stoneZ);
        stone.rotation.y = Math.random() * Math.PI;
        stone.rotation.x = (Math.random() - 0.5) * 0.05;
        stone.rotation.z = (Math.random() - 0.5) * 0.05;
        stone.receiveShadow = !isPreview;
        stone.castShadow = !isPreview;

        pathGroup.add(stone);
        pathGroup.userData.stones.push(stone);
      }

      if (i % 3 === 0 && !isPreview) {
        const grassOffset = (Math.random() > 0.5 ? 0.65 : -0.65);
        const gx = point.x + normX * grassOffset;
        const gz = point.z + normZ * grassOffset;
        const gy = this.terrain.getHeightAt(gx, gz);

        const tuftGeo = new THREE.ConeGeometry(0.12, 0.28, 4);
        const tuft = new THREE.Mesh(tuftGeo, this.materials.grassTuft);
        tuft.position.set(gx, gy + 0.14, gz);
        tuft.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
        pathGroup.add(tuft);
      }
    }

    if (isPreview) {
      pathGroup.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: 0.5,
            roughness: 0.4
          });
        }
      });
    }

    return pathGroup;
  }

  generate(params) {
    const { startPoint, endPoint, variation = 'cobble', isPreview = false } = params;

    const pathGroup = new THREE.Group();
    pathGroup.userData = {
      type: 'path',
      variation,
      startPoint: startPoint.clone(),
      endPoint: endPoint.clone(),
      stones: []
    };

    const dx = endPoint.x - startPoint.x;
    const dz = endPoint.z - startPoint.z;
    const totalDist = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);

    // Number of stone clusters along the path
    const stoneSpacing = 0.55;
    const count = Math.max(2, Math.round(totalDist / stoneSpacing));
    const stepX = dx / count;
    const stepZ = dz / count;

    // Normal vector perpendicular to path direction
    const normX = -dz / totalDist;
    const normZ = dx / totalDist;

    for (let i = 0; i <= count; i++) {
      const baseX = startPoint.x + stepX * i;
      const baseZ = startPoint.z + stepZ * i;

      // Stones in a cluster across path width (approx 1.2m wide)
      const stonesInRow = (variation === 'stepping') ? 1 : 2;

      for (let s = 0; s < stonesInRow; s++) {
        const offsetDist = (variation === 'stepping')
          ? (Math.random() - 0.5) * 0.25
          : (s === 0 ? -0.32 : 0.32) + (Math.random() - 0.5) * 0.18;

        const stoneX = baseX + normX * offsetDist;
        const stoneZ = baseZ + normZ * offsetDist;
        const groundY = this.terrain.getHeightAt(stoneX, stoneZ);

        // Irregular flat stone mesh
        const radX = (variation === 'stepping') ? 0.35 + Math.random() * 0.1 : 0.24 + Math.random() * 0.12;
        const radZ = (variation === 'stepping') ? 0.35 + Math.random() * 0.1 : 0.22 + Math.random() * 0.1;
        const thickness = 0.08;

        const stoneGeo = new THREE.CylinderGeometry(radX, radZ, thickness, 6);
        const mat = (Math.random() > 0.5) ? this.materials.stonePaver1 : this.materials.stonePaver2;
        const stone = new THREE.Mesh(stoneGeo, mat);

        stone.position.set(stoneX, groundY + thickness / 2 + 0.01, stoneZ);
        stone.rotation.y = Math.random() * Math.PI;
        stone.rotation.x = (Math.random() - 0.5) * 0.05;
        stone.rotation.z = (Math.random() - 0.5) * 0.05;
        stone.receiveShadow = !isPreview;
        stone.castShadow = !isPreview;

        pathGroup.add(stone);
        pathGroup.userData.stones.push(stone);
      }

      // Small wild grass tuft along path edge
      if (i % 3 === 0 && !isPreview) {
        const grassOffset = (Math.random() > 0.5 ? 0.65 : -0.65);
        const gx = baseX + normX * grassOffset;
        const gz = baseZ + normZ * grassOffset;
        const gy = this.terrain.getHeightAt(gx, gz);

        const tuftGeo = new THREE.ConeGeometry(0.12, 0.28, 4);
        const tuft = new THREE.Mesh(tuftGeo, this.materials.grassTuft);
        tuft.position.set(gx, gy + 0.14, gz);
        tuft.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
        pathGroup.add(tuft);
      }
    }

    if (isPreview) {
      pathGroup.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: 0.5,
            roughness: 0.4
          });
        }
      });
    }

    return pathGroup;
  }
}
