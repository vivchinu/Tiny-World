import * as THREE from 'three';

/**
 * Radial3DMenu - A Modern, Tactile 3D Radial UI for Meta Quest 3 Hand Tracking & WebXR
 * Features:
 * - High-end glassmorphic 3D discs with stereoscopic depth, chamfered bevels, and neon halos
 * - Central Core Hub showing current active tool with rotating 3D preview & title plaque
 * - Direct Touch / Poke collision: Index fingertip pushes directly into 3D buttons (tactile Z-spring)
 * - Subcategory / Variation Arc: Select variations (e.g. 🌸 Sakura, 🌲 Pine, 🌾 Windmill, 🪵 Wood Fence)
 * - World-Lock / Pin UI: Tap 📌 to lock menu hovering in mid-air in front of you so you can rest hands!
 * - Ergonomic Palm-Facing: Menu floats 12cm in front of left palm directly toward the player's view
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
    this.activeVariationId = 'cottage';

    // World-Lock / Pin State
    this.isPinned = false;
    this.pinnedWorldPos = new THREE.Vector3();
    this.pinnedWorldQuat = new THREE.Quaternion();

    // Touch / Poke tracking
    this.pokeActiveButton = null;
    this.pokeCooldown = 0;
    this.lastPinchClickTime = 0;

    // Subcategory variations dictionary
    this.subcategories = {
      house: [
        { id: 'cottage', label: '🏡', title: 'Cottage', color: 0xc2410c, hex: '#c2410c' },
        { id: 'manor', label: '🏛️', title: 'Manor', color: 0x475569, hex: '#475569' },
        { id: 'mossy', label: '🌿', title: 'Mossy', color: 0x4d7c0f, hex: '#4d7c0f' },
        { id: 'windmill', label: '🌾', title: 'Windmill', color: 0xa16207, hex: '#a16207' }
      ],
      wall: [
        { id: 'stone', label: '🧱', title: 'Stone Wall', color: 0x78716c, hex: '#78716c' },
        { id: 'wood', label: '🪵', title: 'Wood Fence', color: 0x854d0e, hex: '#854d0e' },
        { id: 'hedge', label: '🍃', title: 'Hedge', color: 0x2e7d32, hex: '#2e7d32' }
      ],
      tree: [
        { id: 'oak', label: '🌳', title: 'Oak', color: 0x4d7c0f, hex: '#4d7c0f' },
        { id: 'pine', label: '🌲', title: 'Pine', color: 0x1e3a29, hex: '#1e3a29' },
        { id: 'sakura', label: '🌸', title: 'Sakura', color: 0xf472b6, hex: '#f472b6' },
        { id: 'autumn', label: '🍁', title: 'Autumn', color: 0xea580c, hex: '#ea580c' },
        { id: 'birch', label: '🌾', title: 'Birch', color: 0xa3e635, hex: '#a3e635' }
      ],
      path: [
        { id: 'cobble', label: '🪨', title: 'Cobblestone', color: 0x94a3b8, hex: '#94a3b8' },
        { id: 'stepping', label: '⚪', title: 'Stepping Stones', color: 0xcbd5e1, hex: '#cbd5e1' }
      ],
      prop: [
        { id: 'lantern', label: '🏮', title: 'Lantern', color: 0xfbbf24, hex: '#fbbf24' },
        { id: 'bench', label: '🪑', title: 'Bench', color: 0x854d0e, hex: '#854d0e' },
        { id: 'campfire', label: '🔥', title: 'Campfire', color: 0xea580c, hex: '#ea580c' }
      ]
    };

    // Main Satellite Tool Buttons
    this.buttonDefs = [
      { id: 'house', label: '🏠', title: 'House', color: 0xf97316, hex: '#f97316' },
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
    this.subcatButtons = [];
    this.allInteractiveButtons = [];
    this.orbitRadius = 0.135;

    this.init();
  }

  init() {
    this.buildCenterHub();
    this.buildSatelliteButtons();
    this.buildHeaderControls();
    this.buildSubcategoryArc('house');
    this.refreshAllInteractiveButtons();
  }

  refreshAllInteractiveButtons() {
    this.allInteractiveButtons = [
      ...this.buttons,
      ...this.subcatButtons,
      this.btnPin,
      this.btnClose,
      this.btnPrevVar,
      this.btnNextVar
    ].filter(Boolean);
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
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.15,
      transparent: true,
      opacity: 0.95,
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

    this.rebuildCenterPreview('house', 'cottage');

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

    // 6. Subcategory Steppers (◀ Prev and ▶ Next buttons beside title)
    this.btnPrevVar = this.createSmallButton('◀', -0.054, -0.034, 'prev-var');
    this.btnNextVar = this.createSmallButton('▶', 0.054, -0.034, 'next-var');
    this.centerHub.add(this.btnPrevVar);
    this.centerHub.add(this.btnNextVar);

    this.updateTitleCanvas('🏡 Cottage', '#fed7aa');
    this.group.add(this.centerHub);
  }

  createSmallButton(label, x, y, actionId) {
    const btnGroup = new THREE.Group();
    btnGroup.position.set(x, y, 0.012);

    const hitGeo = new THREE.SphereGeometry(0.012, 10, 10);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    btnGroup.add(hitMesh);

    const discGeo = new THREE.CylinderGeometry(0.010, 0.010, 0.006, 16);
    discGeo.rotateX(Math.PI / 2);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.4,
      roughness: 0.2
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.renderOrder = 10003;
    btnGroup.add(disc);

    const rimGeo = new THREE.TorusGeometry(0.010, 0.0016, 8, 16);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.renderOrder = 10004;
    btnGroup.add(rim);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fed7aa';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 32, 32);

    const tex = new THREE.CanvasTexture(canvas);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.014), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }));
    plane.position.z = 0.005;
    plane.renderOrder = 10005;
    btnGroup.add(plane);

    btnGroup.userData = {
      actionId,
      hitMesh,
      rimMesh: rim,
      discMesh: disc,
      currentPressZ: 0,
      isHovered: false
    };

    return btnGroup;
  }

  // ---------------------------------------------------------------------------
  // Header Controls: Pin / Lock UI in Air (World-Lock) & Close Button
  // ---------------------------------------------------------------------------
  buildHeaderControls() {
    // 1. Pin / Lock UI Button (at top-right x = +0.13m, y = +0.13m)
    this.btnPin = new THREE.Group();
    this.btnPin.position.set(0.125, 0.125, 0.01);

    const pinHitGeo = new THREE.SphereGeometry(0.020, 10, 10);
    const pinHitMesh = new THREE.Mesh(pinHitGeo, new THREE.MeshBasicMaterial({ visible: false }));
    this.btnPin.add(pinHitMesh);

    const pinDiscGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.008, 20);
    pinDiscGeo.rotateX(Math.PI / 2);
    this.pinDiscMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.2 });
    const pinDisc = new THREE.Mesh(pinDiscGeo, this.pinDiscMat);
    pinDisc.renderOrder = 10003;
    this.btnPin.add(pinDisc);

    const pinRimGeo = new THREE.TorusGeometry(0.016, 0.002, 10, 20);
    this.pinRimMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const pinRim = new THREE.Mesh(pinRimGeo, this.pinRimMat);
    pinRim.renderOrder = 10004;
    this.btnPin.add(pinRim);

    this.pinCanvas = document.createElement('canvas');
    this.pinCanvas.width = 96;
    this.pinCanvas.height = 96;
    this.pinCtx = this.pinCanvas.getContext('2d');
    this.pinTex = new THREE.CanvasTexture(this.pinCanvas);
    const pinPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.024, 0.024), new THREE.MeshBasicMaterial({ map: this.pinTex, transparent: true, depthTest: false }));
    pinPlane.position.z = 0.006;
    pinPlane.renderOrder = 10005;
    this.btnPin.add(pinPlane);

    this.updatePinCanvas(false);

    this.btnPin.userData = {
      actionId: 'toggle-pin',
      hitMesh: pinHitMesh,
      rimMesh: pinRim,
      discMesh: pinDisc,
      currentPressZ: 0,
      isHovered: false
    };
    this.group.add(this.btnPin);

    // 2. Dismiss / Close Button (at top-left x = -0.125m, y = +0.125m)
    this.btnClose = new THREE.Group();
    this.btnClose.position.set(-0.125, 0.125, 0.01);
    this.btnClose.visible = false; // only visible when pinned

    const closeHit = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), new THREE.MeshBasicMaterial({ visible: false }));
    this.btnClose.add(closeHit);

    const closeDisc = new THREE.Mesh(pinDiscGeo, new THREE.MeshStandardMaterial({ color: 0x450a0a, metalness: 0.3, roughness: 0.3 }));
    closeDisc.renderOrder = 10003;
    this.btnClose.add(closeDisc);

    const closeRim = new THREE.Mesh(pinRimGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    closeRim.renderOrder = 10004;
    this.btnClose.add(closeRim);

    const closeCanvas = document.createElement('canvas');
    closeCanvas.width = 64;
    closeCanvas.height = 64;
    const cCtx = closeCanvas.getContext('2d');
    cCtx.fillStyle = '#fca5a5';
    cCtx.font = 'bold 44px sans-serif';
    cCtx.textAlign = 'center';
    cCtx.textBaseline = 'middle';
    cCtx.fillText('✕', 32, 32);

    const closeTex = new THREE.CanvasTexture(closeCanvas);
    const closePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.022), new THREE.MeshBasicMaterial({ map: closeTex, transparent: true, depthTest: false }));
    closePlane.position.z = 0.006;
    closePlane.renderOrder = 10005;
    this.btnClose.add(closePlane);

    this.btnClose.userData = {
      actionId: 'close-menu',
      hitMesh: closeHit,
      rimMesh: closeRim,
      discMesh: closeDisc,
      currentPressZ: 0,
      isHovered: false
    };
    this.group.add(this.btnClose);
  }

  updatePinCanvas(isPinned) {
    const ctx = this.pinCtx;
    ctx.clearRect(0, 0, 96, 96);
    ctx.fillStyle = isPinned ? '#10b981' : '#38bdf8';
    ctx.font = '54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isPinned ? '📌' : '🔓', 48, 48);
    this.pinTex.needsUpdate = true;

    if (this.pinRimMat) {
      this.pinRimMat.color.setHex(isPinned ? 0x10b981 : 0x38bdf8);
    }
  }

  togglePin() {
    this.isPinned = !this.isPinned;
    this.app.audio.playPop();

    if (this.isPinned) {
      this.group.getWorldPosition(this.pinnedWorldPos);
      this.group.getWorldQuaternion(this.pinnedWorldQuat);
      this.updatePinCanvas(true);
      this.btnClose.visible = true;
      this.app.ui.showToast('UI Locked in Room 📌 (Free hands to build)');
    } else {
      this.updatePinCanvas(false);
      this.btnClose.visible = false;
      this.app.ui.showToast('UI Unlocked 🖐️ (Follows left palm)');
    }
  }

  // ---------------------------------------------------------------------------
  // Subcategory Variations Arc (e.g. 🌸 Sakura, 🌲 Pine, 🌾 Windmill, 🪵 Wood Fence)
  // ---------------------------------------------------------------------------
  buildSubcategoryArc(toolId) {
    // Remove old subcat buttons from group
    for (let i = 0; i < this.subcatButtons.length; i++) {
      this.group.remove(this.subcatButtons[i]);
    }
    this.subcatButtons = [];

    const variations = this.subcategories[toolId];
    if (!variations || variations.length === 0) {
      this.refreshAllInteractiveButtons();
      return;
    }

    const count = variations.length;
    const arcRadius = 0.205; // 20.5cm outer radius
    const startAngle = -Math.PI / 2 - (count - 1) * 0.22 * 0.5;

    for (let i = 0; i < count; i++) {
      const v = variations[i];
      const angle = startAngle + i * 0.22;
      const targetX = Math.cos(angle) * arcRadius;
      const targetY = Math.sin(angle) * arcRadius;

      const btnGroup = new THREE.Group();
      btnGroup.position.set(targetX, targetY, 0.01);

      const hitGeo = new THREE.SphereGeometry(0.019, 10, 10);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      btnGroup.add(hitMesh);

      const isCurrent = (v.id === this.activeVariationId);

      const discGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.007, 20);
      discGeo.rotateX(Math.PI / 2);
      const discMat = new THREE.MeshStandardMaterial({
        color: isCurrent ? 0x1e3a8a : 0x1e293b,
        metalness: 0.4,
        roughness: 0.2
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.renderOrder = 10003;
      btnGroup.add(discMesh);

      const rimGeo = new THREE.TorusGeometry(0.016, 0.002, 10, 20);
      const rimMat = new THREE.MeshBasicMaterial({
        color: isCurrent ? 0x10b981 : v.color
      });
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.renderOrder = 10004;
      btnGroup.add(rimMesh);

      // Icon plane
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.font = '54px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(v.label, 48, 48);

      const tex = new THREE.CanvasTexture(canvas);
      const iconPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.024, 0.024), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }));
      iconPlane.position.z = 0.005;
      iconPlane.renderOrder = 10005;
      btnGroup.add(iconPlane);

      btnGroup.userData = {
        actionId: 'select-variation',
        toolId,
        variationId: v.id,
        def: v,
        hitMesh,
        rimMesh,
        discMesh,
        currentPressZ: 0,
        isHovered: false
      };

      this.group.add(btnGroup);
      this.subcatButtons.push(btnGroup);
    }

    this.refreshAllInteractiveButtons();
  }

  selectVariation(toolId, variationId) {
    this.activeVariationId = variationId;
    this.app.raycaster.activeVariation = variationId;
    if (this.app.ui && this.app.ui.selectVariation) {
      this.app.ui.selectVariation(toolId, variationId);
    }

    const variations = this.subcategories[toolId] || [];
    const vDef = variations.find(v => v.id === variationId);
    const title = vDef ? `${vDef.label} ${vDef.title}` : variationId;
    const colorHex = vDef ? vDef.hex : '#fed7aa';

    this.updateTitleCanvas(title, colorHex);
    this.rebuildCenterPreview(toolId, variationId);

    // Update subcategory buttons highlight
    for (let i = 0; i < this.subcatButtons.length; i++) {
      const btn = this.subcatButtons[i];
      const isSel = (btn.userData.variationId === variationId);
      btn.userData.rimMesh.material.color.setHex(isSel ? 0x10b981 : btn.userData.def.color);
      btn.userData.discMesh.material.color.setHex(isSel ? 0x1e3a8a : 0x1e293b);
    }

    this.app.audio.playPop();
    this.xr.pulseHaptic(this.xr.controllerRight, 0.7, 40);
    this.app.ui.showToast(`Selected ${title}`);
  }

  cycleVariation(direction = 1) {
    const vars = this.subcategories[this.activeToolId];
    if (!vars || vars.length <= 1) return;

    const curIdx = vars.findIndex(v => v.id === this.activeVariationId);
    const nextIdx = (curIdx + direction + vars.length) % vars.length;
    this.selectVariation(this.activeToolId, vars[nextIdx].id);
  }

  updateTitleCanvas(title, colorHex = '#ea580c') {
    const ctx = this.titleCtx;
    ctx.clearRect(0, 0, 256, 72);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.roundRect(16, 8, 224, 56, 28);
    ctx.fill();

    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 128, 36);

    this.titleTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  // Satellite Orbiting Buttons (Main Tools)
  // ---------------------------------------------------------------------------
  buildSatelliteButtons() {
    const total = this.buttonDefs.length;

    for (let i = 0; i < total; i++) {
      const def = this.buttonDefs[i];
      const angle = -Math.PI / 2 + (i / total) * Math.PI * 2;
      const targetX = Math.cos(angle) * this.orbitRadius;
      const targetY = Math.sin(angle) * this.orbitRadius;

      const btnGroup = new THREE.Group();
      btnGroup.position.set(0, 0, 0);

      // Hitbox
      const hitGeo = new THREE.SphereGeometry(0.024, 12, 12);
      const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
      btnGroup.add(hitMesh);

      // 3D Beveled Disc
      const discGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.008, 24);
      discGeo.rotateX(Math.PI / 2);
      const discMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.15,
        transparent: true,
        opacity: 0.95,
        depthTest: true
      });
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.renderOrder = 10000;
      btnGroup.add(discMesh);

      // Metallic Outer Bevel Rim
      const rimGeo = new THREE.TorusGeometry(0.022, 0.0024, 12, 24);
      const rimMat = new THREE.MeshStandardMaterial({
        color: def.color,
        roughness: 0.2,
        metalness: 0.8
      });
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.renderOrder = 10001;
      btnGroup.add(rimMesh);

      // Glowing Neon Halo Ring
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

      // Icon plane
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
      iconPlane.position.z = 0.007;
      iconPlane.renderOrder = 10002;
      btnGroup.add(iconPlane);

      // Label Banner
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
      const labelPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.046, 0.014), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthTest: false }));
      labelPlane.position.set(0, -0.024, 0.008);
      labelPlane.renderOrder = 10003;
      labelPlane.visible = false;
      btnGroup.add(labelPlane);

      btnGroup.userData = {
        def,
        actionId: 'select-tool',
        toolId: def.id,
        index: i,
        angle,
        targetPos: new THREE.Vector3(targetX, targetY, 0),
        currentPressZ: 0,
        hoverScale: 1.0,
        isHovered: false,
        hitMesh,
        discMesh,
        rimMesh,
        haloMesh,
        iconPlane,
        iconCanvas,
        iconTex,
        labelPlane
      };

      this.group.add(btnGroup);
      this.buttons.push(btnGroup);
    }
  }

  // ---------------------------------------------------------------------------
  // 3D Miniature Model Preview inside Center Core (Updates with Subcategories!)
  // ---------------------------------------------------------------------------
  rebuildCenterPreview(toolId, variationId = null) {
    while (this.previewContainer.children.length > 0) {
      const child = this.previewContainer.children[0];
      this.previewContainer.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    if (toolId === 'house') {
      const g = new THREE.Group();
      if (variationId === 'windmill') {
        // Octagonal Windmill
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6, 0.8, 1.4, 8),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 })
        );
        body.position.y = 0.7;
        g.add(body);
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: 0x78716c })
        );
        dome.position.y = 1.4;
        g.add(dome);
        // Sails
        for (let i = 0; i < 4; i++) {
          const sail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.02), new THREE.MeshStandardMaterial({ color: 0xfef08a }));
          sail.position.set(0, 1.4, 0.65);
          sail.rotation.z = (i * Math.PI) / 2;
          g.add(sail);
        }
      } else {
        const wallColor = variationId === 'mossy' ? 0xdcfce7 : (variationId === 'manor' ? 0xcbd5e1 : 0xfaf5ef);
        const roofColor = variationId === 'mossy' ? 0x2e7d32 : (variationId === 'manor' ? 0x334155 : 0xc2410c);
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 1.0, 1.2),
          new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.6 })
        );
        body.position.y = 0.5;
        g.add(body);
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(1.1, 0.8, 4),
          new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.4 })
        );
        roof.position.y = 1.35;
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
      }
      this.previewContainer.add(g);

    } else if (toolId === 'wall') {
      const wallColor = variationId === 'wood' ? 0x854d0e : (variationId === 'hedge' ? 0x2e7d32 : 0x78716c);
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.9, 0.45),
        new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.7 })
      );
      wall.position.y = 0.45;
      this.previewContainer.add(wall);

    } else if (toolId === 'tree') {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.24, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x5c3a21 })
      );
      trunk.position.y = 0.4;
      g.add(trunk);

      let leafColor = 0x1e3a29;
      if (variationId === 'sakura') leafColor = 0xf472b6;
      else if (variationId === 'autumn') leafColor = 0xea580c;
      else if (variationId === 'birch') leafColor = 0xa3e635;
      else if (variationId === 'oak') leafColor = 0x4d7c0f;

      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.8 - i * 0.18, 0.7, 8),
          new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.6 })
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
      const pathColor = variationId === 'stepping' ? 0xe2e8f0 : 0x94a3b8;
      const path = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.08, 0.8),
        new THREE.MeshStandardMaterial({ color: pathColor, roughness: 0.8 })
      );
      path.position.y = 0.05;
      this.previewContainer.add(path);

    } else if (toolId === 'prop') {
      const g = new THREE.Group();
      if (variationId === 'campfire') {
        const stone = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.15, 8, 16), new THREE.MeshStandardMaterial({ color: 0x78716c }));
        stone.rotation.x = Math.PI / 2;
        stone.position.y = 0.15;
        g.add(stone);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.9 }));
        flame.position.y = 0.55;
        g.add(flame);
      } else if (variationId === 'bench') {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x854d0e }));
        seat.position.y = 0.4;
        g.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0x854d0e }));
        back.position.set(0, 0.7, -0.22);
        g.add(back);
      } else {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 8), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 }));
        post.position.y = 0.7;
        g.add(post);
        const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfbbf24, emissiveIntensity: 0.8 }));
        lantern.position.y = 1.35;
        g.add(lantern);
      }
      this.previewContainer.add(g);

    } else if (toolId === 'demolish') {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x854d0e }));
      handle.position.y = 0.6;
      g.add(handle);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6 }));
      head.position.y = 1.1;
      g.add(head);
      g.rotation.z = -Math.PI / 4;
      this.previewContainer.add(g);

    } else if (toolId === 'anchor') {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.12, 12, 24), new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.8, roughness: 0.2 }));
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

    // 1. Palm Orientation & Ergonomic Placement (or World-Locked stationary position)
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

      const stagger = i * 0.04;
      const progress = THREE.MathUtils.clamp((this.openProgress - stagger) / (1.0 - stagger), 0, 1);
      const easedProgress = Math.sin((progress * Math.PI) / 2);

      btn.position.x = targetPos.x * easedProgress;
      btn.position.y = targetPos.y * easedProgress;
      btn.position.z = (btn.userData.isHovered ? 0.012 : 0) + btn.userData.currentPressZ;

      const targetScale = (btn.userData.isHovered ? 1.18 : 1.0) * easedProgress;
      btn.scale.setScalar(targetScale);
    }

    // 3. Rotate Central Preview Object
    if (this.previewContainer) {
      this.previewContainer.rotation.y += delta * 1.5;
    }

    // 4. DIRECT TOUCH / POKE COLLISION (Index Fingertip pushes directly into buttons)
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
      for (let i = 0; i < this.allInteractiveButtons.length; i++) {
        const btn = this.allInteractiveButtons[i];
        if (!btn || !btn.userData || !btn.userData.hitMesh) continue;

        const btnWorldPos = new THREE.Vector3();
        btn.userData.hitMesh.getWorldPosition(btnWorldPos);

        const dist = rightIndexPos.distanceTo(btnWorldPos);

        if (dist < 0.042) {
          hoveredButton = btn;

          if (dist < 0.019) {
            pokedButton = btn;
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
      this.handleButtonAction(pokedButton);
      this.pokeCooldown = 0.35;
    }

    // 5. STABLE RAYCAST + PINCH INTERACTION (Distance Pointer)
    if (!hoveredButton && controllerRight) {
      const raycaster = this.xr.raycaster;
      const origin = this.xr.getRightPointerOrigin();
      const dir = this.xr.getRightPointerDirection();
      raycaster.set(origin, dir);

      const hitMeshes = this.allInteractiveButtons
        .filter(b => b && b.userData && b.userData.hitMesh)
        .map(b => b.userData.hitMesh);

      const intersects = raycaster.intersectObjects(hitMeshes, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        hoveredButton = this.allInteractiveButtons.find(b => b && b.userData && b.userData.hitMesh === hitMesh);

        if (isPinchingRight && (performance.now() - this.lastPinchClickTime > 400)) {
          this.lastPinchClickTime = performance.now();
          this.handleButtonAction(hoveredButton);
        }
      }
    }

    // Update Hover Visuals
    for (let i = 0; i < this.allInteractiveButtons.length; i++) {
      const btn = this.allInteractiveButtons[i];
      if (!btn || !btn.userData) continue;

      const isHov = (btn === hoveredButton);
      btn.userData.isHovered = isHov;

      if (btn.userData.rimMesh && btn.userData.def) {
        btn.userData.rimMesh.material.color.setHex(isHov ? 0xffffff : btn.userData.def.color);
      }
      if (btn.userData.haloMesh) {
        btn.userData.haloMesh.material.opacity = isHov ? 0.85 : 0.25;
      }
      if (btn.userData.labelPlane) {
        btn.userData.labelPlane.visible = isHov;
      }
    }

    this.hoveredButton = hoveredButton;
  }

  // ---------------------------------------------------------------------------
  // Palm Summon Detection & Ergonomic Billboarding (or Stationary World-Lock)
  // ---------------------------------------------------------------------------
  updatePalmSummon(delta, headPos, leftHand) {
    // If pinned in room, keep static world position & rotation!
    if (this.isPinned) {
      this.isOpen = true;
      this.openProgress = THREE.MathUtils.lerp(this.openProgress, 1.0, delta * 12.0);
      this.group.scale.setScalar(this.openProgress);
      this.group.position.copy(this.pinnedWorldPos);
      this.group.quaternion.copy(this.pinnedWorldQuat);
      return;
    }

    let leftPos = new THREE.Vector3();
    let leftQuat = new THREE.Quaternion();
    let palmNormalWorld = new THREE.Vector3();
    let isHandTracked = false;

    if (leftHand && leftHand.joints && leftHand.joints['wrist'] && leftHand.joints['wrist'].visible) {
      leftHand.joints['wrist'].getWorldPosition(leftPos);
      leftHand.joints['wrist'].getWorldQuaternion(leftQuat);
      isHandTracked = true;

      const jMid = leftHand.joints['middle-finger-metacarpal'];
      const jIdx = leftHand.joints['index-finger-metacarpal'];
      if (jMid && jIdx && jMid.visible && jIdx.visible) {
        const pWrist = new THREE.Vector3();
        const pMid = new THREE.Vector3();
        const pIdx = new THREE.Vector3();
        leftHand.joints['wrist'].getWorldPosition(pWrist);
        jMid.getWorldPosition(pMid);
        jIdx.getWorldPosition(pIdx);

        const vFingers = pMid.sub(pWrist).normalize();
        const vThumbSide = pIdx.sub(pWrist).normalize();

        // Cross product for left hand points outward from palm face
        palmNormalWorld.crossVectors(vFingers, vThumbSide).normalize();
      } else {
        const palmNormalLocal = new THREE.Vector3(0, 1, 0);
        palmNormalWorld.copy(palmNormalLocal).applyQuaternion(leftQuat).normalize();
      }
    } else if (this.xr.controllerLeft) {
      this.xr.controllerLeft.getWorldPosition(leftPos);
      this.xr.controllerLeft.getWorldQuaternion(leftQuat);
      const palmNormalLocal = new THREE.Vector3(0, 0.7, -0.7).normalize();
      palmNormalWorld.copy(palmNormalLocal).applyQuaternion(leftQuat).normalize();
    } else {
      this.isOpen = false;
      this.openProgress = THREE.MathUtils.lerp(this.openProgress, 0, delta * 12);
      return;
    }

    // Vector from left hand to headset eyes
    const toHead = headPos.clone().sub(leftPos).normalize();

    // Facing check: dot product > 0.12 means left palm face is tilted towards player's eyes
    const facingDot = palmNormalWorld.dot(toHead);
    const distToHead = leftPos.distanceTo(headPos);

    this.isOpen = (facingDot > 0.12 && distToHead < 0.95);

    const targetProgress = this.isOpen ? 1.0 : 0.0;
    this.openProgress = THREE.MathUtils.lerp(this.openProgress, targetProgress, delta * 14.0);

    if (this.openProgress > 0.02) {
      this.group.scale.setScalar(this.openProgress);

      // Ergonomic placement: 12cm directly in front of the palm facing the player's view!
      this.group.position.copy(leftPos).add(toHead.clone().multiplyScalar(0.12));

      // Billboard smoothly to face the player's eyes
      this.group.lookAt(headPos);
    }
  }

  // ---------------------------------------------------------------------------
  // Button Click / Poke Actions
  // ---------------------------------------------------------------------------
  handleButtonAction(btn) {
    if (!btn || !btn.userData) return;
    const actionId = btn.userData.actionId;

    if (actionId === 'toggle-pin') {
      this.togglePin();
      return;
    }

    if (actionId === 'close-menu') {
      this.isPinned = false;
      this.isOpen = false;
      this.openProgress = 0;
      this.updatePinCanvas(false);
      this.btnClose.visible = false;
      this.app.audio.playPop();
      return;
    }

    if (actionId === 'prev-var') {
      this.cycleVariation(-1);
      return;
    }

    if (actionId === 'next-var') {
      this.cycleVariation(1);
      return;
    }

    if (actionId === 'select-variation') {
      this.selectVariation(btn.userData.toolId, btn.userData.variationId);
      return;
    }

    if (actionId === 'select-tool') {
      this.triggerButton(btn.userData.toolId);
      return;
    }
  }

  triggerButton(toolId) {
    this.app.audio.playPop();
    this.xr.pulseHaptic(this.xr.controllerRight, 0.8, 50);

    if (toolId === 'anchor') {
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

    // Main Tool Selection
    this.activeToolId = toolId;
    this.app.ui.selectTool(toolId);

    // Default to first variation of tool if available
    const vars = this.subcategories[toolId];
    if (vars && vars.length > 0) {
      this.activeVariationId = vars[0].id;
      this.app.raycaster.activeVariation = this.activeVariationId;
    }

    const def = this.buttonDefs.find(b => b.id === toolId);
    const title = def ? def.title : toolId.toUpperCase();
    const colorHex = def ? def.hex : '#fed7aa';

    this.rebuildCenterPreview(toolId, this.activeVariationId);
    this.updateTitleCanvas(title, colorHex);
    this.buildSubcategoryArc(toolId);

    if (this.hubHaloMat) {
      this.hubHaloMat.color.setHex(def ? def.color : 0xf97316);
      this.hubHaloMesh.scale.setScalar(1.3);
      setTimeout(() => {
        if (this.hubHaloMesh) this.hubHaloMesh.scale.setScalar(1.0);
      }, 180);
    }

    this.app.ui.showToast(`Selected ${title}`);
  }

  updateAnchorVisuals(isLocked) {
    const anchorBtn = this.buttons.find(b => b.userData.def.id === 'anchor');
    if (!anchorBtn) return;

    const def = anchorBtn.userData.def;
    def.title = isLocked ? 'Anchor: ON' : 'Anchor: OFF';
    def.label = isLocked ? '⚓' : '🔓';
    def.color = isLocked ? 0x10b981 : 0x38bdf8;
    def.hex = isLocked ? '#10b981' : '#38bdf8';

    anchorBtn.userData.rimMesh.material.color.setHex(def.color);
    anchorBtn.userData.haloMesh.material.color.setHex(def.color);

    const ctx = anchorBtn.userData.iconCanvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.label, 64, 64);
    anchorBtn.userData.iconTex.needsUpdate = true;

    if (this.activeToolId === 'anchor') {
      this.updateTitleCanvas(def.title, def.hex);
    }
  }
}
