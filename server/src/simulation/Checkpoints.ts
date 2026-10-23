import type { BikeState, RoadGeometry } from '../../../shared/src/contracts';
import { GAME_CONFIG as C } from '../../../shared/src/gameConfig';
import type { RaceRules } from '../../../shared/src/course';
export interface CheckpointProgress {
  next: number; validated: number; previousS: number; previousX: number;
  safeS: number; safeX: number; lane: number; finishFraction: number;
}
export type Crossing = 'invalid' | 'moving' | 'checkpoint' | 'finished';
/** Track progress contract precedes its allocation-free implementation. */
export interface ICheckpoints {
  create(progress: number, x: number): CheckpointProgress;
  advance(state: CheckpointProgress, bike: Readonly<BikeState>, dt: number): Crossing;
  reset(state: CheckpointProgress, progress: number, x: number): void;
}
/** Validates swept sequential gates against trusted previous positions, not client reports. */
export class Checkpoints implements ICheckpoints {
  constructor(private readonly road: RoadGeometry, private readonly rules: RaceRules) {}
  /** Allocates progress once per entrant/round. */
  create(progress: number, x: number): CheckpointProgress {
    return { next: 0, validated: progress, previousS: progress, previousX: x, safeS: progress, safeX: x, lane: x - this.road.centerAt(progress), finishFraction: 0 };
  }
  /** Accepts physically bounded forward movement and at most one ordered crossing per substep. */
  advance(state: CheckpointProgress, bike: Readonly<BikeState>, dt: number): Crossing {
    const ds = bike.progress - state.previousS;
    if (!Number.isFinite(bike.progress) || !Number.isFinite(bike.x) || ds < -0.001 || ds > C.nitroTopSpeed * dt + 0.02
      || Math.abs(bike.x - this.road.centerAt(bike.progress)) > this.road.halfWidth - C.bikeRadius + 0.05) return 'invalid';
    let crossing: Crossing = 'moving'; const gate = this.rules.checkpoints[state.next];
    if (gate !== undefined && state.previousS <= gate && bike.progress >= gate && ds > 0) {
      const fraction = (gate - state.previousS) / ds;
      const x = state.previousX + (bike.x - state.previousX) * fraction;
      if (Math.abs(x - this.road.centerAt(gate)) > this.road.halfWidth - C.bikeRadius + 0.05) return 'invalid';
      state.next++; state.finishFraction = fraction;
      state.safeS = gate - this.rules.resetBehindGate; state.safeX = this.road.centerAt(state.safeS) + state.lane;
      crossing = state.next === this.rules.checkpoints.length ? 'finished' : 'checkpoint';
    }
    const next = this.rules.checkpoints[state.next] ?? this.rules.checkpoints[this.rules.checkpoints.length - 1];
    state.validated = Math.min(bike.progress, next); state.previousS = bike.progress; state.previousX = bike.x;
    return crossing;
  }
  /** Moves trusted history backwards after a server-authorized reset without advancing gates. */
  reset(state: CheckpointProgress, progress: number, x: number): void { state.previousS = progress; state.previousX = x; state.validated = progress; }
}
