import { GAME_CONFIG as C } from './gameConfig';
import { ROAD_SECTIONS, ROAD_OBSTACLES } from './course';
import type { RoadGeometry } from './contracts';
/** Reusable analytic sections shared by rendering, collision and authoritative checkpoint validation. */
export class Road implements RoadGeometry {
  readonly length = C.trackLength;
  readonly halfWidth = C.roadHalfWidth;
  readonly obstacles = ROAD_OBSTACLES;
  /** Returns a continuous centre curve without allocating spline objects. */
  centerAt(progress: number): number {
    let remaining = Math.max(0, Math.min(this.length, progress)); let x = 0;
    for (const section of ROAD_SECTIONS) {
      if (remaining >= section.length) { x += section.shift; remaining -= section.length; continue; }
      const t = remaining / section.length; return x + section.shift * t * t * (3 - 2 * t);
    }
    return x;
  }
}
