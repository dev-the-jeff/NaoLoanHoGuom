# M1 verification — 2026-10-23 (Asia/Saigon)

## Actual environment

Windows desktop; bundled Node.js v24.22.1, npm 11.19.0; Three.js 0.186.1, Vite 8.3.5, TypeScript 6.0.3, Vitest 5.0.5, ESLint 10.13.0, Playwright 1.64.1. Exact dependencies are in package-lock.json. System Node was not used for successful project checks because of Windows Controlled Folder Access; see README runtime workaround.

## Commands and results

| Command | Result |
| --- | --- |
| `npm install --save-exact three` plus dev dependency installation | Passed in staging; npm audit reported 0 vulnerabilities |
| `npm ci` | Passed from final outputs/road-riot directory; 140 packages installed, 0 audit vulnerabilities |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, max warnings 0 |
| `npm test` | Passed: 16 tests in 1 file |
| `npm run build` | Passed; includes TypeScript check; 17 modules transformed |
| `npm run check` | Passed in final directory, including after camera adjustment |
| `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e` (PowerShell env syntax in README) | Passed, Vite dev server, 1 integrated browser scenario; 18.1 seconds test / 20.5 seconds total, before final camera feed-forward adjustment |
| `PLAYWRIGHT_CHANNEL=chrome TEST_PRODUCTION=1 npm run test:e2e` | Passed against built production output; repeated after camera adjustment: 17.6 seconds test / 19.9 seconds total |

Production output: index.html 3.22 kB, CSS 6.04 kB (gzip 2.01 kB), JS 551.87 kB (gzip 139.10 kB). Vite emitted its standard >500 kB chunk warning. Build succeeded. Node also emitted a harmless NO_COLOR/FORCE_COLOR environment warning from the test runner.

## Verified behavior

- Browser renders the original primitive bike, flat road, barriers and canyon scenery. Start and riding screenshots inspected visually, including final Nitro image.
- Keyboard W/Up accelerate; S brakes to zero; D produces a measured change in lateral position; Left/Right arrow input accepted.
- Nitro exceeds 165 km/h during browser test, never more than configured 190 km/h; unit tests assert the exact cap. Final screenshot shows 190 km/h with 64% reserve.
- Three-second full fuel budget and two-second delayed 15 units/s recharge covered by deterministic tests. Browser verifies reserve spending, recharge delay, increase and normal cap after release.
- Local pause freezes distance; reset restores start, speed and fuel. Blur clears input and pauses. Viewport resize updates renderer dimensions.
- No page errors, console errors or failed requests recorded during successful browser scenarios.
- Both side barriers, end barrier, invalid/large deltas, drag, stop/no reverse and exit from barrier contact are unit-tested.
- Renderer debug screenshot observed 34 render calls and roughly 26 FPS with software WebGL in headless Chrome. This is an automation observation, **not a hardware performance claim or a demonstrated 60 FPS target**.

## Issues found and fixed

1. Side-contact drag could leave too little steering authority to leave the wall. Heading now deflects into the road tangent; regression test passes.
2. The initial 90 m straight reached a bend during acceleration/Nitro practice. Extended to 220 m; browser scenario passes.
3. Exponential camera follow alone made the bike too small at top speed. Added velocity feed-forward to maintain intended camera distance; final screenshot inspected and production browser test repeated successfully.
4. Symmetry test retained intentional steering damping state from a separate stopped-input check; reset the fixture between those assertions.

## Limits

No human full-route playtest or mid-range hardware benchmark was performed. Automated browser driving covers a representative start/steering/boost sequence, not an entire 1.1 km run; unit tests exercise collision boundaries and route continuity. Subjective feel still needs human tuning. Camera has no scenery collision solver. M1 is forward-only, flat-ground arcade movement with conservative circular footprint; no suspension simulation. End-of-road is a barrier, not a race result.

No multiplayer, Colyseus backend, room flow, combat, checkpoint validation, abilities or deployment tested or implemented. No M2 work started. Browser test servers shut down automatically after tests.

## Reference APIs checked

- https://threejs.org/docs/pages/WebGLRenderer — animation loop and renderer lifecycle.
- https://vite.dev/guide/ — toolchain requirements and scripts.

## Speed feel update verification — 2026-10-23, 16:10 (Asia/Saigon)

- `npm run check`: passed (typecheck, zero-warning ESLint, 16 unit tests, production build).
- Production browser: installed Chrome via Playwright, `TEST_PRODUCTION=1`, `PLAYWRIGHT_CHANNEL=chrome`, `npm run test:e2e`: 1 scenario passed, 17.5 seconds / 19.9 seconds total. No console/page/request errors recorded.
- Final speed-feel screenshot inspected: denser near-field cues, lower camera, peripheral streaks; 190 km/h visible. Screenshot reports 37 draw calls in software WebGL, not a hardware FPS benchmark.
- Current build supersedes previous totals: 18 transformed modules, JS 559.41 kB / 141.24 kB gzip. Existing >500 kB bundle warning remains.
- Existing user Vite dev process left running on port 5173. Verified HTTP 200 after changes; no test server replaced the user's preview.
- Subjective speed feel needs user feedback; no claim of human playtest approval.
