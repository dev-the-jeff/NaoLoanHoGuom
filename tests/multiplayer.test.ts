import { describe, expect, it } from 'vitest';
import { RaceSimulation } from '../server/src/simulation/RaceSimulation';
import { NET_CONFIG as N, validInput, validNickname, validRoomCode } from '../shared/src/protocol';
import { SnapshotBuffer } from '../client/src/network/SnapshotBuffer';
import { GAME_CONFIG as C } from '../shared/src/gameConfig';
const input = { roundId: 1, seq: 1, throttle: true, brake: false, steer: 0, nitro: false };
describe('M2 authority and protocol', () => {
  it('adds one full-width lane and allocates distinct server grid positions', () => {
    const sim = new RaceSimulation();
    for (let i = 0; i < N.capacity; i++) sim.add(String(i), 'Guest');
    expect(C.laneCount).toBe(3); expect(C.roadHalfWidth * 2).toBe(C.laneCount * C.laneWidth);
    const positions = new Set(sim.snapshot.players.map(p => `${p.x},${p.progress}`)); expect(positions.size).toBe(16);
  });
  it('rejects arbitrary state, invalid payloads and stale sequences', () => {
    const sim = new RaceSimulation(); sim.add('a', 'Guest');
    expect(validInput({ ...input, x: 999 })).toBe(false);
    for (const invalid of [null, [], { ...input, steer: NaN }, { ...input, seq: -1 }, { ...input, steer: 2 }, { ...input, throttle: 1 }]) expect(validInput(invalid)).toBe(false);
    expect(sim.input('a', input, 1000)).toBe(true); expect(sim.input('a', input, 1001)).toBe(false);
    expect(sim.input('a', { ...input, seq: 0 }, 1002)).toBe(false);
  });
  it('requires host, two connected players and everyone Ready', () => {
    const sim = new RaceSimulation(); sim.add('a', 'Same'); expect(sim.start('a', 1000)).toBe(false);
    sim.add('b', 'Same'); sim.ready('a', true); expect(sim.start('a', 1000)).toBe(false);
    sim.ready('b', true); expect(sim.start('b', 1000)).toBe(false); expect(sim.start('a', 1000)).toBe(true);
    expect(sim.snapshot.startsAt).toBe(4000); sim.step(3999); expect(sim.snapshot.phase).toBe('countdown'); sim.step(4000); expect(sim.snapshot.phase).toBe('racing');
  });
  it('only authoritative ticks advance positions, even when inputs arrive in bursts', () => {
    const sim = new RaceSimulation(); sim.add('a', 'A'); sim.add('b', 'B'); sim.ready('a', true); sim.ready('b', true); sim.start('a', 1000);
    const start = sim.snapshot.players[0].progress;
    for (let i = 0; i < 100; i++) sim.input('a', { ...input, seq: i }, 4100);
    expect(sim.snapshot.players[0].progress).toBe(start);
    sim.step(4100); expect(sim.snapshot.players[0].progress).toBeGreaterThan(start);
    expect(sim.snapshot.players[1].speed).toBe(0);
  });
  it('brakes stale held controls and removes disconnected riders with host transfer', () => {
    const sim = new RaceSimulation(); sim.add('a', 'A'); sim.add('b', 'B'); sim.ready('a', true); sim.ready('b', true); sim.start('a', 1000);
    sim.input('a', input, 4000); sim.step(4000); const p = sim.players.get('a'); expect(p?.input.throttle).toBe(true);
    sim.step(4400); expect(p?.input.throttle).toBe(false); expect(p?.input.brake).toBe(true);
    sim.remove('a'); sim.remove('a'); expect(sim.snapshot.players.length).toBe(1); expect(sim.snapshot.hostId).toBe('b');
  });
  it('cancels countdown if membership falls below two', () => {
    const sim = new RaceSimulation(); sim.add('a', 'A'); sim.add('b', 'B'); sim.ready('a', true); sim.ready('b', true); sim.start('a', 1000);
    sim.remove('b'); expect(sim.snapshot.phase).toBe('lobby'); expect(sim.snapshot.startsAt).toBe(0);
  });
  it('isolates rooms and accepts Vietnamese names without unsafe HTML', () => {
    const a = new RaceSimulation(); const b = new RaceSimulation(); a.add('a', 'An');
    expect(b.players.size).toBe(0); expect(validNickname('Nguyễn An')).toBe(true); expect(validNickname('<img src=x>')).toBe(false); expect(validNickname('  ')).toBe(false);
    expect(validRoomCode('ABC234')).toBe(true); expect(validRoomCode('bad')).toBe(false);
  });
  it('interpolates a bounded server timeline and never extrapolates beyond its newest sample', () => {
    const sim = new RaceSimulation(); sim.add('a', 'A'); sim.step(1000);
    const a = structuredClone(sim.snapshot); a.players[0].progress = 10;
    const b = structuredClone(a); b.tick++; b.serverTime = 1100; b.players[0].progress = 20;
    const buffer = new SnapshotBuffer(); buffer.push(a); buffer.push(b); const out = { ...a.players[0] };
    expect(buffer.sample('a', out, 1050)).toBe(true); expect(out.progress).toBe(15);
    buffer.sample('a', out, 2000); expect(out.progress).toBe(20);
    expect(buffer.sample('missing', out, 1050)).toBe(false); buffer.clear(); expect(buffer.latest()).toBeUndefined();
  });
});
