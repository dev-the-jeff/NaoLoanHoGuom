import { Client, type Room } from '@colyseus/sdk';
import type { RoomSnapshot } from '../shared/src/protocol';
export interface TestPeer { room: Room; latest?: RoomSnapshot; frames: Map<number, RoomSnapshot>; bytesIn: number; bytesOut: number; receivedSnapshots: number; errors: string[] }
/** Waits for an observable integration condition with a bounded timeout. */
export async function until(predicate: () => boolean, timeout = 10000): Promise<void> {
  const start = Date.now();
  while (!predicate()) { if (Date.now() - start > timeout) throw new Error('Timed out waiting for multiplayer state'); await new Promise(resolve => setTimeout(resolve, 20)); }
}
/** Creates a real Colyseus guest with snapshot history and actual WebSocket payload byte counters. */
export async function testPeer(endpoint: string, code?: string, nickname = 'Guest'): Promise<TestPeer> {
  const client = new Client(endpoint);
  const room = code ? await client.joinById(code, { nickname }) : await client.create('race', { nickname });
  room.reconnection.enabled = false;
  const peer: TestPeer = { room, frames: new Map(), bytesIn: 0, bytesOut: 0, receivedSnapshots: 0, errors: [] };
  room.onMessage<RoomSnapshot>('snapshot', frame => { peer.receivedSnapshots++; peer.latest = frame; peer.frames.set(frame.tick, frame); if (peer.frames.size > 120) peer.frames.delete(peer.frames.keys().next().value!); });
  room.onMessage('notice', () => {}); room.onMessage('pong', () => {});
  room.onError((code, message) => peer.errors.push(`${code}: ${message}`));
  const socket = (room.connection.transport as unknown as { ws: WebSocket }).ws;
  socket.addEventListener('message', event => { if (event.data instanceof ArrayBuffer) peer.bytesIn += event.data.byteLength; });
  const send = room.connection.send.bind(room.connection);
  room.connection.send = data => { peer.bytesOut += data.byteLength; send(data); };
  room.send('sync'); await until(() => !!peer.latest); return peer;
}
/** Waits for everyone to be Ready before requesting an authoritative countdown. */
export async function startPeers(peers: TestPeer[]): Promise<void> {
  for (const peer of peers) peer.room.send('ready', true);
  await until(() => peers[0].latest?.players.every(player => player.ready) === true);
  peers[0].room.send('start'); await until(() => peers.every(peer => peer.latest?.phase === 'racing'));
}
/** Closes only the test-owned guests. */
export async function closePeers(peers: TestPeer[]): Promise<void> { await Promise.all(peers.map(peer => peer.room.leave())); }

