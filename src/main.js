import * as THREE from 'three';
import { SceneManager } from './engine/SceneManager.js';
import { Terrain } from './engine/Terrain.js';
import { RaycasterManager } from './engine/RaycasterManager.js';
import { XRManager } from './engine/XRManager.js';

import { HouseGenerator } from './generators/HouseGenerator.js';
import { WallGenerator } from './generators/WallGenerator.js';
import { PathGenerator } from './generators/PathGenerator.js';
import { TreeGenerator } from './generators/TreeGenerator.js';
import { PondGenerator } from './generators/PondGenerator.js';
import { PropGenerator } from './generators/PropGenerator.js';

import { BuildAnimationSystem } from './systems/BuildAnimationSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { WorldSystem } from './systems/WorldSystem.js';
import { PopulationSystem } from './systems/PopulationSystem.js';
import { UIManager } from './ui/UIManager.js';

class TinyWorldApp {
  constructor() {
    // 1. Core 3D Scene
    this.sceneManager = new SceneManager('canvas-container');

    // 2. Tabletop Diorama Root (Scales down and positions on table in WebXR)
    this.dioramaRoot = new THREE.Group();
    this.dioramaRoot.name = 'diorama_root';
    this.sceneManager.scene.add(this.dioramaRoot);

    // 3. Floating Island Terrain attached to Diorama Root
    this.terrain = new Terrain(this.dioramaRoot);

    // 4. Audio & Animation Systems
    this.audio = new AudioSystem();
    this.animSystem = new BuildAnimationSystem(this.sceneManager.scene);

    // 5. Procedural Generators
    this.generators = {
      house: new HouseGenerator(this.terrain),
      wall: new WallGenerator(this.terrain),
      path: new PathGenerator(this.terrain),
      tree: new TreeGenerator(this.terrain),
      pond: new PondGenerator(this.terrain),
      prop: new PropGenerator(this.terrain)
    };

    // 6. World & Population Systems attached to Diorama Root
    this.world = new WorldSystem(
      this.dioramaRoot,
      this.terrain,
      this.generators,
      this.animSystem,
      this.audio
    );

    this.population = new PopulationSystem(
      this.dioramaRoot,
      this.terrain,
      this.sceneManager.camera
    );

    // 7. Desktop Raycaster Interaction
    this.raycaster = new RaycasterManager(this.sceneManager, this.terrain);

    // 8. WebXR Manager (Meta Quest 3 VR, AR Passthrough, 3D Wrist Palette, Tabletop Grip Scaling)
    this.xrManager = new XRManager(this);

    // 9. UI Manager
    this.ui = new UIManager(this);

    // Drag Preview Ghost State
    this.currentPreview = null;

    this.setupInteractionHandlers();

    // Clock
    this.clock = new THREE.Clock();

    // Load initial cozy diorama
    this.world.loadPreset('hamlet');

    // WebXR-compatible Animation Loop (replaces requestAnimationFrame)
    this.animate = this.animate.bind(this);
    this.sceneManager.renderer.setAnimationLoop(this.animate);
  }

  setupInteractionHandlers() {
    // Drag Start
    this.raycaster.onDragStartCallback = (startPoint, tool, variation) => {
      this.removePreview();

      if (tool === 'tree' || tool === 'prop') {
        return;
      }

      this.updatePreview(startPoint, startPoint, tool, variation);
    };

    // Drag Update (Move)
    this.raycaster.onDragUpdateCallback = (startPoint, currentPoint, tool, variation) => {
      if (tool === 'tree' || tool === 'prop' || tool === 'inspect' || tool === 'demolish') {
        return;
      }
      this.updatePreview(startPoint, currentPoint, tool, variation);
    };

    // Drag End / Commit
    this.raycaster.onDragEndCallback = (startPoint, endPoint, wasDragging, tool, variation) => {
      this.removePreview();

      if (tool === 'inspect' || tool === 'demolish') return;

      if (tool === 'house') {
        const house = this.generators.house.createFromPoints(startPoint, endPoint, variation);
        this.world.addObject(house);
        this.animSystem.animateHouse(house);

      } else if (tool === 'wall') {
        const wall = this.generators.wall.createFromPoints(startPoint, endPoint, variation);
        this.world.addObject(wall);
        this.animSystem.animateWall(wall);

      } else if (tool === 'path') {
        const path = this.generators.path.createFromPoints(startPoint, endPoint, variation);
        this.world.addObject(path);
        this.animSystem.animateGenericSpring(path);

      } else if (tool === 'pond') {
        const pond = this.generators.pond.createFromPoints(startPoint, endPoint, variation);
        this.world.addObject(pond);
        this.animSystem.animateGenericSpring(pond);

      } else if (tool === 'tree') {
        const tree = this.generators.tree.createAtPoint(endPoint, variation);
        this.world.addObject(tree);
        this.animSystem.animateTree(tree);

      } else if (tool === 'prop') {
        const prop = this.generators.prop.createAtPoint(endPoint, variation);
        this.world.addObject(prop);
        this.animSystem.animateGenericSpring(prop);
      }
    };

    // Demolish Click Raycast
    this.raycaster.onClickObjectCallback = (raycaster) => {
      const allMeshes = [];
      this.world.objects.forEach((obj) => {
        obj.traverse((child) => {
          if (child.isMesh) {
            child.userData.rootObject = obj;
            allMeshes.push(child);
          }
        });
      });

      const intersects = raycaster.intersectObjects(allMeshes, false);
      if (intersects.length > 0) {
        const hitRoot = intersects[0].object.userData.rootObject;
        if (hitRoot) {
          this.world.removeObject(hitRoot);
          this.ui.showToast('Demolished object');
        }
      }
    };
  }

  updatePreview(startPoint, currentPoint, tool, variation) {
    this.removePreview();

    if (tool === 'house') {
      this.currentPreview = this.generators.house.createFromPoints(startPoint, currentPoint, variation, true);
    } else if (tool === 'wall') {
      this.currentPreview = this.generators.wall.createFromPoints(startPoint, currentPoint, variation, true);
    } else if (tool === 'path') {
      this.currentPreview = this.generators.path.createFromPoints(startPoint, currentPoint, variation, true);
    } else if (tool === 'pond') {
      this.currentPreview = this.generators.pond.createFromPoints(startPoint, currentPoint, variation, true);
    }

    if (this.currentPreview) {
      this.dioramaRoot.add(this.currentPreview);
    }
  }

  removePreview() {
    if (this.currentPreview) {
      this.dioramaRoot.remove(this.currentPreview);
      this.world.disposeObject(this.currentPreview);
      this.currentPreview = null;
    }
  }

  animate(timeMs, xrFrame) {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    // Update Systems
    this.sceneManager.update(delta);
    this.terrain.update(time);
    this.animSystem.update(delta);
    this.world.update(delta, time);
    this.population.update(delta);

    // Update WebXR interactions
    if (this.xrManager) {
      this.xrManager.update();
    }

    // Render Scene (Three.js automatically routes to VR/AR headset when XR is active)
    this.sceneManager.render();
  }
}

// Bootstrap when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.app = new TinyWorldApp();
});
