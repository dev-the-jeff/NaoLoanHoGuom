# M2 verification — 2026-10-23 (Asia/Saigon)

## Scope and environment

M2 plus one additional lane: three 7 m lanes, private-room movement. No M3 checkpoints/finish logic, combat, HP, abilities or deployment. Windows desktop; bundled Node 24.22.1, npm 11.19.0; Colyseus core 0.18.23 / SDK 0.18.6 / ws-transport 0.18.4, Three.js 0.186.1, Vite 8.3.5, Playwright 1.64.1. Exact dependencies are pinned in package-lock.json. Runtime workaround is in README; no M2 firewall/security settings were changed.

## Commands actually executed

| Command | Result |
| --- | --- |
| `npm ci` in a clean source copy under work/m2-clean | Passed: 258 installed packages, 0 audit vulnerabilities |
| `npm run dev` after clean install (CLIENT_PORT=5174, PORT=2569) | Both frontend and watched backend launched via one top-level command; frontend HTTP 200, backend health HTTP 200. This isolated test was stopped; original preview kept running |
| `npm run typecheck` | Passed strict TypeScript check including client, shared, server and test tooling |
| `npm run lint` | Passed, zero ESLint warnings |
| `npm test` | 27 passed: 16 original riding tests, 8 authority/protocol/interpolation tests, 3 real Colyseus integration scenarios |
| `npm run build` | Passed; frontend output generated, server TypeScript typechecked and exercised through tsx runtime |
| `npm run check` | Passed; repeated after final derived lane-width/grid refactor (same numeric tuning) |
| `TEST_PRODUCTION=1 PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` | 5 passed in 56.6 s; Windows PowerShell equivalent in README |
| `npm run test:load` | Passed all 7 local profiles; exact per-profile data in verification/m2-load.json |

The successful commands used the approved bundled Node executable to invoke npm-cli.js directly. npm.cmd can select the blocked system Node on this machine. npm emitted optional install-script approval warnings for esbuild/msgpackr-extract; their available fallback/prebuilt paths worked without changing security settings. Existing Vite >500 kB chunk warning and test-runner NO_COLOR/FORCE_COLOR environment warnings remain non-fatal.

## Verified behavior

- Three-lane surface, lane dividers, barriers, roadside markers and collision limits use the same width. All 16 server-assigned grid positions are distinct and inside the road.
- Real SDK clients join by private code, accept duplicate guest names with distinct identities, Ready, and start only with host permission plus 2+ connected participants all Ready.
- Host permission and phase gates are enforced on server; a pending seat is rejected if it arrives after countdown starts. A common server startsAt timestamp was compared in two browser processes.
- Client inputs contain sequenced throttle/brake/steer/Nitro only. Invalid types, nonfinite values, authoritative position fields, stale sequences and excessive intent rate are rejected. Packet volume does not advance physics. Inputs time out to braking after 300 ms.
- Chrome and Edge independently create/join the same room, see each other’s rendered bikes, drive via keyboard, observe remote movement, pause locally without stopping online simulation, and transfer host when the original host leaves.
- Browser position comparisons account for background-window RAF throttling: compare server-derived rendered endpoints after foreground resumes and the observed vehicle has stopped, within 1 m. Active rendered remote movement is also asserted during the 16-member scenario. Canonical positions are compared exactly at matching ticks in real SDK integration/load tests.
- Wrong/missing room, unreachable backend and browser-context offline/disconnect produce explicit join/error UI. Unexpected disconnect removes the remote bike; no retained ghost membership. Automatic reconnect and late rejoin are deliberately not claimed.
- Solo keyboard riding, Nitro, barrier containment, focus pause, reset and resize regression still passes. No unexpected console/page errors in normal successful solo/two-browser flows; error tests intentionally provoke failed connections.
- Original preview left running at frontend port 5173 and backend 2567. Test-owned alternate-port frontend/backend/proxies cleaned up.

## Local backend load measurements

A **separate backend process** ran on loopback port 2568. Each baseline profile drove 2/4/8/16 real SDK connections for about 10 seconds after countdown; RTT profiles used two guests for about 8 seconds. The ordered WebSocket proxy applied the requested nominal RTT and bounded jitter (20 ms width per-direction scheduling). Snapshot frequency counts actual received message events rather than polling the latest frame. Every profile reported zero unexpected room errors and matching canonical positions for a common server tick.

Bandwidth below is aggregate actual binary WebSocket payload bytes divided by duration, in decimal kB/s; HTTP setup, TCP/TLS and WebSocket frame overhead are excluded. CPU is backend-only process.cpuUsage(), percent of one logical core, with short-window Windows sampling limitations. These are short local measurements, not a long soak or WAN certification.

| Guests | Nominal RTT / jitter (ms) | Tick Hz | Snapshot Hz | Tick p95 ms | CPU % one core | Down kB/s | Up kB/s | RTT median / p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 0 ± jitter 0 | 30,02 | 14,95 | 0,069 | 1,56 | 13,7 | 2,1 | 0 / 1 |
| 4 | 0 ± jitter 0 | 30,02 | 15,02 | 0,057 | 1,07 | 45,7 | 4,2 | 0 / 4 |
| 8 | 0 ± jitter 0 | 30,05 | 14,96 | 0,044 | 0,32 | 163,9 | 8,5 | 0 / 1 |
| 16 | 0 ± jitter 0 | 30,03 | 15,06 | 0,064 | 2,18 | 627,3 | 17,0 | 1 / 1 |
| 2 | 50 ± jitter 20 | 30,02 | 14,90 | 0,020 | 0,00 | 13,5 | 2,1 | 76 / 94 |
| 2 | 100 ± jitter 20 | 30,03 | 15,08 | 0,021 | 0,00 | 13,6 | 2,1 | 121 / 124 |
| 2 | 150 ± jitter 20 | 29,86 | 14,94 | 0,024 | 0,78 | 13,5 | 2,1 | 170 / 189 |

## Render measurement and visual QA

One foreground headless Chrome browser rendered 15 remote bikes plus its own; the other 15 participants were SDK load guests. The renderer used software WebGL flags for reproducible automation. Final screenshot and telemetry are in verification/m2/ and verification/m2-render.json. Static geometry merges reduced per-bike draw calls; primitive geometry types were normalized before merging. Road/canyon, lobby and 16-bike images were inspected visually.

Observed mean FPS: **17,3**, draw calls: **179**. This is software rendering, not a mid-range hardware GPU benchmark. It does not establish 60 FPS or 16 physical-device support.

## Issues found and fixed

1. Colyseus patchRate=null set before fixed simulation started an additional clock timer; accumulator consumed too little elapsed time and real load observed roughly 5–6 Hz. Set patchRate after setFixedTimestep to leave one clock owner. Final measured tick rates returned to ~30 Hz without reducing test thresholds.
2. Merging indexed box primitives with nonindexed helmet geometry emitted a Three.js error. Normalize static geometry to nonindexed form before material grouping/merge; normal-use browser console checks pass.
3. Browser input networking originally depended on RAF frequency. Replaced it with an owned 30 Hz intent timer; online physics remains server-only even when renderer FPS drops. Blur/pause still brakes explicitly.
4. Disconnection cleanup no longer sends a redundant leave through an already-closed socket. Offline-context browser test verifies visible rejoin controls.
5. Polling the latest frame at 50 ms undercounted snapshots; instrumentation now increments on each received snapshot message, yielding measured ~15 Hz.

## Limits and next milestone

- Tested two independent browser processes on this Windows host, not two physical devices. A same-LAN two-machine playtest and hardware GPU measurements remain to be done by the user.
- 16 network guests passed a measured local movement load test and one rendered room; no claim that 16 WAN devices are production-ready.
- Interpolation adds 100 ms presentation delay on top of network latency; no local prediction/reconciliation. There are no bike-to-bike collisions yet.
- No automatic reconnect, spectator, late joining into running sessions or persistent rooms. Restarting backend removes all rooms.
- No race result/checkpoint/respawn/rematch, damage/combat, abilities, public HTTPS/WSS deployment or GitHub Pages hosting implemented. M3 has not started.
- Production frontend JS is approximately 743.43 kB (gzip 198.75 kB), CSS 8.82 kB, HTML 5.21 kB; existing chunk-size warning remains.

## API references checked

- https://docs.colyseus.io/room — room lifecycle, fixed timestep, visibility and message handling.
- https://docs.colyseus.io/server — server/transport initialization.
- Installed @colyseus/core, @colyseus/sdk and @colyseus/ws-transport type declarations and source used to confirm the pinned 0.18 APIs.
