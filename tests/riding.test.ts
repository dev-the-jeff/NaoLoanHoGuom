import { describe, expect, it } from 'vitest';
import { BikeController } from '../client/src/game/BikeController';
import { Road } from '../client/src/game/Road';
import { GAME_CONFIG as C } from '../client/src/config/gameConfig';
import type { RidingInput, RoadGeometry } from '../shared/src/contracts';
const straight: RoadGeometry = { length: 100000, halfWidth: 7, centerAt: () => 0 };
const throttle: RidingInput = { throttle: true, brake: false, steer: 0, nitro: false };
const idle: RidingInput = { throttle: false, brake: false, steer: 0, nitro: false };
function tick(bike: BikeController, seconds: number, input: RidingInput): void {
  for (let i = 0; i < Math.round(seconds / C.fixedStep); i++) bike.step(input, C.fixedStep);
}
describe('M1 deterministic arcade movement', () => {
  it('starts on the road, stationary, with a full Nitro tank', () => {
    const road = new Road(); const bike = new BikeController(road);
    expect(bike.state.speed).toBe(0); expect(bike.state.x).toBe(road.centerAt(8)); expect(bike.state.nitro).toBe(100);
  });
  it('accelerates to the normal cap without exceeding it', () => {
    const bike = new BikeController(straight); tick(bike, 15, throttle);
    expect(bike.state.speed).toBeCloseTo(C.topSpeed, 5); expect(bike.state.progress).toBeGreaterThan(400);
  });
  it('brakes to a stop and cannot reverse', () => {
    const bike = new BikeController(straight); tick(bike, 5, throttle);
    tick(bike, 4, { ...idle, brake: true }); expect(bike.state.speed).toBe(0);
    const position = bike.state.progress; tick(bike, 3, { ...idle, brake: true }); expect(bike.state.progress).toBe(position);
  });
  it('coasts to a lower speed with drag when throttle is released', () => {
    const bike = new BikeController(straight); tick(bike, 4, throttle); const speed = bike.state.speed;
    tick(bike, 2, idle); expect(bike.state.speed).toBeGreaterThan(0); expect(bike.state.speed).toBeLessThan(speed);
  });
  it('steers left/right symmetrically and does not steer while stopped', () => {
    const left = new BikeController(straight); const right = new BikeController(straight);
    tick(left, 1, { ...idle, steer: -1 }); expect(left.state.heading).toBe(0); left.reset();
    tick(left, 2, throttle); tick(right, 2, throttle);
    tick(left, 0.5, { ...throttle, steer: -1 }); tick(right, 0.5, { ...throttle, steer: 1 });
    expect(left.state.x).toBeLessThan(0); expect(right.state.x).toBeCloseTo(-left.state.x, 6);
  });
  it('boosts above normal speed and respects Nitro top speed', () => {
    const bike = new BikeController(straight); tick(bike, 8, throttle);
    tick(bike, 2.9, { ...throttle, nitro: true });
    expect(bike.state.speed).toBeGreaterThan(C.topSpeed); expect(bike.state.speed).toBeLessThanOrEqual(C.nitroTopSpeed);
  });
  it('a full Nitro tank lasts exactly three seconds of effective use', () => {
    const bike = new BikeController(straight); tick(bike, 3, { ...throttle, nitro: true });
    expect(bike.state.nitro).toBeCloseTo(0, 8); bike.step({ ...throttle, nitro: true }, C.fixedStep);
    expect(bike.state.boosting).toBe(false);
  });
  it('recharges only after two seconds and at fifteen units per second', () => {
    const bike = new BikeController(straight); tick(bike, 1.5, { ...throttle, nitro: true });
    expect(bike.state.nitro).toBeCloseTo(50, 7); tick(bike, 2, idle); expect(bike.state.nitro).toBeCloseTo(50, 6);
    tick(bike, 1, idle); expect(bike.state.nitro).toBeCloseTo(65, 6);
    tick(bike, 10, idle); expect(bike.state.nitro).toBe(100);
  });
  it('does not spend Nitro without throttle or while braking', () => {
    const bike = new BikeController(straight); tick(bike, 1, { ...idle, nitro: true });
    tick(bike, 1, { ...throttle, brake: true, nitro: true });
    expect(bike.state.nitro).toBe(100); expect(bike.state.boosting).toBe(false); expect(bike.state.speed).toBe(0);
  });
  it.each([-1, 1])('cannot cross the %s-side barrier even at Nitro speed', side => {
    const road = new Road(); const bike = new BikeController(road); tick(bike, 8, throttle);
    let contacted = false;
    for (let i = 0; i < 3000; i++) {
      bike.step({ ...throttle, nitro: true, steer: side }, C.fixedStep);
      expect(Math.abs(bike.state.x - road.centerAt(bike.state.progress))).toBeLessThanOrEqual(road.halfWidth - C.bikeRadius + 1e-9);
      contacted ||= bike.state.contact;
    }
    expect(contacted).toBe(true);
  });
  it('is contained by the end barrier without an invisible race system', () => {
    const bike = new BikeController({ ...straight, length: 30 }); tick(bike, 15, { ...throttle, nitro: true });
    expect(bike.state.progress).toBe(30 - C.bikeRadius); expect(bike.state.speed).toBe(0); expect(bike.state.contact).toBe(true);
  });
  it('allows recovery away from a barrier using opposite steering', () => {
    const bike = new BikeController(straight); tick(bike, 3, { ...throttle, steer: 1 });
    tick(bike, 1.4, { ...throttle, steer: -1 }); expect(bike.state.x).toBeLessThan(straight.halfWidth - C.bikeRadius);
  });
  it('ignores invalid or unbounded deltas rather than tunnelling after a long tab stall', () => {
    const bike = new BikeController(straight); const before = { ...bike.state };
    for (const dt of [NaN, Infinity, -1, 0, 1]) bike.step(throttle, dt);
    expect(bike.state).toEqual(before);
  });
  it('resets every mutable movement and Nitro field', () => {
    const bike = new BikeController(straight); tick(bike, 2, { ...throttle, steer: 1, nitro: true }); bike.reset();
    expect(bike.state).toEqual(new BikeController(straight).state);
  });
  it('uses a continuous bounded route over the whole practice segment', () => {
    const road = new Road(); let last = road.centerAt(0);
    for (let s = 1; s <= road.length; s++) { const center = road.centerAt(s); expect(Math.abs(center - last)).toBeLessThan(0.31); last = center; }
  });
});

