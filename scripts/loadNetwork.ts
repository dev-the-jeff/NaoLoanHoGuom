import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { closePeers, startPeers, testPeer } from './testSupport';
import type { TestPeer } from './testSupport';
import { latencyProxy } from './latencyProxy';
const port = Number(process.env.TEST_SERVER_PORT || 2568);
const endpoint = `ws://127.0.0.1:${port}`; const http = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['--import', 'tsx', 'server/src/index.ts'], {
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', LOCAL_METRICS: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
});
let backendErrors = ''; child.stderr.on('data', data => { backendErrors += String(data); }); child.stdout.resume();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values: number[], fraction: number): number => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))] : 0;
interface Cpu { cpu: { user: number; system: number }; uptime: number }
interface Profile {
  players: number; simulatedRttMs: number; jitterMs: number; seconds: number;
  tickHz: number; snapshotHz: number; tickP95Ms: number; serverCpuSingleCorePercent: number;
  totalDownBytesPerSecond: number; totalUpBytesPerSecond: number; rttMedianMs: number; rttP95Ms: number;
  canonicalPositionsAgree: boolean; errors: string[];
}
async function runProfile(count: number, rtt: number, jitter: number): Promise<Profile> {
  const proxy = rtt ? await latencyProxy(endpoint, rtt, jitter) : undefined;
  const target = proxy?.endpoint ?? endpoint; const peers: TestPeer[] = []; let sender: ReturnType<typeof setInterval> | undefined; let pinger: ReturnType<typeof setInterval> | undefined;
  try {
    for (let i = 0; i < count; i++) peers.push(await testPeer(target, peers[0]?.room.roomId, `Load ${i}`));
    await startPeers(peers); const rtts: number[] = [];
    peers[0].room.onMessage<{ sentAt: number }>('pong', pong => rtts.push(Date.now() - pong.sentAt));
    let seq = 0;
    sender = setInterval(() => { for (const peer of peers) peer.room.send('input', { roundId: 1, seq: ++seq, throttle: true, brake: false, steer: 0, nitro: false }); }, 34);
    pinger = setInterval(() => peers[0].room.send('ping', Date.now()), 500);
    const cpuBefore = await (await fetch(`${http}/metrics`)).json() as Cpu;
    const downStart = peers.reduce((sum, peer) => sum + peer.bytesIn, 0); const upStart = peers.reduce((sum, peer) => sum + peer.bytesOut, 0);
    const initial = peers[0].latest!; const snapshotsBefore = peers[0].receivedSnapshots; let previousTick = initial.tick; const tickCosts: number[] = [];
    const seconds = Number(process.env.LOAD_SECONDS || (rtt ? 8 : 10)); const start = performance.now();
    while (performance.now() - start < seconds * 1000) {
      await sleep(50); const latest = peers[0].latest!;
      if (latest.tick !== previousTick) { tickCosts.push(latest.tickMs); previousTick = latest.tick; }
    }
    const duration = (performance.now() - start) / 1000;
    const cpuAfter = await (await fetch(`${http}/metrics`)).json() as Cpu; const latest = peers[0].latest!;
    const common = Array.from(peers[0].frames.keys()).reverse().find(tick => peers.every(peer => peer.frames.has(tick)));
    assert.notEqual(common, undefined, 'all clients must share a recent authoritative tick');
    const reference = peers[0].frames.get(common!)!.players;
    for (const peer of peers) { assert.deepEqual(peer.frames.get(common!)!.players, reference); assert.equal(peer.latest?.players.length, count); }
    for (const player of latest.players) assert.ok(player.progress > 8 && player.seq > 0, 'each guest must have server-applied input');
    const result: Profile = { players: count, simulatedRttMs: rtt, jitterMs: jitter, seconds: duration,
      tickHz: (latest.tick - initial.tick) * 1000 / (latest.serverTime - initial.serverTime), snapshotHz: (peers[0].receivedSnapshots - snapshotsBefore) / duration,
      tickP95Ms: percentile(tickCosts, 0.95), serverCpuSingleCorePercent: (cpuAfter.cpu.user + cpuAfter.cpu.system - cpuBefore.cpu.user - cpuBefore.cpu.system) / (duration * 1000000) * 100,
      totalDownBytesPerSecond: (peers.reduce((sum, peer) => sum + peer.bytesIn, 0) - downStart) / duration,
      totalUpBytesPerSecond: (peers.reduce((sum, peer) => sum + peer.bytesOut, 0) - upStart) / duration,
      rttMedianMs: percentile(rtts, 0.5), rttP95Ms: percentile(rtts, 0.95), canonicalPositionsAgree: true, errors: peers.flatMap(peer => peer.errors),
    };
    console.log(JSON.stringify(result));
    assert.ok(result.tickHz >= 27, `server tick rate below threshold: ${result.tickHz}`); assert.ok(result.snapshotHz >= 12, `snapshot rate below threshold: ${result.snapshotHz}`);
    assert.equal(result.errors.length, 0); return result;
  } finally { if (sender) clearInterval(sender); if (pinger) clearInterval(pinger); await closePeers(peers); await proxy?.close(); }
}
try {
  const started = Date.now();
  while (true) {
    try { const response = await fetch(`${http}/metrics`); if (response.ok) break; } catch { /* bounded startup polling */ }
    if (Date.now() - started > 10000 || child.exitCode !== null) throw new Error(`Load-test backend could not start: ${backendErrors}`);
    await sleep(100);
  }
  const profiles: Profile[] = [];
  for (const count of [2, 4, 8, 16]) profiles.push(await runProfile(count, 0, 0));
  for (const rtt of [50, 100, 150]) profiles.push(await runProfile(2, rtt, 20));
  const report = { date: new Date().toISOString(), backend: 'separate Node.js process, same physical Windows machine',
    bandwidth: 'Actual binary WebSocket payload bytes after join; excludes HTTP, TCP/TLS and WebSocket framing overhead.',
    cpu: 'Backend-only user+system CPU from process.cpuUsage, percent of one logical core.',
    note: 'Synthetic SDK input load. Render measurements are separate. These are local results, not 16 physical-device/WAN validation.', profiles };
  await writeFile('verification/m3-load.json', JSON.stringify(report, null, 2)); assert.equal(backendErrors.trim(), '', backendErrors);
  console.log('M3 load and latency checks passed. Report: verification/m3-load.json');
} finally { child.kill('SIGTERM'); }


