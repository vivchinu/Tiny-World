import * as THREE from 'three';

export class XRManager {
  constructor(app) {
    this.app = app;
    this.sm = app.sceneManager;
    this.renderer = this.sm.renderer;
    this.scene = this.sm.scene;
    this.dioramaRoot = app.dioramaRoot; // Group containing terrain, objects, population

    this.isXRPresenting = false;
    this.xrSession = null;
    this.sessionMode = null; // 'immersive-vr' or 'immersive-ar'

    // Controllers
    this.controllerRight = null; // Index 0 (dominant / building hand)
    this.controllerLeft = null;  // Index 1 (palette / manipulation hand)

    // Raycast & Reticle
    this.raycaster = new THREE.Raycaster();
    this.reticle = null;
    this.isTriggerDown = false;
    this.dragStartLocal = new THREE.Vector3();
    this.dragCurrentLocal = new THREE.Vector3();

    // 3D VR Palette
    this.paletteButtons = [];
    this.hoveredButton = null;

    // Grip Manipulation
    this.isGrippingRight = false;
    this.isGrippingLeft = false;
    this.gripInitialHandPos = new THREE.Vector3();
    this.gripInitialDioramaPos = new THREE.Vector3();
    this.gripInitialHandDist = 0;
    this.gripInitialScale = 0.07;

    // Original scene state before entering XR
    this.savedBackground = null;
    this.savedFog = null;

    this.initXRButtons();
    this.setupControllers();
  }

  async initXRButtons() {
    if (!('xr' in navigator)) {
      console.log('WebXR not supported in this browser.');
      return;
    }

    const vrSupported = await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
    const arSupported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);

    const topActions = document.querySelector('.top-actions');
    if (!topActions) return;

    // 1. Enter VR Button
    if (vrSupported) {
      const vrBtn = document.createElement('button');
      vrBtn.id = 'btn-enter-vr';
      vrBtn.className = 'icon-btn tooltip-wrap';
      vrBtn.setAttribute('data-tooltip', 'Enter WebXR (VR)');
      vrBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M21 7H3c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h4.5l2 2h5l2-2H21c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-14 7c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm10 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
        </svg>
      `;
      vrBtn.addEventListener('click', () => this.toggleXRSession('immersive-vr'));
      topActions.prepend(vrBtn);
    }

    // 2. Enter AR / Passthrough Button (for Meta Quest 3 Mixed Reality!)
    if (arSupported) {
      const arBtn = document.createElement('button');
      arBtn.id = 'btn-enter-ar';
      arBtn.className = 'icon-btn tooltip-wrap';
      arBtn.setAttribute('data-tooltip', 'Enter Passthrough (AR)');
      arBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      `;
      arBtn.addEventListener('click', () => this.toggleXRSession('immersive-ar'));
      topActions.prepend(arBtn);
    }
  }

  async toggleXRSession(mode) {
    if (this.isXRPresenting) {
      if (this.xrSession) await this.xrSession.end();
      return;
    }

    try {
      const sessionInit = {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers']
      };

      const session = await navigator.xr.requestSession(mode, sessionInit);
      this.xrSession = session;
      this.sessionMode = mode;
      await this.renderer.xr.setSession(session);

      this.onSessionStart(mode);

      session.addEventListener('end', () => {
        this.onSessionEnd();
      });
    } catch (err) {
      console.error('Failed to start WebXR session:', err);
      this.app.ui.showToast('WebXR launch failed: ' + err.message);
    }
  }

  onSessionStart(mode) {
    this.isXRPresenting = true;
    document.body.classList.add('xr-active');

    // Save 2D scene background & fog
    this.savedBackground = this.scene.background;
    this.savedFog = this.scene.fog;

    // Scale diorama to comfortable tabletop miniature size
    // 0.075 scale: 32m island becomes ~2.4m wide tabletop model!
    this.dioramaRoot.scale.setScalar(0.07);
    // Position at comfortable table height (~0.85m) and ~0.8m in front of player
    this.dioramaRoot.position.set(0, 0.85, -0.85);
    this.dioramaRoot.rotation.set(0, 0, 0);

    if (mode === 'immersive-ar') {
      // Mixed Reality Passthrough on Quest 3: transparent background
      this.scene.background = null;
      this.scene.fog = null;
      this.app.ui.showToast('Quest 3 Passthrough Active: Island on Table');
    } else {
      this.app.ui.showToast('WebXR VR Active: Grip to move tabletop');
    }

    this.app.audio.playBuildChord();
  }

  onSessionEnd() {
    this.isXRPresenting = false;
    this.xrSession = null;
    this.sessionMode = null;
    document.body.classList.remove('xr-active');

    // Restore desktop scale and position
    this.dioramaRoot.scale.set(1, 1, 1);
    this.dioramaRoot.position.set(0, 0, 0);
    this.dioramaRoot.rotation.set(0, 0, 0);

    // Restore background & fog
    if (this.savedBackground) this.scene.background = this.savedBackground;
    if (this.savedFog) this.scene.fog = this.savedFog;

    this.app.ui.showToast('Exited WebXR');
  }

  setupControllers() {
    // -------------------------------------------------------------
    // Right Controller (Wand / Drawing / Building)
    // -------------------------------------------------------------
    this.controllerRight = this.renderer.xr.getController(0);
    this.scene.add(this.controllerRight);

    // Stylized Pointer Beam
    const beamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -4)
    ]);
    const beamMat = new THREE.LineBasicMaterial({
      color: 0xf6ad55,
      transparent: true,
      opacity: 0.75,
      linewidth: 3
    });
    this.pointerBeam = new THREE.Line(beamGeo, beamMat);
    this.controllerRight.add(this.pointerBeam);

    // Reticle Ring that aligns to terrain
    const reticleGeo = new THREE.RingGeometry(0.04, 0.055, 24);
    reticleGeo.rotateX(-Math.PI / 2);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0xf6ad55,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    this.reticle = new THREE.Mesh(reticleGeo, reticleMat);
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    // Controller 0 Events
    this.controllerRight.addEventListener('selectstart', () => this.onTriggerStart());
    this.controllerRight.addEventListener('selectend', () => this.onTriggerEnd());
    this.controllerRight.addEventListener('squeezestart', () => this.onGripStart(0));
    this.controllerRight.addEventListener('squeezeend', () => this.onGripEnd(0));

    // -------------------------------------------------------------
    // Left Controller (Palette / Diorama Grip)
    // -------------------------------------------------------------
    this.controllerLeft = this.renderer.xr.getController(1);
    this.scene.add(this.controllerLeft);

    this.controllerLeft.addEventListener('squeezestart', () => this.onGripStart(1));
    this.controllerLeft.addEventListener('squeezeend', () => this.onGripEnd(1));

    // 3D Floating Left Wrist Palette
    this.createWristPalette();
  }

  createWristPalette() {
    this.paletteGroup = new THREE.Group();
    // Position just above the left wrist / controller
    this.paletteGroup.position.set(0, 0.08, -0.06);
    this.paletteGroup.rotation.x = -Math.PI / 3.5;
    this.paletteGroup.scale.setScalar(0.75);

    // Curved backing panel
    const panelGeo = new THREE.BoxGeometry(0.24, 0.16, 0.012);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1a202c,
      roughness: 0.5,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    this.paletteGroup.add(panel);

    // 3D Tool Buttons on Palette
    const tools = [
      { id: 'house', label: '🏠', name: 'House' },
      { id: 'wall', label: '🧱', name: 'Wall' },
      { id: 'path', label: '🛤️', name: 'Path' },
      { id: 'tree', label: '🌳', name: 'Tree' },
      { id: 'pond', label: '💧', name: 'Pond' },
      { id: 'prop', label: '🏮', name: 'Props' },
      { id: 'demolish', label: '🔨', name: 'Clear' },
      { id: 'time', label: '☀️', name: 'Sun' },
      { id: 'undo', label: '↩️', name: 'Undo' }
    ];

    const cols = 3;
    const btnSize = 0.038;
    const gap = 0.046;

    tools.forEach((t, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const bx = (col - 1) * gap;
      const by = (1 - row) * gap;

      const btnGeo = new THREE.BoxGeometry(btnSize, btnSize, 0.016);
      const btnMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.4,
        metalness: 0.1
      });
      const btn = new THREE.Mesh(btnGeo, btnMat);
      btn.position.set(bx, by, 0.01);
      btn.userData = { toolId: t.id, toolName: t.name };

      // Icon canvas texture
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f8fafc';
      ctx.font = '72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.label, 64, 64);

      const iconTex = new THREE.CanvasTexture(canvas);
      const iconMat = new THREE.MeshBasicMaterial({ map: iconTex, transparent: true });
      const iconPlane = new THREE.Mesh(new THREE.PlaneGeometry(btnSize * 0.85, btnSize * 0.85), iconMat);
      iconPlane.position.z = 0.009;
      btn.add(iconPlane);

      this.paletteGroup.add(btn);
      this.paletteButtons.push(btn);
    });

    this.controllerLeft.add(this.paletteGroup);
  }

  // Trigger Action (Point & Draw / Click)
  onTriggerStart() {
    this.pulseHaptic(this.controllerRight, 0.4, 25);

    // 1. Check if clicking on the 3D Wrist Palette
    if (this.hoveredButton) {
      const tid = this.hoveredButton.userData.toolId;
      this.handlePaletteClick(tid);
      this.pulseHaptic(this.controllerRight, 0.8, 50);
      return;
    }

    // 2. Check if pointing at island
    const hitWorld = this.getControllerGroundHit();
    if (!hitWorld) return;

    // Convert world hit point into Diorama Local Space
    const hitLocal = this.worldToDioramaLocal(hitWorld);

    this.isTriggerDown = true;
    this.dragStartLocal.copy(hitLocal);
    this.dragCurrentLocal.copy(hitLocal);

    const tool = this.app.raycaster.currentTool;
    const variation = this.app.raycaster.activeVariation;

    if (tool === 'demolish') {
      this.handleXRDemolish();
      return;
    }

    if (tool !== 'tree' && tool !== 'prop') {
      this.app.updatePreview(this.dragStartLocal, this.dragStartLocal, tool, variation);
    }
  }

  onTriggerEnd() {
    if (!this.isTriggerDown) return;
    this.isTriggerDown = false;

    this.app.removePreview();

    const tool = this.app.raycaster.currentTool;
    const variation = this.app.raycaster.activeVariation;

    if (tool === 'inspect' || tool === 'demolish') return;

    if (tool === 'house') {
      const house = this.app.generators.house.createFromPoints(this.dragStartLocal, this.dragCurrentLocal, variation);
      this.app.world.addObject(house);
      this.app.animSystem.animateHouse(house);
      this.pulseHaptic(this.controllerRight, 0.8, 80);

    } else if (tool === 'wall') {
      const wall = this.app.generators.wall.createFromPoints(this.dragStartLocal, this.dragCurrentLocal, variation);
      this.app.world.addObject(wall);
      this.app.animSystem.animateWall(wall);
      this.pulseHaptic(this.controllerRight, 0.7, 60);

    } else if (tool === 'path') {
      const path = this.app.generators.path.createFromPoints(this.dragStartLocal, this.dragCurrentLocal, variation);
      this.app.world.addObject(path);
      this.app.animSystem.animateGenericSpring(path);
      this.pulseHaptic(this.controllerRight, 0.6, 50);

    } else if (tool === 'pond') {
      const pond = this.app.generators.pond.createFromPoints(this.dragStartLocal, this.dragCurrentLocal, variation);
      this.app.world.addObject(pond);
      this.app.animSystem.animateGenericSpring(pond);
      this.pulseHaptic(this.controllerRight, 0.7, 70);

    } else if (tool === 'tree') {
      const tree = this.app.generators.tree.createAtPoint(this.dragCurrentLocal, variation);
      this.app.world.addObject(tree);
      this.app.animSystem.animateTree(tree);
      this.pulseHaptic(this.controllerRight, 0.6, 50);

    } else if (tool === 'prop') {
      const prop = this.app.generators.prop.createAtPoint(this.dragCurrentLocal, variation);
      this.app.world.addObject(prop);
      this.app.animSystem.animateGenericSpring(prop);
      this.pulseHaptic(this.controllerRight, 0.6, 50);
    }
  }

  handlePaletteClick(toolId) {
    if (toolId === 'undo') {
      this.app.world.undo();
      this.app.ui.showToast('Undone action');
    } else if (toolId === 'time') {
      const times = [6.5, 12.0, 18.0, 22.5];
      const cur = this.sm.timeOfDay;
      const nextTime = times[(times.indexOf(cur) + 1) % times.length] || 12.0;
      this.sm.setTimeOfDay(nextTime);
      this.app.ui.showToast('Time changed');
    } else {
      this.app.ui.selectTool(toolId);
      this.app.ui.showToast(`Selected ${toolId.toUpperCase()}`);
    }
  }

  handleXRDemolish() {
    this.raycaster.set(this.controllerRight.position, this.getControllerDirection(this.controllerRight));
    const allMeshes = [];
    this.app.world.objects.forEach((obj) => {
      obj.traverse((child) => {
        if (child.isMesh) {
          child.userData.rootObject = obj;
          allMeshes.push(child);
        }
      });
    });

    const intersects = this.raycaster.intersectObjects(allMeshes, false);
    if (intersects.length > 0) {
      const hitRoot = intersects[0].object.userData.rootObject;
      if (hitRoot) {
        this.app.world.removeObject(hitRoot);
        this.pulseHaptic(this.controllerRight, 0.9, 90);
        this.app.ui.showToast('Demolished');
      }
    }
  }

  // Grip Manipulation (Pick up, Rotate, Scale Miniature Island)
  onGripStart(controllerIdx) {
    if (controllerIdx === 0) this.isGrippingRight = true;
    if (controllerIdx === 1) this.isGrippingLeft = true;

    if (this.isGrippingRight && this.isGrippingLeft) {
      // Two-handed scale mode
      this.gripInitialHandDist = this.controllerRight.position.distanceTo(this.controllerLeft.position);
      this.gripInitialScale = this.dioramaRoot.scale.x;
    } else {
      // Single hand move mode
      const ctrl = controllerIdx === 0 ? this.controllerRight : this.controllerLeft;
      this.gripInitialHandPos.copy(ctrl.position);
      this.gripInitialDioramaPos.copy(this.dioramaRoot.position);
    }

    this.pulseHaptic(controllerIdx === 0 ? this.controllerRight : this.controllerLeft, 0.5, 40);
  }

  onGripEnd(controllerIdx) {
    if (controllerIdx === 0) this.isGrippingRight = false;
    if (controllerIdx === 1) this.isGrippingLeft = false;
  }

  updateGripManipulation() {
    if (this.isGrippingRight && this.isGrippingLeft) {
      // Two-handed stretch / pinch scaling
      const curDist = this.controllerRight.position.distanceTo(this.controllerLeft.position);
      if (this.gripInitialHandDist > 0.05) {
        const factor = curDist / this.gripInitialHandDist;
        const newScale = THREE.MathUtils.clamp(this.gripInitialScale * factor, 0.02, 0.35);
        this.dioramaRoot.scale.setScalar(newScale);
      }
    } else if (this.isGrippingRight) {
      const delta = this.controllerRight.position.clone().sub(this.gripInitialHandPos);
      this.dioramaRoot.position.copy(this.gripInitialDioramaPos).add(delta);
    } else if (this.isGrippingLeft) {
      const delta = this.controllerLeft.position.clone().sub(this.gripInitialHandPos);
      this.dioramaRoot.position.copy(this.gripInitialDioramaPos).add(delta);
    }
  }

  // Raycasting & Coordinate Helpers
  getControllerDirection(controller) {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(controller.quaternion);
    return dir;
  }

  worldToDioramaLocal(worldPoint) {
    const local = worldPoint.clone();
    this.dioramaRoot.worldToLocal(local);
    return local;
  }

  getControllerGroundHit() {
    if (!this.app.terrain || !this.app.terrain.raycastMesh) return null;

    const dir = this.getControllerDirection(this.controllerRight);
    this.raycaster.set(this.controllerRight.position, dir);

    const intersects = this.raycaster.intersectObject(this.app.terrain.raycastMesh, false);
    if (intersects.length > 0) {
      return intersects[0].point;
    }
    return null;
  }

  pulseHaptic(controller, intensity = 0.5, duration = 40) {
    try {
      const session = this.renderer.xr.getSession();
      if (!session) return;

      const inputSources = session.inputSources;
      if (!inputSources) return;

      for (const source of inputSources) {
        if (source.gamepad && source.gamepad.hapticActuators && source.gamepad.hapticActuators.length > 0) {
          source.gamepad.hapticActuators[0].pulse(intensity, duration);
        }
      }
    } catch (e) {
      // Haptics optional fallback
    }
  }

  update() {
    if (!this.isXRPresenting) return;

    // Handle Grip Manipulation
    this.updateGripManipulation();

    // 1. Raycast against Left Wrist Palette buttons
    const dir = this.getControllerDirection(this.controllerRight);
    this.raycaster.set(this.controllerRight.position, dir);

    const paletteHits = this.raycaster.intersectObjects(this.paletteButtons, false);
    if (paletteHits.length > 0) {
      const hitBtn = paletteHits[0].object;
      if (this.hoveredButton !== hitBtn) {
        if (this.hoveredButton) this.hoveredButton.material.color.setHex(0x334155);
        this.hoveredButton = hitBtn;
        hitBtn.material.color.setHex(0xf6ad55); // Highlight
        this.pulseHaptic(this.controllerRight, 0.2, 15);
      }
      this.reticle.visible = false;
      return;
    } else {
      if (this.hoveredButton) {
        this.hoveredButton.material.color.setHex(0x334155);
        this.hoveredButton = null;
      }
    }

    // 2. Raycast against Island Ground
    const groundHit = this.getControllerGroundHit();
    if (groundHit) {
      this.reticle.position.copy(groundHit);
      this.reticle.position.y += 0.005;
      this.reticle.visible = true;

      // Reticle scale with diorama scale
      this.reticle.scale.setScalar(this.dioramaRoot.scale.x * 12);

      if (this.isTriggerDown) {
        const hitLocal = this.worldToDioramaLocal(groundHit);
        this.dragCurrentLocal.copy(hitLocal);

        const tool = this.app.raycaster.currentTool;
        const variation = this.app.raycaster.activeVariation;

        if (tool !== 'tree' && tool !== 'prop' && tool !== 'inspect' && tool !== 'demolish') {
          this.app.updatePreview(this.dragStartLocal, this.dragCurrentLocal, tool, variation);
        }
      }
    } else {
      this.reticle.visible = false;
    }
  }
}
