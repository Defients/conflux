/**
 * server/src/firebaseAdmin.ts
 *
 * Firebase Admin SDK initialization for the Colyseus server.
 *
 * Credential resolution order:
 *   1. FIREBASE_SERVICE_ACCOUNT_PATH — path to a service account JSON file.
 *   2. GOOGLE_APPLICATION_CREDENTIALS — path to a service account JSON file
 *      (Google's standard ADC variable; honored by applicationDefault()).
 *   3. Application Default Credentials (ADC) — automatic on GCP/Cloud Run.
 *
 * Behavior when no credentials are available:
 *   - Development (NODE_ENV !== 'production'): warn and continue with `db = null`.
 *     Repositories degrade gracefully (no-ops), and onAuth will reject joins
 *     unless FIREBASE_AUTH_DISABLED=1 is set.
 *   - Production (NODE_ENV === 'production'): THROW unless FIREBASE_AUTH_DISABLED=1
 *     is explicitly set. A silently-booted server that rejects every join is the
 *     worst outcome — fail fast so the misconfiguration is visible in logs.
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';

let db: admin.firestore.Firestore | null = null;

/**
 * Whether the Admin SDK authenticated successfully and `admin.auth()` is usable.
 * When false, `verifyAuthToken` will reject all tokens (unless bypassed).
 */
export let authReady = false;

/**
 * Human-readable reason for the current authReady state, for diagnostics.
 */
export let authInitReason = 'not initialized';

const NODE_ENV = process.env.NODE_ENV || 'development';
const AUTH_DISABLED = process.env.FIREBASE_AUTH_DISABLED === '1';
const IS_PROD = NODE_ENV === 'production';

function resolveCredential(): admin.credential.Credential | undefined {
  const reasons: string[] = [];
  const readServiceAccountFile = (path: string, varName: string): admin.credential.Credential | undefined => {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(path, 'utf8'));
      authInitReason = `service account at ${path} (${varName})`;
      return admin.credential.cert(serviceAccount);
    } catch (err) {
      reasons.push(`failed to read ${varName} (${path}): ${err instanceof Error ? err.message : String(err)}`);
      return undefined;
    }
  };

  // 1. Explicit service account path (our own variable).
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const cred = readServiceAccountFile(serviceAccountPath, 'FIREBASE_SERVICE_ACCOUNT_PATH');
    if (cred) return cred;
  }

  // 2. GOOGLE_APPLICATION_CREDENTIALS — read eagerly instead of relying on
  //    applicationDefault()'s lazy resolution, so a missing/malformed file
  //    fails fast here rather than surfacing as verifyIdToken errors later.
  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (adcPath) {
    const cred = readServiceAccountFile(adcPath, 'GOOGLE_APPLICATION_CREDENTIALS');
    if (cred) return cred;
  }

  // 3. FIREBASE_SERVICE_ACCOUNT_JSON — inline service account JSON for hosts
  //    without secret-file mounts (e.g. Render free tier).
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    try {
      const serviceAccount = JSON.parse(inlineJson);
      authInitReason = 'service account from FIREBASE_SERVICE_ACCOUNT_JSON';
      return admin.credential.cert(serviceAccount);
    } catch (err) {
      reasons.push(`failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4. Application Default Credentials — automatic on GCP/Cloud Run.
  try {
    const cred = admin.credential.applicationDefault();
    authInitReason = 'application default credentials';
    return cred;
  } catch {
    reasons.push('no credentials available (set FIREBASE_SERVICE_ACCOUNT_PATH, GOOGLE_APPLICATION_CREDENTIALS, or FIREBASE_SERVICE_ACCOUNT_JSON)');
  }

  authInitReason = reasons.join(' | ');
  return undefined;
}

try {
  if (!admin.apps.length) {
    const credential = resolveCredential();
    if (!credential && IS_PROD && !AUTH_DISABLED) {
      // Production without credentials and without an explicit bypass is a
      // misconfiguration. Fail fast with an actionable message instead of
      // booting a server that silently rejects every room join.
      const reason = authInitReason !== 'not initialized' ? ` Reason: ${authInitReason}.` : '';
      throw new Error(
        `[Firebase] No credentials found in production.${reason} Set FIREBASE_SERVICE_ACCOUNT_PATH ` +
        '(path to a service account JSON) or GOOGLE_APPLICATION_CREDENTIALS, or set ' +
        'FIREBASE_AUTH_DISABLED=1 to bypass auth (NOT recommended for production).'
      );
    }
    admin.initializeApp({ credential });
  }
  db = admin.firestore();
  authReady = true;
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  authInitReason = message;
  if (IS_PROD && !AUTH_DISABLED) {
    // Re-throw in production so the server exits with a visible error.
    throw err;
  }
  // Development: degrade gracefully.
  console.warn(`[Firebase] Admin SDK init skipped — ${message}. Profile persistence disabled.`);
  if (!AUTH_DISABLED) {
    console.warn(
      '[Firebase] onAuth will reject all joins. Set FIREBASE_AUTH_DISABLED=1 for local dev, ' +
      'or provide credentials (FIREBASE_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS).'
    );
  }
}

export { db, admin };
