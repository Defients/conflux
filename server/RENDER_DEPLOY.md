# Render Deployment — Conflux Circuit Server

The Colyseus multiplayer backend is a plain Node.js web service.
It runs on Render free tier with no Docker required.

---

## Exact Render Settings

| Field | Value |
|---|---|
| **Service type** | Web Service |
| **Root Directory** | `server` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/health` |
| **Auto-Deploy** | Yes (on push to `main`) |

---

## Environment Variables (set in Render dashboard)

| Variable | Value | Required |
|---|---|---|
| `NODE_ENV` | `production` | Yes |
| `ALLOWED_ORIGINS` | `https://confluxcircuit.com` | Yes |
| `GOOGLE_APPLICATION_CREDENTIALS` | *(JSON path or leave unset)* | No — Firebase auth/profile sync is disabled when absent, but the game server runs fully |

> **`PORT` is set automatically by Render (defaults to `10000`). Do not set it manually.**

---

## Frontend Integration

In the client `.env` (or Render env for the static host), set:

```
VITE_SERVER_URL=wss://<your-service-name>.onrender.com
```

- Use `wss://` (WebSocket Secure) — Render terminates TLS.
- Do **not** include a trailing slash or path.
- After setting this, rebuild the client: `npm run build` from the repo root.

---

## How the Build Works

`rootDir` in `server/tsconfig.json` is set to `..` (the repo root) so that
shared types in `/shared` compile together with the server source.
Output lands at `server/dist/server/src/index.js` — which is what `npm start` runs.

Render clones the entire repository, sets Root Directory to `server/`,
and runs all commands from there. The `../shared` relative import path
resolves correctly because the full repo is present.

---

## Free-Tier Caveats

- **Spin-down**: Render free web services sleep after ~15 minutes of inactivity
  (no inbound HTTP or WebSocket traffic). Cold start takes ~30–60 seconds.
- **Cold start + WebSockets**: When the service wakes, the first WebSocket connection
  attempt from the client will fail or time out. The client's auto-reconnect logic
  (5 attempts, exponential backoff) in `services/networkService.ts` handles this
  transparently for reconnects during a match, but the **initial lobby connection**
  will show a "Connection lost" error that the user must retry manually.
- **No keep-alive hacks**: Do not add synthetic pings to defeat spin-down — this
  violates Render's free tier terms and masks the real availability profile.
- **750 hr/month limit**: One instance running 24/7 uses ~744 hr/month, which fits
  within the free allowance for a single service.
- **No persistent state**: Rooms are in-memory. A cold start clears all active rooms.
  Players mid-match when the service sleeps will need to start a new room.

---

## Local Development

No changes required. Run from `server/`:

```bash
npm run dev   # ts-node-dev hot-reload on port 2567
```

The `ALLOWED_ORIGINS` env var is intentionally absent in local dev, which leaves
CORS open (`*`). Set it only in the Render dashboard.
