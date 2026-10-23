import type { RoomSnapshot } from '../../../shared/src/protocol';
import { element } from './hud';
export interface LobbyEvents {
  connect(action: 'create' | 'join', nickname: string, code: string): Promise<void>;
  ready(value: boolean): void; start(): void; leave(): void; opened(): void;
}
/** Safe DOM lobby. Dynamic guest names are always textContent, never HTML. */
export class Lobby {
  private readonly panel = element('online-panel');
  private readonly form = element('connection-form');
  private readonly roomPanel = element('room-state');
  private readonly notice = element('connection-notice');
  private readonly roster = element('roster');
  private readonly readyButton = element<HTMLButtonElement>('ready');
  private readonly startButton = element<HTMLButtonElement>('start-race');
  private readonly phase = element('phase-status');
  private readonly events = new AbortController();
  private readonly entries = new Map<string, HTMLLIElement>();
  private latest: RoomSnapshot | undefined;
  private localId = '';
  private busy = false;
  constructor(private readonly actions: LobbyEvents) {
    const on = (id: string, callback: () => void) => element(id).addEventListener('click', callback, { signal: this.events.signal });
    on('online-open', () => this.open()); on('network-open', () => this.open()); on('close-online', () => { this.panel.hidden = true; });
    on('create-room', () => { void this.connect('create'); }); on('join-room', () => { void this.connect('join'); });
    on('ready', () => { const me = this.latest?.players.find(player => player.id === this.localId); this.actions.ready(!me?.ready); });
    on('start-race', () => this.actions.start());
    on('leave-room', () => { this.actions.leave(); this.reset(); });
    const saved = localStorage.getItem('road-riot-nickname');
    if (saved) element<HTMLInputElement>('nickname').value = saved;
  }
  private async connect(action: 'create' | 'join'): Promise<void> {
    if (this.busy) return; this.busy = true; this.setNotice('Connecting…'); this.buttons(true);
    const nickname = element<HTMLInputElement>('nickname').value.trim();
    try { await this.actions.connect(action, nickname, element<HTMLInputElement>('room-code').value); localStorage.setItem('road-riot-nickname', nickname); this.setNotice(''); }
    catch (error: unknown) { this.setNotice(error instanceof Error ? error.message : 'Could not connect.'); }
    finally { this.busy = false; this.buttons(false); }
  }
  private buttons(disabled: boolean): void { element<HTMLButtonElement>('create-room').disabled = disabled; element<HTMLButtonElement>('join-room').disabled = disabled; }
  /** Opens room controls while the game decides how to handle local input. */
  open(): void { this.panel.hidden = false; this.actions.opened(); }
  /** Displays only server-granted membership, host privileges and readiness. */
  update(frame: RoomSnapshot, localId: string): void {
    const wasRacing = this.latest?.phase === 'racing'; const wasResults = this.latest?.phase === 'results'; this.latest = frame; this.localId = localId;
    this.form.hidden = true; this.roomPanel.hidden = false; if (wasResults && frame.phase === 'lobby') this.panel.hidden = false;
    element('room-code-display').textContent = frame.roomId;
    element('player-count').textContent = `${frame.players.length} / 16`;
    for (const [id, entry] of this.entries) if (!frame.players.some(player => player.id === id)) { entry.remove(); this.entries.delete(id); }
    for (const player of frame.players) {
      let entry = this.entries.get(player.id);
      if (!entry) { entry = document.createElement('li'); entry.dataset.session = player.id; this.entries.set(player.id, entry); this.roster.append(entry); }
      const text = `${player.nickname}${player.id === localId ? ' (you)' : ''}${player.id === frame.hostId ? ' · HOST' : ''} — ${player.ready ? 'READY' : 'WAITING'}`;
      if (entry.textContent !== text) entry.textContent = text;
      entry.style.borderLeftColor = `#${player.color.toString(16).padStart(6, '0')}`;
    }
    const me = frame.players.find(player => player.id === localId);
    this.readyButton.textContent = me?.ready ? 'UNREADY' : 'READY'; this.readyButton.disabled = frame.phase !== 'lobby';
    this.startButton.hidden = frame.hostId !== localId;
    this.startButton.disabled = frame.phase !== 'lobby' || frame.players.length < 2 || frame.players.some(player => !player.ready);
    if (frame.phase === 'racing' && !wasRacing) { this.panel.hidden = true; if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }
  }
  /** Updates the countdown using the synchronized server clock. */
  clock(serverNow: number): void {
    if (!this.latest) return;
    const frame = this.latest;
    this.phase.textContent = frame.phase === 'countdown' ? `START IN ${Math.max(0, Math.ceil((frame.startsAt - serverNow) / 1000))}`
      : frame.phase === 'racing' ? 'RIDING · SERVER AUTHORITATIVE' : frame.phase === 'results' ? 'RACE COMPLETE · See final standings.' : 'Need 2+ players, everyone Ready. Host starts.';
  }
  /** Shows concise connection failures without hiding them behind the canvas. */
  setNotice(message: string): void { this.notice.textContent = message; }
  /** Returns to entry controls without preserving stale room identity. */
  reset(): void {
    this.latest = undefined; this.localId = ''; this.form.hidden = false; this.roomPanel.hidden = true;
    this.entries.clear(); this.roster.replaceChildren();
  }
  /** Keeps disconnect errors visible and offers explicit rejoin. */
  disconnected(message: string): void { this.reset(); this.panel.hidden = false; this.setNotice(message); }
  /** Removes all owned UI handlers. */
  dispose(): void { this.events.abort(); this.entries.clear(); }
}
