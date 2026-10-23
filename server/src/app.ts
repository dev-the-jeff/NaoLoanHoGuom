import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import cors from 'cors';
import express from 'express';
import { NET_CONFIG as N } from '../../shared/src/protocol';
import { RaceRoom } from './rooms/RaceRoom';
/** Creates a standalone server; callers own listen/shutdown for testing or local development. */
export function createGameServer(roomType: typeof RaceRoom = RaceRoom): Server {
  const transport = new WebSocketTransport({ maxPayload: N.maxPayloadBytes, perMessageDeflate: false, pingInterval: 3000, pingMaxRetries: 2 });
  const server = new Server({ transport, greet: false, gracefullyShutdown: false,
    express: app => {
      app.disable('x-powered-by');
      app.use(cors()); app.use(express.json({ limit: '1kb' }));
      if (process.env.LOCAL_METRICS === '1') app.get('/metrics', (_request, response) => response.json({ cpu: process.cpuUsage(), uptime: process.uptime() }));
      app.get('/health', (_request, response) => response.json({ ok: true, milestone: 'M3', tickRate: N.tickRate, snapshotRate: N.snapshotRate }));
    },
  });
  server.define('race', roomType); return server;
}

