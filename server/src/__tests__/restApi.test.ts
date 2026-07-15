/**
 * server/src/__tests__/restApi.test.ts
 *
 * Tests for the Express REST API endpoints:
 *   GET /health        — server health check
 *   GET /diagnostics   — build identity + registered rooms
 *   GET /api/rooms     — browse open match rooms
 *   GET /api/queue/status — queue player counts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { defineRooms, REGISTERED_ROOMS } from '../gameServerConfig';
import { createExpressApp } from '../createExpressApp';

const TEST_PORT = 2572;

let gameServer: Server;
let httpServer: http.Server;

function httpRequest(
  port: number,
  path: string,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      `http://127.0.0.1:${port}${path}`,
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: data });
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error(`Request to ${path} timed out`));
    });
  });
}

describe('REST API endpoints', () => {
  beforeAll(async () => {
    const app = createExpressApp();
    httpServer = http.createServer(app);
    gameServer = new Server({
      transport: new WebSocketTransport({ server: httpServer }),
    });
    defineRooms(gameServer);
    await new Promise<void>((resolve) => {
      httpServer.listen(TEST_PORT, '127.0.0.1', resolve);
    });
  });

  afterAll(async () => {
    await gameServer.gracefullyShutdown(false);
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('GET /health returns 200 with status, uptime, and env', async () => {
    const res = await httpRequest(TEST_PORT, '/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.env).toBeDefined();
    expect(res.body.version).toBeDefined();
  });

  it('GET /diagnostics returns 200 with registered room types', async () => {
    const res = await httpRequest(TEST_PORT, '/diagnostics');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.registeredRoomTypes).toEqual(REGISTERED_ROOMS);
    expect(res.body.registeredRoomTypes).toContain('conflux_match');
    expect(res.body.registeredRoomTypes).toContain('conflux_tournament');
  });

  it('GET /api/rooms returns 200 with rooms array', async () => {
    const res = await httpRequest(TEST_PORT, '/api/rooms');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('rooms');
    expect(Array.isArray(res.body.rooms)).toBe(true);
  });

  it('GET /api/queue/status returns 200 with ranked and unranked counts', async () => {
    const res = await httpRequest(TEST_PORT, '/api/queue/status');
    expect(res.status).toBe(200);
    expect(typeof res.body.ranked).toBe('number');
    expect(typeof res.body.unranked).toBe('number');
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await httpRequest(TEST_PORT, '/nonexistent');
    expect(res.status).toBe(404);
  });
});
