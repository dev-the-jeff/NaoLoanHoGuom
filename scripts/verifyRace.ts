import { writeFile } from 'node:fs/promises';
import { createGameServer } from '../server/src/app';
import { Road } from '../shared/src/Road';
import { closePeers, startPeers, testPeer, until } from './testSupport';
import type { TestPeer } from './testSupport';
const server = createGameServer(); const peers: TestPeer[] = [];
let timer: ReturnType<typeof setInterval> | undefined;
try {
  await server.listen(0, '127.0.0.1'); const address = server.transport.server?.address();
  if (!address || typeof address === 'string') throw new Error('Missing address');
  const endpoint = 'ws://127.0.0.1:' + address.port; const road = new Road();
  peers.push(await testPeer(endpoint, undefined, 'Full course A'));
  peers.push(await testPeer(endpoint, peers[0].room.roomId, 'Full course B'));
  await startPeers(peers); const began = Date.now(); let seq = 0;
  timer = setInterval(() => {
    seq++;
    for (const peer of peers) {
      const me = peer.latest?.players.find(p => p.id === peer.room.sessionId); if (!me) continue;
      const heading = Math.atan2(road.centerAt(me.progress + 18) - me.x, 18);
      peer.room.send('input', { seq, roundId: peer.latest!.roundId, throttle: true, brake: false, nitro: false,
        steer: Math.max(-1, Math.min(1, (heading - me.heading) * 4)) });
    }
  }, 34);
  await until(() => peers.every(peer => peer.latest?.phase === 'results'), 180000);
  const results = peers.map(peer => peer.latest!.standings);
  if (JSON.stringify(results[0]) !== JSON.stringify(results[1])) throw new Error('Finishing order differs');
  if (results[0].some(p => p.status !== 'finished' || p.checkpoint !== 9)) throw new Error('Full course did not finish');
  const duration = Date.now() - began; const code = peers[0].room.roomId;
  peers[1].room.send('rematch', { roundId: 1 }); await new Promise(resolve => setTimeout(resolve, 150));
  if (peers[0].latest!.phase !== 'results') throw new Error('Guest rematch was accepted');
  peers[0].room.send('rematch', { roundId: 1 });
  await until(() => peers.every(p => p.latest?.phase === 'lobby' && p.latest.roundId === 2));
  await startPeers(peers); await until(() => peers.every(p => (p.latest?.players.find(q => q.id === p.room.sessionId)?.checkpoint ?? 0) >= 1), 20000);
  const report = { milestone: 'M3', courseMetres: road.length, finishGate: 3350, realTimeMs: duration, participants: 2,
    transport: 'Real Colyseus sockets on localhost, 30Hz intent, production course and rules', results: results[0],
    identicalResults: true, guestRematchRejected: true, rematchSameRoom: peers.every(p => p.room.roomId === code),
    secondRound: peers[0].latest!.roundId, secondRoundCheckpoint: peers[0].latest!.players.map(p => p.checkpoint),
    errors: peers.flatMap(p => p.errors), note: 'Automated steering driver for verification only, not a gameplay bot or human playtest.' };
  if (report.errors.length) throw new Error(report.errors.join(','));
  await writeFile('verification/m3-race.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { if (timer) clearInterval(timer); await closePeers(peers); await server.gracefullyShutdown(false); }
