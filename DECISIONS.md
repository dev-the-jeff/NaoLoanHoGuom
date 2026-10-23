# Decisions — M1

- Scope is the M1 tasks/acceptance of ROAD_RIOT_GDD_CODEX.md, not its entire v0.1 backlog. No Colyseus dependencies, server folder, room UI, combat, ability or checkpoint stubs.
- Browser-native TypeScript/Vite/Three.js and plain HTML/CSS follow the requested stack. Unity-specific Odin/DOTween/UniTask guidance has no direct counterpart in a browser project; composition, centralized config, explicit interfaces, allocation-conscious updates and resource cleanup are retained.
- The project lives under outputs/road-riot so the deliverable is self-contained. Shared interfaces sit under shared/src; a later server can reuse pure movement code without importing Three.js. No data-access layer exists in M1, so a repository abstraction would be unnecessary.
- Road uses an analytic X curve over longitudinal distance with 4 m tessellation, not an external spline package. Visual geometry and analytic collision use the same centre function. The 1.1 km closed practice route is not a loop and does not implement race validation.
- Browser smoke testing showed the first 90 m straight was too short for a comfortable acceleration/Nitro tutorial; it was extended to 220 m. This is a test-driven prototype default, not playtest-proven balance.
- Fixed 120 Hz movement, capped 100 ms wall-clock frame delta, flat-ground constraint and 1.6 m conservative collision radius prevent ordinary tunnelling and keep the complete primitive bike inside barriers. This is intentionally conservative, not a detailed collider.
- Movement is forward-only with limited relative yaw. Barrier impact slows the bike and deflects heading into the road tangent, avoiding a low-speed steering trap found by testing. Public step rejects invalid/oversized dt; Game owns accumulation.
- Nitro requires throttle and no brake; partial last ticks spend only remaining fuel. No recharge for 2 seconds after actual boost use. Holding Shift on an empty tank can consume newly recovered fuel; release Shift to recharge fully.
- Local pause is real pause; blur/hidden tab pauses and clears keys to avoid background movement. R restarts the practice run, not a safe-progress online respawn. Online pause/reset policy is deferred.
- Three.js setAnimationLoop owns rendering; repeated props are InstancedMesh objects. No object spawns happen in normal frames. DOM/string formatting is throttled to 10 Hz and telemetry is hidden by default. No dynamic shadows, large textures or animation libraries are needed.
- No deployment or hosting was performed. Vite base './' keeps built assets relocatable for local static previews; GitHub Pages workflow and multiplayer backend deployment remain M6.
- Exact dependency versions and lockfile are committed in the artifact. Node 24.22.1 and installed Edge/Chrome are the local verification environment. Test software WebGL FPS is not a desktop GPU benchmark.
- Windows sandbox initialization failed; approved standalone commands and bundled Node were used. Controlled Folder Access additionally prevented initial Documents writes; after user consent, the Codex PowerShell and bundled Node executables were allowed. Automatic review rejected adding the system Node executable; no workaround to that rejection was attempted. README provides a session-only bundled-runtime PATH command.

- Final screenshot QA found speed-dependent camera lag shrinking the bike. Velocity feed-forward now compensates chase-camera lag; production browser smoke test was rerun after this change.

## Speed feel adjustment — 2026-10-23

User feedback: >100 km/h did not feel fast; roadside scenery should pass more noticeably.

- Keep metre/second simulation and 160/190 km/h caps unchanged. Increase near-field optic flow instead of moving road geometry independently from collision.
- Roadside post interval 16 m -> 4 m; add alternating 2.5 m rumble markers and small rocks immediately beyond rails; bring some cacti closer. Two added static instanced draw calls.
- Smoothly lower camera from 4.3 m to 2.8 m, move follow distance 10 m -> 8.5 m and widen FOV 64 -> 77 with speed, 83 during Nitro. Velocity compensation remains active.
- 48 subtle peripheral speed lines above 60 km/h, one draw call; preallocated typed arrays are updated in place, no spawned objects. Effects hide while paused/stationary and when reduced motion is requested. Existing Resources owner disposes all buffers/materials during teardown/HMR.
- No change to steering, collision, Nitro budget/recharge or milestone scope.

## M2 — private multiplayer and one extra lane

- Explicit user authorization now includes M2. Road expanded from 2 to 3 lanes, keeping the original 7 m lane width; geometry, rails, props and analytic collision bounds share the widened config. M3+ remain out of scope.
- Shared pure config, road and controller moved to shared/src. Browser-only shims keep M1 imports stable. Backend owns movement; online clients use interpolated snapshots and never run their solo integrator on online state.
- Colyseus versions verified against installed declarations/source: core 0.18.23, SDK 0.18.6, WebSocket transport 0.18.4. Full bounded snapshots use Colyseus MsgPack messages at 15 Hz, without Schema decorators. The tradeoff is higher bandwidth than delta snapshots, measured rather than assumed in the load report.
- 30 Hz authoritative ticks use four existing 120 Hz physics substeps. Each guest sends only sequenced intent at 30 Hz using an owned timer independent of renderer FPS. Remote/local online views interpolate at 100 ms; local prediction is deferred until measured latency/feel warrants its complexity.
- Load testing caught a Colyseus clock initialization interaction: setting patchRate=null as a class field started an extra clock timer before fixed simulation existed. Set patchRate=null after setFixedTimestep() to clear the old patch timer without starting another. No library internals were patched; regression is checked by actual observed tick rate.
- Six-character cryptographic random private room IDs, 16 seats, server-validated guest names and readiness, host-only start, common 3 s start timestamp, host transfer, immediate disconnect removal. Room state is isolated and auto-disposes when empty. Duplicate names are safe because identity uses unique sessions.
- Strict input whitelist rejects position/velocity fields, nonfinite values, invalid axis range and stale sequences. Tick count depends on server time, not packet volume. Per-input rate and framework per-client message limits apply; websocket and HTTP JSON payload caps are 1 kB. No claims of production anti-cheat or public-service abuse resistance.
- R is disabled online rather than providing an exploitable reset without checkpoint validation. Esc/blur sends braking intent and clears keys while the online session continues. Stale intent brakes after 300 ms. No fake checkpoints/finish times were added.
- Initial clean disconnect is implemented; reconnect and late joins are deliberately deferred. Online rooms lock at countdown. No spectator, gameplay bots or auto-matchmaking.
- Remote bike slots are pooled across joins/leaves. Static bike parts merge per material; indexed and nonindexed primitives are normalized before merge. All meshes/materials/buffers remain under Game lifecycle ownership.
- LAN dev binds frontend and backend to 0.0.0.0. Endpoint defaults to the browser hostname on port 2567, with a VITE_SERVER_URL override for future WSS hosting. No firewall/security policy changes or public deployments were performed for M2.
- Tests distinguish SDK load, two independent browser processes, and one browser rendering 16 participants. These do not imply a successful 16-device/WAN playtest. CPU metrics come from a separate backend process; jitter proxy preserves reliable frame order.

## M3 — course, authority and race lifecycle

- User authorized continuing M3. Existing M1/M2 remains; M4 combat/HP and M5 abilities are not implemented.
- Reusable smoothstep sections total 3400 m. Nine gates end at 3350 m, with 50 m runoff. Shared roadworks collision coordinates and telegraph cones; all props cover the full route.
- Checkpoints validates bounded swept forward movement and only the next expected gate. Clients cannot submit position/checkpoint/results. Finish timing interpolates the 120 Hz substep, with grid tie-breaking.
- First finish opens 45 seconds; all finishing ends immediately. Remaining entrants become DNF by checkpoint/progress. Five-minute hard timeout prevents idle races. Results freeze until rematch.
- Safe R requires speed below 4 m/s, cooldown 8 seconds, behind last completed gate in assigned lane, never forward; preserves fuel/recharge/checkpoint sequence. This is M3 unstuck, not M4 combat recovery.
- Host rematch preserves room/session, resets Ready/grid/fuel/race, increments roundId. Delayed old-round commands are rejected. Interpolation clears on round change, snaps on resetVersion.
- CanvasTexture signs are owned/disposed by Resources. Short test rules injected via trusted server factory; no matchmaking option selects them.
- Real-socket automated driving finished in 78 seconds without Nitro, not human balance validation. The GDD 2–3 minute aspiration remains unverified; accepted speed feel/caps are preserved.
- Full snapshots including standings increase 16-guest aggregate downstream to ~1.39 MB/s. Delta snapshots are a future optimization; local SDK load is not WAN/GPU certification.
