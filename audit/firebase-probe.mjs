// audit/firebase-probe.mjs — live Firebase connectivity + rules probe.
// Reads VITE_FIREBASE_* from ../.env, signs in anonymously, and exercises
// each rules path. Writes only to this probe's own anonymous profile and
// a single disposable ghost doc.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env');
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const { initializeApp } = await import('firebase/app');
const { getAuth, signInAnonymously } = await import('firebase/auth');
const {
  getFirestore, doc, getDoc, setDoc, deleteDoc,
  collection, query, where, orderBy, limit, getDocs, terminate,
} = await import('firebase/firestore');

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const results = [];
const report = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} :: ${detail}`);
};

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const t0 = Date.now();
const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout:${label}`)), ms))]);

// 1. Anonymous auth
let uid = null;
try {
  const cred = await withTimeout(signInAnonymously(auth), 15000, 'anon-signin');
  uid = cred.user.uid;
  report('anonymous sign-in', true, `uid=${uid.slice(0, 8)}… in ${Date.now() - t0}ms`);
} catch (e) {
  report('anonymous sign-in', false, `${e.code ?? e.message} — check that Anonymous provider is enabled in Firebase console`);
  console.log(JSON.stringify(results, null, 2));
  process.exit(1);
}

const myProfileRef = doc(db, 'profiles', uid);

// 2. Read own (probably nonexistent) profile
try {
  const snap = await withTimeout(getDoc(myProfileRef), 15000, 'profile-read');
  report('read own profile', true, snap.exists() ? 'document exists' : 'document absent (allowed read)');
} catch (e) {
  report('read own profile', false, e.code ?? e.message);
}

// 3. Legit profile create — sane fields only
try {
  await withTimeout(setDoc(myProfileRef, {
    name: 'probe-pilot', avatarId: '🛰️', circuitPoints: 0, winStreak: 0,
    unlockedChassis: ['STANDARD'], unlockedAccolades: [], gauntletHighScore: 0,
    appliedMatchIds: [], dailyBests: {}, eventMastery: {}, revision: 1,
    skills: { speed: {}, tech: {}, endurance: {}, availableCP: 0 },
    loadouts: {}, unlockedModules: [],
    rank: { rating: 1000, tier: 'bronze', wins: 0, losses: 0, peakRating: 1000 },
    sponsorships: {}, firebaseUid: uid,
  }), 15000, 'profile-create');
  report('create own profile (legit)', true, 'written');
} catch (e) {
  report('create own profile (legit)', false, `${e.code ?? e.message}`);
}

// 3b. Cosmetic-only update — should be ALLOWED under hardened rules
try {
  await withTimeout(setDoc(myProfileRef, {
    name: 'probe-pilot-2', avatarId: '🚀', revision: 2, firebaseUid: uid,
  }, { merge: true }), 15000, 'cosmetic-update');
  report('cosmetic-only profile update', true, 'written');
} catch (e) {
  report('cosmetic-only profile update', false, `denied — cosmetic writes should stay allowed (${e.code ?? e.message})`);
}

// 4. MALICIOUS write — forge currency. Should be DENIED by hardened rules.
let forgeWriteSucceeded = false;
try {
  await withTimeout(setDoc(myProfileRef, {
    name: 'probe-pilot', avatarId: '🛰️', circuitPoints: 99999999, winStreak: 999,
    rank: { rating: 9999, tier: 'grandmaster', wins: 999, losses: 0, peakRating: 9999 },
    appliedMatchIds: [], dailyBests: {}, revision: 2,
  }, { merge: true }), 15000, 'forge-write');
  forgeWriteSucceeded = true;
  report('forge circuitPoints=99,999,999 + rating=9999', false, 'WRITE SUCCEEDED — progression fields are client-forgeable');
} catch (e) {
  report('forge circuitPoints=99,999,999 + rating=9999', true, `denied as intended (${e.code})`);
}

// 5. Read someone else's profile — should be DENIED
try {
  const snap = await withTimeout(getDoc(doc(db, 'profiles', 'definitely-not-my-uid')), 15000, 'other-profile');
  report('read another user\'s profile', false, `allowed (exists=${snap.exists()}) — cross-user read leak`);
} catch (e) {
  report('read another user\'s profile', true, `denied as intended (${e.code})`);
}

// 6. Leaderboard read (any authed user)
try {
  const q = query(collection(db, 'leaderboards', 'allTime', 'entries'), orderBy('score', 'desc'), limit(3));
  const snap = await withTimeout(getDocs(q), 15000, 'lb-read');
  report('read allTime leaderboard', true, `${snap.size} entries`);
} catch (e) {
  report('read allTime leaderboard', false, e.code ?? e.message);
}

// 7. Leaderboard write — should be DENIED (server-only)
try {
  await withTimeout(setDoc(doc(db, 'leaderboards', 'allTime', 'entries', uid), {
    userId: uid, name: 'probe', score: 999999, submittedAt: Date.now(),
  }), 15000, 'lb-write');
  report('write leaderboard entry directly', false, 'WRITE SUCCEEDED — leaderboard is client-forgeable');
} catch (e) {
  report('write leaderboard entry directly', true, `denied as intended (${e.code})`);
}

// 8. Ghost submit (own uid) + ghost list read
let ghostId = null;
try {
  ghostId = `${uid}-probe-${Date.now()}`;
  await withTimeout(setDoc(doc(db, 'ghosts', ghostId), {
    ghostId, userId: uid, ownerName: 'probe-pilot', ownerAvatarId: '🛰️',
    seed: 'probe-seed', runLength: 8, schemaVersion: 1,
    tileResults: [{ tileIndex: 1, stars: 2, primaryMetric: 123 }],
    submittedAt: Date.now(), ownerCircuitPoints: 0,
  }), 15000, 'ghost-create');
  report('submit own ghost run', true, `ghostId=${ghostId.slice(-14)}`);
} catch (e) {
  report('submit own ghost run', false, e.code ?? e.message);
}
try {
  const q = query(collection(db, 'ghosts'), where('seed', '==', 'probe-seed'), orderBy('ownerCircuitPoints', 'desc'), limit(5));
  const snap = await withTimeout(getDocs(q), 20000, 'ghost-query');
  report('ghost seed+orderBy query (needs composite index)', true, `${snap.size} docs`);
} catch (e) {
  report('ghost seed+orderBy query (needs composite index)', false, `${e.code ?? e.message} — likely missing composite index`);
}

// 9. Ghost write as another user — should be DENIED
try {
  await withTimeout(setDoc(doc(db, 'ghosts', `${uid}-spoof-${Date.now()}`), {
    userId: 'someone-else', ownerName: 'spoof', seed: 'x', runLength: 8,
    tileResults: [], submittedAt: Date.now(),
  }), 15000, 'ghost-spoof');
  report('submit ghost claiming another userId', false, 'WRITE SUCCEEDED — ghost ownership not enforced');
} catch (e) {
  report('submit ghost claiming another userId', true, `denied as intended (${e.code})`);
}

// 10. Tournaments read
try {
  const snap = await withTimeout(getDocs(query(collection(db, 'tournaments'), limit(5))), 15000, 'tourney-read');
  report('read tournaments', true, `${snap.size} docs`);
} catch (e) {
  report('read tournaments', false, e.code ?? e.message);
}

// 11. Match receipts + history subcollections — owner should be able to read
//     (server writes at matchReceipts/{uid}/receipts/{matchId} and
//     matchHistory/{uid}/matches/{matchId})
try {
  const snap = await withTimeout(getDocs(query(collection(db, 'matchReceipts', uid, 'receipts'), limit(5))), 15000, 'receipts-read');
  report('read own match receipts subcollection', true, `${snap.size} docs`);
} catch (e) {
  report('read own match receipts subcollection', false, `${e.code ?? e.message} — subcollection rule missing`);
}
try {
  const snap = await withTimeout(getDocs(query(collection(db, 'matchHistory', uid, 'matches'), limit(5))), 15000, 'history-read');
  report('read own match history subcollection', true, `${snap.size} docs`);
} catch (e) {
  report('read own match history subcollection', false, `${e.code ?? e.message} — subcollection rule missing`);
}
// Cross-user receipts read — should be DENIED
try {
  await withTimeout(getDocs(query(collection(db, 'matchReceipts', 'definitely-not-my-uid', 'receipts'), limit(1))), 15000, 'receipts-xread');
  report('read another user\'s receipts', false, 'allowed — cross-user receipt leak');
} catch (e) {
  report('read another user\'s receipts', true, `denied as intended (${e.code})`);
}
// Client write to receipts — should be DENIED (server-only)
try {
  await withTimeout(setDoc(doc(db, 'matchReceipts', uid, 'receipts', 'fake-receipt'), {
    matchId: 'fake-receipt', forged: true,
  }), 15000, 'receipt-write');
  report('write match receipt directly', false, 'WRITE SUCCEEDED — receipts are client-forgeable');
} catch (e) {
  report('write match receipt directly', true, `denied as intended (${e.code})`);
}

// Cleanup: restore legit profile & delete probe ghost. Note: profile delete
// is denied by design under hardened rules; the leftover doc is cosmetic-only.
try {
  if (forgeWriteSucceeded) {
    await setDoc(myProfileRef, { circuitPoints: 0, winStreak: 0, revision: 3 }, { merge: true });
  }
  if (ghostId) await deleteDoc(doc(db, 'ghosts', ghostId));
  try {
    await deleteDoc(myProfileRef);
    console.log('cleanup: probe docs deleted');
  } catch {
    await setDoc(myProfileRef, { name: 'probe-cleanup', revision: 99 }, { merge: true });
    console.log('cleanup: profile delete denied by rules (expected) — reset to cosmetic stub');
  }
} catch (e) {
  console.log('cleanup partial:', e.code ?? e.message);
}

await terminate(db);
console.log(JSON.stringify(results, null, 2));
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
