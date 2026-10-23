import { createGameServer } from './app';
import { NET_CONFIG } from '../../shared/src/protocol';
const server = createGameServer();
const port = Number(process.env.PORT || NET_CONFIG.port);
await server.listen(port, process.env.HOST || '0.0.0.0');
console.log(`ROAD RIOT M2 server http://127.0.0.1:${port}`);
let closing = false;
const shutdown = (): void => { if (closing) return; closing = true; void server.gracefullyShutdown(false).then(() => process.exit(0)); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
