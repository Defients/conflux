/**
 * server/src/index.ts
 * 
 * Colyseus game server entry point.
 * Hosts the ConfluxRoom for multiplayer match lifecycle.
 */

import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import cors, { CorsOptions } from 'cors';
import http from 'http';
import { ConfluxRoom } from './rooms/ConfluxRoom';

const PORT = Number(process.env.PORT) || 2567;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Set ALLOWED_ORIGINS to a comma-separated list of permitted frontend origins.
// Example (Render env var): ALLOWED_ORIGINS=https://confluxcircuit.com
// When unset (local dev), all origins are permitted.
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

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()), env: NODE_ENV });
});

const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

// Register the game room
gameServer.define('conflux_match', ConfluxRoom);

gameServer.listen(PORT, '0.0.0.0').then(() => {
  console.log(`[ConfluxServer] env:     ${NODE_ENV}`);
  console.log(`[ConfluxServer] port:    ${PORT}`);
  console.log(`[ConfluxServer] origins: ${allowedOrigins ? allowedOrigins.join(', ') : '* (open — set ALLOWED_ORIGINS in production)'}`);
  console.log(`[ConfluxServer] health:  http://0.0.0.0:${PORT}/health`);
});
