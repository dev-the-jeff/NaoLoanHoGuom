import { BikeController } from '../../../shared/src/BikeController';
import { Road } from '../../../shared/src/Road';
import { GAME_CONFIG as C } from '../../../shared/src/gameConfig';
import { RACE_RULES } from '../../../shared/src/course';
import type { RaceRules } from '../../../shared/src/course';
import { NET_CONFIG as N, validInput } from '../../../shared/src/protocol';
import type { InputPacket, PlayerSnapshot, RoomSnapshot, RaceResult } from '../../../shared/src/protocol';
import { Checkpoints } from './Checkpoints';
import type { CheckpointProgress } from './Checkpoints';
interface ServerPlayer {
  bike: BikeController; input: InputPacket; snapshot: PlayerSnapshot; gates: CheckpointProgress;
  lastInputAt: number; windowStart: number; windowCount: number; grid: number; result?: RaceResult;
}
const COLORS = [0x28c4bd, 0xe9763e, 0x668def, 0xe8ca54, 0xc077db, 0x91b952];
function compareResults(a: RaceResult, b: RaceResult): number {
  if (a.finishMs !== null && b.finishMs !== null) return a.finishMs - b.finishMs || a.grid - b.grid;
  if (a.finishMs !== null) return -1; if (b.finishMs !== null) return 1;
  return b.checkpoint - a.checkpoint || b.progress - a.progress || a.grid - b.grid;
}
/** Room-isolated authoritative racing aggregate. Input never owns progress, finish time or reset placement. */
export class RaceSimulation {
  readonly players = new Map<string, ServerPlayer>();
  readonly snapshot: RoomSnapshot;
  private readonly road = new Road();
  private readonly checkpoints: Checkpoints;
  constructor(readonly rules: RaceRules = RACE_RULES) {
    if (!rules.checkpoints.length || rules.checkpoints.some((s, i) => s <= 35 || s >= this.road.length || i > 0 && s <= rules.checkpoints[i - 1])) throw new Error('Course gates must be ordered, after the grid and before road end.');
    this.checkpoints = new Checkpoints(this.road, rules);
    this.snapshot = { tick: 0, serverTime: 0, roomId: '', hostId: '', phase: 'lobby', startsAt: 0, roundId: 1,
      checkpoints: rules.checkpoints, elapsedMs: 0, finishDeadlineAt: 0, standings: [], players: [], tickMs: 0, tickRate: N.tickRate, snapshotRate: N.snapshotRate };
  }
  /** Creates one guest on a distinct server-owned grid slot. */
  add(id: string, nickname: string): void {
    let grid = 0;
    while (Array.from(this.players.values()).some(player => player.grid === grid)) grid++;
    const bike = new BikeController(this.road);
    bike.state.progress = 8 + Math.floor(grid / C.laneCount) * 5;
    bike.state.x = (grid % C.laneCount - (C.laneCount - 1) / 2) * C.laneWidth;
    const state: PlayerSnapshot = { ...bike.state, id, nickname, ready: false, seq: -1, steer: 0, color: COLORS[grid % COLORS.length],
      checkpoint: 0, validatedProgress: bike.state.progress, rank: 0, finishMs: null, resetVersion: 0, resetAvailableAt: 0 };
    this.players.set(id, { bike, snapshot: state, gates: this.checkpoints.create(bike.state.progress, bike.state.x),
      input: { roundId: this.snapshot.roundId, seq: -1, throttle: false, brake: false, nitro: false, steer: 0 }, lastInputAt: 0, windowStart: 0, windowCount: 0, grid });
    this.snapshot.players.push(state); if (!this.snapshot.hostId) this.snapshot.hostId = id;
  }
  /** Removes the vehicle, retains its DNF standing during a race, and transfers host. */
  remove(id: string): void {
    const player = this.players.get(id);
    if (player?.result && this.snapshot.phase === 'racing' && player.result.finishMs === null) player.result.status = 'dnf';
    this.players.delete(id); const index = this.snapshot.players.findIndex(p => p.id === id);
    if (index >= 0) this.snapshot.players.splice(index, 1);
    if (this.snapshot.hostId === id) this.snapshot.hostId = this.snapshot.players[0]?.id ?? '';
    if (this.snapshot.phase === 'countdown' && this.players.size < 2) {
      this.snapshot.phase = 'lobby'; this.snapshot.startsAt = 0; this.snapshot.standings.length = 0;
      for (const p of this.players.values()) { p.snapshot.ready = false; p.result = undefined; }
    }
    if (this.snapshot.phase === 'racing') this.checkEnd(this.snapshot.serverTime);
  }
  /** Changes readiness only between races. */
  ready(id: string, ready: unknown): void { const player = this.players.get(id); if (this.snapshot.phase === 'lobby' && player && typeof ready === 'boolean') player.snapshot.ready = ready; }
  /** Starts only for host plus at least two connected, Ready entrants. */
  start(id: string, now: number): boolean {
    const s = this.snapshot;
    if (s.hostId !== id || s.phase !== 'lobby' || this.players.size < 2) return false;
    for (const player of this.players.values()) if (!player.snapshot.ready) return false;
    s.standings.length = 0;
    for (const player of this.players.values()) {
      player.result = { id: player.snapshot.id, nickname: player.snapshot.nickname, color: player.snapshot.color, rank: 0,
        checkpoint: 0, progress: player.bike.state.progress, finishMs: null, status: 'racing', grid: player.grid };
      s.standings.push(player.result);
    }
    s.phase = 'countdown'; s.startsAt = now + N.countdownMs; this.rank(); return true;
  }
  /** Whitelists intent, round generation, sequence and bounded packet rate. */
  input(id: string, packet: unknown, now: number): boolean {
    const p = this.players.get(id);
    if (!p || !validInput(packet) || packet.roundId !== this.snapshot.roundId) return false;
    if (now - p.windowStart >= 1000) { p.windowStart = now; p.windowCount = 0; }
    if (++p.windowCount > N.maxInputRate || packet.seq <= p.input.seq) return false;
    Object.assign(p.input, packet); p.lastInputAt = now; return true;
  }
  /** Resolves R to the last safe completed gate, never forward, never with extra fuel. */
  reset(id: string, roundId: unknown, now: number): string | null {
    const p = this.players.get(id);
    if (!p || roundId !== this.snapshot.roundId || this.snapshot.phase !== 'racing' || p.snapshot.finishMs !== null) return 'Reset is available only while racing.';
    if (now < p.snapshot.resetAvailableAt) return 'Reset is cooling down.';
    if (p.bike.state.speed > this.rules.resetMaxSpeed) return 'Brake below 15 km/h before resetting.';
    const s = p.bike.state; const fuel = s.nitro; const rechargeDelay = s.rechargeDelay;
    const target = Math.min(s.progress, p.gates.safeS); const x = this.road.centerAt(target) + p.gates.lane;
    p.bike.reset(); s.progress = target; s.x = x; s.heading = Math.atan2(this.road.centerAt(target + 0.5) - this.road.centerAt(target - 0.5), 1);
    s.nitro = fuel; s.rechargeDelay = rechargeDelay; this.checkpoints.reset(p.gates, target, x);
    p.input.throttle = false; p.input.brake = true; p.input.nitro = false; p.input.steer = 0;
    p.snapshot.resetVersion++; p.snapshot.resetAvailableAt = now + this.rules.resetCooldownMs; this.sync(p); this.rank(); return null;
  }
  /** Returns finished room to a fresh Ready lobby without restarting its server or changing code. */
  rematch(id: string, roundId: unknown): boolean {
    const s = this.snapshot; if (id !== s.hostId || roundId !== s.roundId || s.phase !== 'results') return false;
    s.roundId++; s.phase = 'lobby'; s.startsAt = 0; s.elapsedMs = 0; s.finishDeadlineAt = 0; s.standings.length = 0;
    let grid = 0;
    for (const p of this.players.values()) {
      p.grid = grid++; p.bike.reset(); p.bike.state.progress = 8 + Math.floor(p.grid / C.laneCount) * 5;
      p.bike.state.x = (p.grid % C.laneCount - (C.laneCount - 1) / 2) * C.laneWidth;
      p.gates = this.checkpoints.create(p.bike.state.progress, p.bike.state.x); p.result = undefined;
      p.snapshot.ready = false; p.snapshot.finishMs = null; p.snapshot.rank = 0; p.snapshot.resetAvailableAt = 0; p.snapshot.resetVersion++;
      p.input.roundId = s.roundId; p.input.throttle = false; p.input.brake = true; p.input.nitro = false; p.input.steer = 0; p.lastInputAt = 0; this.sync(p);
    }
    return true;
  }
  /** Advances fixed 30 Hz authority with four validated 120 Hz substeps. */
  step(now: number): void {
    const began = performance.now(); const s = this.snapshot; s.tick++; s.serverTime = now;
    if (s.phase === 'countdown' && now >= s.startsAt) s.phase = 'racing';
    if (s.phase === 'racing') s.elapsedMs = Math.max(0, now - s.startsAt);
    for (const p of this.players.values()) {
      const input = p.input;
      if (now - p.lastInputAt > N.staleInputMs) { input.throttle = false; input.brake = true; input.steer = 0; input.nitro = false; }
      if (s.phase === 'racing' && p.snapshot.finishMs === null) {
        for (let i = 0; i < 4; i++) {
          p.bike.step(input, C.fixedStep); const crossing = this.checkpoints.advance(p.gates, p.bike.state, C.fixedStep);
          if (crossing === 'invalid') { p.bike.state.progress = p.gates.previousS; p.bike.state.x = p.gates.previousX; p.bike.state.speed = 0; }
          if (crossing === 'finished') {
            const finishAt = Math.max(s.startsAt, now - (4 - i - p.gates.finishFraction) * C.fixedStep * 1000);
            const limit = Math.min(s.startsAt + this.rules.maxRaceMs, s.finishDeadlineAt || Infinity);
            if (finishAt > limit) break;
            p.snapshot.finishMs = finishAt - s.startsAt; p.bike.state.speed = 0; p.bike.state.boosting = false;
            if (p.result) { p.result.finishMs = p.snapshot.finishMs; p.result.status = 'finished'; }
            const deadline = finishAt + this.rules.finishWindowMs;
            s.finishDeadlineAt = s.finishDeadlineAt === 0 ? deadline : Math.min(s.finishDeadlineAt, deadline); break;
          }
        }
      }
      this.sync(p);
    }
    this.rank(); if (s.phase === 'racing') this.checkEnd(now); s.tickMs = performance.now() - began;
  }
  private sync(p: ServerPlayer): void {
    Object.assign(p.snapshot, p.bike.state); p.snapshot.seq = p.input.seq; p.snapshot.steer = p.input.steer;
    p.snapshot.checkpoint = p.gates.next; p.snapshot.validatedProgress = p.gates.validated;
    if (p.result && this.snapshot.phase !== 'results') { p.result.checkpoint = p.gates.next; p.result.progress = p.gates.validated; }
  }
  private rank(): void {
    if (this.snapshot.phase === 'results') return;
    this.snapshot.standings.sort(compareResults);
    for (let i = 0; i < this.snapshot.standings.length; i++) {
      const result = this.snapshot.standings[i]; result.rank = i + 1; const p = this.players.get(result.id); if (p) p.snapshot.rank = result.rank;
    }
  }
  private checkEnd(now: number): void {
    let active = 0; for (const p of this.players.values()) if (p.snapshot.finishMs === null) active++;
    if (active > 0 && now < this.snapshot.startsAt + this.rules.maxRaceMs && (this.snapshot.finishDeadlineAt === 0 || now < this.snapshot.finishDeadlineAt)) return;
    this.rank(); this.snapshot.phase = 'results';
    for (const result of this.snapshot.standings) if (result.finishMs === null) result.status = 'dnf';
    for (const p of this.players.values()) { p.bike.state.speed = 0; p.bike.state.boosting = false; Object.assign(p.snapshot, p.bike.state); }
  }
}
