import './style.css';
import { Game } from './game/Game';
import { element } from './ui/hud';
let game: Game | undefined;
const reload = (): void => window.location.reload();
element('reload').addEventListener('click', reload);
try { game = new Game(); }
catch (error: unknown) {
  element('error-message').textContent = error instanceof Error ? error.message : 'Graphics initialization failed.';
  element('error').hidden = false;
}
const dispose = (): void => { game?.dispose(); element('reload').removeEventListener('click', reload); window.removeEventListener('beforeunload', dispose); };
window.addEventListener('beforeunload', dispose);
if (import.meta.hot) import.meta.hot.dispose(dispose);
