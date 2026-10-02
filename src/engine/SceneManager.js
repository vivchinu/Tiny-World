import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdbeafe); // Soft daytime sky
    this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.012);

    // Camera (near plane 0.01m prevents close-up WebXR VR/AR clipping)
    this.camera = new THREE.PerspectiveCamera(40, this.width / this.height, 0.01, 300);
    this.camera.position.set(22, 18, 24);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true // Required for photo snapshot download
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.xr.enabled = true; // Enable WebXR for Quest 3
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 1.5, 0);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep above bottom void
    this.controls.minDistance = 6;
    this.controls.maxDistance = 55;
    this.controls.screenSpacePanning = true;

    // Default: Left click rotates only when inspect tool active, or right click always rotates
    this.setupControlButtons();

    // Lighting Setup
    this.setupLighting();

    // Environment & Clouds
    this.setupSkyAndClouds();

    // Weather Particles
    this.setupWeatherSystem();

    // Resize event
    window.addEventListener('resize', () => this.onResize());

    this.timeOfDay = 12.0; // 12:00 Noon
    this.weatherType = 'clear';
  }

  setupControlButtons() {
    // Standard setup: Right click pans/rotates, middle zooms. Left click can be toggled.
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
  }

  setBuildMode(isBuilding) {
    // When in building mode, left-click is used by raycaster/drawing,
    // so OrbitControls only responds to RIGHT click for rotate and MIDDLE for zoom!
    if (isBuilding) {
      this.controls.mouseButtons = {
        LEFT: null,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
      };
      this.container.classList.add('drawing');
    } else {
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
      this.container.classList.remove('drawing');
    }
  }

  setupLighting() {
    // Ambient / Hemisphere light
    this.hemiLight = new THREE.HemisphereLight(0xfff7ed, 0x3d4a36, 0.7);
    this.scene.add(this.hemiLight);

    // Main Sun Directional Light
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.8);
    this.sunLight.position.set(24, 32, 16);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 100;
    this.sunLight.shadow.camera.left = -22;
    this.sunLight.shadow.camera.right = 22;
    this.sunLight.shadow.camera.top = 22;
    this.sunLight.shadow.camera.bottom = -22;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.radius = 2.5; // Soft shadow blur
    this.scene.add(this.sunLight);

    // Subtle Fill Light from opposite side
    this.fillLight = new THREE.DirectionalLight(0xbbe1fa, 0.4);
    this.fillLight.position.set(-20, 15, -20);
    this.scene.add(this.fillLight);
  }

  setupSkyAndClouds() {
    // Floating stylized puffy low-poly clouds
    this.cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      flatShading: true,
      transparent: true,
      opacity: 0.88
    });

    const cloudCount = 10;
    for (let i = 0; i < cloudCount; i++) {
      const cloud = new THREE.Group();
      const puffs = 4 + Math.floor(Math.random() * 4);
      for (let p = 0; p < puffs; p++) {
        const rad = 1.2 + Math.random() * 1.6;
        const puffGeo = new THREE.DodecahedronGeometry(rad, 1);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set((p - puffs / 2) * 1.4, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.2);
        cloud.add(puff);
      }
      const angle = (i / cloudCount) * Math.PI * 2;
      const dist = 32 + Math.random() * 14;
      const height = 10 + Math.random() * 12;
      cloud.position.set(Math.cos(angle) * dist, height, Math.sin(angle) * dist);
      cloud.scale.setScalar(0.9 + Math.random() * 0.6);
      this.cloudsGroup.add(cloud);
    }
    this.scene.add(this.cloudsGroup);
  }

  setupWeatherSystem() {
    // Breeze Petals / Leaves Particle System
    const petalCount = 120;
    const petalGeo = new THREE.BufferGeometry();
    const petalPos = new Float32Array(petalCount * 3);
    const petalColors = new Float32Array(petalCount * 3);

    const colors = [
      new THREE.Color(0xf6ad55), // Autumn Gold
      new THREE.Color(0xf687b3), // Sakura Pink
      new THREE.Color(0x68d391)  // Spring Green
    ];

    for (let i = 0; i < petalCount; i++) {
      petalPos[i * 3 + 0] = (Math.random() - 0.5) * 40;
      petalPos[i * 3 + 1] = 2 + Math.random() * 16;
      petalPos[i * 3 + 2] = (Math.random() - 0.5) * 40;

      const c = colors[i % colors.length];
      petalColors[i * 3 + 0] = c.r;
      petalColors[i * 3 + 1] = c.g;
      petalColors[i * 3 + 2] = c.b;
    }

    petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));
    petalGeo.setAttribute('color', new THREE.BufferAttribute(petalColors, 3));

    const petalMat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.petals = new THREE.Points(petalGeo, petalMat);
    this.petals.visible = false;
    this.scene.add(this.petals);

    // Rain Particle System
    const rainCount = 400;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);

    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3 + 0] = (Math.random() - 0.5) * 36;
      rainPos[i * 3 + 1] = Math.random() * 24;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 36;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.22,
      transparent: true,
      opacity: 0.7
    });

    this.rain = new THREE.Points(rainGeo, rainMat);
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  setTimeOfDay(timeVal) {
    this.timeOfDay = timeVal;
    // timeVal: 0 to 24 (6 = Dawn, 12 = Noon, 18 = Sunset, 22 = Night)
    const angle = ((timeVal - 6) / 24) * Math.PI * 2;
    const sunDist = 38;

    const sunX = Math.cos(angle) * sunDist;
    const sunY = Math.sin(angle) * sunDist;
    const sunZ = Math.sin(angle * 0.7) * (sunDist * 0.6);

    this.sunLight.position.set(sunX, Math.max(sunY, -5), sunZ);

    // Sky colors interpolation based on time
    let skyColor, sunColor, sunIntensity, hemiSky, hemiGround, fogDensity;

    if (timeVal >= 5 && timeVal < 8) {
      // Dawn / Sunrise
      const t = (timeVal - 5) / 3;
      skyColor = new THREE.Color(0xfbcfe8).lerp(new THREE.Color(0xfef08a), t);
      sunColor = new THREE.Color(0xfb923c);
      sunIntensity = 1.3 * t + 0.3;
      hemiSky = new THREE.Color(0xfde047);
      hemiGround = new THREE.Color(0x365314);
      fogDensity = 0.015;
    } else if (timeVal >= 8 && timeVal < 16) {
      // Crisp Bright Noon / Afternoon
      skyColor = new THREE.Color(0xdbeafe);
      sunColor = new THREE.Color(0xfffaed);
      sunIntensity = 1.8;
      hemiSky = new THREE.Color(0xfff7ed);
      hemiGround = new THREE.Color(0x3f6212);
      fogDensity = 0.012;
    } else if (timeVal >= 16 && timeVal < 19.5) {
      // Golden Hour / Sunset
      const t = (timeVal - 16) / 3.5;
      skyColor = new THREE.Color(0xdbeafe).lerp(new THREE.Color(0xf472b6), t);
      sunColor = new THREE.Color(0xf97316);
      sunIntensity = 1.5 * (1 - t * 0.5);
      hemiSky = new THREE.Color(0xfdba74);
      hemiGround = new THREE.Color(0x1e293b);
      fogDensity = 0.016;
    } else {
      // Night & Twilight
      skyColor = new THREE.Color(0x0f172a);
      sunColor = new THREE.Color(0x93c5fd); // Moonlight tint
      sunIntensity = 0.35;
      hemiSky = new THREE.Color(0x1e293b);
      hemiGround = new THREE.Color(0x090d16);
      fogDensity = 0.018;
    }

    this.scene.background = skyColor;
    this.scene.fog.color = skyColor;
    this.scene.fog.density = fogDensity;

    this.sunLight.color = sunColor;
    this.sunLight.intensity = sunIntensity;
    this.hemiLight.color = hemiSky;
    this.hemiLight.groundColor = hemiGround;

    // Toggle window and lantern glows in the world if night
    const isNight = timeVal < 6 || timeVal >= 18.5;
    window.dispatchEvent(new CustomEvent('time-changed', { detail: { isNight, timeVal } }));
  }

  setWeather(type) {
    this.weatherType = type;
    this.petals.visible = (type === 'breeze');
    this.rain.visible = (type === 'rain');
  }

  setCameraPreset(preset) {
    if (preset === 'iso') {
      this.animateCameraTo(new THREE.Vector3(22, 18, 22), new THREE.Vector3(0, 1.5, 0));
    } else if (preset === 'close') {
      this.animateCameraTo(new THREE.Vector3(9, 7, 9), new THREE.Vector3(0, 1.5, 0));
    } else if (preset === 'top') {
      this.animateCameraTo(new THREE.Vector3(0.1, 32, 0.1), new THREE.Vector3(0, 1.5, 0));
    }
  }

  animateCameraTo(targetPos, targetLookAt) {
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    let progress = 0;

    const anim = () => {
      progress += 0.045;
      const ease = 1 - Math.pow(1 - progress, 3);
      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.controls.target.lerpVectors(startTarget, targetLookAt, ease);

      if (progress < 1) {
        requestAnimationFrame(anim);
      } else {
        this.camera.position.copy(targetPos);
        this.controls.target.copy(targetLookAt);
      }
    };
    anim();
  }

  update(delta) {
    this.controls.update();

    // Slowly rotate clouds
    if (this.cloudsGroup) {
      this.cloudsGroup.rotation.y += delta * 0.02;
    }

    // Weather particles update
    if (this.petals && this.petals.visible) {
      const pos = this.petals.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 0] += Math.sin(pos[i + 1] + performance.now() * 0.001) * 0.04 - 0.03;
        pos[i + 1] -= 0.03; // Fall
        pos[i + 2] += Math.cos(pos[i + 1] + performance.now() * 0.001) * 0.04;
        if (pos[i + 1] < 0.2) {
          pos[i + 1] = 16;
        }
      }
      this.petals.geometry.attributes.position.needsUpdate = true;
    }

    if (this.rain && this.rain.visible) {
      const pos = this.rain.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 1] -= 0.45; // Fast rain drops
        if (pos[i + 1] < 0.2) {
          pos[i + 1] = 20;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }
}
