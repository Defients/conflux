/**
 * server/src/__tests__/verifyToken.test.ts
 *
 * Tests for Firebase auth token verification.
 * Tests the dev bypass mode and the production verification path
 * using mocked Firebase Admin SDK.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin before importing the module under test.
// The path must match the import in verifyToken.ts (../firebaseAdmin from src/auth/).
vi.mock('../firebaseAdmin', () => {
  const mockVerifyIdToken = vi.fn();
  return {
    admin: {
      auth: () => ({
        verifyIdToken: mockVerifyIdToken,
      }),
    },
    db: null,
    __mockVerifyIdToken: mockVerifyIdToken,
  };
});

import { verifyAuthToken, validateUserIdClaim } from '../auth/verifyToken';

describe('auth/verifyToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FIREBASE_AUTH_DISABLED;
  });

  describe('verifyAuthToken — dev bypass mode', () => {
    it('should bypass auth and return dev-user when FIREBASE_AUTH_DISABLED=1 and no token', async () => {
      process.env.FIREBASE_AUTH_DISABLED = '1';
      const result = await verifyAuthToken(undefined);
      expect(result).not.toBeNull();
      expect(result!.uid).toBe('dev-user');
      expect(result!.authBypassed).toBe(true);
    });

    it('should bypass auth and return dev-user when token verification fails in dev mode', async () => {
      process.env.FIREBASE_AUTH_DISABLED = '1';
      const { __mockVerifyIdToken } = await import('../firebaseAdmin' as any);
      __mockVerifyIdToken.mockRejectedValueOnce(new Error('invalid token'));
      const result = await verifyAuthToken('invalid-token');
      expect(result).not.toBeNull();
      expect(result!.uid).toBe('dev-user');
      expect(result!.authBypassed).toBe(true);
    });

    it('should verify token in dev mode when token is valid', async () => {
      process.env.FIREBASE_AUTH_DISABLED = '1';
      const { __mockVerifyIdToken } = await import('../firebaseAdmin' as any);
      __mockVerifyIdToken.mockResolvedValueOnce({ uid: 'real-uid-123' });
      const result = await verifyAuthToken('valid-token');
      expect(result).not.toBeNull();
      expect(result!.uid).toBe('real-uid-123');
      expect(result!.authBypassed).toBe(true);
    });
  });

  describe('verifyAuthToken — production mode', () => {
    it('should reject when no token provided', async () => {
      const result = await verifyAuthToken(undefined);
      expect(result).toBeNull();
    });

    it('should reject when token is invalid', async () => {
      const { __mockVerifyIdToken } = await import('../firebaseAdmin' as any);
      __mockVerifyIdToken.mockRejectedValueOnce(new Error('invalid token'));
      const result = await verifyAuthToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should reject when token is expired', async () => {
      const { __mockVerifyIdToken } = await import('../firebaseAdmin' as any);
      __mockVerifyIdToken.mockRejectedValueOnce(new Error('token expired'));
      const result = await verifyAuthToken('expired-token');
      expect(result).toBeNull();
    });

    it('should return verified UID when token is valid', async () => {
      const { __mockVerifyIdToken } = await import('../firebaseAdmin' as any);
      __mockVerifyIdToken.mockResolvedValueOnce({ uid: 'verified-uid-456' });
      const result = await verifyAuthToken('valid-token');
      expect(result).not.toBeNull();
      expect(result!.uid).toBe('verified-uid-456');
      expect(result!.authBypassed).toBe(false);
    });

    it('should reject when token is revoked', async () => {
      const { __mockVerifyIdToken } = await import('../firebaseAdmin' as any);
      __mockVerifyIdToken.mockRejectedValueOnce(new Error('token revoked'));
      const result = await verifyAuthToken('revoked-token');
      expect(result).toBeNull();
    });
  });

  describe('validateUserIdClaim', () => {
    it('should return true when no userId is claimed', () => {
      expect(validateUserIdClaim(undefined, 'verified-uid')).toBe(true);
    });

    it('should return true when claimed userId matches verified UID', () => {
      expect(validateUserIdClaim('verified-uid', 'verified-uid')).toBe(true);
    });

    it('should return false when claimed userId does not match verified UID (spoof)', () => {
      expect(validateUserIdClaim('someone-else', 'verified-uid')).toBe(false);
    });
  });
});
