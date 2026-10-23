import * as THREE from 'three';
import { GAME_CONFIG as C } from '../config/gameConfig';
import type { BikeState } from '../../../shared/src/contracts';
import { NET_CONFIG as N } from '../../../shared/src/protocol';
import type { RoomSnapshot } from '../../../shared/src/protocol';
import { Road } from './Road';
import { Track } from './Track';
import { Resources } from './Resources';
import { BikeController } from './BikeController';
import { BikeView } from './BikeView';
import { FollowCamera } from './Camera';
import { SpeedLines } from './SpeedLines';
import { RemoteBikes } from './RemoteBikes';
import { KeyboardInput } from './KeyboardInput';
import { MultiplayerClient } from '../network/MultiplayerClient';
import { Hud, element } from '../ui/hud';
import { RaceHud } from '../ui/RaceHud'; import { Lobby } from '../ui/lobby';
/** Composition root. Solo integrates locally; online rendering only samples server-owned state. */
export class Game {
  private readonly resources = new Resources();
  private readonly scene = new THREE.Scene();
  private readonly road = new Road();
  private readonly bike = new BikeController(this.road);
  private readonly display: BikeState = { ...this.bike.state };
  private readonly view = new BikeView(this.resources);
  private readonly camera = new FollowCamera();
  private readonly speedLines = new SpeedLines(this.resources);
  private readonly remotes = new RemoteBikes(this.resources);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly input: KeyboardInput;
  private readonly hud: Hud;
  private readonly lobby: Lobby; private readonly raceHud: RaceHud; private roundId = 0; private resetVersion = -1;
  private readonly network: MultiplayerClient;
  private readonly canvas = element<HTMLCanvasElement>('game');
  private mode: 'ready' | 'riding' | 'paused' = 'ready';
  private online = false;
  private previousTime = 0;
  private accumulator = 0;
  private hudElapsed = 0;
  private fps = 60;
  private disposed = false;
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, C.maxPixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0xd4b68e); this.scene.fog = new THREE.Fog(0xd4b68e, 90, 440);
    this.scene.add(new THREE.HemisphereLight(0xffeed0, 0x6c6256, 2.2));
    const sun = new THREE.DirectionalLight(0xffd0a0, 2.4); sun.position.set(-80, 110, 30); this.scene.add(sun);
    this.scene.add(new Track(this.road, this.resources).root, this.view.root, this.remotes.root);
    this.camera.camera.add(this.speedLines.root); this.scene.add(this.camera.camera);
    this.hud = new Hud(this.resume, this.togglePause);
    this.input = new KeyboardInput(this.togglePause, this.restart, () => this.hud.toggleDebug());
    this.network = new MultiplayerClient({ snapshot: this.onSnapshot,
      disconnected: message => { this.offline(); this.lobby.disconnected(message); }, notice: message => { this.lobby.setNotice(message); this.raceHud.setNotice(message); } });
    this.lobby = new Lobby({ connect: (action, nickname, code) => this.network.connect(action, nickname, code),
      ready: value => this.network.ready(value), start: () => this.network.start(), leave: () => { this.network.leave(); this.offline(); },
      opened: () => { if (this.mode === 'riding') this.pause(); } });
    this.raceHud = new RaceHud(() => this.network.rematch(), () => { this.network.leave(); this.offline(); this.lobby.reset(); });
    window.addEventListener('resize', this.resize); window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility); this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.resize(); this.view.update(this.bike.state, 0, 0); this.camera.update(this.bike.state, 0, true);
    this.hud.setMode(this.mode); this.hud.update(this.bike.state, this.fps, 0);
    this.renderer.setAnimationLoop(this.frame);
  }
  private readonly onSnapshot = (frame: RoomSnapshot): void => {
    const room = this.network.room; if (!room) return;
    if (!this.online) {
      this.online = true; this.mode = 'riding'; this.accumulator = 0; this.input.clear(); this.hud.setMode(this.mode, true);
      this.network.buffer.sample(room.sessionId, this.display, this.network.serverNow()); this.camera.update(this.display, 0, true);
      const me = frame.players.find(player => player.id === room.sessionId); if (me) this.view.tint(me.color);
    }
    const local = frame.players.find(player => player.id === room.sessionId);
    if (local && (this.roundId !== frame.roundId || this.resetVersion !== local.resetVersion)) {
      this.roundId = frame.roundId; this.resetVersion = local.resetVersion; this.input.clear(); this.network.stopInput();
      Object.assign(this.display, local); this.camera.update(this.display, 0, true);
      if (frame.phase === 'lobby') { this.mode = 'riding'; this.hud.setMode(this.mode, true); }
    }
    this.raceHud.update(frame, room.sessionId, this.network.serverNow());
    this.canvas.dataset.round = String(frame.roundId); this.canvas.dataset.checkpoint = String(local?.checkpoint ?? 0);
    this.canvas.dataset.rank = String(local?.rank ?? 0); this.canvas.dataset.resetVersion = String(local?.resetVersion ?? 0);
    this.remotes.roster(frame, room.sessionId); this.lobby.update(frame, room.sessionId);
    element('session-text').textContent = `ROOM ${frame.roomId} / ${frame.players.length} RIDERS`;
    this.canvas.dataset.startsAt = frame.startsAt.toString(); this.canvas.dataset.phase = frame.phase; this.canvas.dataset.room = frame.roomId;
  };
  private offline(): void {
    this.raceHud.hide(); this.roundId = 0; this.resetVersion = -1; this.online = false; this.mode = 'ready'; this.remotes.clear(); this.bike.reset(); this.input.clear(); this.accumulator = 0;
    this.view.tint(0x28c4bd); this.hud.setMode(this.mode); this.hud.network('');
    this.view.update(this.bike.state, 0, 0); this.camera.update(this.bike.state, 0, true);
    element('session-text').textContent = 'LOCAL RIDING / 3 LANES'; this.canvas.dataset.phase = 'solo'; this.canvas.dataset.room = '';
  }
  private readonly resume = (): void => { this.mode = 'riding'; this.accumulator = 0; this.input.clear(); this.hud.setMode(this.mode, this.online); };
  private pause(): void { this.mode = 'paused'; this.accumulator = 0; this.input.clear(); this.network.stopInput(); this.hud.setMode(this.mode, this.online); }
  private readonly togglePause = (): void => { if (this.mode === 'ready') return; if (this.mode === 'riding') this.pause(); else this.resume(); };
  private readonly restart = (): void => {
    if (this.online) { this.input.clear(); this.network.reset(); return; }
    this.bike.reset(); this.input.clear(); this.accumulator = 0; this.view.update(this.bike.state, 0, 0); this.camera.update(this.bike.state, 0, true);
    this.hud.update(this.bike.state, this.fps, this.renderer.info.render.calls);
  };
  private readonly onBlur = (): void => { if (this.mode === 'riding') this.pause(); };
  private readonly onVisibility = (): void => { this.previousTime = 0; if (document.hidden) this.onBlur(); };
  private readonly onContextLost = (event: Event): void => {
    event.preventDefault(); this.pause(); this.network.leave(); this.renderer.setAnimationLoop(null);
    element('error-message').textContent = 'Graphics context was lost. Reload to restart.'; element('error').hidden = false;
  };
  private readonly resize = (): void => { this.renderer.setSize(window.innerWidth, window.innerHeight); this.camera.resize(window.innerWidth, window.innerHeight); };
  private readonly frame = (time: number): void => {
    if (this.disposed) return;
    const delta = this.previousTime === 0 ? 0 : Math.min(C.maxFrameDelta, Math.max(0, (time - this.previousTime) / 1000)); this.previousTime = time;
    if (delta > 0) this.fps += (1 / delta - this.fps) * 0.05;
    const frame = this.network.buffer.latest();
    const onlineRacing = this.online && frame?.phase === 'racing';
    let state = this.bike.state;
    if (this.online && this.network.room) {
      this.network.update(this.input.state, this.mode === 'riding' && onlineRacing);
      const sampleTime = this.network.serverNow() - N.interpolationMs;
      this.network.buffer.sample(this.network.room.sessionId, this.display, sampleTime);
      this.remotes.update(this.network.buffer, sampleTime, delta); state = this.display;
    } else if (this.mode === 'riding') {
      this.accumulator += delta;
      while (this.accumulator >= C.fixedStep) { this.bike.step(this.input.state, C.fixedStep); this.accumulator -= C.fixedStep; }
    }
    const moving = this.online ? onlineRacing : this.mode === 'riding';
    this.view.update(state, moving ? delta : 0, moving ? this.input.state.steer : 0);
    this.camera.update(state, delta, false, moving); this.speedLines.update(state.speed, delta, this.camera.camera, moving);
    this.renderer.render(this.scene, this.camera.camera);
    this.hudElapsed += delta;
    if (this.hudElapsed >= C.hudInterval) {
      this.hudElapsed = 0;
      this.hud.network(this.online && frame ? `Room ${frame.roomId} | ${frame.players.length}/16 riders\nPing ${Math.round(this.network.ping)} ms | tick ${frame.tickRate} Hz | snapshots ${frame.snapshotRate} Hz\nInterpolation ${N.interpolationMs} ms | authoritative server\n${frame.phase === 'countdown' ? `START IN ${Math.max(0, Math.ceil((frame.startsAt - this.network.serverNow()) / 1000))}` : frame.phase}` : 'Server: none');
      if (this.online && frame && this.network.room) this.raceHud.update(frame, this.network.room.sessionId, this.network.serverNow()); this.hud.update(state, this.fps, this.renderer.info.render.calls); this.lobby.clock(this.network.serverNow());
      const countdown = element('race-countdown'); countdown.hidden = !this.online || frame?.phase !== 'countdown';
      if (frame?.phase === 'countdown') countdown.textContent = Math.max(1, Math.ceil((frame.startsAt - this.network.serverNow()) / 1000)).toString();
      this.canvas.dataset.progress = state.progress.toFixed(2); this.canvas.dataset.x = state.x.toFixed(2);
      this.canvas.dataset.remoteCount = this.remotes.count().toString(); this.canvas.dataset.remoteProgress = this.remotes.firstProgress().toFixed(2);
      this.canvas.dataset.fps = this.fps.toFixed(1); this.canvas.dataset.drawCalls = this.renderer.info.render.calls.toString();
    }
  };
  /** Stops network membership, render loop, subscriptions, pooled instance buffers and unique GPU assets. */
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.renderer.setAnimationLoop(null); this.network.leave(); this.input.dispose(); this.hud.dispose(); this.lobby.dispose(); this.raceHud.dispose();
    window.removeEventListener('resize', this.resize); window.removeEventListener('blur', this.onBlur); document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.scene.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose(); });
    this.resources.dispose(); this.scene.clear(); this.renderer.dispose();
  }
}

