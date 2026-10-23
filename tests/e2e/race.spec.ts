import { test, expect } from '@playwright/test';
import { closePeers, testPeer, until } from '../../scripts/testSupport';
import type { TestPeer } from '../../scripts/testSupport';
test('M3 real browser: reset feedback, ordered gates, same results as peer, host rematch and second start', async ({ page }, info) => {
  test.setTimeout(60000);
  const peers: TestPeer[] = []; let timer: ReturnType<typeof setInterval> | undefined;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:5180'); await page.locator('#online-open').click();
    await page.locator('#nickname').fill('Browser host'); await page.locator('#create-room').click();
    await expect(page.locator('#room-code-display')).toHaveText(/^[A-Z2-9]{6}$/);
    const code = (await page.locator('#room-code-display').textContent())!;
    const peer = await testPeer('ws://127.0.0.1:2571', code, 'SDK guest'); peers.push(peer);
    await page.locator('#ready').click(); peer.room.send('ready', true);
    await expect(page.locator('#start-race')).toBeEnabled(); await page.locator('#start-race').click();
    await expect(page.locator('#game')).toHaveAttribute('data-phase', 'racing');
    await page.keyboard.press('KeyR'); await expect(page.locator('#game')).toHaveAttribute('data-reset-version', '1');
    await page.keyboard.press('KeyR'); await expect(page.locator('#race-notice')).toContainText('cooling');
    let seq = 0;
    timer = setInterval(() => peer.room.send('input', { roundId: peer.latest?.roundId ?? 1, seq: ++seq, throttle: true, brake: false, steer: 0, nitro: true }), 34);
    await page.keyboard.down('KeyW');
    await expect.poll(async () => Number(await page.locator('#game').getAttribute('data-checkpoint')), { timeout: 10000 }).toBeGreaterThan(0);
    await expect(page.locator('#game')).toHaveAttribute('data-phase', 'results', { timeout: 20000 }); await page.keyboard.up('KeyW');
    await until(() => peer.latest?.phase === 'results');
    await expect(page.locator('#results')).toBeVisible(); await expect(page.locator('#result-rows tr')).toHaveCount(2);
    expect(await page.locator('#result-rows tr').evaluateAll(rows => rows.map(row => (row as HTMLElement).dataset.id))).toEqual(peer.latest!.standings.map(p => p.id));
    await page.screenshot({ path: info.outputPath('m3-results.png') });
    clearInterval(timer); timer = undefined;
    await page.locator('#rematch').click(); await expect(page.locator('#game')).toHaveAttribute('data-phase', 'lobby');
    await expect(page.locator('#game')).toHaveAttribute('data-round', '2'); await expect(page.locator('#results')).toBeHidden();
    await expect(page.locator('#online-panel')).toBeVisible(); await expect(page.locator('#room-code-display')).toHaveText(code);
    await expect(page.locator('#ready')).toHaveText('READY'); await expect(page.locator('#start-race')).toBeDisabled();
    await page.locator('#ready').click(); peer.room.send('ready', true);
    await expect(page.locator('#start-race')).toBeEnabled(); await page.locator('#start-race').click();
    await expect(page.locator('#game')).toHaveAttribute('data-phase', 'racing');
    await page.keyboard.down('KeyW'); await expect.poll(async () => Number(await page.locator('#distance').textContent())).toBeGreaterThan(12); await page.keyboard.up('KeyW');
    await page.screenshot({ path: info.outputPath('m3-second-round.png') }); expect(errors).toEqual([]);
  } finally { if (timer) clearInterval(timer); await closePeers(peers); }
});
