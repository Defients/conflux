/**
 * server/src/createExpressApp.ts
 *
 * Creates and configures the Express app with all REST API routes.
 * Extracted from index.ts so tests can reuse the same route definitions
 * without duplicating code.
 */

import express from 'express';
import cors, { CorsOptions } from 'cors';
import { matchMaker } from 'colyseus';
import { RoomNames } from '../../shared/protocol';
import { REGISTERED_ROOMS } from './gameServerConfig';

const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_VERSION = process.env.npm_package_version || process.env.APP_VERSION || '0.0.0';
const COMMIT_SHA =
  process.env.RENDER_GIT_COMMIT ||
  process.env.GIT_COMMIT ||
  process.env.SOURCE_VERSION ||
  'unknown';
const BUILD_TIMESTAMP = process.env.BUILD_TIMESTAMP || 'unknown';
const STARTED_AT = new Date().toISOString();

const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;
const allowedOrigins = rawAllowedOrigins
  ? rawAllowedOrigins.split(',').map(o => o.trim()).filter(Boolean)
  : null;

const corsOptions: CorsOptions = {
  origin: allowedOrigins
    ? (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin '${origin}' not in allowlist`));
        }
      }
    : true,
  credentials: true,
};

export function createExpressApp(): express.Express {
  const app = express();
  app.use(cors(corsOptions));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      env: NODE_ENV,
      version: APP_VERSION,
      commit: COMMIT_SHA,
    });
  });

  app.get('/diagnostics', (_req, res) => {
    res.json({
      status: 'ok',
      env: NODE_ENV,
      version: APP_VERSION,
      commit: COMMIT_SHA,
      buildTimestamp: BUILD_TIMESTAMP,
      startedAt: STARTED_AT,
      uptime: Math.floor(process.uptime()),
      registeredRoomTypes: REGISTERED_ROOMS,
    });
  });

  app.get('/api/queue/status', async (_req, res) => {
    try {
      const rankedRooms = await matchMaker.query({ name: RoomNames.QUEUE_RANKED });
      const unrankedRooms = await matchMaker.query({ name: RoomNames.QUEUE_UNRANKED });
      const rankedCount = rankedRooms.reduce((sum: number, r: any) => sum + (r.clients ?? 0), 0);
      const unrankedCount = unrankedRooms.reduce((sum: number, r: any) => sum + (r.clients ?? 0), 0);
      res.json({ ranked: rankedCount, unranked: unrankedCount });
    } catch {
      res.status(500).json({ error: 'Failed to fetch queue status' });
    }
  });

  app.get('/api/rooms', async (_req, res) => {
    try {
      const rooms = await matchMaker.query({ name: RoomNames.MATCH });
      const openRooms = rooms
        .filter((r: any) => {
          const phase = r.metadata?.phase ?? 'lobby';
          const isPrivate = r.metadata?.isPrivate ?? false;
          const isJoinable = phase === 'lobby' && !isPrivate && (r.clients ?? 0) < (r.maxClients ?? 6);
          const hasRoomCode = r.metadata?.roomCode;
          return isJoinable && hasRoomCode;
        })
        .map((r: any) => ({
          roomId: r.roomId,
          roomCode: r.metadata?.roomCode ?? '',
          playerCount: r.clients ?? 0,
          maxPlayers: r.maxClients ?? 6,
          phase: r.metadata?.phase ?? 'lobby',
        }));
      res.json({ rooms: openRooms });
    } catch (err) {
      console.error('[ConfluxServer] Error fetching rooms:', err);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  });

  return app;
}
