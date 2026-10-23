import * as THREE from 'three';
import { GAME_CONFIG as C } from '../config/gameConfig';
import { Resources } from './Resources';
/** Peripheral speed cues. Fixed typed buffers are reused; no frame-time spawning or allocations. */
export class SpeedLines {
  readonly root: THREE.LineSegments;
  private readonly positions = new Float32Array(C.speedLineCount * 6);
  private readonly phases = new Float32Array(C.speedLineCount);
  private readonly directions = new Float32Array(C.speedLineCount * 2);
  private readonly attribute: THREE.BufferAttribute;
  private readonly material: THREE.LineBasicMaterial;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(resources: Resources) {
    const geometry = resources.geometry(new THREE.BufferGeometry());
    this.attribute = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.attribute);
    this.material = resources.material(new THREE.LineBasicMaterial({
      color: 0xffedce, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
    }));
    this.root = new THREE.LineSegments(geometry, this.material);
    this.root.frustumCulled = false; this.root.renderOrder = 10; this.root.visible = false;
    for (let i = 0; i < C.speedLineCount; i++) {
      // Concentrate at the sides; leave the bike, road and central horizon unobscured.
      const angle = -0.52 + (i % 24) / 23 * 1.04;
      this.directions[i * 2] = Math.cos(angle) * (i % 2 === 0 ? 1 : -1);
      this.directions[i * 2 + 1] = Math.sin(angle);
      this.phases[i] = (i * 0.61803398875) % 1;
    }
  }
  /** Updates the single reusable line buffer. Pausing hides effects and freezes their phases. */
  update(speed: number, dt: number, camera: THREE.PerspectiveCamera, riding: boolean): void {
    const amount = Math.min(1, Math.max(0, (speed - C.speedLineStart) / (C.nitroTopSpeed - C.speedLineStart)));
    this.root.visible = riding && !this.reducedMotion && amount > 0.01;
    if (!this.root.visible) return;
    this.material.opacity = C.speedLineOpacity * amount;
    const halfHeight = Math.tan(camera.fov * Math.PI / 360) * 1.5;
    for (let i = 0; i < C.speedLineCount; i++) {
      let phase = this.phases[i] + dt * (0.6 + speed * 0.035);
      phase -= Math.floor(phase); this.phases[i] = phase;
      const head = 0.62 + phase * 0.65;
      const tail = head - (0.035 + amount * 0.10);
      const dx = this.directions[i * 2] * halfHeight * camera.aspect;
      const dy = this.directions[i * 2 + 1] * halfHeight;
      const offset = i * 6;
      this.positions[offset] = dx * tail; this.positions[offset + 1] = dy * tail; this.positions[offset + 2] = -1.5;
      this.positions[offset + 3] = dx * head; this.positions[offset + 4] = dy * head; this.positions[offset + 5] = -1.5;
    }
    this.attribute.needsUpdate = true;
  }
}
