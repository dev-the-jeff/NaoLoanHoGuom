# ROAD RIOT — GDD & IMPLEMENTATION SPEC

**Version:** 0.1 (internal multiplayer prototype)  
**Date:** 2026-10-23  
**Language:** English for coding-agent precision  
**Status:** Approved scope baseline; tunable values are hypotheses, not playtest-validated  
**Project type:** Desktop browser 3D motorcycle combat racer, retro low-poly

> **Instructions for Codex:** Treat this file as the product specification and implementation backlog. Build incrementally, maintaining a runnable project after each milestone. Do not build the entire game in one pass. Start with **Milestone 1**, verify it, then proceed only when instructed. Ask only for essential external credentials or infrastructure. If anything is unspecified, choose the simplest maintainable option, record it in `DECISIONS.md`, and avoid scope expansion. Do not present untested features as working.

---

## 1. Product goal

A small, fun game for colleagues to play through a web link, inspired by the *mechanics* of classic motorcycle combat racing: **race and fight while riding**. The first internal prototype is not a commercial release.

- **Platform:** Desktop web (Chrome/Edge first), keyboard controls.
- **Distribution:** Static frontend on GitHub Pages; separate HTTPS/WSS-accessible Node.js multiplayer server.
- **Room:** 2–16 humans, max 16 per room; no minimum of 16 to start.
- **Modes:** One Free-for-All point-to-point race; private room code.
- **Map:** One simple low-poly point-to-point road with bends, obstacles, basic scenery; target 3–4 km of gameplay distance, tuned for ~2–3 minute matches.
- **Characters:** 3 selectable characters with one active ability each; common bike physics and stats.
- **Experience balance:** Approximately 60% racing / 40% combat, as a qualitative design direction, not a strict measurable ratio.
- **No accounts, persistent progression, item shop, database, ranked play, mobile support, or weapon pickups in v0.1.**
- **Legal/IP:** Original name, characters, track, models, sounds and UI. Do not reuse copyrighted Road Rash assets or branding.

### Design pillars
1. The bike must be enjoyable to drive even without opponents.
2. Attacks must matter without preventing racing for long stretches.
3. Joining a colleague's game must be fast and uncomplicated.
4. 16-player chaos must stay readable and performant.
5. Game is always playable from a standard browser without installing Unity or an executable.

---

## 2. MVP gameplay specification

### 2.1 Race

- Third-person follow camera, smooth and stable.
- Arcade driving: throttle, brake, steering, slight visual lean, speed cap, friction/drag, collisions. **Do not simulate motorcycle suspension or full wheel physics** in v0.1.
- Nitro temporarily boosts top speed; fixed resource, simple recovery rules.
- Road defined by reusable procedural sections/spline; bend, roadside props, basic collision barriers, race checkpoints.
- Single point-to-point route; no laps and no alternate routes required.
- Rank determined on server by furthest valid checkpoint and progress along track. Finish times are authoritative.
- Progress only counted after sequential checkpoints; respawn must not allow skipping checkpoints.
- After first finisher, 45-second finish window; others are ranked by progress if they do not finish. Tune after playtesting.

### 2.2 Initial tuning values

These are **prototype defaults**, adjustable via shared config. Internal movement units should be meters and seconds; HUD may show km/h.

| Parameter | Initial value | Notes |
|---|---:|---|
| Normal top speed | 160 km/h (~44.44 m/s) | Same for all characters |
| Nitro top speed | 190 km/h (~52.78 m/s) | Only while boosting |
| Nitro total burst | 3 seconds from full | 100 resource units; consumption 33.33 units/s |
| Nitro recharge | 15 units/s | Starts after 2 seconds without using boost |
| HP | 100 | Per bike/player |
| Left/right punch | 15 HP | Cooldown 0.7 s |
| Kick | 20 HP | Cooldown 1.2 s; narrower or longer tell |
| Fall | HP <= 0 | Play fall visual, interrupt controls |
| Recovery | 2.5 s | Reset to safe recent progress point |
| Respawn protection | 1.5 s | Cannot attack while invulnerable |
| Active race target | ~2–3 min | Track distance may be shortened/tuned if needed |
| Room capacity | 16 | Load-test before declaring supported |

**Driving feel parameters (acceleration, braking, friction, yaw gain, turn damping, hit impulse) must be kept in a centralized config and tuned empirically.** Do not hard-code untested numbers across systems.

### 2.3 Controls

| Input | Action |
|---|---|
| W / Arrow Up | Accelerate |
| S / Arrow Down | Brake |
| A / Arrow Left | Steer left |
| D / Arrow Right | Steer right |
| J | Punch left |
| L | Punch right |
| K | Kick (auto-select valid adjacent target; no arbitrary long-range hits) |
| Shift | Nitro (hold) |
| E | Character ability |
| R | Unstuck / reset to safe progress point, with anti-abuse restrictions |
| Esc | Pause overlay (race continues online) |

No advanced keybinding UI required for MVP. Prevent browser scrolling on game controls.

### 2.4 Combat

- Keep combat simple: left punch, right punch, kick. **No separate Stability/Instability system, guards, weapon pickups, weapons, or combo trees** in v0.1.
- Server validates the attack cooldown, target proximity, relative direction/side, and target vulnerability at the timestamp window it can safely verify.
- Initial suggested hit range: punch ~2.0m; kick ~2.4m; tune with model scale and latency.
- Attacks have animations/tells (simple procedural animation acceptable) and distinct successful-hit feedback.
- Successful hits subtract HP and apply a **small** server-controlled lateral/forward impulse; avoid huge physics explosions.
- At 0 HP, rider falls, waits 2.5 seconds, reappears at safe valid progress with full HP, and receives 1.5-second invulnerability. During invulnerability they cannot attack.
- Being knocked down does **not** eliminate a player.
- Prevent chain stun or unlimited knockdown loops with invulnerability and conservative knockback.
- On disconnect, handle vehicle safely without teleport exploits.

### 2.5 Characters

All characters use one bike physics setup, HP, max speed and basic attack values. Differences are confined to **one active ability**. No passive abilities in v0.1.

| Character | Theme | Ability (E) | Cooldown |
|---|---|---|---:|
| **REX** | Red aggressive brawler | Next successful punch or kick within 3 s deals 2x its normal HP damage; consumes buff on hit, does not stack | 15 s |
| **NOVA** | Yellow speedster | Acceleration boost for 3 s; obey normal/Nitro speed caps (doesn't raise cap) | 18 s |
| **BRICK** | Blue defensive rider | 50% damage reduction for 3 s | 20 s |

Abilities are authoritative on server. Same skeleton / animation rig, alternate simple low-poly appearances or colors. Selecting duplicates is allowed.

### 2.6 Visual direction

- Original **retro PS1-inspired low-poly 3D** visuals, but readable at speed.
- 1 generic motorcycle mesh/physics model; characters distinguished by rider colors/silhouettes.
- Procedural road, simple landscape, repeated props, low-resolution textures or solid colors.
- Minimal VFX: speed lines/nitro, hit flash, fall, simple skill visuals.
- Avoid costly dynamic shadows, complex ragdolls and large textures.
- Use basic primitives/placeholder meshes initially; polished art is not a blocker for networking tests.

### 2.7 Camera and HUD

- Follow camera behind and slightly above bike; smooth position and yaw; mild FOV increase during Nitro; optional mild shake on hits.
- HUD: speed (km/h), position X/16, checkpoint/progress, HP bar, Nitro bar, ability ready/cooldown, timer, concise hit/knockdown notifications.
- Main screens: nickname entry, room create/join, character select + ready, race, results/rematch.
- Make debug overlay toggleable (FPS, ping, tick/snapshot rates, room ID).

---

## 3. Online game flow and rules

1. Player opens GitHub Pages link and enters a nickname (guest session only).
2. Player creates a room and receives a short code, or joins with an existing code.
3. Player selects REX/NOVA/BRICK and marks Ready.
4. Room host starts with at least 2 connected players; ready requirements should be clear in UI.
5. Server sends authoritative countdown and race start timestamp.
6. Up to 16 participants race concurrently, attack, use abilities and checkpoint progress.
7. Players finish or time out 45 seconds after first finisher; server sends final standings.
8. Players can rematch in same room or leave.

**Disconnect:** for prototype, remove a disconnected player from active controls and allow a short reconnect window (~15 s) if session identity is retained. If reconnect is too complex for initial networking milestone, implement clean disconnect first and track reconnect as a later MVP task; never claim reconnect works unless tested.

**Room host:** Host can trigger the start, but game simulation does not run on host browser. If host leaves, transfer control to another connected player. Single-process in-memory room state is acceptable; all rooms disappear on server restart.

**Out-of-scope:** automatic matchmaking, bots, spectator, anti-grief moderation panel, dedicated account system, post-match persistence, voice chat.

---

## 4. Technical architecture

### 4.1 Stack

- **Language:** TypeScript throughout.
- **Build:** Vite.
- **3D client:** Three.js.
- **Realtime server:** Node.js + Colyseus (use compatible current package APIs; verify before implementing).
- **Rendering/physics:** Custom lightweight arcade movement; simple geometric collision / raycasts. Add a dedicated physics library **only if** the prototype demonstrates need.
- **UI:** plain HTML/CSS or lightweight DOM overlays (no React required).
- **Transport:** WebSockets via Colyseus, secure `wss://` for deployed HTTPS frontend.
- **Frontend hosting:** GitHub Pages, with correct Vite `base` for repo subpath.
- **Backend hosting:** any always-on or suitable Node.js host supporting persistent WebSocket connections and HTTPS/WSS termination.
- **Storage:** In-memory room/match state. No DB, Redis, queue or cloud asset pipeline.

**Critical deployment fact:** GitHub Pages only hosts static files. It cannot run the multiplayer game server. The GitHub Pages frontend must connect to a separately deployed backend. Do not attempt a production GitHub-Pages-only multiplayer solution.

### 4.2 Repo layout (suggested)

```text
road-riot/
  README.md
  ROAD_RIOT_GDD_CODEX.md
  DECISIONS.md
  package.json
  client/
    index.html
    vite.config.ts
    src/
      main.ts
      game/
        Game.ts
        BikeController.ts
        Track.ts
        Camera.ts
        CombatVisuals.ts
      network/
        MultiplayerClient.ts
      ui/
        hud.ts
        lobby.ts
      config/
        gameConfig.ts
  server/
    src/
      index.ts
      rooms/
        RaceRoom.ts
      simulation/
        RaceSimulation.ts
        Combat.ts
        Checkpoints.ts
      state/
        RaceState.ts
  shared/
    src/
      protocol.ts
      constants.ts
  .github/
    workflows/
      deploy-pages.yml
```

This is a suggested structure, not an obligation; keep actual structure coherent and documented.

### 4.3 Authoritative state

Server owns:
- Room membership, selected character, ready state and countdown.
- Valid bike position/heading, movement speed, damage, respawn.
- Attack cooldowns, skill activations/cooldowns, Nitro spend/recharge.
- Checkpoint completion, race progress, ranks, finish timestamps.

Clients send input (accelerate, brake, steer, punch/kick, Nitro, ability, reset) with input sequence numbers. Clients **must not** report authoritative damage, rank, velocity, checkpoint completion, or finish time. Client prediction and smooth interpolation are desirable, but add them in stages.

### 4.4 Synchronization starting targets

| Area | Starting target |
|---|---|
| Server simulation | 30 ticks/s |
| Client rendering | 60 FPS target on mid-range desktop |
| Client input send | ~20–30 Hz |
| State snapshots | ~10–20 Hz (optimize by testing) |
| Remote interpolation delay | ~100–150 ms |
| Room size | 16 players max |
| Online latency test | 50ms, 100ms, 150ms RTT plus jitter |

These are initial engineering targets. Measure bandwidth, jitter, server CPU and client FPS at 2, 4, 8 and 16 players. **Do not assert 16-player support based only on testing two browser tabs.**

### 4.5 Performance and safety

- Use instancing/reuse for static props, simple collisions and efficient per-tick allocations.
- Never render 16 high-poly animated models in v0.1.
- One backend process first; per-room simulation state isolated.
- Basic validation of nickname, room code, payload sizes, input rate and movement limits.
- Prevent rapid attack/ability spam and invalid checkpoint skips.
- Validate UI inputs and avoid `innerHTML` on unsanitized strings.
- Graceful errors: server offline, room full, room not found, connection lost.
- Avoid logging session tokens in shared logs.

---

## 5. First-pass design of track

Create **one** point-to-point track with these sections:

1. **Start straight:** wide, safe acceleration, initial separation.
2. **Gentle bends:** learn steering and side-by-side combat.
3. **Obstacle segment:** static roadside props and a few telegraphed obstacles.
4. **Tighter curves:** reward driving skill, with barriers preventing route skips.
5. **Finish straight:** space for overtakes and Nitro.

For first implementation, build a looping *set of procedural road segments* visually but define a single continuous race-progress spline and unique ordered checkpoints. Final game route should be point-to-point, **not a lap circuit**. No traffic AI is required in v0.1. Target 3–4 km is aspirational; shorter placeholder map is fine in Milestone 1, but final prototype should target ~2–3 minute races under realistic speed/turn tuning.

---

## 6. Scope control

### MUST HAVE v0.1

- Desktop browser build hosted as static site.
- Drivable 3D motorbike with arcade handling, follow cam, Nitro.
- One low-poly point-to-point road with checkpoints.
- 3 selectable characters and 3 active abilities.
- Punch left/right + kick; HP/damage/fall/respawn.
- Private room code, nickname, ready/start, rematch.
- Server-authoritative racing and basic combat state.
- Up to 16 players in a single room **once load testing passes**.
- HUD, finish rankings, simple in-game feedback.
- Basic local run instructions and deploy setup.

### DO NOT BUILD v0.1

- Unity project, React UI architecture unless strong need, mobile controls.
- More than one map, ranked/MMR, persistent database, login/auth.
- Multiple bike classes, upgrades, cosmetics shop, progression.
- Passive character skills, weapons, collectible items, combo fighting.
- Police chases, weather, day/night, procedural open world, vehicle traffic AI.
- Voice chat, replay, tournament, analytics backend, microservices.

---

## 7. Implementation milestones / executable backlog

### M1 — Local single-player riding (**start here**)

**Tasks**
- Scaffold TypeScript + Vite + Three.js web client, with a single top-level dev command.
- Display low-poly bike mesh on simple road with environment primitives.
- Implement throttle/brake/steering and arcade camera.
- Add Nitro and minimal speed/nitro HUD.
- Build a small playable road segment; implement collision with simple barriers.
- Document how to run locally and test basic keyboard controls.

**Acceptance**
- `npm install` / appropriate package install and documented start command work.
- Browser shows one controllable bike, no console errors in normal use.
- Steering and boost feel functional; bike doesn't fall through ground or clip through barriers in ordinary driving.
- No server required to test M1.

**Stop after M1 and report:** implemented files, commands, verification results, known issues, suggested tuning points. Do not silently implement M2+.

### M2 — Room + multiplayer movement

**Tasks**
- Add Colyseus server with in-memory room and guest nickname.
- Room create/join by short code, lobby and ready flow.
- Add 2-player synced movement, then test 4/8/16.
- Server-side movement, fixed tick, snapshots, client interpolation/prediction as appropriate.
- Error UI for full/missing room and disconnect.

**Acceptance**
- Two devices/browsers can join same room and each sees the other's bike.
- Host starts race; countdown consistent.
- No duplicate control authority; consistent positions within tested latency.
- 16 players supported only after explicit multiplayer load test.

### M3 — Track / checkpoints / finish

**Tasks**
- Complete one point-to-point track from sections.
- Server checkpoint sequencing and rankings, finish timestamps, timeout.
- Respawn/unstuck safe position; HUD progress and final leaderboard.

**Acceptance**
- Player cannot exploit a shortcut to finish without checkpoints.
- All clients receive the same finishing order.
- Match can complete and restart.

### M4 — Combat + health + recovery

**Tasks**
- Add server-valid left/right punch and kick.
- Add attack cooldown, range/direction tests, HP, hit feedback.
- Add knockdown, recovery, respawn invulnerability.

**Acceptance**
- Legit adjacent attacks hit, distant attacks do not.
- Health and falls match on all players' screens.
- No infinite knockdown loop on respawn.

### M5 — Characters / abilities

**Tasks**
- Character selection in lobby; shared meshes/rig or simple color distinction.
- REX next-hit double damage, NOVA acceleration, BRICK temporary defense.
- Server cooldown and effect expiration; HUD feedback.

**Acceptance**
- Each ability activates, expires and cools down properly.
- Identical base vehicle physics across characters.

### M6 — Internal deployment and polish

**Tasks**
- Add GitHub Pages build workflow, configure Vite base path and endpoint env variable.
- Deploy Node server separately; verify secure WebSocket on live domain.
- Tune controls, camera, attacks; simple audio/VFX and performance settings.
- Test cross-device, room full, disconnect, finish and rematch.
- Document setup and troubleshooting for company playtest.

**Acceptance**
- Colleagues open a URL, enter nickname, join by code, race and fight through full match.
- Measure 16-player load with client FPS, server tick stability, bandwidth and errors.
- A match can finish and restart without restarting server.

---

## 8. Definition of done — internal playtest

- A stable URL serves the client from GitHub Pages.
- A separately hosted multiplayer server is reachable over WSS.
- 2–16 people can join a room; 16-player target is **demonstrated in a test**, not assumed.
- Players can select one of 3 characters, join lobby, race and attack.
- Attacks, HP, respawns, abilities, checkpoints and finish positions are resolved server-side.
- One 2–3 minute point-to-point race runs to results without a critical game-breaking bug.
- Users do not need to install Unity, a desktop executable or create a user account.
- README includes local setup, environment variables, GitHub Pages deployment, multiplayer backend deployment, and known limitations.

## 9. Specific test cases

1. Solo local steering, turning, braking and Nitro recharge.
2. 2 browsers in same room, movement synchronized.
3. Full room prevents 17th player from joining with clear message.
4. Same nickname in room still maps to unique session identity.
5. Wrong room code shows human-readable error.
6. Punch left cannot hit targets only on right or out of range.
7. Kick/punch spam cannot bypass cooldown.
8. BRICK damage reduction applied by server; REX buff consumed correctly.
9. NOVA acceleration boost never bypasses configured speed cap.
10. Knocked-down players get protected respawn and cannot instantly attack.
11. Players cannot skip checkpoint order or finish via shortcut.
12. Finish order identical on all clients under concurrent arrivals.
13. Disconnect, browser refresh and server restart fail gracefully.
14. Multiplayer remains playable under simulated 100–150ms RTT and jitter; document limitations.
15. 16-player test reports observed FPS, server tick and network throughput.
16. HTTPS GitHub Pages client successfully connects to WSS server.

---

## 10. Non-goals / decisions awaiting evidence

- No player retention, monetization, extensive balancing, or complex production systems yet.
- Refine map length after test-driving; 3–4 km and 2–3 minutes are goals that may conflict under actual average speed.
- Reconnect within 15 seconds is desirable but may be deferred if it threatens the first stable internal test.
- If 16 people stress browser performance, prioritize reliable sync and visually simple meshes before adding any visual effects.
- If authoritative collision becomes hard to implement with Colyseus, document alternative implementation options rather than silently giving authority to clients.

## 11. Codex execution instructions — first session

1. Read this entire specification and inspect existing repository before editing.
2. Provide a *brief* plan for **M1 only**.
3. Build M1 with minimal dependencies, modular TypeScript and runnable development scripts.
4. Use placeholder/primitive 3D assets and procedural track geometry; do not wait for artist assets.
5. Execute available build/typecheck/lint/tests; fix errors found.
6. Update README with exact run instructions and control mapping.
7. Summarize implementation, what was actually tested, limitations and next milestone.
8. Do not claim the multiplayer game is complete until M2–M6 are implemented and verified.

**Suggested first Codex message:**

> Implement Milestone M1 of `ROAD_RIOT_GDD_CODEX.md` in this repository. Follow its architecture and scope constraints. Run the project checks and report the exact commands and results. Do not start M2 until M1 is ready for review.
