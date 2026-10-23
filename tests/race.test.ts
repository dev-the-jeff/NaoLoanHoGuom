import { describe, expect, it } from 'vitest';
import { RaceSimulation } from '../server/src/simulation/RaceSimulation';
import { Checkpoints } from '../server/src/simulation/Checkpoints';
import { Road } from '../shared/src/Road';
import { BikeController } from '../shared/src/BikeController';
import { GAME_CONFIG as C } from '../shared/src/gameConfig';
import { RACE_RULES, ROAD_SECTIONS, ROAD_OBSTACLES } from '../shared/src/course';
import type { RaceRules } from '../shared/src/course';
import { SnapshotBuffer } from '../client/src/network/SnapshotBuffer';
const short: RaceRules = { ...RACE_RULES, checkpoints: [60, 120, 180, 240, 300], finishWindowMs: 1000, maxRaceMs: 30000 };
function race(rules = short): RaceSimulation {
  const sim = new RaceSimulation(rules); sim.add('a', 'An'); sim.add('b', 'Binh');
  sim.ready('a', true); sim.ready('b', true); expect(sim.start('a', 1000)).toBe(true); return sim;
}
function drive(sim: RaceSimulation, now: number, seq: number, ids = ['a', 'b']): void {
  const road = new Road();
  for (const id of ids) {
    const p = sim.players.get(id)!; const state = p.bike.state;
    const ahead = 18; const heading = Math.atan2(road.centerAt(state.progress + ahead) - state.x, ahead);
    sim.input(id, { roundId: sim.snapshot.roundId, seq, throttle: true, brake: false, nitro: false,
      steer: Math.max(-1, Math.min(1, (heading - state.heading) * 4)) }, now);
  }
  sim.step(now);
}
describe('M3 checkpoints and race lifecycle', () => {
  it('builds a 3.4km point-to-point route with a safe grid, bends, telegraphed works and finish straight', () => {
    const road = new Road(); expect(road.length).toBe(3400); expect(ROAD_SECTIONS.length).toBe(8);
    expect(road.centerAt(20)).toBe(road.centerAt(340)); expect(road.centerAt(2810)).toBe(road.centerAt(3400));
    expect(ROAD_OBSTACLES.length).toBe(3); expect(RACE_RULES.finishWindowMs).toBe(45000);
  });
  it('rejects teleport, off-road and reverse checkpoint awards', () => {
    const road = new Road(); const gates = new Checkpoints(road, RACE_RULES); const state = gates.create(8, 0);
    const bike = new BikeController(road).state;
    for (const [s, x] of [[3351, road.centerAt(3351)], [8.1, 999], [7, 0]]) {
      bike.progress = s; bike.x = x; expect(gates.advance(state, bike, C.fixedStep)).toBe('invalid');
      expect(state.next).toBe(0); expect(state.previousS).toBe(8);
    }
  });
  it('requires the next gate even if trusted history is after a skipped gate', () => {
    const road = new Road(); const gates = new Checkpoints(road, RACE_RULES); const state = gates.create(751, road.centerAt(751));
    const bike = new BikeController(road).state; bike.progress = 751.1; bike.x = road.centerAt(751.1);
    expect(gates.advance(state, bike, C.fixedStep)).toBe('moving'); expect(state.next).toBe(0); expect(state.validated).toBe(350);
  });
  it('collides with roadworks without forward teleport or crossing the road boundary', () => {
    const road = new Road(); const bike = new BikeController(road); const obstacle = ROAD_OBSTACLES[0];
    bike.state.progress = obstacle.progress - obstacle.halfLength - C.bikeRadius - 0.1;
    bike.state.x = road.centerAt(obstacle.progress) + obstacle.lateral; bike.state.speed = C.nitroTopSpeed;
    const before = bike.state.progress; bike.step({ throttle: true, brake: false, steer: 0, nitro: true }, C.fixedStep);
    expect(bike.state.contact).toBe(true); expect(bike.state.speed).toBeLessThan(20);
    expect(bike.state.progress - before).toBeLessThanOrEqual(C.nitroTopSpeed * C.fixedStep);
    expect(Math.abs(bike.state.x - road.centerAt(bike.state.progress))).toBeLessThan(road.halfWidth);
  });
  it('completes the full production course in order using only bounded riding input', () => {
    const sim = race(RACE_RULES); let seq = 0;
    for (let now = 4000; now < 200000 && sim.snapshot.phase !== 'results'; now += 1000 / 30) drive(sim, now, ++seq);
    expect(sim.snapshot.phase).toBe('results');
    for (const result of sim.snapshot.standings) { expect(result.status).toBe('finished'); expect(result.checkpoint).toBe(9); expect(result.finishMs).toBeGreaterThan(60000); }
  });
  it('accepts safe R only at low speed, respects cooldown and preserves fuel/delay/checkpoints', () => {
    const sim = race(); let seq = 0;
    for (let now = 4000; now < 7500; now += 1000 / 30) drive(sim, now, ++seq);
    const p = sim.players.get('a')!; const before = p.bike.state.progress;
    expect(sim.reset('a', 1, 7500)).toContain('Brake'); p.bike.state.speed = 0;
    p.bike.state.nitro = 23; p.bike.state.rechargeDelay = 1.7; const gates = p.gates.next;
    expect(sim.reset('a', 1, 7500)).toBeNull(); expect(p.bike.state.progress).toBeLessThan(before);
    expect(p.gates.next).toBe(gates); expect(p.bike.state.nitro).toBe(23); expect(p.bike.state.rechargeDelay).toBe(1.7);
    expect(sim.reset('a', 1, 7501)).toContain('cooling'); expect(p.snapshot.resetVersion).toBe(1);
    expect(sim.reset('a', 999, 16000)).not.toBeNull();
  });
  it('orders sub-tick finishes by crossing time, independent of Map iteration order', () => {
    const sim = race({ ...short, checkpoints: [60] });
    for (const [id, s] of [['a', 59.7], ['b', 59.9]] as const) {
      const p = sim.players.get(id)!; p.bike.state.progress = s; p.bike.state.x = 0; p.bike.state.speed = C.topSpeed;
      p.gates.previousS = s; p.gates.previousX = 0;
    }
    drive(sim, 5000, 1); expect(sim.snapshot.phase).toBe('results');
    expect(sim.snapshot.standings.map(p => p.id)).toEqual(['b', 'a']);
    expect(sim.snapshot.standings[0].finishMs!).toBeLessThan(sim.snapshot.standings[1].finishMs!);
    expect(sim.snapshot.finishDeadlineAt).toBeCloseTo(sim.snapshot.startsAt + sim.snapshot.standings[0].finishMs! + 1000);
  });
  it('ends the production 45-second window with DNF ranked by valid progress and freezes results', () => {
    const sim = race({ ...short, finishWindowMs: 45000, maxRaceMs: 120000 }); let seq = 0; let now = 4000;
    for (; now < 20000 && sim.snapshot.finishDeadlineAt === 0; now += 1000 / 30) drive(sim, now, ++seq, ['a']);
    expect(sim.snapshot.finishDeadlineAt).toBeGreaterThan(0);
    sim.step(sim.snapshot.finishDeadlineAt - 1); expect(sim.snapshot.phase).toBe('racing');
    sim.step(sim.snapshot.finishDeadlineAt + 1); expect(sim.snapshot.phase).toBe('results');
    expect(sim.snapshot.standings.map(p => p.status)).toEqual(['finished', 'dnf']);
    const final = structuredClone(sim.snapshot.standings); drive(sim, now + 50000, seq + 1);
    expect(sim.snapshot.standings).toEqual(final);
  });
  it('never awards a finish after the finish-window boundary', () => {
    const sim = race({ ...short, checkpoints: [60] }); sim.step(4000);
    const a = sim.players.get('a')!; a.snapshot.finishMs = 600; a.result!.finishMs = 600; a.result!.status = 'finished';
    sim.snapshot.finishDeadlineAt = 5000;
    const b = sim.players.get('b')!; b.bike.state.progress = 59.9; b.bike.state.x = 0; b.bike.state.speed = C.topSpeed;
    b.gates.previousS = 59.9; b.gates.previousX = 0;
    drive(sim, 5100, 1, ['b']);
    expect(sim.snapshot.phase).toBe('results'); expect(b.snapshot.finishMs).toBeNull(); expect(b.result!.status).toBe('dnf');
  });  it('ends a stalled race at the hard timeout without inventing finishes', () => {
    const sim = race(); sim.step(4000 + short.maxRaceMs);
    expect(sim.snapshot.phase).toBe('results'); expect(sim.snapshot.standings.every(p => p.status === 'dnf')).toBe(true);
  });
  it('retains disconnected standings and transfers host through rematch', () => {
    const sim = race(); sim.step(4000); sim.remove('a'); expect(sim.snapshot.standings.find(p => p.id === 'a')?.status).toBe('dnf');
    sim.step(4000 + short.maxRaceMs); expect(sim.rematch('a', 1)).toBe(false); expect(sim.rematch('b', 1)).toBe(true);
    expect(sim.snapshot.hostId).toBe('b'); expect(sim.snapshot.players).toHaveLength(1);
  });
  it('rematches in the same room with clean Ready/grid state and rejects delayed prior-round input', () => {
    const sim = race(); sim.snapshot.roomId = 'ABC234'; let seq = 0;
    for (let now = 4000; now < 20000 && sim.snapshot.phase !== 'results'; now += 1000 / 30) drive(sim, now, ++seq);
    expect(sim.rematch('b', 1)).toBe(false); expect(sim.rematch('a', 1)).toBe(true); expect(sim.snapshot.roundId).toBe(2);
    expect(sim.snapshot.roomId).toBe('ABC234'); expect(sim.snapshot.standings).toHaveLength(0); expect(sim.snapshot.startsAt).toBe(0);
    expect(sim.snapshot.players.every(p => !p.ready && p.finishMs === null && p.checkpoint === 0 && p.nitro === 100)).toBe(true);
    expect(sim.start('a', 30000)).toBe(false);
    expect(sim.input('a', { roundId: 1, seq: ++seq, throttle: true, brake: false, nitro: false, steer: 0 }, 30000)).toBe(false);
    sim.ready('a', true); sim.ready('b', true); expect(sim.start('a', 30000)).toBe(true); drive(sim, 34000, seq + 1);
    expect(sim.snapshot.players[0].progress).toBeGreaterThan(8);
  });
  it('snaps interpolation across reset versions instead of sweeping backwards through scenery', () => {
    const sim = race(); sim.step(4000); const a = structuredClone(sim.snapshot); const b = structuredClone(a);
    a.players[0].progress = 200; b.tick++; b.serverTime += 100; b.players[0].progress = 56; b.players[0].resetVersion++;
    const buffer = new SnapshotBuffer(); buffer.push(a); buffer.push(b); const out = { ...a.players[0] };
    buffer.sample('a', out, a.serverTime + 50); expect(out.progress).toBe(56);
  });
});
