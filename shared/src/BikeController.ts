import { GAME_CONFIG as C } from './gameConfig';
import type { BikeState, RidingInput, RoadGeometry } from './contracts';
/** Allocation-free arcade simulation. Flat road constraint replaces wheel/suspension physics. */
export class BikeController {
  readonly state: BikeState = { x: 0, progress: 8, heading: 0, speed: 0,
    nitro: C.nitroCapacity, rechargeDelay: 0, boosting: false, contact: false };
  private steering = 0;
  constructor(private readonly road: RoadGeometry) { this.reset(); }
  /** Resets the solo practice session. This is not an online respawn or checkpoint system. */
  reset(): void {
    const s = this.state;
    s.progress = 8; s.x = this.road.centerAt(s.progress); s.heading = 0; s.speed = 0;
    s.nitro = C.nitroCapacity; s.rechargeDelay = 0; s.boosting = false; s.contact = false;
    this.steering = 0;
  }
  /** Advances one bounded simulation tick without heap allocations. */
  step(input: Readonly<RidingInput>, dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0 || dt > C.fixedStep + 1e-8) return;
    const s = this.state;
    // A partial final boost tick consumes only available fuel, preserving the 3-second budget.
    const boostTime = input.nitro && input.throttle && !input.brake ? Math.min(dt, s.nitro / C.nitroDrain) : 0;
    s.boosting = boostTime > 1e-9;
    if (s.boosting) {
      s.nitro = Math.max(0, s.nitro - C.nitroDrain * boostTime);
      s.rechargeDelay = C.nitroDelay;
    } else {
      const rechargeTime = Math.max(0, dt - s.rechargeDelay);
      s.rechargeDelay = Math.max(0, s.rechargeDelay - dt);
      s.nitro = Math.min(C.nitroCapacity, s.nitro + C.nitroRecharge * rechargeTime);
    }
    let acceleration = -(C.rollingDrag + C.quadraticDrag * s.speed * s.speed);
    if (input.brake) acceleration -= C.braking;
    else if (input.throttle) acceleration += C.acceleration + (C.nitroAcceleration - C.acceleration) * boostTime / dt;
    const cap = s.boosting ? C.nitroTopSpeed : C.topSpeed;
    s.speed = Math.max(0, Math.min(cap, s.speed + acceleration * dt));
    this.steering += (Math.max(-1, Math.min(1, input.steer)) - this.steering) * (1 - Math.exp(-C.steeringResponse * dt));
    const speedFactor = Math.min(1, s.speed / 12);
    s.heading = Math.max(-C.maxHeading, Math.min(C.maxHeading, s.heading + this.steering * C.yawGain * speedFactor * dt));
    s.progress += Math.cos(s.heading) * s.speed * dt;
    s.x += Math.sin(s.heading) * s.speed * dt;
    s.contact = false;
    const minProgress = C.bikeRadius;
    const maxProgress = this.road.length - C.bikeRadius;
    if (s.progress < minProgress || s.progress > maxProgress) {
      s.progress = Math.max(minProgress, Math.min(maxProgress, s.progress)); s.speed = 0; s.contact = true;
    }
    if (this.road.obstacles) for (const obstacle of this.road.obstacles) {
      const ox = this.road.centerAt(obstacle.progress) + obstacle.lateral;
      if (Math.abs(s.progress - obstacle.progress) < obstacle.halfLength + C.bikeRadius && Math.abs(s.x - ox) < obstacle.halfWidth + C.bikeRadius) {
        const side = obstacle.lateral === 0 ? (Math.sign(s.x - ox) || 1) : -Math.sign(obstacle.lateral);
        s.x = ox + side * (obstacle.halfWidth + C.bikeRadius + 0.02); s.speed *= 0.35; s.contact = true;
      }
    }
    const center = this.road.centerAt(s.progress);
    const limit = this.road.halfWidth - C.bikeRadius;
    const lateral = s.x - center;
    if (Math.abs(lateral) > limit) {
      s.x = center + Math.sign(lateral) * limit;
      s.speed *= Math.exp(-C.barrierDrag * dt); s.contact = true;
      // Deflect into the road tangent so low-speed wall contact cannot trap steering.
      const tangent = Math.atan2(this.road.centerAt(s.progress + 0.5) - this.road.centerAt(s.progress - 0.5), 1);
      if (Math.sign(lateral) * (s.heading - tangent) > 0) s.heading = tangent;
    }
  }
}



