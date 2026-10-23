import { ROAD_LENGTH } from './course';
const LANE_COUNT = 3;
const LANE_WIDTH = 7;
/** Central prototype tuning. No physics constants are scattered across systems. */
export const GAME_CONFIG = Object.freeze({
  fixedStep: 1 / 120, maxFrameDelta: 0.1, hudInterval: 0.1,
  topSpeed: 160 / 3.6, nitroTopSpeed: 190 / 3.6,
  acceleration: 12, nitroAcceleration: 18, braking: 26,
  rollingDrag: 1.5, quadraticDrag: 0.0016,
  yawGain: 1.12, steeringResponse: 7, maxHeading: 1.1,
  bikeRadius: 1.6, barrierDrag: 9,
  nitroCapacity: 100, nitroDrain: 100 / 3, nitroRecharge: 15, nitroDelay: 2,
  trackLength: ROAD_LENGTH, startStraightLength: 350, laneCount: LANE_COUNT, laneWidth: LANE_WIDTH, roadHalfWidth: LANE_COUNT * LANE_WIDTH / 2, roadSampleStep: 4,
  cameraDistance: 10, cameraHeight: 4.3, cameraSmoothing: 5,
  cameraFov: 64, speedFov: 77, boostFov: 83, maxPixelRatio: 1.5,
  speedCameraHeight: 2.8, speedCameraDistance: 8.5,
  roadsidePostSpacing: 4, rumbleSpacing: 2.5,
  speedLineCount: 48, speedLineStart: 60 / 3.6, speedLineOpacity: 0.17,
});






