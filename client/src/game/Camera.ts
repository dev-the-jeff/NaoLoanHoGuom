import * as THREE from 'three';
import type { BikeState } from '../../../shared/src/contracts';
import { GAME_CONFIG as C } from '../config/gameConfig';
/** Frame-rate-independent chase camera with reusable vectors and speed-dependent height, distance and FOV. */
export class FollowCamera {
  readonly camera = new THREE.PerspectiveCamera(C.cameraFov, 1, 0.1, 650);
  private readonly targetPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly targetLook = new THREE.Vector3();
  /** Updates camera dimensions without reallocating camera objects. */
  resize(width: number, height: number): void { this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix(); }
  /** Moves camera behind the rider, or snaps immediately after restart. */
  update(s: Readonly<BikeState>, dt: number, snap = false, moving = true): void {
    const smoothing = snap ? 1 : 1 - Math.exp(-C.cameraSmoothing * dt);
    // Velocity feed-forward offsets exponential follow lag, keeping the bike readable at top speed.
    const lead = moving && !snap ? s.speed / C.cameraSmoothing : 0;
    const speedRatio = Math.min(1, Math.max(0, s.speed / C.topSpeed));
    const speedBlend = speedRatio * speedRatio * (3 - 2 * speedRatio);
    const distance = THREE.MathUtils.lerp(C.cameraDistance, C.speedCameraDistance, speedBlend);
    const height = THREE.MathUtils.lerp(C.cameraHeight, C.speedCameraHeight, speedBlend);
    this.targetPosition.set(s.x + Math.sin(s.heading) * (lead - distance), height, -s.progress - Math.cos(s.heading) * (lead - distance));
    this.targetLook.set(s.x + Math.sin(s.heading) * (11 + lead), 1, -s.progress - Math.cos(s.heading) * (11 + lead));
    this.camera.position.lerp(this.targetPosition, smoothing); this.lookTarget.lerp(this.targetLook, smoothing);
    this.camera.lookAt(this.lookTarget);
    const targetFov = s.boosting ? C.boostFov : THREE.MathUtils.lerp(C.cameraFov, C.speedFov, speedBlend);
    const fov = this.camera.fov + (targetFov - this.camera.fov) * smoothing;
    if (Math.abs(fov - this.camera.fov) > 0.001) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }
}


