import { randomInt } from 'node:crypto';
import { Room, ServerError, type Client } from '@colyseus/core';
import { NET_CONFIG as N, validNickname } from '../../../shared/src/protocol';
import { RaceSimulation } from '../simulation/RaceSimulation';
const activeCodes = new Set<string>();
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(): string {
  let code: string;
  do { code = ''; for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)]; } while (activeCodes.has(code));
  activeCodes.add(code); return code;
}
/** Private in-memory Colyseus room. All game decisions live in the server simulation. */
export class RaceRoom extends Room {
  maxClients = N.capacity;
  maxMessagesPerSecond = N.maxMessagesPerSecond;
  protected simulation!: RaceSimulation;
  /** Supplies production rules; trusted server tests may override the factory. */
  protected createSimulation(): RaceSimulation { return new RaceSimulation(); }
  /** Registers intent handlers and a framework-owned fixed tick loop. */
  async onCreate(): Promise<void> {
    this.simulation = this.createSimulation(); this.roomId = makeCode(); this.simulation.snapshot.roomId = this.roomId;
    await this.setPrivate(true);
    this.onMessage('input', (client, packet: unknown) => { this.simulation.input(client.sessionId, packet, Date.now()); });
    this.onMessage('ready', (client, ready: unknown) => this.simulation.ready(client.sessionId, ready));
    this.onMessage('start', client => {
      if (this.simulation.start(client.sessionId, Date.now())) void this.lock();
      else client.send('notice', 'Host needs at least 2 connected players, all Ready.');
    });
    this.onMessage('reset', (client, packet: unknown) => {
      const round = commandRound(packet); if (round === undefined) return;
      const error = this.simulation.reset(client.sessionId, round, Date.now());
      if (error) client.send('notice', error);
    });
    this.onMessage('rematch', (client, packet: unknown) => {
      const round = commandRound(packet); if (round === undefined) return;
      if (this.simulation.rematch(client.sessionId, round)) { if (this.clients.length < this.maxClients) void this.unlock(); }
      else client.send('notice', 'Only the host can return a completed race to the lobby.');
    });
    this.onMessage('sync', client => client.send('snapshot', this.simulation.snapshot));
    this.onMessage('ping', (client, sentAt: unknown) => {
      if (typeof sentAt === 'number' && Number.isFinite(sentAt)) client.send('pong', { sentAt, serverTime: Date.now() });
    });
    this.onMessage('*', () => { /* Unknown commands never mutate simulation state. */ });
    this.setFixedTimestep(() => {
      this.simulation.step(Date.now());
      if (this.simulation.snapshot.tick % 2 === 0) this.broadcast('snapshot', this.simulation.snapshot);
    }, N.tickRate);
    // Disable schema patches after installing simulation; otherwise Colyseus starts a second clock tick timer.
    this.patchRate = null;
  }
  /** Rejects unsafe or blank guest nicknames before room membership is granted. */
  onAuth(_client: Client, options: unknown): boolean {
    if (this.simulation.snapshot.phase !== 'lobby') throw new ServerError(409, 'Room already starting or racing.');
    const nickname = options && typeof options === 'object' ? (options as Record<string, unknown>).nickname : undefined;
    if (!validNickname(nickname)) throw new ServerError(400, 'Nickname must be 1–20 letters, numbers, spaces, dots, dashes or underscores.');
    return true;
  }
  /** Allocates one authoritative bike per unique session. */
  onJoin(client: Client, options: { nickname: string }): void {
    if (this.simulation.snapshot.phase !== 'lobby') throw new ServerError(409, 'Room already starting or racing.');
    this.simulation.add(client.sessionId, options.nickname.trim());
  }
  /** Immediately removes a lost connection; automatic reconnection is deliberately deferred. */
  onDrop(client: Client): void { this.remove(client); }
  /** Removes consented leaves or completes unexpected disconnect cleanup, idempotently. */
  onLeave(client: Client): void { this.remove(client); }
  private remove(client: Client): void {
    this.simulation.remove(client.sessionId);
    if (this.simulation.snapshot.phase === 'lobby' && this.clients.length < this.maxClients) void this.unlock();
  }
  /** Releases the private-code reservation; Colyseus owns tick and socket cleanup. */
  onDispose(): void { activeCodes.delete(this.roomId); }
}


function commandRound(packet: unknown): number | undefined {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet) || Object.keys(packet).length !== 1) return undefined;
  const round = (packet as Record<string, unknown>).roundId;
  return typeof round === 'number' && Number.isSafeInteger(round) && round >= 1 ? round : undefined;
}
