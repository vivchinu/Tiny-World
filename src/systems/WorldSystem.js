import * as THREE from 'three';

export class WorldSystem {
  constructor(parentGroup, terrain, generators, animSystem, audioSystem) {
    this.parentGroup = parentGroup;
    this.terrain = terrain;
    this.generators = generators;
    this.animSystem = animSystem;
    this.audioSystem = audioSystem;

    this.objects = []; // All placed 3D objects
    this.undoStack = [];
    this.redoStack = [];

    this.STORAGE_KEY = 'tiny_world_saved_data';
  }

  addObject(objGroup, recordUndo = true) {
    this.parentGroup.add(objGroup);
    this.objects.push(objGroup);

    if (recordUndo) {
      this.undoStack.push({ type: 'add', object: objGroup });
      this.redoStack = []; // Clear redo stack on new action
    }

    // Play build audio
    if (this.audioSystem) {
      if (objGroup.userData.type === 'house') this.audioSystem.playBuildChord();
      else if (objGroup.userData.type === 'wall') this.audioSystem.playWallClick();
      else if (objGroup.userData.type === 'tree') this.audioSystem.playPop();
      else if (objGroup.userData.type === 'pond') this.audioSystem.playWaterSplash();
      else this.audioSystem.playPop();
    }

    // Trigger population reaction
    window.dispatchEvent(new CustomEvent('object-built', {
      detail: {
        type: objGroup.userData.type,
        position: objGroup.position.clone()
      }
    }));

    return objGroup;
  }

  removeObject(objGroup, recordUndo = true) {
    const idx = this.objects.indexOf(objGroup);
    if (idx === -1) return;

    if (recordUndo) {
      this.undoStack.push({ type: 'remove', object: objGroup });
      this.redoStack = [];
    }

    if (this.audioSystem) {
      this.audioSystem.playDemolish();
    }

    this.animSystem.animateDemolish(objGroup, () => {
      this.parentGroup.remove(objGroup);
      const curIdx = this.objects.indexOf(objGroup);
      if (curIdx !== -1) {
        this.objects.splice(curIdx, 1);
      }
      this.disposeObject(objGroup);
    });
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    const action = this.undoStack.pop();

    if (action.type === 'add') {
      const idx = this.objects.indexOf(action.object);
      if (idx !== -1) {
        this.objects.splice(idx, 1);
        this.parentGroup.remove(action.object);
        this.redoStack.push({ type: 'add', object: action.object });
      }
    } else if (action.type === 'remove') {
      this.parentGroup.add(action.object);
      this.objects.push(action.object);
      this.redoStack.push({ type: 'remove', object: action.object });
    }
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const action = this.redoStack.pop();

    if (action.type === 'add') {
      this.parentGroup.add(action.object);
      this.objects.push(action.object);
      this.undoStack.push({ type: 'add', object: action.object });
    } else if (action.type === 'remove') {
      const idx = this.objects.indexOf(action.object);
      if (idx !== -1) {
        this.objects.splice(idx, 1);
        this.parentGroup.remove(action.object);
        this.undoStack.push({ type: 'remove', object: action.object });
      }
    }
    return true;
  }

  clearAll() {
    this.objects.forEach((obj) => {
      this.parentGroup.remove(obj);
      this.disposeObject(obj);
    });
    this.objects = [];
    this.undoStack = [];
    this.redoStack = [];
  }

  disposeObject(objGroup) {
    objGroup.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
      }
    });
  }

  // Load Preset Dioramas
  loadPreset(presetName) {
    this.clearAll();

    if (presetName === 'blank') {
      return;
    }

    if (presetName === 'hamlet') {
      // 1. Cottage 1 (Main Residence)
      const h1 = this.generators.house.generate({
        position: new THREE.Vector3(-4.5, this.terrain.getHeightAt(-4.5, -1.0), -1.0),
        width: 4.6,
        depth: 5.2,
        height: 3.2,
        rotation: 0.2,
        variation: 'cottage'
      });
      this.addObject(h1, false);
      this.animSystem.animateHouse(h1);

      // 2. Cottage 2 (Small Workshop)
      const h2 = this.generators.house.generate({
        position: new THREE.Vector3(5.0, this.terrain.getHeightAt(5.0, 3.5), 3.5),
        width: 3.4,
        depth: 3.8,
        height: 2.8,
        rotation: -0.4,
        variation: 'manor'
      });
      this.addObject(h2, false);
      this.animSystem.animateHouse(h2);

      // 3. Cobblestone Path connecting the two
      const p1 = this.generators.path.generate({
        startPoint: new THREE.Vector3(-2.0, 0, 1.0),
        endPoint: new THREE.Vector3(3.2, 0, 2.5),
        variation: 'cobble'
      });
      this.addObject(p1, false);

      // 4. Garden Wall
      const w1 = this.generators.wall.generate({
        startPoint: new THREE.Vector3(-1.0, 0, -4.5),
        endPoint: new THREE.Vector3(5.5, 0, -3.8),
        variation: 'stone'
      });
      this.addObject(w1, false);
      this.animSystem.animateWall(w1);

      // 5. Trees
      const t1 = this.generators.tree.createAtPoint(new THREE.Vector3(-7.5, 0, 4.5), 'oak');
      this.addObject(t1, false);
      this.animSystem.animateTree(t1);

      const t2 = this.generators.tree.createAtPoint(new THREE.Vector3(2.5, 0, -6.5), 'birch');
      this.addObject(t2, false);
      this.animSystem.animateTree(t2);

      // 6. Street Lanterns & Bench
      const l1 = this.generators.prop.createAtPoint(new THREE.Vector3(-0.5, 0, 0.4), 'lantern');
      this.addObject(l1, false);

      const b1 = this.generators.prop.createAtPoint(new THREE.Vector3(1.2, 0, 0.2), 'bench');
      this.addObject(b1, false);

    } else if (presetName === 'lakeside') {
      // Tranquil Pond
      const pond = this.generators.pond.generate({
        position: new THREE.Vector3(1.5, this.terrain.getHeightAt(1.5, 0.5), 0.5),
        radius: 4.2,
        variation: 'pond'
      });
      this.addObject(pond, false);
      this.animSystem.animateGenericSpring(pond);

      // Lake Cottage
      const h1 = this.generators.house.generate({
        position: new THREE.Vector3(-5.5, this.terrain.getHeightAt(-5.5, -3.0), -3.0),
        width: 4.2,
        depth: 4.8,
        height: 3.0,
        rotation: 0.35,
        variation: 'mossy'
      });
      this.addObject(h1, false);
      this.animSystem.animateHouse(h1);

      // Campfire with Firelight by the lake
      const fire = this.generators.prop.createAtPoint(new THREE.Vector3(-2.2, 0, 3.8), 'campfire');
      this.addObject(fire, false);

      // Willow & Birch Trees
      const t1 = this.generators.tree.createAtPoint(new THREE.Vector3(6.5, 0, -2.5), 'autumn');
      this.addObject(t1, false);
      this.animSystem.animateTree(t1);

      const t2 = this.generators.tree.createAtPoint(new THREE.Vector3(5.8, 0, 4.8), 'oak');
      this.addObject(t2, false);
      this.animSystem.animateTree(t2);

      // Wooden fence
      const fence = this.generators.wall.generate({
        startPoint: new THREE.Vector3(-7.5, 0, 2.0),
        endPoint: new THREE.Vector3(-4.5, 0, 5.5),
        variation: 'wood'
      });
      this.addObject(fence, false);
      this.animSystem.animateWall(fence);

    } else if (presetName === 'sakura') {
      // Windmill / Shrine
      const shrine = this.generators.house.generate({
        position: new THREE.Vector3(0, this.terrain.getHeightAt(0, 0), 0),
        width: 3.8,
        depth: 4.2,
        height: 3.6,
        rotation: 0,
        variation: 'manor'
      });
      this.addObject(shrine, false);
      this.animSystem.animateHouse(shrine);

      // Stepping stones path
      const p1 = this.generators.path.generate({
        startPoint: new THREE.Vector3(0, 0, 2.5),
        endPoint: new THREE.Vector3(0, 0, 7.8),
        variation: 'stepping'
      });
      this.addObject(p1, false);

      // Sakura trees flanking
      const s1 = this.generators.tree.createAtPoint(new THREE.Vector3(-4.2, 0, 2.5), 'sakura');
      this.addObject(s1, false);
      this.animSystem.animateTree(s1);

      const s2 = this.generators.tree.createAtPoint(new THREE.Vector3(4.2, 0, 2.5), 'sakura');
      this.addObject(s2, false);
      this.animSystem.animateTree(s2);

      const s3 = this.generators.tree.createAtPoint(new THREE.Vector3(-3.5, 0, -4.5), 'sakura');
      this.addObject(s3, false);
      this.animSystem.animateTree(s3);

      const s4 = this.generators.tree.createAtPoint(new THREE.Vector3(3.5, 0, -4.5), 'sakura');
      this.addObject(s4, false);
      this.animSystem.animateTree(s4);

      // Flower patches & Stone well
      const well = this.generators.prop.createAtPoint(new THREE.Vector3(-3.2, 0, -1.0), 'well');
      this.addObject(well, false);

      const fl = this.generators.prop.createAtPoint(new THREE.Vector3(2.8, 0, 5.2), 'flowers');
      this.addObject(fl, false);
    }
  }

  update(delta, time) {
    // Dynamic updates for placed world objects (smoke particles, ducks, flames, windmills)
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i];
      const ud = obj.userData;

      // 1. Chimney Smoke Puffs
      if (ud.smokeParticles && ud.smokeParticles.length > 0) {
        ud.smokeParticles.forEach((puff) => {
          const pud = puff.userData;
          puff.position.y += delta * pud.speed;
          puff.position.x += Math.sin(time * 2 + pud.offsetY) * 0.005;
          puff.position.z += Math.cos(time * 2 + pud.offsetY) * 0.005;

          const hRatio = (puff.position.y - pud.baseY) / pud.maxHeight;
          puff.scale.setScalar(1 + hRatio * 1.5);
          puff.material.opacity = Math.max(0, 0.65 * (1 - hRatio));

          if (puff.position.y - pud.baseY > pud.maxHeight) {
            puff.position.y = pud.baseY;
          }
        });
      }

      // 2. Windmill Rotor Blades
      if (ud.rotorGroup) {
        ud.rotorGroup.rotation.z += delta * 1.2;
      }

      // 3. Swimming Pond Ducks
      if (ud.ducks && ud.ducks.length > 0) {
        ud.ducks.forEach((duck) => {
          duck.userData.orbitAngle += delta * duck.userData.speed;
          const a = duck.userData.orbitAngle;
          const r = duck.userData.orbitRadius;
          duck.position.x = Math.cos(a) * r;
          duck.position.z = Math.sin(a) * r;
          duck.rotation.y = -a + Math.PI; // Face forward along tangent
          // Gentle bobbing
          duck.position.y = 0.16 + Math.sin(time * 4) * 0.02;
        });
      }

      // 4. Campfire & Lantern Light Flickering
      if (ud.flickerLight) {
        ud.flickerLight.intensity = 1.6 + Math.sin(time * 12 + i) * 0.35 + (Math.random() - 0.5) * 0.15;
      }

      if (ud.flameMesh) {
        const s = 1.0 + Math.sin(time * 16) * 0.15;
        ud.flameMesh.scale.set(s, 1.0 + Math.cos(time * 14) * 0.2, s);
      }

      // 5. Tree gentle wind sway
      if (ud.foliageGroup) {
        const sway = Math.sin(time * 1.8 + ud.swayOffset) * 0.035;
        ud.foliageGroup.rotation.z = sway;
        ud.foliageGroup.rotation.x = sway * 0.7;
      }
    }
  }
}
