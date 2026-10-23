import { chromium } from '@playwright/test';
import { testPeer, closePeers } from './testSupport';
import type { TestPeer } from './testSupport';
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const peers: TestPeer[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(process.env.CAPTURE_URL || 'http://127.0.0.1:5173'); await page.locator('#online-open').click();
  await page.locator('#nickname').fill('Visual host'); await page.locator('#create-room').click();
  await page.locator('#room-code-display').waitFor({ state: 'visible' });
  let code = '';
  for (let i = 0; i < 100 && code.length !== 6; i++) { code = (await page.locator('#room-code-display').textContent()) ?? ''; if (code.length !== 6) await page.waitForTimeout(50); }
  const guest = await testPeer('ws://127.0.0.1:2567', code, 'Visual guest'); peers.push(guest);
  await page.locator('#ready').click(); guest.room.send('ready', true);
  await page.locator('#start-race').waitFor({ state: 'visible' });
  for (let i = 0; i < 100 && !await page.locator('#start-race').isEnabled(); i++) await page.waitForTimeout(50);
  await page.locator('#start-race').click();
  await page.waitForFunction(() => document.querySelector<HTMLCanvasElement>('#game')?.dataset.phase === 'racing');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => Number(document.querySelector<HTMLCanvasElement>('#game')?.dataset.progress) > 319, undefined, { timeout: 20000 });
  await page.screenshot({ path: 'verification/m3/checkpoint-approach.png' });
  await page.keyboard.up('KeyW'); console.log('Production checkpoint approach captured.');
} finally { await closePeers(peers); await browser.close(); }
