import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Forward-Render Hand Skeleton & Visual Highlight Helper
// Always renders in front of virtual objects (renderOrder 9999, depthTest false)
// ---------------------------------------------------------------------------
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _vUp = new THREE.Vector3(0, 1, 0);
const _tempQuat = new THREE.Quaternion();
const _tempPos = new THREE.Vector3();

class HandVisualizer {
  constructor(scene, handedness = 'right') {
    this.scene = scene;
    this.handedness = handedness;
    this.group = new THREE.Group();
    this.group.renderOrder = 9999;
    this.scene.add(this.group);

    this.jointMeshes = {};
    this.boneCylinders = [];

    // Joint geometries & materials (depthTest false, depthWrite false for forward rendering)
    const jointGeo = new THREE.SphereGeometry(0.0055, 10, 8);
    const tipGeo = new THREE.SphereGeometry(0.009, 12, 10);

    this.matStandard = new THREE.MeshBasicMaterial({
      color: 0x94a3b8, // Clean Slate/Silver
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false
    });

    this.matThumb = new THREE.MeshBasicMaterial({
      color: 0xfb923c, // Warm Sunset Amber
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false
    });

    this.matIndex = new THREE.MeshBasicMaterial({
      color: 0xfbbf24, // Electric Gold (Draw / Place / Click)
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false
    });

    this.matMiddle = new THREE.MeshBasicMaterial({
      color: 0x34d399, // Bright Emerald (Rotate & Zoom)
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false
    });

    this.matLittle = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc, // Sky Blue (Ring & Pinky)
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false
    });

    // 3D Bone links (cylinders for real volume and high visibility in Quest 3)
    const boneCylGeo = new THREE.CylinderGeometry(0.003, 0.0035, 1, 6);
    this.boneMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa, // Glowing Cyan/Blue
      transparent: true,
      opacity: 0.7,
      depthTest: false,
      depthWrite: false
    });

    // Palm Center glowing disc
    const palmGeo = new THREE.CircleGeometry(0.016, 16);
    this.palmDisc = new THREE.Mesh(palmGeo, new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      depthTest: false,
      depthWrite: false
    }));
    this.palmDisc.renderOrder = 9998;
    this.palmDisc.visible = false;
    this.group.add(this.palmDisc);

    // Pinch Halo: Index (Draw / Build active indicator)
    const ringGeo = new THREE.RingGeometry(0.014, 0.020, 20);
    this.pinchHaloIndex = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false
    }));
    this.pinchHaloIndex.renderOrder = 10000;
    this.pinchHaloIndex.visible = false;
    this.group.add(this.pinchHaloIndex);

    // Pinch Halo: Middle (Rotate & Zoom active indicator)
    const middleHaloGeo = new THREE.RingGeometry(0.015, 0.022, 24);
    this.pinchHaloMiddle = new THREE.Mesh(middleHaloGeo, new THREE.MeshBasicMaterial({
      color: 0x34d399,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false
    }));
    this.pinchHaloMiddle.renderOrder = 10000;
    this.pinchHaloMiddle.visible = false;
    this.group.add(this.pinchHaloMiddle);

    // Standard WebXR 25 joint names
    this.jointNames = [
      'wrist',
      'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
      'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
      'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
      'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
      'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'
    ];

    // Create joint meshes
    this.jointNames.forEach((name) => {
      let mat = this.matStandard;
      let geo = jointGeo;

      if (name === 'thumb-tip') {
        mat = this.matThumb;
        geo = tipGeo;
      } else if (name === 'index-finger-tip') {
        mat = this.matIndex;
        geo = tipGeo;
      } else if (name === 'middle-finger-tip') {
        mat = this.matMiddle;
        geo = tipGeo;
      } else if (name === 'ring-finger-tip' || name === 'pinky-finger-tip') {
        mat = this.matLittle;
        geo = tipGeo;
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 9999;
      mesh.visible = false;
      this.group.add(mesh);
      this.jointMeshes[name] = mesh;
    });

    // Bone chains connecting all joints
    this.chains = [
      ['wrist', 'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'],
      ['wrist', 'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip'],
      ['wrist', 'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip'],
      ['wrist', 'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip'],
      ['wrist', 'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip']
    ];

    this.chains.forEach((chain) => {
      for (let i = 0; i < chain.length - 1; i++) {
        const cyl = new THREE.Mesh(boneCylGeo, this.boneMat);
        cyl.renderOrder = 9998;
        cyl.visible = false;
        cyl.userData = { from: chain[i], to: chain[i + 1] };
        this.group.add(cyl);
        this.boneCylinders.push(cyl);
      }
    });
  }

  update(hand, isIndexPinching = false, isMiddlePinching = false) {
    if (!hand || !hand.joints) {
      this.group.visible = false;
      return;
    }

    const wrist = hand.joints['wrist'];
    if (!wrist || !wrist.visible) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;

    // 1. Update joint spheres
    for (let i = 0; i < this.jointNames.length; i++) {
      const name = this.jointNames[i];
      const joint = hand.joints[name];
      const mesh = this.jointMeshes[name];
      if (joint && joint.visible) {
        joint.getWorldPosition(_tempPos);
        mesh.position.copy(_tempPos);
        mesh.visible = true;
      } else {
        mesh.visible = false;
      }
    }

    // 2. Update connecting 3D bone cylinders (real volume, forward-rendered)
    for (let i = 0; i < this.boneCylinders.length; i++) {
      const cyl = this.boneCylinders[i];
      const jFrom = hand.joints[cyl.userData.from];
      const jTo = hand.joints[cyl.userData.to];
      if (jFrom && jTo && jFrom.visible && jTo.visible) {
        jFrom.getWorldPosition(_v1);
        jTo.getWorldPosition(_v2);
        const dist = _v1.distanceTo(_v2);

        if (dist > 0.002) {
          cyl.position.copy(_v1).lerp(_v2, 0.5);
          _vDir.copy(_v2).sub(_v1).normalize();
          _tempQuat.setFromUnitVectors(_vUp, _vDir);
          cyl.quaternion.copy(_tempQuat);
          cyl.scale.set(1, dist, 1);
          cyl.visible = true;
        } else {
          cyl.visible = false;
        }
      } else {
        cyl.visible = false;
      }
    }

    // 3. Palm Center Disc
    const jMidMeta = hand.joints['middle-finger-metacarpal'];
    if (wrist && jMidMeta && wrist.visible && jMidMeta.visible) {
      wrist.getWorldPosition(_v1);
      jMidMeta.getWorldPosition(_v2);
      this.palmDisc.position.copy(_v1).lerp(_v2, 0.5);
      wrist.getWorldQuaternion(_tempQuat);
      this.palmDisc.quaternion.copy(_tempQuat);
      this.palmDisc.visible = true;
    } else {
      this.palmDisc.visible = false;
    }

    // 4. Highlight pinch rings (Gold for Index, Emerald for Middle)
    const thumbMesh = this.jointMeshes['thumb-tip'];
    const indexMesh = this.jointMeshes['index-finger-tip'];
    const middleMesh = this.jointMeshes['middle-finger-tip'];

    if (isIndexPinching && thumbMesh && indexMesh && thumbMesh.visible && indexMesh.visible) {
      this.pinchHaloIndex.visible = true;
      this.pinchHaloIndex.position.copy(thumbMesh.position).lerp(indexMesh.position, 0.5);
      this.pinchHaloIndex.lookAt(this.scene.position);
    } else {
      this.pinchHaloIndex.visible = false;
    }

    if (isMiddlePinching && thumbMesh && middleMesh && thumbMesh.visible && middleMesh.visible) {
      this.pinchHaloMiddle.visible = true;
      this.pinchHaloMiddle.position.copy(thumbMesh.position).lerp(middleMesh.position, 0.5);
      this.pinchHaloMiddle.lookAt(this.scene.position);
    } else {
      this.pinchHaloMiddle.visible = false;
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}

// ---------------------------------------------------------------------------
// Main XRManager Class
// ---------------------------------------------------------------------------
export class XRManager {
  constructor(app) {
    this.app = app;
    this.sm = app.sceneManager;
    this.renderer = this.sm.renderer;
    this.scene = this.sm.scene;
    this.dioramaRoot = app.dioramaRoot; // Tabletop diorama group

    this.isXRPresenting = false;
    this.xrSession = null;
    this.sessionMode = null; // 'immersive-vr' or 'immersive-ar'

    // Controllers & Hand Tracking
    this.controllerRight = null;
    this.controllerLeft = null;
    this.handRight = null;
    this.handLeft = null;

    // Forward-Render Hand Visualizers
    this.visualizerRight = null;
    this.visualizerLeft = null;

    // Raycast & Reticle
    this.raycaster = new THREE.Raycaster();
    this.reticle = null;
    this.isActionActive = false; // Index pinch / Trigger held
    this.dragStartLocal = new THREE.Vector3();
    this.dragCurrentLocal = new THREE.Vector3();

    // 3D VR Left Palm Menu
    this.paletteGroup = null;
    this.paletteButtons = [];
    this.hoveredButton = null;
    this.isPaletteFacing = false;
    this.paletteScaleLerp = 0.001;

    // Pinches state (Separate Index from Middle finger)
    this.isIndexPinchingRight = false;
    this.isIndexPinchingLeft = false;

    // Middle Finger Pinch (Dedicated Rotate & Zoom)
    this.isMiddlePinchingRight = false;
    this.isMiddlePinchingLeft = false;

    this.middlePinchStartPosRight = new THREE.Vector3();
    this.middlePinchStartPosLeft = new THREE.Vector3();
    this.middlePinchInitialDioramaRotY = 0;
    this.middlePinchInitialDioramaScale = 0.07;
    this.middlePinchInitialHandsDist = 0;
    this.middlePinchInitialHandsAngle = 0;

    // Grip states (Controllers)
    this.isGrippingRight = false;
    this.isGrippingLeft = false;
    this.singleGripInitialHandPos = new THREE.Vector3();
    this.singleGripInitialDioramaPos = new THREE.Vector3();

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
      this.scene.background = null;
      this.scene.fog = null;
      this.app.ui.showToast('Quest 3 Passthrough: Look at left palm for menu | Middle pinch to Rotate & Zoom');
    } else {
      this.app.ui.showToast('WebXR VR: Look at left palm for menu | Middle pinch to Rotate & Zoom');
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

    if (this.visualizerRight) this.visualizerRight.setVisible(false);
    if (this.visualizerLeft) this.visualizerLeft.setVisible(false);
    if (this.manipGizmo) this.manipGizmo.visible = false;

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
    // 1. Right & Left Controllers
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

    // 2. Direct Hand Tracking (Hands 0 & 1)
    this.handRight = this.renderer.xr.getHand(0);
    this.scene.add(this.handRight);

    this.handLeft = this.renderer.xr.getHand(1);
    this.scene.add(this.handLeft);

    // 3. Forward-Render Hand Skeleton Visualizers (Renders above virtual models)
    this.visualizerRight = new HandVisualizer(this.scene, 'right');
    this.visualizerLeft = new HandVisualizer(this.scene, 'left');

    // 4. Left Hand-Facing Floating Palm Menu
    this.createWristPalette();

    // 5. Tabletop Manipulation Feedback Indicator Ring (Active during Middle Pinch)
    const gizmoGeo = new THREE.RingGeometry(1.02, 1.07, 48);
    gizmoGeo.rotateX(-Math.PI / 2);
    this.manipGizmo = new THREE.Mesh(gizmoGeo, new THREE.MeshBasicMaterial({
      color: 0x34d399,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
      depthWrite: false
    }));
    this.manipGizmo.position.y = -0.15;
    this.manipGizmo.renderOrder = 9995;
    this.manipGizmo.visible = false;
    this.dioramaRoot.add(this.manipGizmo);
  }

  createWristPalette() {
    this.paletteGroup = new THREE.Group();
    this.paletteGroup.visible = false;
    this.paletteGroup.scale.setScalar(0.001);
    this.paletteGroup.renderOrder = 9999;

    // Frosted glass backing plate
    const panelGeo = new THREE.BoxGeometry(0.25, 0.23, 0.012);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.35,
      metalness: 0.2,
      transparent: true,
      opacity: 0.92,
      depthTest: false
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.renderOrder = 9999;
    this.paletteGroup.add(panel);

    // Border glow rim
    const borderGeo = new THREE.BoxGeometry(0.256, 0.236, 0.008);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xf6ad55, transparent: true, opacity: 0.45, depthTest: false });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.position.z = -0.003;
    border.renderOrder = 9999;
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
    const titleMat = new THREE.MeshBasicMaterial({ map: titleTex, transparent: true, depthTest: false });
    const titlePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.042), titleMat);
    titlePlane.position.set(0, 0.092, 0.01);
    titlePlane.renderOrder = 10000;
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
    const btnSize = 0.044;
    const gapX = 0.058;
    const gapY = 0.048;
    const startY = 0.046;

    buttons.forEach((t, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const bx = (col - 1) * gapX;
      const by = startY - row * gapY;

      const btnGeo = new THREE.BoxGeometry(btnSize, btnSize, 0.016);
      const isControl = (t.id.startsWith('rotate') || t.id.startsWith('scale'));
      const btnMat = new THREE.MeshStandardMaterial({
        color: isControl ? 0x1e293b : 0x334155,
        roughness: 0.4,
        metalness: 0.1,
        depthTest: false
      });
      const btn = new THREE.Mesh(btnGeo, btnMat);
      btn.position.set(bx, by, 0.01);
      btn.renderOrder = 10000;
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
      const iconMat = new THREE.MeshBasicMaterial({ map: iconTex, transparent: true, depthTest: false });
      const iconPlane = new THREE.Mesh(new THREE.PlaneGeometry(btnSize * 0.85, btnSize * 0.85), iconMat);
      iconPlane.position.z = 0.009;
      iconPlane.renderOrder = 10001;
      btn.add(iconPlane);

      this.paletteGroup.add(btn);
      this.paletteButtons.push(btn);
    });

    this.scene.add(this.paletteGroup);
  }

  // Trigger or Index Pinch Start (Action / Draw / Build)
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

  // Middle Finger Pinch Start (Rotate & Zoom)
  onMiddlePinchStart(handIndex) {
    if (handIndex === 0) {
      this.isMiddlePinchingRight = true;
      this.middlePinchStartPosRight.copy(this.getPinchPoint(0, 'middle'));
    } else {
      this.isMiddlePinchingLeft = true;
      this.middlePinchStartPosLeft.copy(this.getPinchPoint(1, 'middle'));
    }

    this.middlePinchInitialDioramaRotY = this.dioramaRoot.rotation.y;
    this.middlePinchInitialDioramaScale = this.dioramaRoot.scale.x;

    if (this.isMiddlePinchingRight && this.isMiddlePinchingLeft) {
      const pR = this.getPinchPoint(0, 'middle');
      const pL = this.getPinchPoint(1, 'middle');
      this.middlePinchInitialHandsDist = pR.distanceTo(pL);
      this.middlePinchInitialHandsAngle = Math.atan2(pR.x - pL.x, pR.z - pL.z);
    }

    if (this.manipGizmo) this.manipGizmo.visible = true;
    this.app.audio.playPop();
  }

  onMiddlePinchEnd(handIndex) {
    if (handIndex === 0) this.isMiddlePinchingRight = false;
    if (handIndex === 1) this.isMiddlePinchingLeft = false;

    if (!this.isMiddlePinchingRight && !this.isMiddlePinchingLeft) {
      if (this.manipGizmo) this.manipGizmo.visible = false;
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

    this.singleGripInitialHandPos.copy(this.isGrippingRight ? posR : posL);
    this.singleGripInitialDioramaPos.copy(this.dioramaRoot.position);
  }

  // Detect and update Hand Tracking (Joints, Index Pinch, Middle Pinch, Hand Forward Render)
  updateHandTracking(delta) {
    const session = this.renderer.xr.getSession();
    if (!session) return;

    // -------------------------------------------------------------
    // 1. Right Hand Tracking (Index Pinch vs Middle Pinch)
    // -------------------------------------------------------------
    if (this.handRight && this.handRight.joints && this.handRight.joints['wrist'] && this.handRight.joints['wrist'].visible) {
      const indexTip = this.handRight.joints['index-finger-tip'];
      const middleTip = this.handRight.joints['middle-finger-tip'];
      const thumbTip = this.handRight.joints['thumb-tip'];

      if (thumbTip && thumbTip.visible) {
        const indexDist = (indexTip && indexTip.visible) ? indexTip.position.distanceTo(thumbTip.position) : 999;
        const middleDist = (middleTip && middleTip.visible) ? middleTip.position.distanceTo(thumbTip.position) : 999;

        // Thresholds with hysteresis
        const indexThreshold = this.isIndexPinchingRight ? 0.030 : 0.024;
        const middleThreshold = this.isMiddlePinchingRight ? 0.032 : 0.026;

        let wantsIndex = indexDist < indexThreshold;
        let wantsMiddle = middleDist < middleThreshold;

        // Mutually exclusive: closer pinch wins, so rotating never accidentally builds or draws!
        if (wantsIndex && wantsMiddle) {
          if (this.isMiddlePinchingRight) {
            wantsIndex = false;
          } else if (this.isIndexPinchingRight) {
            wantsMiddle = false;
          } else if (middleDist < indexDist) {
            wantsIndex = false;
          } else {
            wantsMiddle = false;
          }
        }

        // Apply Index Pinch (Draw / Build / Click)
        if (wantsIndex && !this.isIndexPinchingRight) {
          this.isIndexPinchingRight = true;
          this.onActionStart();
        } else if (!wantsIndex && this.isIndexPinchingRight) {
          this.isIndexPinchingRight = false;
          this.onActionEnd();
        }

        // Apply Middle Finger Pinch (Rotate & Zoom)
        if (wantsMiddle && !this.isMiddlePinchingRight) {
          this.onMiddlePinchStart(0);
        } else if (!wantsMiddle && this.isMiddlePinchingRight) {
          this.onMiddlePinchEnd(0);
        }
      }

      // Update Forward-Render Hand Skeleton (always on top of virtual models)
      this.visualizerRight.update(this.handRight, this.isIndexPinchingRight, this.isMiddlePinchingRight);
    } else {
      this.visualizerRight.setVisible(false);
    }

    // -------------------------------------------------------------
    // 2. Left Hand Tracking (Index Pinch vs Middle Pinch)
    // -------------------------------------------------------------
    if (this.handLeft && this.handLeft.joints && this.handLeft.joints['wrist'] && this.handLeft.joints['wrist'].visible) {
      const indexTip = this.handLeft.joints['index-finger-tip'];
      const middleTip = this.handLeft.joints['middle-finger-tip'];
      const thumbTip = this.handLeft.joints['thumb-tip'];

      if (thumbTip && thumbTip.visible) {
        const indexDist = (indexTip && indexTip.visible) ? indexTip.position.distanceTo(thumbTip.position) : 999;
        const middleDist = (middleTip && middleTip.visible) ? middleTip.position.distanceTo(thumbTip.position) : 999;

        const indexThreshold = this.isIndexPinchingLeft ? 0.030 : 0.024;
        const middleThreshold = this.isMiddlePinchingLeft ? 0.032 : 0.026;

        let wantsIndex = indexDist < indexThreshold;
        let wantsMiddle = middleDist < middleThreshold;

        if (wantsIndex && wantsMiddle) {
          if (this.isMiddlePinchingLeft) {
            wantsIndex = false;
          } else if (this.isIndexPinchingLeft) {
            wantsMiddle = false;
          } else if (middleDist < indexDist) {
            wantsIndex = false;
          } else {
            wantsMiddle = false;
          }
        }

        this.isIndexPinchingLeft = wantsIndex;

        if (wantsMiddle && !this.isMiddlePinchingLeft) {
          this.onMiddlePinchStart(1);
        } else if (!wantsMiddle && this.isMiddlePinchingLeft) {
          this.onMiddlePinchEnd(1);
        }
      }

      this.visualizerLeft.update(this.handLeft, this.isIndexPinchingLeft, this.isMiddlePinchingLeft);
    } else {
      this.visualizerLeft.setVisible(false);
    }
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
    this.isPaletteFacing = facingDot > 0.25 && leftPos.distanceTo(headPos) < 0.85;

    // Target scale: 0.85 when facing, 0.001 when facing away
    const targetScale = this.isPaletteFacing ? 0.85 : 0.001;
    this.paletteScaleLerp = THREE.MathUtils.lerp(this.paletteScaleLerp, targetScale, delta * 12.0);

    if (this.paletteScaleLerp > 0.05) {
      this.paletteGroup.visible = true;
      this.paletteGroup.scale.setScalar(this.paletteScaleLerp);

      // Position palette gracefully 8cm above the palm facing the player's eyes
      const offset = new THREE.Vector3(0.02, 0.08, 0.02).applyQuaternion(leftQuat);
      this.paletteGroup.position.copy(leftPos).add(offset);
      this.paletteGroup.lookAt(headPos);
    } else {
      this.paletteGroup.visible = false;
      this.paletteGroup.scale.setScalar(0.001);
    }
  }

  // Middle Finger Pinch Rotation & Zoom (plus controller thumbsticks)
  updateManipulation(delta) {
    const session = this.renderer.xr.getSession();

    // 1. Controller Thumbsticks (Touch Plus)
    if (session && session.inputSources) {
      for (const source of session.inputSources) {
        if (source.gamepad && source.gamepad.axes && source.gamepad.axes.length >= 4) {
          if (source.handedness === 'right') {
            const axisX = source.gamepad.axes[2]; // Rotate
            const axisY = source.gamepad.axes[3]; // Zoom / Scale

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

    // 2. Middle Finger Pinch Rotation & Zoom (Hand Tracking)
    const cam = this.renderer.xr.getCamera();
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    camRight.y = 0;
    camRight.normalize();

    if (this.isMiddlePinchingRight && this.isMiddlePinchingLeft) {
      // Two-handed middle pinch: distance zooms, angle rotates!
      const pR = this.getPinchPoint(0, 'middle');
      const pL = this.getPinchPoint(1, 'middle');

      // Zoom (Scale) by hand distance
      const curDist = pR.distanceTo(pL);
      if (this.middlePinchInitialHandsDist > 0.04) {
        const factor = curDist / this.middlePinchInitialHandsDist;
        const newScale = THREE.MathUtils.clamp(this.middlePinchInitialDioramaScale * factor, 0.015, 0.35);
        this.dioramaRoot.scale.setScalar(newScale);
      }

      // Rotate around Y by angle between hands
      const dx = pR.x - pL.x;
      const dz = pR.z - pL.z;
      const curAngle = Math.atan2(dx, dz);
      const angleDiff = curAngle - this.middlePinchInitialHandsAngle;
      this.dioramaRoot.rotation.y = this.middlePinchInitialDioramaRotY + angleDiff;

    } else if (this.isMiddlePinchingRight) {
      // Single hand (Right) Middle Finger Pinch:
      // Horizontal motion relative to player view -> Rotate terrain
      // Vertical motion -> Zoom (scale) terrain
      const curPos = this.getPinchPoint(0, 'middle');
      const deltaWorld = curPos.clone().sub(this.middlePinchStartPosRight);
      const dx = deltaWorld.dot(camRight);
      const dy = deltaWorld.y;

      // Turntable rotation
      this.dioramaRoot.rotation.y = this.middlePinchInitialDioramaRotY + dx * 4.5;

      // Zoom / Scale Up and Down
      const scaleFactor = 1.0 + dy * 3.0;
      const newScale = THREE.MathUtils.clamp(this.middlePinchInitialDioramaScale * scaleFactor, 0.015, 0.35);
      this.dioramaRoot.scale.setScalar(newScale);

    } else if (this.isMiddlePinchingLeft) {
      // Single hand (Left) Middle Finger Pinch
      const curPos = this.getPinchPoint(1, 'middle');
      const deltaWorld = curPos.clone().sub(this.middlePinchStartPosLeft);
      const dx = deltaWorld.dot(camRight);
      const dy = deltaWorld.y;

      this.dioramaRoot.rotation.y = this.middlePinchInitialDioramaRotY + dx * 4.5;

      const scaleFactor = 1.0 + dy * 3.0;
      const newScale = THREE.MathUtils.clamp(this.middlePinchInitialDioramaScale * scaleFactor, 0.015, 0.35);
      this.dioramaRoot.scale.setScalar(newScale);

    } else if (this.isGrippingRight || this.isGrippingLeft) {
      // Single controller grip move
      const ctrlPos = this.isGrippingRight ? this.getRightHandWorldPosition() : this.getLeftHandWorldPosition();
      const delta = ctrlPos.clone().sub(this.singleGripInitialHandPos);
      this.dioramaRoot.position.copy(this.singleGripInitialDioramaPos).add(delta);
    }
  }

  // Pointer & Hand Position Helpers
  getPinchPoint(handIndex, finger = 'middle') {
    const hand = handIndex === 0 ? this.handRight : this.handLeft;
    const ctrl = handIndex === 0 ? this.controllerRight : this.controllerLeft;

    if (hand && hand.joints) {
      const tip = hand.joints[`${finger}-finger-tip`];
      const thumb = hand.joints['thumb-tip'];
      if (tip && thumb && tip.visible && thumb.visible) {
        const p1 = new THREE.Vector3();
        const p2 = new THREE.Vector3();
        tip.getWorldPosition(p1);
        thumb.getWorldPosition(p2);
        return p1.lerp(p2, 0.5);
      }
    }
    const pos = new THREE.Vector3();
    ctrl.getWorldPosition(pos);
    return pos;
  }

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

    // 1. Detect Hand Tracking (Joints, Index Pinch, Middle Pinch, Forward Render)
    this.updateHandTracking(delta);

    // 2. Detect Left Palm Facing to Show / Hide 3D Menu
    this.updatePalmFacingMenu(delta);

    // 3. Middle Finger Pinch for Rotation & Zoom / Scaling
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
