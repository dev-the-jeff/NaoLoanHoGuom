import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@colyseus/sdk';
import { createGameServer } from '../server/src/app';
import { closePeers, startPeers, testPeer, until } from '../scripts/testSupport';
import type { TestPeer } from '../scripts/testSupport';
const server = createGameServer(); let endpoint: string; let peers: TestPeer[] = [];
beforeAll(async () => {
  await server.listen(0, '127.0.0.1'); const address = server.transport.server?.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server address'); endpoint = `ws://127.0.0.1:${address.port}`;
});
afterEach(async () => { await closePeers(peers); peers = []; });
afterAll(async () => { await server.gracefullyShutdown(false); });
describe('M2 real Colyseus integration', () => {
  it('synchronizes two independent guests, server countdown and intent-only movement', async () => {
    const a = await testPeer(endpoint, undefined, 'Same'); peers.push(a);
    const b = await testPeer(endpoint, a.room.roomId, 'Same'); peers.push(b);
    await until(() => a.latest?.players.length === 2); expect(a.room.sessionId).not.toBe(b.room.sessionId);
    a.room.send('start'); await new Promise(resolve => setTimeout(resolve, 100)); expect(a.latest?.phase).toBe('lobby');
    await startPeers(peers); expect(a.latest?.startsAt).toBe(b.latest?.startsAt);
    const initial = a.latest!.players.find(player => player.id === a.room.sessionId)!.progress;
    a.room.send('input', { roundId: 1, seq: 1, throttle: true, brake: false, steer: 0, nitro: false, progress: 1000 });
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(a.latest!.players.find(player => player.id === a.room.sessionId)!.progress).toBe(initial);
    let seq = 0;
    const sending = setInterval(() => a.room.send('input', { roundId: 1, seq: ++seq, throttle: true, brake: false, steer: 0, nitro: false }), 34);
    try { await until(() => (b.latest?.players.find(player => player.id === a.room.sessionId)?.progress ?? 0) > initial + 3); }
    finally { clearInterval(sending); }
    const common = Array.from(a.frames.keys()).reverse().find(tick => b.frames.has(tick));
    expect(common).toBeDefined(); expect(a.frames.get(common!)?.players).toEqual(b.frames.get(common!)?.players);
    expect(b.latest?.players.find(player => player.id === b.room.sessionId)?.speed).toBe(0);
    expect(a.errors).toEqual([]); expect(b.errors).toEqual([]);
  }, 15000);
  it('transfers host and removes an unexpectedly dropped rider without a ghost bike', async () => {
    const a = await testPeer(endpoint); peers.push(a); const b = await testPeer(endpoint, a.room.roomId); peers.push(b);
    a.room.connection.close(); peers = [b];
    await until(() => b.latest?.players.length === 1 && b.latest.hostId === b.room.sessionId);
    expect(b.latest?.players[0].id).toBe(b.room.sessionId);
  });
  it('rejects a missing room, invalid nickname, a seventeenth guest, and joining a running room', async () => {
    const client = new Client(endpoint);
    await expect(client.joinById('ZZZZZZ', { nickname: 'Guest' })).rejects.toThrow();
    await expect(client.create('race', { nickname: '<script>' })).rejects.toThrow();
    const host = await testPeer(endpoint); peers.push(host);
    for (let i = 1; i < 16; i++) peers.push(await testPeer(endpoint, host.room.roomId));
    await until(() => host.latest?.players.length === 16);
    await expect(client.joinById(host.room.roomId, { nickname: 'Seventeenth' })).rejects.toThrow();
    await startPeers(peers);
    await expect(client.joinById(host.room.roomId, { nickname: 'Late' })).rejects.toThrow();
    expect(new Set(host.latest?.players.map(player => player.id)).size).toBe(16);
  }, 20000);
});
