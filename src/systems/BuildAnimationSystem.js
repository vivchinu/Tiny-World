import * as THREE from 'three';

export class BuildAnimationSystem {
  constructor(scene) {
    this.scene = scene;
    this.activeAnimations = [];
    this.particles = [];

    // Shared dust puff particle geometry & material
    this.dustGeo = new THREE.DodecahedronGeometry(0.18, 0);
    this.dustMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.85
    });
  }

  // Elastic Spring Ease Function (overshoot and settle)
  easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  easeOutElastic(x) {
    const c4 = (2 * Math.PI) / 3;
    return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  }

  animateHouse(houseGroup, onComplete) {
    const stages = houseGroup.userData.animStages;
    if (!stages) {
      this.animateGenericSpring(houseGroup, onComplete);
      return;
    }

    const { foundation, walls, roof, details } = stages;

    // Initially hide / scale to zero
    foundation.scale.set(1, 0.001, 1);
    walls.scale.set(1, 0.001, 1);
    roof.scale.set(0.001, 0.001, 0.001);
    details.scale.set(0.001, 0.001, 0.001);

    this.spawnDustRing(houseGroup.position, Math.max(houseGroup.userData.width, houseGroup.userData.depth) * 0.7);

    let elapsed = 0;
    const totalDuration = 0.85; // Cozy snappy build time

    const anim = {
      update: (delta) => {
        elapsed += delta;

        // Stage 1: Foundation (0.00s -> 0.22s)
        const t1 = Math.min(1, Math.max(0, elapsed / 0.22));
        foundation.scale.y = this.easeOutBack(t1);

        // Stage 2: Walls (0.15s -> 0.42s)
        if (elapsed > 0.15) {
          const t2 = Math.min(1, (elapsed - 0.15) / 0.27);
          walls.scale.y = this.easeOutBack(t2);
        }

        // Stage 3: Roof (0.35s -> 0.65s)
        if (elapsed > 0.35) {
          const t3 = Math.min(1, (elapsed - 0.35) / 0.3);
          const s = this.easeOutElastic(t3);
          roof.scale.set(s, s, s);
        }

        // Stage 4: Details (0.50s -> 0.85s)
        if (elapsed > 0.5) {
          const t4 = Math.min(1, (elapsed - 0.5) / 0.35);
          const s = this.easeOutBack(t4);
          details.scale.set(s, s, s);
        }

        if (elapsed >= totalDuration) {
          foundation.scale.set(1, 1, 1);
          walls.scale.set(1, 1, 1);
          roof.scale.set(1, 1, 1);
          details.scale.set(1, 1, 1);
          if (onComplete) onComplete();
          return true; // Finished
        }
        return false;
      }
    };

    this.activeAnimations.push(anim);
  }

  animateWall(wallGroup, onComplete) {
    const segments = wallGroup.userData.segments || [];
    if (segments.length === 0) {
      this.animateGenericSpring(wallGroup, onComplete);
      return;
    }

    segments.forEach((seg) => {
      seg.scale.set(0.001, 0.001, 0.001);
    });

    let elapsed = 0;
    const segInterval = 0.07;
    const totalDuration = segments.length * segInterval + 0.35;

    const anim = {
      update: (delta) => {
        elapsed += delta;

        segments.forEach((seg, idx) => {
          const startT = idx * segInterval;
          if (elapsed > startT) {
            const t = Math.min(1, (elapsed - startT) / 0.28);
            const s = this.easeOutBack(t);
            seg.scale.set(s, s, s);

            if (t > 0 && t < 0.15) {
              const worldPos = new THREE.Vector3();
              seg.getWorldPosition(worldPos);
              this.spawnDustRing(worldPos, 0.5, 3);
            }
          }
        });

        if (elapsed >= totalDuration) {
          segments.forEach(seg => seg.scale.set(1, 1, 1));
          if (onComplete) onComplete();
          return true;
        }
        return false;
      }
    };

    this.activeAnimations.push(anim);
  }

  animateTree(treeGroup, onComplete) {
    treeGroup.scale.set(0.001, 0.001, 0.001);
    this.spawnDustRing(treeGroup.position, 1.0, 8);

    let elapsed = 0;
    const duration = 0.55;

    const anim = {
      update: (delta) => {
        elapsed += delta;
        const progress = Math.min(1, elapsed / duration);
        const s = this.easeOutElastic(progress);

        // Squash & stretch: tall at first, then settles
        treeGroup.scale.set(s * 0.9, s * 1.15, s * 0.9);

        if (progress >= 1) {
          treeGroup.scale.set(1, 1, 1);
          if (onComplete) onComplete();
          return true;
        }
        return false;
      }
    };

    this.activeAnimations.push(anim);
  }

  animateGenericSpring(objGroup, onComplete) {
    objGroup.scale.set(0.001, 0.001, 0.001);
    this.spawnDustRing(objGroup.position, 1.0, 6);

    let elapsed = 0;
    const duration = 0.45;

    const anim = {
      update: (delta) => {
        elapsed += delta;
        const progress = Math.min(1, elapsed / duration);
        const s = this.easeOutBack(progress);
        objGroup.scale.set(s, s, s);

        if (progress >= 1) {
          objGroup.scale.set(1, 1, 1);
          if (onComplete) onComplete();
          return true;
        }
        return false;
      }
    };

    this.activeAnimations.push(anim);
  }

  animateDemolish(objGroup, onComplete) {
    const worldPos = new THREE.Vector3();
    objGroup.getWorldPosition(worldPos);
    this.spawnDustRing(worldPos, 1.4, 12, 0xd1d5db);

    let elapsed = 0;
    const duration = 0.25;
    const initialScale = objGroup.scale.clone();

    const anim = {
      update: (delta) => {
        elapsed += delta;
        const progress = Math.min(1, elapsed / duration);
        const s = 1 - progress;
        objGroup.scale.set(initialScale.x * s, initialScale.y * s, initialScale.z * s);

        if (progress >= 1) {
          if (onComplete) onComplete();
          return true;
        }
        return false;
      }
    };

    this.activeAnimations.push(anim);
  }

  spawnDustRing(pos, radius = 1.0, count = 8, colorHex = 0xfef08a) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = radius * (0.6 + Math.random() * 0.4);
      const vel = new THREE.Vector3(
        Math.cos(angle) * (1.2 + Math.random() * 1.5),
        1.5 + Math.random() * 2.0,
        Math.sin(angle) * (1.2 + Math.random() * 1.5)
      );

      const pMesh = new THREE.Mesh(this.dustGeo, this.dustMat.clone());
      pMesh.material.color.setHex(colorHex);
      pMesh.position.set(pos.x, pos.y + 0.15, pos.z);
      this.scene.add(pMesh);

      this.particles.push({
        mesh: pMesh,
        vel,
        life: 0.6 + Math.random() * 0.3,
        maxLife: 0.6 + Math.random() * 0.3
      });
    }
  }

  update(delta) {
    // Update active construction animations
    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      const finished = this.activeAnimations[i].update(delta);
      if (finished) {
        this.activeAnimations.splice(i, 1);
      }
    }

    // Update dust puff particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      p.mesh.position.addScaledVector(p.vel, delta);
      p.vel.y -= 4.0 * delta; // Gravity
      p.vel.x *= 0.95;
      p.vel.z *= 0.95;

      const progress = p.life / p.maxLife;
      p.mesh.scale.setScalar(progress * 1.2);
      p.mesh.material.opacity = progress * 0.85;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }
}
