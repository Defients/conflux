/**
 * server/src/auth/verifyToken.ts
 *
 * Firebase Auth token verification for Colyseus room joins.
 *
 * The server must never derive trusted identity from a client-supplied userId.
 * Instead, the client sends a Firebase ID token, and the server verifies it
 * with Firebase Admin SDK to derive the authoritative UID.
 *
 * In development (when FIREBASE_AUTH_DISABLED is set), token verification
 * is bypassed. This bypass is explicit, opt-in, and must never be used in
 * production.
 */

import { admin } from '../firebaseAdmin';

export interface VerifiedIdentity {
  uid: string;
  /** Whether auth was bypassed (dev mode only). */
  authBypassed: boolean;
}

/**
 * Verify a Firebase ID token and return the verified UID.
 *
 * @param idToken - The Firebase ID token from the client.
 * @returns Verified identity with UID, or null if verification fails.
 */
export async function verifyAuthToken(idToken?: string): Promise<VerifiedIdentity | null> {
  // Development bypass: explicit, opt-in, non-production.
  if (process.env.FIREBASE_AUTH_DISABLED === '1') {
    if (!idToken) {
      // In dev bypass mode without a token, use a dev UID.
      return { uid: 'dev-user', authBypassed: true };
    }
    // In dev bypass mode with a token, still try to verify but fall back gracefully.
    try {
      const decoded = await admin.auth().verifyIdToken(idToken, true);
      return { uid: decoded.uid, authBypassed: true };
    } catch {
      return { uid: 'dev-user', authBypassed: true };
    }
  }

  // Production: require valid token.
  if (!idToken) {
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken, true);
    return { uid: decoded.uid, authBypassed: false };
  } catch (err) {
    // Token is invalid, expired, revoked, or malformed.
    return null;
  }
}

/**
 * Check if a client-supplied userId matches the verified UID.
 * If the client claims a different UID, it's a spoofing attempt.
 */
export function validateUserIdClaim(claimedUserId: string | undefined, verifiedUid: string): boolean {
  if (!claimedUserId) return true; // No claim is fine; server will use verified UID.
  return claimedUserId === verifiedUid;
}
