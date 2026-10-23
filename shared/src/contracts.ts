import type { RoadObstacle } from './course';
/** Input contract shared by keyboard adapter and deterministic riding simulation. */
export interface RidingInput { throttle: boolean; brake: boolean; steer: number; nitro: boolean }
/** Mutable simulation state, measured in metres, seconds and radians. */
export interface BikeState {
  x: number; progress: number; heading: number; speed: number;
  nitro: number; rechargeDelay: number; boosting: boolean; contact: boolean;
}
/** Read-only route geometry contract; no renderer dependency. */
export interface RoadGeometry { readonly length: number; readonly halfWidth: number; readonly obstacles?: readonly RoadObstacle[]; centerAt(progress: number): number }

