import { Client, type Room } from '@colyseus/sdk';
import type { RidingInput } from '../../../shared/src/contracts';
import { NET_CONFIG as N, validNickname, validRoomCode } from '../../../shared/src/protocol';
import type { RoomSnapshot } from '../../../shared/src/protocol';
import { SnapshotBuffer } from './SnapshotBuffer';
export interface NetworkEvents { snapshot(frame: RoomSnapshot): void; disconnected(message: string): void; notice(message: string): void }
/** Colyseus intent-only adapter with bounded interpolation and explicit connection lifecycle. */
export class MultiplayerClient {
  readonly buffer = new SnapshotBuffer();
  room: Room | undefined;
  ping = 0;
  private generation = 0;
  private seq = 0;
  private timer: number | undefined;
  private lastPingAt = 0;
  private enabled = false;
  private pending: Readonly<RidingInput> = { throttle: false, brake: true, steer: 0, nitro: false };
  private clockOffset = 0;
  private clockReady = false;
  private readonly client: Client;
  private readonly packet = { seq: 0, roundId: 1, throttle: false, brake: false, steer: 0, nitro: false };
  private readonly stop: RidingInput = { throttle: false, brake: true, steer: 0, nitro: false };
  constructor(private readonly events: NetworkEvents) {
    const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
    const endpoint = configured || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:2567`;
    this.client = new Client(endpoint);
  }
  /** Clock estimate uses server timestamp plus the measured one-way delay. */
  serverNow(): number { return Date.now() + this.clockOffset; }
  /** Joins a private room or creates one; stale async completions are immediately closed. */
  async connect(action: 'create' | 'join', nickname: string, code: string): Promise<void> {
    if (!validNickname(nickname.trim())) throw new Error('Nickname: use 1–20 letters, numbers, spaces, . - or _.');
    code = code.trim().toUpperCase();
    if (action === 'join' && !validRoomCode(code)) throw new Error('Enter the 6-character room code.');
    this.leave(); const generation = this.generation;
    let room: Room;
    try { room = action === 'create' ? await this.client.create('race', { nickname: nickname.trim() }) : await this.client.joinById(code, { nickname: nickname.trim() }); }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (/full|locked|maxclients|seat/i.test(message)) throw new Error('Room is full or already racing. Ask the host for a new room.', { cause: error });
      if (/not found|not defined|invalid room|no rooms|disposed/i.test(message)) throw new Error('Room not found. Check the code with the host.', { cause: error });
      throw new Error('Cannot reach the multiplayer server. Check the server address and connection.', { cause: error });
    }
    if (generation !== this.generation) { void room.leave(); return; }
    this.room = room; room.reconnection.enabled = false; this.seq = 0; this.clockReady = false;
    room.onMessage<RoomSnapshot>('snapshot', frame => {
      if (this.room !== room) return;
      if (!this.clockReady && frame.serverTime > 0) { this.clockOffset = frame.serverTime - Date.now(); this.clockReady = true; }
      if (this.buffer.latest()?.roundId !== frame.roundId) this.buffer.clear(); this.buffer.push(frame); this.events.snapshot(frame);
    });
    room.onMessage<{ sentAt: number; serverTime: number }>('pong', message => {
      this.ping = Math.max(0, Date.now() - message.sentAt);
      const offset = message.serverTime + this.ping / 2 - Date.now();
      this.clockOffset = this.clockReady ? this.clockOffset * 0.7 + offset * 0.3 : offset; this.clockReady = true;
    });
    room.onMessage<string>('notice', message => this.events.notice(message));
    room.onError((_code, message) => { if (this.room === room) this.events.notice(message || 'Connection error.'); });
    room.onLeave(() => { if (this.room !== room) return; this.clearLocal(); this.events.disconnected('Connection lost. Rejoin a lobby with its code or create a room. Running rooms cannot be rejoined yet.'); });
    room.send('sync'); room.send('ping', Date.now()); this.lastPingAt = Date.now();
    this.timer = window.setInterval(this.flush, 1000 / N.inputRate);
  }
  /** Caches current intent; an owned timer sends at 30 Hz independently of renderer FPS. */
  update(input: Readonly<RidingInput>, enabled: boolean): void { this.pending = input; this.enabled = enabled; }
  private readonly flush = (): void => {
    const room = this.room; if (!room) return;
    this.send(this.enabled ? this.pending : this.stop);
    if (Date.now() - this.lastPingAt >= 1000) { this.lastPingAt = Date.now(); room.send('ping', this.lastPingAt); }
  };
  private send(input: Readonly<RidingInput>): void {
    if (!this.room) return;
    Object.assign(this.packet, input); this.packet.seq = ++this.seq; this.packet.roundId = this.buffer.latest()?.roundId ?? 1; this.room.send('input', this.packet);
  }
  /** Sends a braking intent immediately on blur/pause; the race itself continues online. */
  stopInput(): void { this.enabled = false; this.send(this.stop); }
  /** Marks local readiness; server validates phase and player membership. */
  ready(value: boolean): void { this.room?.send('ready', value); }
  /** Requests host start; the server enforces permissions and Ready requirements. */
  start(): void { this.room?.send('start'); }
  /** Requests server-owned safe placement; no client position is accepted. */
  reset(): void { this.stopInput(); this.room?.send('reset', { roundId: this.buffer.latest()?.roundId }); }
  /** Requests a new Ready lobby in the same private room. */
  rematch(): void { this.room?.send('rematch', { roundId: this.buffer.latest()?.roundId }); }
  private clearLocal(): void {
    this.generation++; this.room = undefined; this.buffer.clear(); this.ping = 0; this.enabled = false;
    if (this.timer !== undefined) { window.clearInterval(this.timer); this.timer = undefined; }
  }
  /** Closes the owned room, invalidates pending joins and releases networking timers. */
  leave(): void {
    const room = this.room; this.clearLocal();
    if (room && room.connection.isOpen) { room.reconnection.enabled = false; void room.leave(); }
  }
}

