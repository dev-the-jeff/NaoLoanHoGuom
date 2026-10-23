import type { RoomSnapshot } from '../../../shared/src/protocol';
import { element } from './hud';
function clock(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  return Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toFixed(2).padStart(5, '0');
}
/** Throttled race presentation. Authority and order come exclusively from server snapshots. */
export class RaceHud {
  private readonly bar = element('race-hud');
  private readonly summary = element('race-summary');
  private readonly progress = element('race-progress');
  private readonly reset = element('reset-status');
  private readonly results = element('results');
  private readonly rows = element('result-rows');
  private readonly rematch = element<HTMLButtonElement>('rematch');
  private readonly notice = element('race-notice');
  private readonly events = new AbortController();
  private readonly entries = new Map<string, HTMLTableRowElement>();
  private noticeUntil = 0;
  private resultRound = 0;
  constructor(onRematch: () => void, onLeave: () => void) {
    this.rematch.addEventListener('click', onRematch, { signal: this.events.signal });
    element('results-leave').addEventListener('click', onLeave, { signal: this.events.signal });
  }
  /** Shows server rejection feedback even while lobby controls are closed. */
  setNotice(message: string): void { this.notice.textContent = message; this.noticeUntil = performance.now() + 4000; this.notice.hidden = false; }
  /** Refreshes race instruments at the HUD rate; result rows allocate only at race completion. */
  update(frame: RoomSnapshot, id: string, now: number): void {
    const me = frame.players.find(player => player.id === id); if (!me) return;
    this.bar.hidden = frame.phase === 'lobby'; this.results.hidden = frame.phase !== 'results';
    if (performance.now() > this.noticeUntil) this.notice.hidden = true;
    const finish = frame.checkpoints[frame.checkpoints.length - 1];
    const percent = Math.min(100, Math.max(0, me.validatedProgress / finish * 100));
    this.summary.textContent = 'P' + me.rank + ' / ' + frame.standings.length + '  ·  CP ' + me.checkpoint + '/' + frame.checkpoints.length
      + '  ·  ' + percent.toFixed(0) + '%  ·  ' + clock(frame.elapsedMs);
    this.progress.style.width = percent + '%';
    this.reset.textContent = me.finishMs !== null ? 'FINISHED · ' + clock(me.finishMs) + (frame.phase === 'results' ? '' : ' · Waiting for other riders')
      : frame.finishDeadlineAt > 0 ? 'FINISH WINDOW · ' + Math.max(0, Math.ceil((frame.finishDeadlineAt - now) / 1000)) + ' SEC'
      : now < me.resetAvailableAt ? 'RESET COOLDOWN · ' + Math.ceil((me.resetAvailableAt - now) / 1000) + ' SEC'
      : 'R · SAFE RESET (BRAKE BELOW 15 KM/H)';
    this.rematch.hidden = frame.hostId !== id;
    element('results-help').textContent = frame.hostId === id ? 'Return everyone to Ready in the same room.' : 'Waiting for host to return to the lobby.';
    if (frame.phase === 'results' && this.resultRound !== frame.roundId) {
      this.resultRound = frame.roundId; this.entries.clear(); this.rows.replaceChildren();
      for (const result of frame.standings) {
        const row = document.createElement('tr'); row.dataset.id = result.id;
        for (const value of [String(result.rank), result.nickname + (result.id === id ? ' (you)' : ''), result.finishMs === null ? 'DNF' : clock(result.finishMs), result.checkpoint + '/' + frame.checkpoints.length]) {
          const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
        }
        this.rows.append(row); this.entries.set(result.id, row);
      }
    }
  }
  /** Clears transient race displays when leaving a room. */
  hide(): void { this.bar.hidden = true; this.results.hidden = true; this.notice.hidden = true; this.resultRound = 0; this.rows.replaceChildren(); this.entries.clear(); }
  /** Releases owned DOM subscriptions and references. */
  dispose(): void { this.events.abort(); this.entries.clear(); }
}
