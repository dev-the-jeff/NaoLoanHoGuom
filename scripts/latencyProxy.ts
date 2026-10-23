import { createServer, request } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
/** Test-only ordered WebSocket proxy: adds RTT and bounded jitter without reordering reliable frames. */
export async function latencyProxy(target: string, rtt: number, jitter: number): Promise<{ endpoint: string; close(): Promise<void> }> {
  const targetUrl = new URL(target); const sockets = new Set<WebSocket>(); const timers = new Set<ReturnType<typeof setTimeout>>();
  const http = createServer((incoming, outgoing) => {
    const forward = request({ hostname: targetUrl.hostname, port: targetUrl.port, path: incoming.url, method: incoming.method, headers: incoming.headers }, response => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers); response.pipe(outgoing);
    });
    forward.on('error', () => { outgoing.writeHead(502); outgoing.end(); }); incoming.pipe(forward);
  });
  const wss = new WebSocketServer({ noServer: true });
  http.on('upgrade', (req, socket, head) => { wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req)); });
  wss.on('connection', (front, req) => {
    const back = new WebSocket(`${target}${req.url}`); sockets.add(front); sockets.add(back);
    let frontDelivery = 0; let backDelivery = 0;
    const queued: { data: RawData; binary: boolean }[] = [];
    const schedule = (destination: WebSocket, data: RawData, binary: boolean, toBack: boolean): void => {
      const previous = toBack ? backDelivery : frontDelivery;
      const delivery = Math.max(previous + 0.1, Date.now() + rtt / 2 + (Math.random() - 0.5) * jitter);
      if (toBack) backDelivery = delivery; else frontDelivery = delivery;
      const timer = setTimeout(() => { timers.delete(timer); if (destination.readyState === WebSocket.OPEN) destination.send(data, { binary }); }, Math.max(0, delivery - Date.now()));
      timers.add(timer);
    };
    front.on('message', (data, binary) => { if (back.readyState === WebSocket.OPEN) schedule(back, data, binary, true); else queued.push({ data, binary }); });
    back.on('open', () => { for (const frame of queued) schedule(back, frame.data, frame.binary, true); queued.length = 0; });
    back.on('message', (data, binary) => schedule(front, data, binary, false));
    const cleanup = (): void => { sockets.delete(front); sockets.delete(back); if (front.readyState < WebSocket.CLOSING) front.close(); if (back.readyState < WebSocket.CLOSING) back.close(); };
    front.on('close', cleanup); back.on('close', cleanup); front.on('error', cleanup); back.on('error', cleanup);
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address(); if (!address || typeof address === 'string') throw new Error('Proxy failed to listen');
  return { endpoint: `ws://127.0.0.1:${address.port}`, async close(): Promise<void> {
    for (const timer of timers) clearTimeout(timer); for (const socket of sockets) socket.terminate();
    await new Promise<void>(resolve => wss.close(() => resolve()));
    await new Promise<void>(resolve => { http.close(() => resolve()); http.closeAllConnections(); });
  } };
}
