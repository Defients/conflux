"use strict";
/**
 * server/src/index.ts
 *
 * Colyseus game server entry point.
 * Hosts the ConfluxRoom for multiplayer match lifecycle.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const colyseus_1 = require("colyseus");
const ws_transport_1 = require("@colyseus/ws-transport");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const ConfluxRoom_1 = require("./rooms/ConfluxRoom");
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
const corsOptions = {
    origin: allowedOrigins
        ? (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error(`CORS: origin '${origin}' not in allowlist`));
            }
        }
        : true,
    credentials: true,
};
const app = (0, express_1.default)();
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()), env: NODE_ENV });
});
const server = http_1.default.createServer(app);
const gameServer = new colyseus_1.Server({
    transport: new ws_transport_1.WebSocketTransport({ server }),
});
// Register the game room
gameServer.define('conflux_match', ConfluxRoom_1.ConfluxRoom);
gameServer.listen(PORT, '0.0.0.0').then(() => {
    console.log(`[ConfluxServer] env:     ${NODE_ENV}`);
    console.log(`[ConfluxServer] port:    ${PORT}`);
    console.log(`[ConfluxServer] origins: ${allowedOrigins ? allowedOrigins.join(', ') : '* (open — set ALLOWED_ORIGINS in production)'}`);
    console.log(`[ConfluxServer] health:  http://0.0.0.0:${PORT}/health`);
});
//# sourceMappingURL=index.js.map