import * as THREE from 'three';

export class PopulationSystem {
  constructor(parentGroup, terrain, camera) {
    this.parentGroup = parentGroup;
    this.terrain = terrain;
    this.camera = camera;

    this.villagers = [];
    this.sheep = [];
    this.birds = [];

    this.popGroup = new THREE.Group();
    this.parentGroup.add(this.popGroup);

    this.emoteContainer = document.getElementById('emote-container');

    // Shared Materials
    this.materials = {
      skin: new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.6 }),
      cloakRed: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.7 }),
      cloakBlue: new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.7 }),
      cloakGreen: new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.7 }),
      cloakAmber: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 }),
      hatDark: new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 }),
      woodStaff: new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 }),
      sheepWool: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.95 }),
      sheepFace: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 }),
      birdFeather: new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.5 })
    };

    this.initPopulation();
    this.setupBuildingReactionListener();
  }

  initPopulation() {
    // Spawn 5 cute miniature villagers with varying cloak colors
    const cloaks = [this.materials.cloakRed, this.materials.cloakBlue, this.materials.cloakGreen, this.materials.cloakAmber];

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + 0.3;
      const dist = 3.5 + Math.random() * 4.0;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const mat = cloaks[i % cloaks.length];

      this.spawnVillager(x, z, mat);
    }

    // Spawn 4 fluffy sheep
    for (let s = 0; s < 4; s++) {
      const angle = (s / 4) * Math.PI * 2 + 1.2;
      const dist = 5.0 + Math.random() * 3.5;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      this.spawnSheep(x, z);
    }
  }

  spawnVillager(x, z, cloakMat) {
    const vGroup = new THREE.Group();
    const groundY = this.terrain.getHeightAt(x, z);
    vGroup.position.set(x, groundY, z);

    // 1. Cloak Body (Tapered Cone/Cylinder)
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.32, 0.75, 8);
    const body = new THREE.Mesh(bodyGeo, cloakMat);
    body.position.y = 0.45;
    body.castShadow = true;
    vGroup.add(body);

    // 2. Head / Face (Round sphere)
    const headGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const head = new THREE.Mesh(headGeo, this.materials.skin);
    head.position.y = 0.92;
    head.castShadow = true;
    vGroup.add(head);

    // 3. Pointed Traveller's Hat
    const hatGeo = new THREE.ConeGeometry(0.24, 0.42, 8);
    const hat = new THREE.Mesh(hatGeo, this.materials.hatDark);
    hat.position.y = 1.15;
    hat.rotation.z = -0.15;
    vGroup.add(hat);

    // 4. Tiny Backpack
    const packGeo = new THREE.BoxGeometry(0.2, 0.28, 0.16);
    const pack = new THREE.Mesh(packGeo, this.materials.hatDark);
    pack.position.set(0, 0.5, -0.22);
    vGroup.add(pack);

    // 5. Walking Stick / Staff
    const staffGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.95, 4);
    const staff = new THREE.Mesh(staffGeo, this.materials.woodStaff);
    staff.position.set(0.24, 0.48, 0.12);
    vGroup.add(staff);

    this.popGroup.add(vGroup);

    // Villager AI State
    this.villagers.push({
      mesh: vGroup,
      target: new THREE.Vector3(x, groundY, z),
      state: 'idle', // 'idle' | 'walking' | 'inspecting'
      stateTimer: 1 + Math.random() * 3,
      speed: 1.1 + Math.random() * 0.4,
      walkPhase: Math.random() * Math.PI,
      staff: staff,
      body: body
    });
  }

  spawnSheep(x, z) {
    const sGroup = new THREE.Group();
    const groundY = this.terrain.getHeightAt(x, z);
    sGroup.position.set(x, groundY, z);

    // Woolly Body
    const woolGeo = new THREE.DodecahedronGeometry(0.36, 1);
    woolGeo.scale(1.3, 1.0, 1.1);
    const wool = new THREE.Mesh(woolGeo, this.materials.sheepWool);
    wool.position.y = 0.38;
    wool.castShadow = true;
    sGroup.add(wool);

    // Head
    const headGeo = new THREE.SphereGeometry(0.14, 6, 6);
    const head = new THREE.Mesh(headGeo, this.materials.sheepFace);
    head.position.set(0.38, 0.42, 0);
    sGroup.add(head);

    // Tiny 4 Legs
    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.22, 4);
    const legPos = [
      [0.2, 0.11, 0.18],
      [0.2, 0.11, -0.18],
      [-0.2, 0.11, 0.18],
      [-0.2, 0.11, -0.18]
    ];
    legPos.forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, this.materials.sheepFace);
      leg.position.set(lx, ly, lz);
      sGroup.add(leg);
    });

    this.popGroup.add(sGroup);

    this.sheep.push({
      mesh: sGroup,
      target: new THREE.Vector3(x, groundY, z),
      state: 'grazing',
      stateTimer: 2 + Math.random() * 4,
      speed: 0.6 + Math.random() * 0.3,
      hopPhase: 0
    });
  }

  setupBuildingReactionListener() {
    window.addEventListener('object-built', (e) => {
      const { type, position } = e.detail;
      this.reactToConstruction(position, type);
    });
  }

  reactToConstruction(buildPos, type) {
    // Find closest 1-2 villagers
    let closest = null;
    let minDist = Infinity;

    this.villagers.forEach((v) => {
      const d = v.mesh.position.distanceTo(buildPos);
      if (d < minDist) {
        minDist = d;
        closest = v;
      }
    });

    if (closest) {
      // Pick a spot near the building to walk to
      const angle = Math.random() * Math.PI * 2;
      const offsetDist = 2.2 + Math.random() * 1.0;
      const targetX = buildPos.x + Math.cos(angle) * offsetDist;
      const targetZ = buildPos.z + Math.sin(angle) * offsetDist;
      const targetY = this.terrain.getHeightAt(targetX, targetZ);

      closest.target.set(targetX, targetY, targetZ);
      closest.state = 'inspecting';
      closest.stateTimer = 6.0; // Stay interested for a few seconds

      // Show Emote Bubble
      const emojis = {
        house: '🏠 ✨',
        wall: '🧱 👍',
        tree: '🌸 🌿',
        pond: '💧 🦆',
        prop: '🏮 ❤️'
      };
      const emoji = emojis[type] || '❤️';
      this.showEmoteBubble(closest.mesh.position, emoji);
    }
  }

  showEmoteBubble(worldPos, text) {
    if (!this.emoteContainer) return;

    // Convert 3D world pos to 2D screen coordinate
    const screenPos = worldPos.clone();
    screenPos.y += 1.4; // Above villager head
    screenPos.project(this.camera);

    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;

    const bubble = document.createElement('div');
    bubble.className = 'world-emote';
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    bubble.textContent = text;

    this.emoteContainer.appendChild(bubble);

    // Auto-remove after animation finishes
    setTimeout(() => {
      if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
    }, 1800);
  }

  pickRandomTargetOnIsland(currentPos, maxRadius = 13) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 1.0 + Math.random() * (maxRadius - 1.5);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = this.terrain.getHeightAt(x, z);
    return new THREE.Vector3(x, y, z);
  }

  update(delta) {
    // -------------------------------------------------------------
    // 1. Villagers AI & Waddling Walk Cycle
    // -------------------------------------------------------------
    this.villagers.forEach((v) => {
      v.stateTimer -= delta;

      if (v.state === 'idle') {
        if (v.stateTimer <= 0) {
          // Switch to walking
          v.target = this.pickRandomTargetOnIsland(v.mesh.position);
          v.state = 'walking';
          v.stateTimer = 5 + Math.random() * 6;
        }
      } else if (v.state === 'walking' || v.state === 'inspecting') {
        const dx = v.target.x - v.mesh.position.x;
        const dz = v.target.z - v.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.3) {
          // Move towards target
          const dirX = dx / dist;
          const dirZ = dz / dist;

          v.mesh.position.x += dirX * v.speed * delta;
          v.mesh.position.z += dirZ * v.speed * delta;
          v.mesh.position.y = this.terrain.getHeightAt(v.mesh.position.x, v.mesh.position.z);

          // Face direction of movement
          v.mesh.rotation.y = Math.atan2(dirX, dirZ);

          // Waddling Walk Animation (gentle tilt left and right)
          v.walkPhase += delta * 9.0;
          v.mesh.rotation.z = Math.sin(v.walkPhase) * 0.12;

          // Staff tapping
          if (v.staff) {
            v.staff.rotation.x = Math.sin(v.walkPhase) * 0.35;
          }
        } else {
          // Reached target
          v.mesh.rotation.z = 0;
          v.state = 'idle';
          v.stateTimer = 2.5 + Math.random() * 4.0;
        }

        if (v.stateTimer <= 0) {
          v.mesh.rotation.z = 0;
          v.state = 'idle';
          v.stateTimer = 3.0;
        }
      }
    });

    // -------------------------------------------------------------
    // 2. Sheep AI & Grazing / Hopping
    // -------------------------------------------------------------
    this.sheep.forEach((s) => {
      s.stateTimer -= delta;

      if (s.state === 'grazing') {
        // Head down chewing grass
        s.mesh.rotation.x = 0.25;
        if (s.stateTimer <= 0) {
          s.target = this.pickRandomTargetOnIsland(s.mesh.position, 12);
          s.state = 'walking';
          s.stateTimer = 4 + Math.random() * 5;
        }
      } else if (s.state === 'walking') {
        s.mesh.rotation.x = 0;
        const dx = s.target.x - s.mesh.position.x;
        const dz = s.target.z - s.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.3) {
          const dirX = dx / dist;
          const dirZ = dz / dist;

          s.mesh.position.x += dirX * s.speed * delta;
          s.mesh.position.z += dirZ * s.speed * delta;
          const groundY = this.terrain.getHeightAt(s.mesh.position.x, s.mesh.position.z);

          // Little joyful hop
          s.hopPhase += delta * 7;
          s.mesh.position.y = groundY + Math.abs(Math.sin(s.hopPhase)) * 0.12;
          s.mesh.rotation.y = Math.atan2(dirX, dirZ);
        } else {
          s.state = 'grazing';
          s.stateTimer = 3 + Math.random() * 4;
        }

        if (s.stateTimer <= 0) {
          s.state = 'grazing';
          s.stateTimer = 3;
        }
      }
    });
  }
}
