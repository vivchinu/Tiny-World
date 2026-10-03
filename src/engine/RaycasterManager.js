import * as THREE from 'three';

export class RaycasterManager {
  constructor(sceneManager, terrain) {
    this.sm = sceneManager;
    this.terrain = terrain;
    this.domElement = sceneManager.renderer.domElement;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.isPointerDown = false;
    this.isDragging = false;
    this.dragStart = new THREE.Vector3();
    this.dragCurrent = new THREE.Vector3();
    this.downScreenPos = { x: 0, y: 0 };

    this.currentTool = 'house'; // Default tool
    this.activeVariation = 'cottage'; // Sub-variation

    // Ground hover cursor / cursor ring
    this.initCursorHelper();

    // Callbacks
    this.onDragStartCallback = null;
    this.onDragUpdateCallback = null;
    this.onDragEndCallback = null;
    this.onClickObjectCallback = null;

    this.setupListeners();
  }

  initCursorHelper() {
    this.cursorGroup = new THREE.Group();

    // Glowing ring for cursor position on terrain
    const ringGeo = new THREE.RingGeometry(0.35, 0.45, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf6ad55,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    this.cursorRing = new THREE.Mesh(ringGeo, ringMat);
    this.cursorGroup.add(this.cursorRing);

    // Inner glowing dot
    const dotGeo = new THREE.CircleGeometry(0.12, 16);
    dotGeo.rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    this.cursorDot = new THREE.Mesh(dotGeo, dotMat);
    this.cursorGroup.add(this.cursorDot);

    this.cursorGroup.visible = false;
    this.sm.scene.add(this.cursorGroup);
  }

  setTool(tool, variation = null) {
    this.currentTool = tool;
    if (variation) this.activeVariation = variation;

    const isInspect = (tool === 'inspect');
    this.sm.setBuildMode(!isInspect);
    this.cursorGroup.visible = !isInspect;

    // Change cursor color based on tool
    if (tool === 'demolish') {
      this.cursorRing.material.color.setHex(0xf87171); // Red
    } else if (tool === 'pond') {
      this.cursorRing.material.color.setHex(0x38bdf8); // Cyan
    } else if (tool === 'tree') {
      this.cursorRing.material.color.setHex(0x4ade80); // Green
    } else {
      this.cursorRing.material.color.setHex(0xf6ad55); // Warm Gold
    }
  }

  setVariation(variation) {
    this.activeVariation = variation;
  }

  updatePointerCoord(clientX, clientY) {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  getGroundIntersection() {
    this.raycaster.setFromCamera(this.pointer, this.sm.camera);
    if (!this.terrain || !this.terrain.raycastMesh) return null;

    const intersects = this.raycaster.intersectObject(this.terrain.raycastMesh, false);
    if (intersects.length > 0) {
      return intersects[0].point;
    }
    return null;
  }

  setupListeners() {
    // Pointer down
    this.domElement.addEventListener('pointerdown', (e) => {
      // If right click or middle click, allow OrbitControls to handle orbit/pan
      if (e.button !== 0 || this.currentTool === 'inspect') return;

      this.updatePointerCoord(e.clientX, e.clientY);
      this.downScreenPos = { x: e.clientX, y: e.clientY };

      const groundHit = this.getGroundIntersection();
      if (!groundHit) return;

      this.isPointerDown = true;
      this.isDragging = false;
      this.dragStart.copy(groundHit);
      this.dragCurrent.copy(groundHit);
      this.pointsHistory = [groundHit.clone()];

      if (this.currentTool === 'demolish') {
        // Demolish check on pointer down or click
        this.checkDemolishRaycast();
        return;
      }

      if (this.onDragStartCallback) {
        this.onDragStartCallback(this.dragStart, this.currentTool, this.activeVariation, this.pointsHistory);
      }
    });

    // Pointer move
    this.domElement.addEventListener('pointermove', (e) => {
      this.updatePointerCoord(e.clientX, e.clientY);

      const groundHit = this.getGroundIntersection();
      if (groundHit) {
        this.cursorGroup.position.copy(groundHit);
        this.cursorGroup.position.y += 0.05; // Slight offset above terrain
        this.cursorGroup.visible = (this.currentTool !== 'inspect');
      } else {
        this.cursorGroup.visible = false;
      }

      if (!this.isPointerDown) return;

      // Check drag distance threshold
      const dist = Math.hypot(e.clientX - this.downScreenPos.x, e.clientY - this.downScreenPos.y);
      if (dist > 5) {
        this.isDragging = true;
      }

      if (this.isDragging && groundHit) {
        this.dragCurrent.copy(groundHit);

        const lastPt = this.pointsHistory[this.pointsHistory.length - 1];
        if (!lastPt || lastPt.distanceTo(groundHit) > 0.35) {
          this.pointsHistory.push(groundHit.clone());
        }

        if (this.onDragUpdateCallback) {
          this.onDragUpdateCallback(this.dragStart, this.dragCurrent, this.currentTool, this.activeVariation, this.pointsHistory);
        }
      }
    });

    // Pointer up
    window.addEventListener('pointerup', (e) => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;

      const groundHit = this.getGroundIntersection() || this.dragCurrent;
      if (this.pointsHistory && this.pointsHistory.length > 0) {
        const lastPt = this.pointsHistory[this.pointsHistory.length - 1];
        if (lastPt.distanceTo(groundHit) > 0.1) {
          this.pointsHistory.push(groundHit.clone());
        }
      }

      if (this.onDragEndCallback && this.currentTool !== 'demolish') {
        this.onDragEndCallback(this.dragStart, groundHit, this.isDragging, this.currentTool, this.activeVariation, this.pointsHistory);
      }

      this.isDragging = false;
    });

    // Touch support prevent default scrolling on canvas
    this.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        // Multi-touch gestures (pinch to zoom) -> let orbit controls handle
        this.isPointerDown = false;
        this.isDragging = false;
      }
    }, { passive: true });
  }

  checkDemolishRaycast() {
    this.raycaster.setFromCamera(this.pointer, this.sm.camera);
    if (this.onClickObjectCallback) {
      this.onClickObjectCallback(this.raycaster);
    }
  }
}
