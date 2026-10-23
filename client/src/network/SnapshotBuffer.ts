import type { BikeState } from '../../../shared/src/contracts';
import type { PlayerSnapshot, RoomSnapshot } from '../../../shared/src/protocol';
/** Fixed-capacity timeline; frame-time sampling reuses the caller's state object. */
export class SnapshotBuffer {
  private readonly frames: (RoomSnapshot | undefined)[] = new Array(32);
  private cursor = 0;
  private count = 0;
  /** Adds an ordered server snapshot at the networking boundary. */
  push(frame: RoomSnapshot): void {
    const latest = this.latest();
    if (latest && frame.tick <= latest.tick) return;
    this.frames[this.cursor] = frame; this.cursor = (this.cursor + 1) % this.frames.length; this.count = Math.min(this.count + 1, this.frames.length);
  }
  /** Returns the most recent authoritative snapshot, without copying it. */
  latest(): RoomSnapshot | undefined { return this.count ? this.frames[(this.cursor - 1 + this.frames.length) % this.frames.length] : undefined; }
  /** Interpolates valid server positions, never extrapolates arbitrary client velocity. */
  sample(id: string, out: BikeState, time: number): boolean {
    let before: RoomSnapshot | undefined; let after: RoomSnapshot | undefined;
    for (let i = 0; i < this.count; i++) {
      const frame = this.frames[(this.cursor - this.count + i + this.frames.length) % this.frames.length];
      if (!frame) continue;
      after = frame;
      if (frame.serverTime >= time) break;
      before = frame;
    }
    if (!after) return false;
    before ??= after;
    let a: PlayerSnapshot | undefined; let b: PlayerSnapshot | undefined;
    for (const p of before.players) if (p.id === id) { a = p; break; }
    for (const p of after.players) if (p.id === id) { b = p; break; }
    if (!b) return false; a ??= b;
    const span = after.serverTime - before.serverTime;
    const t = a.resetVersion !== b.resetVersion || before.roundId !== after.roundId ? 1 : span > 0 ? Math.max(0, Math.min(1, (time - before.serverTime) / span)) : 1;
    out.x = a.x + (b.x - a.x) * t; out.progress = a.progress + (b.progress - a.progress) * t;
    out.heading = a.heading + (b.heading - a.heading) * t; out.speed = a.speed + (b.speed - a.speed) * t;
    out.nitro = a.nitro + (b.nitro - a.nitro) * t; out.rechargeDelay = b.rechargeDelay;
    out.boosting = b.boosting; out.contact = b.contact; return true;
  }
  /** Releases snapshot references when changing/leaving rooms. */
  clear(): void { this.frames.fill(undefined); this.cursor = 0; this.count = 0; }
}
