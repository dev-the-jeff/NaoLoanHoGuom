import type { RidingInput } from '../../../shared/src/contracts';
const CONTROL_KEYS = new Set(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyR','Escape','F3']);
/** Owns keyboard listeners and clears held keys when browser focus is lost. */
export class KeyboardInput {
  readonly state: RidingInput = { throttle: false, brake: false, steer: 0, nitro: false };
  private readonly keys = new Set<string>();
  constructor(private readonly onPause: () => void, private readonly onReset: () => void, private readonly onDebug: () => void) {
    window.addEventListener('keydown', this.onDown); window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.clear);
  }
  private readonly onDown = (event: KeyboardEvent): void => {
    if (!CONTROL_KEYS.has(event.code)) return;
    if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    event.preventDefault();
    if (!event.repeat) {
      if (event.code === 'Escape') this.onPause();
      if (event.code === 'KeyR') this.onReset();
      if (event.code === 'F3') this.onDebug();
    }
    this.keys.add(event.code); this.refresh();
  };
  private readonly onUp = (event: KeyboardEvent): void => {
    if (CONTROL_KEYS.has(event.code)) event.preventDefault();
    this.keys.delete(event.code); this.refresh();
  };
  private refresh(): void {
    const k = this.keys; const s = this.state;
    s.throttle = k.has('KeyW') || k.has('ArrowUp'); s.brake = k.has('KeyS') || k.has('ArrowDown');
    s.steer = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft'));
    s.nitro = k.has('ShiftLeft') || k.has('ShiftRight');
  }
  /** Clears transient input without replacing the shared state object. */
  readonly clear = (): void => { this.keys.clear(); this.refresh(); };
  /** Removes every owned browser listener. */
  dispose(): void {
    window.removeEventListener('keydown', this.onDown); window.removeEventListener('keyup', this.onUp); window.removeEventListener('blur', this.clear); this.clear();
  }
}

