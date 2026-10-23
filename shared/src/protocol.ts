import type { BikeState, RidingInput } from './contracts';
/** Wire input contains intent only, never position, velocity or race results. */
export interface InputPacket extends RidingInput { seq: number; roundId: number }
/** Server-owned player presentation data. */
export interface PlayerSnapshot extends BikeState { id: string; nickname: string; ready: boolean; seq: number; steer: number; color: number; checkpoint: number; validatedProgress: number; rank: number; finishMs: number | null; resetVersion: number; resetAvailableAt: number }
/** Server-frozen finish order or checkpoint/progress-ranked DNF entry. */
export interface RaceResult { id: string; nickname: string; color: number; rank: number; checkpoint: number; progress: number; finishMs: number | null; status: 'racing' | 'finished' | 'dnf'; grid: number }
/** Authoritative race lifecycle snapshot. */
export interface RoomSnapshot {
  tick: number; serverTime: number; roomId: string; hostId: string;
  phase: 'lobby' | 'countdown' | 'racing' | 'results'; startsAt: number;
  roundId: number; checkpoints: readonly number[]; elapsedMs: number; finishDeadlineAt: number; standings: RaceResult[];
  players: PlayerSnapshot[]; tickMs: number; tickRate: number; snapshotRate: number;
}
/** Conservative local prototype limits. */
export const NET_CONFIG = Object.freeze({
  port: 2567, capacity: 16, tickRate: 30, snapshotRate: 15, inputRate: 30,
  interpolationMs: 100, staleInputMs: 300, countdownMs: 3000,
  maxInputRate: 45, maxMessagesPerSecond: 80, maxPayloadBytes: 1024,
});
/** Validates the guest name before it reaches any DOM or room state. */
export function validNickname(value: unknown): value is string {
  return typeof value === 'string' && /^[\p{L}\p{N} _.-]{1,20}$/u.test(value) && value.trim().length > 0;
}
/** Validates the six-character private code, excluding ambiguous letters. */
export function validRoomCode(value: unknown): value is string { return typeof value === 'string' && /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(value); }
/** Strict whitelist rejects client attempts to submit authoritative movement state. */
export function validInput(value: unknown): value is InputPacket {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  if (Object.keys(p).length !== 6) return false;
  return Number.isSafeInteger(p.roundId) && (p.roundId as number) >= 1 && Number.isSafeInteger(p.seq) && (p.seq as number) >= 0 && (p.seq as number) < Number.MAX_SAFE_INTEGER
    && typeof p.throttle === 'boolean' && typeof p.brake === 'boolean' && typeof p.nitro === 'boolean'
    && typeof p.steer === 'number' && Number.isFinite(p.steer) && p.steer >= -1 && p.steer <= 1;
}

