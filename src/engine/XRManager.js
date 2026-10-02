import * as THREE from 'three';

export class XRManager {
  constructor(app) {
    this.app = app;
    this.sm = app.sceneManager;
    this.renderer = this.sm.renderer;
    this.scene = this.sm.scene;
    this.dioramaRoot = app.dioramaRoot; // Root group containing terrain, structures, population

    this.isXRPresenting = false;
    this.xrSession = null;
    this.sessionMode = null; // 'immersive-vr' or 'immersive-ar'

    // Controllers & Hand Tracking
    this.controllerRight = null; // Controller Index 0
    this.controllerLeft = null;  // Controller Index 1
    this.handRight = null;       // Hand Index 0
    this.handLeft = null;        // Hand Index 1

    // Raycast & Reticle
    this.raycaster = new THREE.Raycaster();
    this.reticle = null;
    this.isActionActive = false; // Trigger or Pinch held down
    this.dragStartLocal = new THREE.Vector3();
    this.dragCurrentLocal = new THREE.Vector3();

    // 3D VR Palm Palette
    this.paletteGroup = null;
    this.paletteButtons = [];
    this.hoveredButton = null;
    this.isPaletteFacing = false;
    this.paletteScaleLerp = 0.001;

    // Tabletop Manipulation (Move, Rotate, Scale)
    this.isGrippingRight = false;
    this.isGrippingLeft = false;
    this.isPinchingRight = false;
    this.isPinchingLeft = false;

    this.initialHandsDistance = 0;
    this.initialHandsAngle = 0;
    this.initialHandsMidpoint = new THREE.Vector3();
    this.initialDioramaScale = 0.07;
    this.initialDioramaRotY = 0;
    this.initialDioramaPos = new THREE.Vector3();

    this.singleGripInitialHandPos = new THREE.Vector3();
    this.singleGripInitialDioramaPos = new THREE.Vector3();

    // Hand joints tracking indicators
    this.pinchMarkerRight = null;
    this.pinchMarkerLeft = null;

    // Saved desktop scene settings
    this.savedBackground = null;
    this.savedFog = null;

    this.initXRButtons();
    this.setupControllersAndHands();
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

    // 2. Enter AR / Passthrough Button (for Meta Quest 3 Mixed Reality)
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

    // Save desktop background & fog
    this.savedBackground = this.scene.background;
    this.savedFog = this.scene.fog;

    // Reset tabletop position and scale (comfortable table height and distance)
    this.resetIslandView();

    if (mode === 'immersive-ar') {
      // Quest 3 Color Passthrough: clear background & fog
      this.scene.background = null;
      this.scene.fog = null;
      this.app.ui.showToast('Quest 3 Passthrough: Look at your left palm for menu');
    } else {
      this.app.ui.showToast('WebXR VR: Look at your left palm for menu');
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

    if (this.savedBackground) this.scene.background = this.savedBackground;
    if (this.savedFog) this.scene.fog = this.savedFog;

    this.app.ui.showToast('Exited WebXR');
  }

  resetIslandView() {
    this.dioramaRoot.scale.setScalar(0.07);
    this.dioramaRoot.position.set(0, 0.85, -0.85);
    this.dioramaRoot.rotation.set(0, 0, 0);
  }

  rotateIsland(angleRad) {
    this.dioramaRoot.rotation.y += angleRad;
    this.app.audio.playPop();
  }

  scaleIsland(factor) {
    const cur = this.dioramaRoot.scale.x;
    const next = THREE.MathUtils.clamp(cur * factor, 0.015, 0.35);
    this.dioramaRoot.scale.setScalar(next);
    this.app.audio.playPop();
  }

  setupControllersAndHands() {
    // -------------------------------------------------------------
    // 1. Right & Left Controllers (Touch Plus)
    // -------------------------------------------------------------
    this.controllerRight = this.renderer.xr.getController(0);
    this.scene.add(this.controllerRight);

    this.controllerLeft = this.renderer.xr.getController(1);
    this.scene.add(this.controllerLeft);

    // Pointer Ray from Right Hand
    const beamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -3.5)
    ]);
    const beamMat = new THREE.LineBasicMaterial({
      color: 0xf6ad55,
      transparent: true,
      opacity: 0.8,
      linewidth: 3
    });
    this.pointerBeam = new THREE.Line(beamGeo, beamMat);
    this.controllerRight.add(this.pointerBeam);

    // Reticle Ring on terrain
    const reticleGeo = new THREE.RingGeometry(0.04, 0.055, 24);
    reticleGeo.rotateX(-Math.PI / 2);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0xf6ad55,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95
    });
    this.reticle = new THREE.Mesh(reticleGeo, reticleMat);
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    // Controller Events
    this.controllerRight.addEventListener('selectstart', () => this.onActionStart());
    this.controllerRight.addEventListener('selectend', () => this.onActionEnd());
    this.controllerRight.addEventListener('squeezestart', () => this.onGripStart(0));
    this.controllerRight.addEventListener('squeezeend', () => this.onGripEnd(0));

    this.controllerLeft.addEventListener('squeezestart', () => this.onGripStart(1));
    this.controllerLeft.addEventListener('squeezeend', () => this.onGripEnd(1));

    // -------------------------------------------------------------
    // 2. Direct Hand Tracking (Hands 0 & 1)
    // -------------------------------------------------------------
    this.handRight = this.renderer.xr.getHand(0);
    this.scene.add(this.handRight);

    this.handLeft = this.renderer.xr.getHand(1);
    this.scene.add(this.handLeft);

    // Visual pinch cursors for index finger tips
    const pinchGeo = new THREE.SphereGeometry(0.012, 12, 12);
    const pinchMat = new THREE.MeshBasicMaterial({
      color: 0xf6ad55,
      transparent: true,
      opacity: 0.8
    });

    this.pinchMarkerRight = new THREE.Mesh(pinchGeo, pinchMat);
    this.pinchMarkerRight.visible = false;
    this.scene.add(this.pinchMarkerRight);

    this.pinchMarkerLeft = new THREE.Mesh(pinchGeo, pinchMat.clone());
    this.pinchMarkerLeft.visible = false;
    this.scene.add(this.pinchMarkerLeft);

    // -------------------------------------------------------------
    // 3. Left Hand-Facing Floating Palm Menu
    // -------------------------------------------------------------
    this.createWristPalette();
  }

  createWristPalette() {
    this.paletteGroup = new THREE.Group();
    this.paletteGroup.visible = false;
    this.paletteGroup.scale.setScalar(0.001);

    // Frosted glass backing plate
    const panelGeo = new THREE.BoxGeometry(0.24, 0.22, 0.012);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.35,
      metalness: 0.2,
      transparent: true,
      opacity: 0.92
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    this.paletteGroup.add(panel);

    // Border glow rim
    const borderGeo = new THREE.BoxGeometry(0.246, 0.226, 0.008);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xf6ad55, transparent: true, opacity: 0.4 });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.position.z = -0.003;
    this.paletteGroup.add(border);

    // Menu Title
    const titleCanvas = document.createElement('canvas');
    titleCanvas.width = 256;
    titleCanvas.height = 64;
    const tCtx = titleCanvas.getContext('2d');
    tCtx.fillStyle = '#fed7aa';
    tCtx.font = 'bold 30px sans-serif';
    tCtx.textAlign = 'center';
    tCtx.fillText('🌱 Tiny World', 128, 42);

    const titleTex = new THREE.CanvasTexture(titleCanvas);
    const titleMat = new THREE.MeshBasicMaterial({ map: titleTex, transparent: true });
    const titlePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.042), titleMat);
    titlePlane.position.set(0, 0.088, 0.01);
    this.paletteGroup.add(titlePlane);

    // Palette Buttons layout (3 columns x 4 rows)
    const buttons = [
      // Row 1: Building Basics
      { id: 'house', label: '🏠', name: 'House' },
      { id: 'wall', label: '🧱', name: 'Wall' },
      { id: 'path', label: '🛤️', name: 'Path' },

      // Row 2: Nature & Details
      { id: 'tree', label: '🌳', name: 'Tree' },
      { id: 'pond', label: '💧', name: 'Pond' },
      { id: 'prop', label: '🏮', name: 'Props' },

      // Row 3: Actions & Environment
      { id: 'demolish', label: '🔨', name: 'Clear' },
      { id: 'time', label: '☀️', name: 'Time' },
      { id: 'undo', label: '↩️', name: 'Undo' },

      // Row 4: Rotate & Scale Island
      { id: 'rotate-left', label: '↺', name: 'Rotate 45°' },
      { id: 'scale-up', label: '➕', name: 'Scale +' },
      { id: 'scale-down', label: '➖', name: 'Scale -' }
    ];

    const cols = 3;
    const btnSize = 0.042;
    const gapX = 0.056;
    const gapY = 0.046;
    const startY = 0.044;

    buttons.forEach((t, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const bx = (col - 1) * gapX;
      const by = startY - row * gapY;

      const btnGeo = new THREE.BoxGeometry(btnSize, btnSize, 0.016);
      const btnMat = new THREE.MeshStandardMaterial({
        color: (t.id.startsWith('rotate') || t.id.startsWith('scale')) ? 0x1e293b : 0x334155,
        roughness: 0.4,
        metalness: 0.1
      });
      const btn = new THREE.Mesh(btnGeo, btnMat);
      btn.position.set(bx, by, 0.01);
      btn.userData = { toolId: t.id, toolName: t.name };

      // Button Icon Texture
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.font = '68px sans-serif';
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

    this.scene.add(this.paletteGroup);
  }

  // Trigger or Hand Pinch Start
  onActionStart() {
    this.pulseHaptic(this.controllerRight, 0.4, 25);

    // 1. Check if clicking on the Left Palm Menu
    if (this.paletteGroup.visible && this.hoveredButton) {
      const tid = this.hoveredButton.userData.toolId;
      this.handlePaletteClick(tid);
      this.pulseHaptic(this.controllerRight, 0.8, 50);
      return;
    }

    // 2. Check if pointing at island
    const hitWorld = this.getPointerGroundHit();
    if (!hitWorld) return;

    // Convert world hit point into Diorama Local Space
    const hitLocal = this.worldToDioramaLocal(hitWorld);

    this.isActionActive = true;
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

  onActionEnd() {
    if (!this.isActionActive) return;
    this.isActionActive = false;

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
    } else if (toolId === 'rotate-left') {
      this.rotateIsland(-Math.PI / 4);
      this.app.ui.showToast('Rotated 45° ↺');
    } else if (toolId === 'rotate-right') {
      this.rotateIsland(Math.PI / 4);
      this.app.ui.showToast('Rotated 45° ↻');
    } else if (toolId === 'scale-up') {
      this.scaleIsland(1.25);
      this.app.ui.showToast('Scaled Up ➕');
    } else if (toolId === 'scale-down') {
      this.scaleIsland(0.8);
      this.app.ui.showToast('Scaled Down ➖');
    } else {
      this.app.ui.selectTool(toolId);
      this.app.ui.showToast(`Selected ${toolId.toUpperCase()}`);
    }
  }

  handleXRDemolish() {
    const origin = this.getRightPointerOrigin();
    const dir = this.getRightPointerDirection();
    this.raycaster.set(origin, dir);

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

  // Grip Manipulation (Controllers)
  onGripStart(controllerIdx) {
    if (controllerIdx === 0) this.isGrippingRight = true;
    if (controllerIdx === 1) this.isGrippingLeft = true;

    this.captureInitialManipulationState();
    this.pulseHaptic(controllerIdx === 0 ? this.controllerRight : this.controllerLeft, 0.5, 40);
  }

  onGripEnd(controllerIdx) {
    if (controllerIdx === 0) this.isGrippingRight = false;
    if (controllerIdx === 1) this.isGrippingLeft = false;
  }

  captureInitialManipulationState() {
    const posR = this.getRightHandWorldPosition();
    const posL = this.getLeftHandWorldPosition();

    this.initialHandsDistance = posR.distanceTo(posL);
    this.initialHandsMidpoint.copy(posR).add(posL).multiplyScalar(0.5);

    const dx = posR.x - posL.x;
    const dz = posR.z - posL.z;
    this.initialHandsAngle = Math.atan2(dx, dz);

    this.initialDioramaScale = this.dioramaRoot.scale.x;
    this.initialDioramaRotY = this.dioramaRoot.rotation.y;
    this.initialDioramaPos.copy(this.dioramaRoot.position);

    // Single hand reference
    this.singleGripInitialHandPos.copy(this.isGrippingRight ? posR : posL);
  }

  // Detect and update Hand Tracking (Pinch & Palm Facing)
  updateHandTracking(delta) {
    const session = this.renderer.xr.getSession();
    if (!session) return;

    let hasHandRight = false;
    let hasHandLeft = false;

    // Check hand joints
    if (this.handRight && this.handRight.joints && this.handRight.joints['index-finger-tip']) {
      const indexTip = this.handRight.joints['index-finger-tip'];
      const thumbTip = this.handRight.joints['thumb-tip'];

      if (indexTip.position && thumbTip.position) {
        hasHandRight = true;
        const pinchDist = indexTip.position.distanceTo(thumbTip.position);
        const isPinching = pinchDist < 0.024; // 2.4cm pinch threshold

        // Update pinch cursor
        this.pinchMarkerRight.position.copy(indexTip.position).lerp(thumbTip.position, 0.5);
        this.pinchMarkerRight.visible = true;

        if (isPinching && !this.isPinchingRight) {
          this.isPinchingRight = true;
          this.pinchMarkerRight.scale.setScalar(1.5);
          this.onActionStart();
        } else if (!isPinching && this.isPinchingRight) {
          this.isPinchingRight = false;
          this.pinchMarkerRight.scale.setScalar(1.0);
          this.onActionEnd();
        }
      }
    }

    if (this.handLeft && this.handLeft.joints && this.handLeft.joints['index-finger-tip']) {
      const indexTip = this.handLeft.joints['index-finger-tip'];
      const thumbTip = this.handLeft.joints['thumb-tip'];

      if (indexTip.position && thumbTip.position) {
        hasHandLeft = true;
        const pinchDist = indexTip.position.distanceTo(thumbTip.position);
        const isPinching = pinchDist < 0.024;

        this.pinchMarkerLeft.position.copy(indexTip.position).lerp(thumbTip.position, 0.5);
        this.pinchMarkerLeft.visible = true;

        if (isPinching && !this.isPinchingLeft) {
          this.isPinchingLeft = true;
          this.captureInitialManipulationState();
        } else if (!isPinching && this.isPinchingLeft) {
          this.isPinchingLeft = false;
        }
      }
    }

    if (!hasHandRight) this.pinchMarkerRight.visible = false;
    if (!hasHandLeft) this.pinchMarkerLeft.visible = false;
  }

  // Detect if Left Palm is facing user's eyes & smoothly animate palette
  updatePalmFacingMenu(delta) {
    if (!this.paletteGroup) return;

    // Get Head / Camera position
    const cam = this.renderer.xr.getCamera();
    const headPos = new THREE.Vector3();
    cam.getWorldPosition(headPos);

    // Get Left Hand / Wrist position and orientation
    let leftPos = new THREE.Vector3();
    let leftQuat = new THREE.Quaternion();

    if (this.handLeft && this.handLeft.joints && this.handLeft.joints['wrist'] && this.handLeft.joints['wrist'].visible) {
      this.handLeft.joints['wrist'].getWorldPosition(leftPos);
      this.handLeft.joints['wrist'].getWorldQuaternion(leftQuat);
    } else {
      this.controllerLeft.getWorldPosition(leftPos);
      this.controllerLeft.getWorldQuaternion(leftQuat);
    }

    // Vector from left hand to eyes
    const toHead = headPos.clone().sub(leftPos).normalize();

    // Palm normal vector: points outwards from palm face
    const palmNormalLocal = new THREE.Vector3(0.2, 0.85, -0.3).normalize();
    const palmNormalWorld = palmNormalLocal.clone().applyQuaternion(leftQuat);

    // Dot product: > 0.25 means the palm is tilted towards the user's face!
    const facingDot = palmNormalWorld.dot(toHead);
    this.isPaletteFacing = facingDot > 0.25 && leftPos.distanceTo(headPos) < 0.8;

    // Target scale: 0.85 when facing, 0.001 when facing away
    const targetScale = this.isPaletteFacing ? 0.85 : 0.001;
    this.paletteScaleLerp = THREE.MathUtils.lerp(this.paletteScaleLerp, targetScale, delta * 12.0);

    if (this.paletteScaleLerp > 0.05) {
      this.paletteGroup.visible = true;
      this.paletteGroup.scale.setScalar(this.paletteScaleLerp);

      // Position palette gracefully 7cm above the palm facing the player
      const offset = new THREE.Vector3(0.02, 0.08, 0.02).applyQuaternion(leftQuat);
      this.paletteGroup.position.copy(leftPos).add(offset);
      // Billboard angle towards head
      this.paletteGroup.quaternion.copy(leftQuat);
    } else {
      this.paletteGroup.visible = false;
      this.paletteGroup.scale.setScalar(0.001);
    }
  }

  // Two-Handed and Thumbstick Manipulation: Move, Rotate, Scale Up/Down
  updateManipulation(delta) {
    const session = this.renderer.xr.getSession();

    // 1. Check Thumbsticks on Quest 3 Touch Plus Controllers
    if (session && session.inputSources) {
      for (const source of session.inputSources) {
        if (source.gamepad && source.gamepad.axes && source.gamepad.axes.length >= 4) {
          // Right controller thumbstick: rotate and scale
          if (source.handedness === 'right') {
            const axisX = source.gamepad.axes[2]; // Horizontal: Rotate
            const axisY = source.gamepad.axes[3]; // Vertical: Scale Up / Down

            if (Math.abs(axisX) > 0.18) {
              this.dioramaRoot.rotation.y += axisX * delta * 2.4;
            }

            if (Math.abs(axisY) > 0.18) {
              const scaleDelta = 1.0 - axisY * delta * 1.4;
              const newScale = THREE.MathUtils.clamp(this.dioramaRoot.scale.x * scaleDelta, 0.015, 0.35);
              this.dioramaRoot.scale.setScalar(newScale);
            }
          }
        }
      }
    }

    // 2. Two-Handed Manipulation (Grip or Hand Tracking Pinch on both hands)
    const bothActive = (this.isGrippingRight && this.isGrippingLeft) || (this.isPinchingRight && this.isPinchingLeft);

    if (bothActive) {
      const posR = this.getRightHandWorldPosition();
      const posL = this.getLeftHandWorldPosition();

      // Scale Up / Down by hand distance
      const curDist = posR.distanceTo(posL);
      if (this.initialHandsDistance > 0.04) {
        const factor = curDist / this.initialHandsDistance;
        const newScale = THREE.MathUtils.clamp(this.initialDioramaScale * factor, 0.015, 0.35);
        this.dioramaRoot.scale.setScalar(newScale);
      }

      // Rotate around Y by angle between hands
      const dx = posR.x - posL.x;
      const dz = posR.z - posL.z;
      const curAngle = Math.atan2(dx, dz);
      const angleDiff = curAngle - this.initialHandsAngle;
      this.dioramaRoot.rotation.y = this.initialDioramaRotY + angleDiff;

      // Translate by hand midpoint
      const curMidpoint = posR.clone().add(posL).multiplyScalar(0.5);
      const deltaMid = curMidpoint.sub(this.initialHandsMidpoint);
      this.dioramaRoot.position.copy(this.initialDioramaPos).add(deltaMid);

    } else if (this.isGrippingRight || (this.isPinchingRight && !this.reticle.visible)) {
      // Single hand move
      const posR = this.getRightHandWorldPosition();
      const delta = posR.clone().sub(this.singleGripInitialHandPos);
      this.dioramaRoot.position.copy(this.singleGripInitialDioramaPos).add(delta);
    } else if (this.isGrippingLeft || this.isPinchingLeft) {
      const posL = this.getLeftHandWorldPosition();
      const delta = posL.clone().sub(this.singleGripInitialHandPos);
      this.dioramaRoot.position.copy(this.singleGripInitialDioramaPos).add(delta);
    }
  }

  // Pointer & Hand Helpers
  getRightPointerOrigin() {
    if (this.handRight && this.handRight.joints && this.handRight.joints['index-finger-tip'] && this.handRight.joints['index-finger-tip'].visible) {
      const pos = new THREE.Vector3();
      this.handRight.joints['index-finger-tip'].getWorldPosition(pos);
      return pos;
    }
    const pos = new THREE.Vector3();
    this.controllerRight.getWorldPosition(pos);
    return pos;
  }

  getRightPointerDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    if (this.handRight && this.handRight.joints && this.handRight.joints['index-finger-tip'] && this.handRight.joints['index-finger-tip'].visible) {
      const tip = new THREE.Vector3();
      const phalanx = new THREE.Vector3();
      this.handRight.joints['index-finger-tip'].getWorldPosition(tip);
      this.handRight.joints['index-finger-phalanx-distal'].getWorldPosition(phalanx);
      return tip.sub(phalanx).normalize();
    }
    dir.applyQuaternion(this.controllerRight.quaternion);
    return dir;
  }

  getRightHandWorldPosition() {
    const pos = new THREE.Vector3();
    if (this.handRight && this.handRight.joints && this.handRight.joints['wrist'] && this.handRight.joints['wrist'].visible) {
      this.handRight.joints['wrist'].getWorldPosition(pos);
    } else {
      this.controllerRight.getWorldPosition(pos);
    }
    return pos;
  }

  getLeftHandWorldPosition() {
    const pos = new THREE.Vector3();
    if (this.handLeft && this.handLeft.joints && this.handLeft.joints['wrist'] && this.handLeft.joints['wrist'].visible) {
      this.handLeft.joints['wrist'].getWorldPosition(pos);
    } else {
      this.controllerLeft.getWorldPosition(pos);
    }
    return pos;
  }

  worldToDioramaLocal(worldPoint) {
    const local = worldPoint.clone();
    this.dioramaRoot.worldToLocal(local);
    return local;
  }

  getPointerGroundHit() {
    if (!this.app.terrain || !this.app.terrain.raycastMesh) return null;

    const origin = this.getRightPointerOrigin();
    const dir = this.getRightPointerDirection();
    this.raycaster.set(origin, dir);

    const intersects = this.raycaster.intersectObject(this.app.terrain.raycastMesh, false);
    if (intersects.length > 0) {
      return intersects[0].point;
    }
    return null;
  }

  pulseHaptic(controller, intensity = 0.5, duration = 40) {
    try {
      const session = this.renderer.xr.getSession();
      if (!session || !session.inputSources) return;

      for (const source of session.inputSources) {
        if (source.gamepad && source.gamepad.hapticActuators && source.gamepad.hapticActuators.length > 0) {
          source.gamepad.hapticActuators[0].pulse(intensity, duration);
        }
      }
    } catch (e) {
      // Optional fallback
    }
  }

  update(delta = 0.016) {
    if (!this.isXRPresenting) return;

    // 1. Detect Hand Tracking (Joints & Pinches)
    this.updateHandTracking(delta);

    // 2. Detect Left Palm Facing to Show / Hide 3D Menu
    this.updatePalmFacingMenu(delta);

    // 3. Handle Terrain Rotation, Scaling Up/Down, and Movement
    this.updateManipulation(delta);

    // 4. Raycast against Left Palm Menu
    const origin = this.getRightPointerOrigin();
    const dir = this.getRightPointerDirection();
    this.raycaster.set(origin, dir);

    if (this.paletteGroup.visible) {
      const paletteHits = this.raycaster.intersectObjects(this.paletteButtons, false);
      if (paletteHits.length > 0) {
        const hitBtn = paletteHits[0].object;
        if (this.hoveredButton !== hitBtn) {
          if (this.hoveredButton) this.hoveredButton.material.color.setHex(0x334155);
          this.hoveredButton = hitBtn;
          hitBtn.material.color.setHex(0xf6ad55); // Highlight
          this.pulseHaptic(this.controllerRight, 0.25, 20);
        }
        this.reticle.visible = false;
        return;
      } else {
        if (this.hoveredButton) {
          this.hoveredButton.material.color.setHex(0x334155);
          this.hoveredButton = null;
        }
      }
    }

    // 5. Raycast against Island Ground
    const groundHit = this.getPointerGroundHit();
    if (groundHit) {
      this.reticle.position.copy(groundHit);
      this.reticle.position.y += 0.005;
      this.reticle.visible = true;

      // Scale reticle with tabletop scale
      this.reticle.scale.setScalar(this.dioramaRoot.scale.x * 12);

      if (this.isActionActive) {
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
