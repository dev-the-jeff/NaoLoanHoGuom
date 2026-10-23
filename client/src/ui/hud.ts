import { GAME_CONFIG as C } from '../../../shared/src/gameConfig'; import type { BikeState } from '../../../shared/src/contracts';
/** Requires a DOM node at startup instead of failing silently during animation. */
export function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Required UI element missing: ${id}`);
  return node as T;
}
/** Small DOM adapter; text updates are throttled by Game, never run at simulation tick rate. */
export class Hud {
  private readonly speed = element('speed');
  private readonly speedFill = element('speed-fill');
  private readonly nitro = element('nitro-value');
  private readonly nitroFill = element('nitro-fill');
  private readonly nitroStatus = element('nitro-status');
  private readonly distance = element('distance');
  private readonly status = element('ride-status');
  private readonly overlay = element('overlay');
  private readonly title = element('overlay-title');
  private readonly copy = element('overlay-copy');
  private readonly ride = element<HTMLButtonElement>('ride');
  private readonly pause = element<HTMLButtonElement>('pause');
  private readonly debug = element('debug');
  private readonly events = new AbortController();
  private networkDetails = '';
  private online = false;
  constructor(onRide: () => void, onPause: () => void) {
    this.ride.addEventListener('click', onRide, { signal: this.events.signal });
    this.pause.addEventListener('click', onPause, { signal: this.events.signal });
  }
  /** Reflects local pause/start state without injecting dynamic HTML. */
  setMode(mode: 'ready' | 'riding' | 'paused', online = false): void {
    this.online = online;
    this.overlay.hidden = mode === 'riding'; this.pause.disabled = mode === 'ready';
    if (mode === 'paused') { this.title.textContent = 'TAKE A BREATHER.'; this.copy.textContent = online ? 'The online session continues. Your bike brakes while this overlay is open.' : 'Local practice is paused. Resume when you’re ready.'; this.ride.textContent = 'RESUME RIDE ↗'; }
    if (mode === 'ready') { this.title.textContent = 'RIDE THE REDLINE.'; this.copy.textContent = 'Solo practice or a private room with colleagues. Three lanes, one canyon.'; this.ride.textContent = 'LET’S RIDE ↗'; }
    this.pause.textContent = mode === 'paused' ? 'RESUME [ESC]' : 'PAUSE [ESC]';
  }
  /** Displays measured state. Speed is converted from metres per second to km/h. */
  update(s: Readonly<BikeState>, fps: number, calls: number): void {
    this.speed.textContent = Math.round(s.speed * 3.6).toString().padStart(3, '0');
    this.speedFill.style.width = `${Math.min(100, s.speed * 3.6 / 190 * 100)}%`;
    this.nitro.textContent = Math.ceil(s.nitro).toString(); this.nitroFill.style.width = `${s.nitro}%`;
    this.distance.textContent = Math.floor(s.progress).toString().padStart(4, '0');
    this.status.textContent = s.progress >= C.trackLength - 2 ? (this.online ? 'FINISH STRAIGHT' : 'END OF PRACTICE · R TO RESTART') : s.contact ? 'BARRIER CONTACT · EASE OFF & STEER AWAY' : s.speed > 0.1 ? 'FIND YOUR LINE' : 'W / ↑ TO ACCELERATE';
    this.nitroStatus.textContent = s.boosting ? 'BOOST ACTIVE' : s.rechargeDelay > 0 ? 'COOLING · RECHARGE IN 2 SEC' : s.nitro < 100 ? 'RECHARGING · 15% / SEC' : 'SHIFT TO BOOST · 3 SEC BURST';
    if (!this.debug.hidden) this.debug.textContent = `ROAD RIOT M3\nFPS ${Math.round(fps)} | draws ${calls}\n120 Hz physics\nx ${s.x.toFixed(2)} m | s ${s.progress.toFixed(2)} m\nyaw ${s.heading.toFixed(2)} rad\n${this.networkDetails || 'Server: none'}`;
  }
  /** Changes the debug summary without rebuilding the HUD. */
  network(details: string): void { this.networkDetails = details; }
  /** Toggles developer telemetry only. */
  toggleDebug(): void { this.debug.hidden = !this.debug.hidden; }
  /** Detaches every owned UI event handler. */
  dispose(): void { this.events.abort(); }
}


