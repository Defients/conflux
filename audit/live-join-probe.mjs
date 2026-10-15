// audit/live-join-probe.mjs — verifies the DEPLOYED Render server can verify
// Firebase ID tokens (i.e. service account env vars are set correctly).
// 1) garbage token must be REJECTED (auth is enforced)
// 2) real anonymous token + matching userId must JOIN (credentials work)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(join(here, '..', '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const { initializeApp } = await import('firebase/app');
const { getAuth, signInAnonymously } = await import('firebase/auth');
const { Client } = await import('colyseus.js');

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const cred = await signInAnonymously(auth);
const idToken = await cred.user.getIdToken();
const uid = cred.user.uid;
console.log(`signed in anonymously: uid=${uid.slice(0, 8)}…`);

const serverUrl = (env.VITE_SERVER_URL || 'ws://localhost:2567');
console.log(`connecting to ${serverUrl}`);
const client = new Client(serverUrl);
const baseOpts = { playerName: 'auth-probe', avatarId: '🛰️', chassisId: 'STANDARD' };

// Probe A — garbage token must be rejected
try {
  const room = await client.joinOrCreate('conflux_match', {
    ...baseOpts, userId: 'garbage-uid', idToken: 'garbage.token.value',
  });
  console.log(`FAIL garbage token JOINED room ${room.roomId} — auth is not being enforced`);
  await room.leave(true);
} catch (e) {
  console.log(`PASS garbage token rejected :: ${e.message}`);
}

// Probe B — real token must join
try {
  const room = await client.joinOrCreate('conflux_match', {
    ...baseOpts, userId: uid, idToken,
  });
  console.log(`PASS real token joined room ${room.roomId} (sessionId=${room.sessionId}) — Firebase service account is working`);
  await room.leave(true);
} catch (e) {
  console.log(`FAIL real token rejected :: ${e.message}`);
}

// Probe C — spoofed userId must be rejected even with a valid token
try {
  const room = await client.joinOrCreate('conflux_match', {
    ...baseOpts, userId: 'not-my-uid', idToken,
  });
  console.log(`FAIL spoofed userId JOINED room ${room.roomId} — userId spoofing possible`);
  await room.leave(true);
} catch (e) {
  console.log(`PASS spoofed userId rejected :: ${e.message}`);
}

process.exit(0);
