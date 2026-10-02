import * as THREE from 'three';

/**
 * Radial3DMenu - A Modern, Tactile 3D Radial UI for Meta Quest 3 Hand Tracking & WebXR
 * Features:
 * - High-end glassmorphic 3D discs with stereoscopic depth, chamfered bevels, and neon halos
 * - Central Core Hub showing current active tool with rotating 3D preview & title plaque
 * - Effortless Direct Touch / Poke collision (Right Index Fingertip pushes into 3D buttons)
 * - Rock-solid Raycast + Pinch with Hover-Lock Buffer to prevent finger-curl deflection
 * - Blooming radial expansion animation when Left Palm faces player's eyes
 * - Integrated AR Foundation Anchor Toggle (⚓ Locked vs 🔓 Free Float)
 */
export class Radial3DMenu {
  constructor(xrManager) {
    this.xr = xrManager;
    this.app = xrManager.app;
    this.scene = xrManager.scene;

    this.group = new THREE.Group();
    this.group.name = 'Radial3DMenu';
    this.group.visible = false;
    this.group.scale.setScalar(0.001);
    this.group.renderOrder = 9999;
    this.scene.add(this.group);

    // State
    this.isOpen = false;
    this.openProgress = 0.0;
    this.hoveredButton = null;
    this.hoveredTime = 0;
    this.activeToolId = 'house';

    // Touch / Poke tracking
    this.pokeActiveButton = null;
    this.pokeCooldown = 0;
    this.lastPinchClickTime = 0;

    // Button definitions (Radial satellite nodes)
    this.buttonDefs = [
      { id: 'house', label: '🏠', title: 'Cottage', color: 0xf97316, hex: '#f97316' },
      { id: 'wall', label: '🧱', title: 'Wall', color: 0x94a3b8, hex: '#94a3b8' },
      { id: 'path', label: '🛤️', title: 'Path', color: 0x64748b, hex: '#64748b' },
      { id: 'tree', label: '🌲', title: 'Tree', color: 0x22c55e, hex: '#22c55e' },
      { id: 'pond', label: '💧', title: 'Pond', color: 0x06b6d4, hex: '#06b6d4' },
      { id: 'prop', label: '🏮', title: 'Props', color: 0xeab308, hex: '#eab308' },
      { id: 'demolish', label: '🔨', title: 'Clear', color: 0xef4444, hex: '#ef4444' },
      { id: 'anchor', label: '⚓', title: 'Anchor: ON', color: 0x10b981, hex: '#10b981', isToggle: true },
      { id: 'time', label: '☀️', title: 'Time', color: 0xf59e0b, hex: '#f59e0b' },
      { id: 'undo', label: '↩️', title: 'Undo', color: 0x8b5cf6, hex: '#8b5cf6' }
    ];

    this.buttons = [];
    this.orbitRadius = 0.135; // 13.5cm radius orbit

    this.init();
  }

  init() {
    this.buildCenterHub();
    this.buildSatelliteButtons();
  }

  // ---------------------------------------------------------------------------
  // Central Core Hub (Displays Active Tool, Rotating 3D Preview, Title Plaque)
  // ---------------------------------------------------------------------------
  buildCenterHub() {
    this.centerHub = new THREE.Group();
    this.centerHub.position.set(0, 0, 0);

    // 1. Center Glass Disc Base
    const hubBaseGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.012, 32);
    hubBaseGeo.rotateX(Math.PI / 2);
    const hubBaseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.15,
      metalness: 0.4,
      transparent: true,
      opacity: 0.92,
      depthTest: true
    });
    this.hubBaseMesh = new THREE.Mesh(hubBaseGeo, hubBaseMat);
    this.hubBaseMesh.renderOrder = 9999;
    this.centerHub.add(this.hubBaseMesh);

    // 2. Beveled Metallic Rim Ring
    const rimGeo = new THREE.TorusGeometry(0.046, 0.0035, 16, 32);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xf6ad55,
      roughness: 0.25,
      metalness: 0.85
    });
    this.hubRimMesh = new THREE.Mesh(rimGeo, rimMat);
    this.hubRimMesh.renderOrder = 10000;
    this.centerHub.add(this.hubRimMesh);

    // 3. Neon Halo Backing
    const haloGeo = new THREE.RingGeometry(0.046, 0.054, 32);
    this.hubHaloMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthTest: false
    });
    this.hubHaloMesh = new THREE.Mesh(haloGeo, this.hubHaloMat);
    this.hubHaloMesh.position.z = -0.004;
    this.hubHaloMesh.renderOrder = 9998;
    this.centerHub.add(this.hubHaloMesh);

    // 4. Center 3D Preview Container (Rotating Miniature)
    this.previewContainer = new THREE.Group();
    this.previewContainer.position.set(0, 0.004, 0.016);
    this.previewContainer.scale.setScalar(0.024);
    this.centerHub.add(this.previewContainer);

    // Initial 3D preview model (Cottage)
    this.rebuildCenterPreview('house');

    // 5. Title Plaque beneath center orb
    this.titleCanvas = document.createElement('canvas');
    this.titleCanvas.width = 256;
    this.titleCanvas.height = 72;
    this.titleCtx = this.titleCanvas.getContext('2d');
    this.titleTex = new THREE.CanvasTexture(this.titleCanvas);
    this.titleTex.minFilter = THREE.LinearFilter;

    const titleMat = new THREE.MeshBasicMaterial({
      map: this.titleTex,
      transparent: true,
      depthTest: false
    });
    const titlePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.088, 0.025), titleMat);
    titlePlane.position.set(0, -0.034, 0.012);
    titlePlane.renderOrder = 10002;
    this.centerHub.add(titlePlane);

    this.updateTitleCanvas('Cottage', '#fed7aa');

    this.group.add(this.centerHub);
  }

  updateTitleCanvas(title, colorHex = '#fed7aa') {
    const ctx = this.titleCtx;
    ctx.clearRect(0, 0, 256, 72);

    // Pill background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(16, 8, 224, 56, 28);
    ctx.fill();

    // Border
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 128, 36);

    this.titleTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  // Satellite Orbiting Buttons
  // ---------------------------------------------------------------------------
  buildSatelliteButtons() {
    const total = this.buttonDefs.length;

    for (let i = 0; i < total; i++) {
      const def = this.buttonDefs[i];

      // Calculate radial angle: distribute nicely around circle starting from top
      // Top button (index 0) at angle = -PI/2
      const angle = -Math.PI / 2 + (i / total) * Math.PI * 2;
      const targetX = Math.cos(angle) * this.orbitRadius;
      const targetY = Math.sin(angle) * this.orbitRadius;

      const btnGroup = new THREE.Group();
      btnGroup.position.set(0, 0, 0); // starts at center for blooming
      btnGroup.userData = {
        def,
        index: i,
        angle,
        targetPos: new THREE.Vector3(targetX, targetY, 0),
        currentPressZ: 0,
        hoverScale: 1.0,
        isHovered: false,
        isPressed: false
      };

      // 1. Hitbox (Sphere for fast distance checking & raycasting)
      const hitGeo = new THREE.SphereGeometry(0.024, 12, 12);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { buttonGroup: btnGroup, def };
      btnGroup.add(hitMesh);
      btnGroup.userData.hitMesh = hitMesh;

      // 2. 3D Beveled Disc
      const discGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.008, 24);
      discGeo.rotateX(Math.PI / 2);
      const discMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.25,
        metalness: 0.35,
        transparent: true,
        opacity: 0.92,
        depthTest: true
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.renderOrder = 10000;
      btnGroup.add(discMesh);
      btnGroup.userData.discMesh = discMesh;

      // 3. Metallic Outer Bevel Rim
      const rimGeo = new THREE.TorusGeometry(0.022, 0.0024, 12, 24);
      const rimMat = new THREE.MeshStandardMaterial({
        color: def.color,
        roughness: 0.2,
        metalness: 0.8
      });
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.renderOrder = 10001;
      btnGroup.add(rimMesh);
      btnGroup.userData.rimMesh = rimMesh;

      // 4. Glowing Neon Halo Ring
      const haloGeo = new THREE.RingGeometry(0.022, 0.028, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthTest: false
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.z = -0.003;
      haloMesh.renderOrder = 9998;
      btnGroup.add(haloMesh);
      btnGroup.userData.haloMesh = haloMesh;

      // 5. Crisp 2D Icon Plane with Stereoscopic Depth
      const iconCanvas = document.createElement('canvas');
      iconCanvas.width = 128;
      iconCanvas.height = 128;
      const ctx = iconCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.font = '64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, 64, 64);

      const iconTex = new THREE.CanvasTexture(iconCanvas);
      iconTex.minFilter = THREE.LinearFilter;
      const iconMat = new THREE.MeshBasicMaterial({
        map: iconTex,
        transparent: true,
        depthTest: false
      });
      const iconPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.030, 0.030), iconMat);
      iconPlane.position.z = 0.007; // Pop forward in 3D
      iconPlane.renderOrder = 10002;
      btnGroup.add(iconPlane);
      btnGroup.userData.iconPlane = iconPlane;
      btnGroup.userData.iconCanvas = iconCanvas;
      btnGroup.userData.iconTex = iconTex;

      // 6. Floating Label Banner (Appears on hover or for active tool)
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 160;
      labelCanvas.height = 48;
      const lCtx = labelCanvas.getContext('2d');
      lCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      lCtx.beginPath();
      lCtx.roundRect(8, 4, 144, 40, 20);
      lCtx.fill();
      lCtx.fillStyle = '#ffffff';
      lCtx.font = 'bold 20px sans-serif';
      lCtx.textAlign = 'center';
      lCtx.textBaseline = 'middle';
      lCtx.fillText(def.title, 80, 24);

      const labelTex = new THREE.CanvasTexture(labelCanvas);
      const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthTest: false });
      const labelPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.046, 0.014), labelMat);
      labelPlane.position.set(0, -0.024, 0.008);
      labelPlane.renderOrder = 10003;
      labelPlane.visible = false;
      btnGroup.add(labelPlane);
      btnGroup.userData.labelPlane = labelPlane;

      this.group.add(btnGroup);
      this.buttons.push(btnGroup);
    }
  }

  // ---------------------------------------------------------------------------
  // 3D Miniature Model Preview inside Center Core
  // ---------------------------------------------------------------------------
  rebuildCenterPreview(toolId) {
    // Clear old preview
    while (this.previewContainer.children.length > 0) {
      const child = this.previewContainer.children[0];
      this.previewContainer.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    if (toolId === 'house') {
      const g = new THREE.Group();
      // Mini cottage body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.0, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xfaf5ef, roughness: 0.6 })
      );
      body.position.y = 0.5;
      g.add(body);
      // Mini roof
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 0.8, 4),
        new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.4 })
      );
      roof.position.y = 1.35;
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
      this.previewContainer.add(g);

    } else if (toolId === 'wall') {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.9, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.7 })
      );
      wall.position.y = 0.45;
      this.previewContainer.add(wall);

    } else if (toolId === 'tree') {
      const g = new THREE.Group();
      // Trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.24, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x5c3a21 })
      );
      trunk.position.y = 0.4;
      g.add(trunk);
      // Foliage cones
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.8 - i * 0.18, 0.7, 8),
          new THREE.MeshStandardMaterial({ color: 0x1e3a29, roughness: 0.6 })
        );
        cone.position.y = 0.8 + i * 0.45;
        g.add(cone);
      }
      this.previewContainer.add(g);

    } else if (toolId === 'pond') {
      const pond = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 0.15, 24),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.7 })
      );
      pond.position.y = 0.1;
      this.previewContainer.add(pond);

    } else if (toolId === 'path') {
      const path = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.08, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 })
      );
      path.position.y = 0.05;
      this.previewContainer.add(path);

    } else if (toolId === 'prop') {
      // Mini glowing lantern
      const g = new THREE.Group();
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 })
      );
      post.position.y = 0.7;
      g.add(post);
      const lantern = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.45, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfbbf24, emissiveIntensity: 0.8 })
      );
      lantern.position.y = 1.35;
      g.add(lantern);
      this.previewContainer.add(g);

    } else if (toolId === 'demolish') {
      // Mini hammer
      const g = new THREE.Group();
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x854d0e })
      );
      handle.position.y = 0.6;
      g.add(handle);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.35, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6 })
      );
      head.position.y = 1.1;
      g.add(head);
      g.rotation.z = -Math.PI / 4;
      this.previewContainer.add(g);

    } else if (toolId === 'anchor') {
      // 3D Anchor symbol
      const g = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.12, 12, 24),
        new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.8, roughness: 0.2 })
      );
      ring.position.y = 0.7;
      g.add(ring);
      this.previewContainer.add(g);
    }
  }

  // ---------------------------------------------------------------------------
  // Main Update Loop: Hand Tracking, Direct Touch Poke & Raycast
  // ---------------------------------------------------------------------------
  update(delta, headPos, leftHand, rightHand, controllerRight, isPinchingRight) {
    if (this.pokeCooldown > 0) this.pokeCooldown -= delta;

    // 1. Palm Orientation & Ergonomic Placement
    this.updatePalmSummon(delta, headPos, leftHand);

    if (this.openProgress < 0.02) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // 2. Animate satellite blooming expansion
    for (let i = 0; i < this.buttons.length; i++) {
      const btn = this.buttons[i];
      const targetPos = btn.userData.targetPos;

      // Staggered radial bloom
      const stagger = i * 0.04;
      const progress = THREE.MathUtils.clamp((this.openProgress - stagger) / (1.0 - stagger), 0, 1);
      const easedProgress = Math.sin((progress * Math.PI) / 2); // smooth ease out

      btn.position.x = targetPos.x * easedProgress;
      btn.position.y = targetPos.y * easedProgress;
      btn.position.z = (btn.userData.isHovered ? 0.012 : 0) + btn.userData.currentPressZ;

      // Scale lerp
      const targetScale = (btn.userData.isHovered ? 1.18 : 1.0) * easedProgress;
      btn.scale.setScalar(targetScale);
    }

    // 3. Rotate Central Preview Object
    if (this.previewContainer) {
      this.previewContainer.rotation.y += delta * 1.5;
    }

    // 4. DIRECT TOUCH / POKE COLLISION (Right Index Fingertip pushes into 3D buttons)
    let rightIndexPos = null;
    if (rightHand && rightHand.joints && rightHand.joints['index-finger-tip'] && rightHand.joints['index-finger-tip'].visible) {
      rightIndexPos = new THREE.Vector3();
      rightHand.joints['index-finger-tip'].getWorldPosition(rightIndexPos);
    } else if (controllerRight) {
      rightIndexPos = new THREE.Vector3();
      controllerRight.getWorldPosition(rightIndexPos);
    }

    let pokedButton = null;
    let hoveredButton = null;

    if (rightIndexPos) {
      for (let i = 0; i < this.buttons.length; i++) {
        const btn = this.buttons[i];
        const btnWorldPos = new THREE.Vector3();
        btn.userData.hitMesh.getWorldPosition(btnWorldPos);

        const dist = rightIndexPos.distanceTo(btnWorldPos);

        // Hover distance (< 4.5cm)
        if (dist < 0.045) {
          hoveredButton = btn;

          // Push / Press distance (< 1.8cm)
          if (dist < 0.019) {
            pokedButton = btn;
            // Visual 3D push back into menu plane
            const pushDepth = THREE.MathUtils.clamp((0.019 - dist) / 0.019, 0, 1) * -0.014;
            btn.userData.currentPressZ = THREE.MathUtils.lerp(btn.userData.currentPressZ, pushDepth, delta * 25);
          } else {
            btn.userData.currentPressZ = THREE.MathUtils.lerp(btn.userData.currentPressZ, 0, delta * 15);
          }
          break;
        } else {
          btn.userData.currentPressZ = THREE.MathUtils.lerp(btn.userData.currentPressZ, 0, delta * 15);
        }
      }
    }

    // Direct Touch Poke Trigger
    if (pokedButton && this.pokeCooldown <= 0) {
      this.triggerButton(pokedButton.userData.def.id);
      this.pokeCooldown = 0.35; // Hysteresis debounce to prevent rapid re-triggering
    }

    // 5. STABLE RAYCAST + PINCH INTERACTION (Distance Pointer)
    if (!hoveredButton && controllerRight) {
      const raycaster = this.xr.raycaster;
      const origin = this.xr.getRightPointerOrigin();
      const dir = this.xr.getRightPointerDirection();
      raycaster.set(origin, dir);

      const hitMeshes = this.buttons.map(b => b.userData.hitMesh);
      const intersects = raycaster.intersectObjects(hitMeshes, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        hoveredButton = hitMesh.userData.buttonGroup;

        // If user pinched while hovering (or within lock buffer)
        if (isPinchingRight && (performance.now() - this.lastPinchClickTime > 400)) {
          this.lastPinchClickTime = performance.now();
          this.triggerButton(hoveredButton.userData.def.id);
        }
      }
    }

    // Update Hover Visuals
    for (let i = 0; i < this.buttons.length; i++) {
      const btn = this.buttons[i];
      const isHov = (btn === hoveredButton);
      btn.userData.isHovered = isHov;

      btn.userData.rimMesh.material.color.setHex(isHov ? 0xffffff : btn.userData.def.color);
      btn.userData.haloMesh.material.opacity = isHov ? 0.85 : 0.25;
      btn.userData.labelPlane.visible = isHov;
    }

    this.hoveredButton = hoveredButton;
  }

  // ---------------------------------------------------------------------------
  // Palm Summon Detection & Ergonomic Billboarding
  // ---------------------------------------------------------------------------
  updatePalmSummon(delta, headPos, leftHand) {
    let leftPos = new THREE.Vector3();
    let leftQuat = new THREE.Quaternion();

    if (leftHand && leftHand.joints && leftHand.joints['wrist'] && leftHand.joints['wrist'].visible) {
      leftHand.joints['wrist'].getWorldPosition(leftPos);
      leftHand.joints['wrist'].getWorldQuaternion(leftQuat);
    } else if (this.xr.controllerLeft) {
      this.xr.controllerLeft.getWorldPosition(leftPos);
      this.xr.controllerLeft.getWorldQuaternion(leftQuat);
    } else {
      this.isOpen = false;
      this.openProgress = THREE.MathUtils.lerp(this.openProgress, 0, delta * 12);
      return;
    }

    // Vector from left hand to eyes
    const toHead = headPos.clone().sub(leftPos).normalize();

    // Palm normal: points outward from the palm face
    const palmNormalLocal = new THREE.Vector3(0.2, 0.85, -0.3).normalize();
    const palmNormalWorld = palmNormalLocal.clone().applyQuaternion(leftQuat);

    // Dot product > 0.18 means palm is comfortably tilted towards player's eyes
    const facingDot = palmNormalWorld.dot(toHead);
    const distToHead = leftPos.distanceTo(headPos);

    this.isOpen = (facingDot > 0.18 && distToHead < 0.85);

    const targetProgress = this.isOpen ? 1.0 : 0.0;
    this.openProgress = THREE.MathUtils.lerp(this.openProgress, targetProgress, delta * 14.0);

    if (this.openProgress > 0.02) {
      this.group.scale.setScalar(this.openProgress);

      // Position radially 7cm above palm along palm normal
      const offset = new THREE.Vector3(0.015, 0.075, 0.02).applyQuaternion(leftQuat);
      this.group.position.copy(leftPos).add(offset);

      // Smoothly billboard menu to face the player's eyes
      this.group.lookAt(headPos);
    }
  }

  // ---------------------------------------------------------------------------
  // Button Trigger Action (Modern, instantaneous feedback)
  // ---------------------------------------------------------------------------
  triggerButton(toolId) {
    this.app.audio.playPop();
    this.xr.pulseHaptic(this.xr.controllerRight, 0.8, 50);

    if (toolId === 'anchor') {
      // Toggle AR Foundation Anchor ON / OFF
      this.xr.toggleAnchor();
      return;
    }

    if (toolId === 'undo') {
      this.app.world.undo();
      this.app.ui.showToast('Undone action ↩️');
      return;
    }

    if (toolId === 'time') {
      const times = [6.5, 12.0, 18.0, 22.5];
      const cur = this.xr.sm.timeOfDay;
      const nextTime = times[(times.indexOf(cur) + 1) % times.length] || 12.0;
      this.xr.sm.setTimeOfDay(nextTime);
      this.app.ui.showToast('Time changed ☀️');
      return;
    }

    // Standard Tools (house, wall, path, tree, pond, prop, demolish)
    this.activeToolId = toolId;
    this.app.ui.selectTool(toolId);

    const def = this.buttonDefs.find(b => b.id === toolId);
    const title = def ? def.title : toolId.toUpperCase();
    const colorHex = def ? def.hex : '#fed7aa';

    // Update central core hub
    this.rebuildCenterPreview(toolId);
    this.updateTitleCanvas(title, colorHex);

    // Pulse center halo
    if (this.hubHaloMat) {
      this.hubHaloMat.color.setHex(def ? def.color : 0xf97316);
      this.hubHaloMesh.scale.setScalar(1.3);
      setTimeout(() => {
        if (this.hubHaloMesh) this.hubHaloMesh.scale.setScalar(1.0);
      }, 180);
    }

    this.app.ui.showToast(`Selected ${title}`);
  }

  // ---------------------------------------------------------------------------
  // External Anchor Visual Sync (Called by XRManager when anchor changes)
  // ---------------------------------------------------------------------------
  updateAnchorVisuals(isLocked) {
    const anchorBtn = this.buttons.find(b => b.userData.def.id === 'anchor');
    if (!anchorBtn) return;

    const def = anchorBtn.userData.def;
    def.title = isLocked ? 'Anchor: ON' : 'Anchor: OFF';
    def.label = isLocked ? '⚓' : '🔓';
    def.color = isLocked ? 0x10b981 : 0x38bdf8;
    def.hex = isLocked ? '#10b981' : '#38bdf8';

    // Update rim & halo
    anchorBtn.userData.rimMesh.material.color.setHex(def.color);
    anchorBtn.userData.haloMesh.material.color.setHex(def.color);

    // Update canvas icon
    const ctx = anchorBtn.userData.iconCanvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.label, 64, 64);
    anchorBtn.userData.iconTex.needsUpdate = true;

    // Update center title if anchor is currently active
    if (this.activeToolId === 'anchor') {
      this.updateTitleCanvas(def.title, def.hex);
    }
  }
}
