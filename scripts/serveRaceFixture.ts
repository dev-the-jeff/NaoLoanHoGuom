import { spawn } from 'node:child_process';
import { createGameServer } from '../server/src/app';
import { ShortRaceRoom } from '../tests/ShortRaceRoom';
const server = createGameServer(ShortRaceRoom);
await server.listen(2571, '127.0.0.1');
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'client/vite.config.ts'], {
  stdio: 'inherit', env: { ...process.env, CLIENT_PORT: '5180', VITE_SERVER_URL: 'ws://127.0.0.1:2571' },
});
let closing = false;
async function close(): Promise<void> {
  if (closing) return; closing = true; vite.kill(); await server.gracefullyShutdown(false); process.exit(0);
}
process.on('SIGTERM', () => { void close(); }); process.on('SIGINT', () => { void close(); });
vite.on('exit', () => { void close(); });
