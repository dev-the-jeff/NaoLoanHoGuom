import { test, expect, chromium } from '@playwright/test';
import { closePeers, testPeer, until } from '../../scripts/testSupport';
import type { TestPeer } from '../../scripts/testSupport';
import { writeFile } from 'node:fs/promises';
const launchArgs = ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
test('M2 two browsers: private code, ready/countdown, both see movement, pause stays online', async ({ page, baseURL }, testInfo) => {
  const edge = await chromium.launch({ channel: 'msedge', args: launchArgs });
  const second = await edge.newPage({ viewport: { width: 1280, height: 720 } });
  const errors: string[] = [];
  for (const p of [page, second]) {
    p.on('pageerror', error => errors.push(error.message));
    p.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  }
  try {
    await page.goto('/'); await page.locator('#online-open').click(); await page.locator('#nickname').fill('An'); await page.locator('#create-room').click();
    await expect(page.locator('#room-code-display')).toHaveText(/^[A-Z2-9]{6}$/);
    const code = (await page.locator('#room-code-display').textContent())!;
    await second.goto(baseURL!); await second.locator('#online-open').click(); await second.locator('#nickname').fill('Binh'); await second.locator('#room-code').fill(code); await second.locator('#join-room').click();
    await expect(page.locator('#roster li')).toHaveCount(2); await expect(second.locator('#roster li')).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath('m2-lobby.png') });
    await page.locator('#ready').click(); await second.locator('#ready').click(); await expect(page.locator('#start-race')).toBeEnabled(); await page.locator('#start-race').click();
    await expect(page.locator('#game')).toHaveAttribute('data-phase', 'countdown'); await expect(second.locator('#game')).toHaveAttribute('data-phase', 'countdown');
    expect(await page.locator('#game').getAttribute('data-starts-at')).toBe(await second.locator('#game').getAttribute('data-starts-at'));
    await expect(page.locator('#game')).toHaveAttribute('data-phase', 'racing'); await expect(second.locator('#game')).toHaveAttribute('data-phase', 'racing');
    await expect(page.locator('#game')).toHaveAttribute('data-remote-count', '1'); await expect(second.locator('#game')).toHaveAttribute('data-remote-count', '1');
    await page.keyboard.down('KeyW'); await expect.poll(async () => Number(await page.locator('#distance').textContent()), { timeout: 10000 }).toBeGreaterThan(15);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyS'); await expect.poll(async () => Number(await page.locator('#speed').textContent()), { timeout: 6000 }).toBe(0); await page.keyboard.up('KeyS');
    const ownA = Number(await page.locator('#game').getAttribute('data-progress'));
    await second.bringToFront();
    await expect.poll(async () => Math.abs(Number(await second.locator('#game').getAttribute('data-remote-progress')) - ownA)).toBeLessThan(1);
    if (await second.locator('#overlay').isVisible()) await second.locator('#ride').click();
    await second.locator('#game').click({ position: { x: 640, y: 360 } });
    await second.keyboard.down('ArrowUp'); await expect.poll(async () => Number(await second.locator('#distance').textContent()), { timeout: 10000 }).toBeGreaterThan(15); await second.keyboard.up('ArrowUp');
    await second.keyboard.down('ArrowDown');
    await expect.poll(async () => Number(await second.locator('#speed').textContent()), { timeout: 6000 }).toBe(0); await second.keyboard.up('ArrowDown');
    const ownB = Number(await second.locator('#game').getAttribute('data-progress'));
    // Background windows may stop RAF; compare the rendered position after foreground resumes and B is stationary.
    await page.bringToFront();
    await expect.poll(async () => Math.abs(Number(await page.locator('#game').getAttribute('data-remote-progress')) - ownB)).toBeLessThan(1);
    if (await page.locator('#overlay').isVisible()) await page.locator('#ride').click();
    await page.screenshot({ path: testInfo.outputPath('m2-riding.png') });
    await page.bringToFront();
    if (await page.locator('#overlay').isVisible()) await page.locator('#ride').click();
    await page.keyboard.press('Escape'); await expect(page.locator('#overlay')).toBeVisible(); await expect(second.locator('#game')).toHaveAttribute('data-phase', 'racing');
    await page.keyboard.press('KeyR'); await expect(page.locator('#game')).toHaveAttribute('data-reset-version', '1'); await expect.poll(async () => Number(await page.locator('#distance').textContent())).toBe(8);
    await page.locator('#ride').click(); await page.locator('#network-open').click(); await page.locator('#leave-room').click();
    await expect(second.locator('#game')).toHaveAttribute('data-remote-count', '0');
    await second.locator('#network-open').click(); await expect(second.locator('#roster')).toContainText('Binh (you) · HOST');
    expect(errors).toEqual([]);
  } finally { await edge.close(); }
});
test('M2 error UI: missing room and unreachable backend', async ({ page }) => {
  await page.goto('/'); await page.locator('#online-open').click(); await page.locator('#nickname').fill('Guest'); await page.locator('#room-code').fill('ZZZZZZ'); await page.locator('#join-room').click();
  await expect(page.locator('#connection-notice')).toContainText('Room not found');
  await page.route('**/matchmake/**', route => route.abort()); await page.locator('#create-room').click();
  await expect(page.locator('#connection-notice')).toContainText('Cannot reach');
});
test('M2 UI handles connection loss and returns to explicit join controls', async ({ page }) => {
  try {
    await page.goto('/'); await page.locator('#online-open').click(); await page.locator('#nickname').fill('Guest'); await page.locator('#create-room').click();
    await expect(page.locator('#room-code-display')).toHaveText(/^[A-Z2-9]{6}$/);
    await page.context().setOffline(true);
    await expect(page.locator('#connection-notice')).toContainText('Connection lost', { timeout: 10000 });
    await expect(page.locator('#connection-form')).toBeVisible();
  } finally { await page.context().setOffline(false); }
});
test('M2 16 connected riders: render membership and collect actual software-WebGL telemetry', async ({ page }, testInfo) => {
  const peers: TestPeer[] = []; let sending: ReturnType<typeof setInterval> | undefined;
  try {
    await page.goto('/'); await page.locator('#online-open').click(); await page.locator('#nickname').fill('Render host'); await page.locator('#create-room').click();
    await expect(page.locator('#room-code-display')).toHaveText(/^[A-Z2-9]{6}$/); const code = (await page.locator('#room-code-display').textContent())!;
    for (let i = 1; i < 16; i++) peers.push(await testPeer('ws://127.0.0.1:2567', code, `Guest ${i}`));
    await expect(page.locator('#roster li')).toHaveCount(16); await page.locator('#ready').click();
    for (const peer of peers) peer.room.send('ready', true);
    await expect(page.locator('#start-race')).toBeEnabled({ timeout: 15000 }); await page.locator('#start-race').click();
    await until(() => peers[0].latest?.phase === 'racing'); await expect(page.locator('#game')).toHaveAttribute('data-remote-count', '15');
    let seq = 0; sending = setInterval(() => { for (const peer of peers) peer.room.send('input', { roundId: 1, seq: ++seq, throttle: true, brake: false, steer: 0, nitro: false }); }, 34);
    const remoteBefore = Number(await page.locator('#game').getAttribute('data-remote-progress'));
    await page.keyboard.down('KeyW'); const samples: number[] = [];
    for (let i = 0; i < 10; i++) { await page.waitForTimeout(500); samples.push(Number(await page.locator('#game').getAttribute('data-fps'))); }
    await page.keyboard.up('KeyW');
    expect(Number(await page.locator('#game').getAttribute('data-remote-progress'))).toBeGreaterThan(remoteBefore + 5);
    await page.keyboard.press('F3'); await page.screenshot({ path: testInfo.outputPath('m2-16-riders.png') });
    const metrics = { participants: 16, renderedRemotes: 15, softwareWebGL: true, averageFps: samples.reduce((a, b) => a + b, 0) / samples.length, samples, drawCalls: Number(await page.locator('#game').getAttribute('data-draw-calls')), note: 'One rendered browser plus 15 SDK guests on one machine, not 16 physical devices or a hardware GPU benchmark.' };
    await writeFile('verification/m3-render.json', JSON.stringify(metrics, null, 2)); await testInfo.attach('16-riders-render-metrics', { body: JSON.stringify(metrics), contentType: 'application/json' });
  } finally { if (sending) clearInterval(sending); await closePeers(peers); }
});




