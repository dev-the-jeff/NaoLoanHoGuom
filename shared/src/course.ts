/** Reusable section of a point-to-point route; offsets blend with zero slope at section boundaries. */
export interface RoadSection { readonly length: number; readonly shift: number; readonly name: string }
/** Static collision primitive, expressed in metres relative to the road centre. */
export interface RoadObstacle { readonly progress: number; readonly lateral: number; readonly halfWidth: number; readonly halfLength: number }
export const ROAD_SECTIONS: readonly RoadSection[] = Object.freeze([
  { length: 350, shift: 0, name: 'START STRAIGHT' },
  { length: 400, shift: 60, name: 'GENTLE BENDS' }, { length: 400, shift: -55, name: 'GENTLE BENDS' },
  { length: 650, shift: 30, name: 'ROADWORKS' },
  { length: 330, shift: -65, name: 'CANYON CURVES' }, { length: 340, shift: 65, name: 'CANYON CURVES' }, { length: 330, shift: -25, name: 'CANYON CURVES' },
  { length: 600, shift: 0, name: 'FINISH STRAIGHT' },
]);
export const ROAD_LENGTH = ROAD_SECTIONS.reduce((length, section) => length + section.length, 0);
export const ROAD_OBSTACLES: readonly RoadObstacle[] = Object.freeze([
  { progress: 1260, lateral: -7, halfWidth: 0.8, halfLength: 1.2 },
  { progress: 1450, lateral: 7, halfWidth: 0.8, halfLength: 1.2 },
  { progress: 1670, lateral: -7, halfWidth: 0.8, halfLength: 1.2 },
]);
/** Rules are injected only by trusted server construction, never by matchmaking options. */
export interface RaceRules {
  readonly checkpoints: readonly number[]; readonly finishWindowMs: number; readonly maxRaceMs: number;
  readonly resetCooldownMs: number; readonly resetMaxSpeed: number; readonly resetBehindGate: number;
}
export const RACE_RULES: RaceRules = Object.freeze({ checkpoints: Object.freeze([350, 750, 1150, 1550, 1900, 2250, 2600, 2950, 3350]),
  finishWindowMs: 45000, maxRaceMs: 300000, resetCooldownMs: 8000, resetMaxSpeed: 4, resetBehindGate: 4 });
