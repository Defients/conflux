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
import { authReady, authInitReason } from './firebaseAdmin';
import { verifyAuthToken } from './auth/verifyToken';
import { getMatchReceipt, saveMatchReceipt, updateProfileTransaction } from './services/profileRepository';
import { writeLeaderboardEntry } from './services/leaderboardRepository';
import { writeMatchHistory } from './services/matchHistoryRepository';
import { applyMatchSummaryToProfile, MatchSummary } from '../../shared/matchSummary';
import { CHASSIS_DEFINITIONS, CHASSIS_MODULES, SKILL_TREE_NODES } from '../../shared/constants';
import { ChassisId, LeaderboardEntry, LoadoutSlot, MatchHistoryEntry, PilotProfile } from '../../shared/types';

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

// Client-supplied local match summaries are trusted at most up to these bounds.
// Legit CP per match is ~280 max (placement ≤50 + ≤96 star CP ×1.25 streak +
// contract rewards); 400 leaves headroom without allowing jackpot writes.
const MAX_LOCAL_MATCH_CP = 400;
const MAX_RUN_LENGTH = 50;
const MAX_DAILY_BEST = 250;
const MAX_GAUNTLET_TILES = 500;

/**
 * A client-supplied profile may only seed cosmetic identity on first sync.
 * All progression fields start at starter values — cloud progression is
 * server-owned from that point on. This prevents first-sync CP injection.
 */
const sanitizeSeedProfile = (p: PilotProfile): PilotProfile => ({
  name: typeof p.name === 'string' && p.name.trim() ? p.name.slice(0, 32) : 'Pilot',
  avatarId: typeof p.avatarId === 'string' && p.avatarId ? p.avatarId : '🚀',
  circuitPoints: 0,
  winStreak: 0,
  unlockedChassis: [ChassisId.Standard],
  unlockedAccolades: [],
  rivalData: p.rivalData && typeof p.rivalData === 'object'
    ? { ...p.rivalData, wins: 0, losses: 0 }
    : { name: 'Rival', avatarId: '👾', favoredChassis: ChassisId.Standard, wins: 0, losses: 0, traits: [] },
  gauntletHighScore: 0,
  sponsorships: {},
  appliedMatchIds: [],
  dailyBests: {},
  skills: { speed: {}, tech: {}, endurance: {}, availableCP: 0 },
  loadouts: {},
  unlockedModules: [],
  eventMastery: {},
  rank: { rating: 1000, tier: 'bronze', wins: 0, losses: 0, peakRating: 1000 },
});

const isSaneLocalSummary = (summary: MatchSummary | undefined): summary is MatchSummary => {
  if (!summary) return false;
  if (typeof summary.matchId !== 'string' || summary.matchId.length === 0 || summary.matchId.length > 128) return false;
  if (!summary.cp || typeof summary.cp.totalCp !== 'number') return false;
  if (summary.cp.totalCp < 0 || summary.cp.totalCp > MAX_LOCAL_MATCH_CP) return false;
  if (typeof summary.runLength !== 'number' || summary.runLength < 1 || summary.runLength > MAX_RUN_LENGTH) return false;
  if (typeof summary.humanPlacement !== 'number' || summary.humanPlacement < 0 || summary.humanPlacement > 6) return false;
  if (summary.dailyPersonalBest != null && (typeof summary.dailyPersonalBest !== 'number' || summary.dailyPersonalBest < 0 || summary.dailyPersonalBest > MAX_DAILY_BEST)) return false;
  if (summary.gauntletTilesSurvived != null && (typeof summary.gauntletTilesSurvived !== 'number' || summary.gauntletTilesSurvived < 0 || summary.gauntletTilesSurvived > MAX_GAUNTLET_TILES)) return false;
  return true;
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
      firebaseAuthReady: authReady,
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
      firebaseAuthReady: authReady,
      firebaseAuthReason: authInitReason,
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

  app.get('/api/rooms', async (req, res) => {
    try {
      const includeSpectatable = req.query.spectatable === '1' || req.query.includeActive === '1';
      const rooms = await matchMaker.query({ name: RoomNames.MATCH });
      const openRooms = rooms
        .filter((r: any) => {
          const phase = r.metadata?.phase ?? 'lobby';
          const isPrivate = r.metadata?.isPrivate ?? false;
          const hasRoomCode = Boolean(r.metadata?.roomCode);
          if (!hasRoomCode) return false;
          if (includeSpectatable) {
            return !isPrivate;
          }
          const isJoinable = phase === 'lobby' && !isPrivate && (r.clients ?? 0) < (r.maxClients ?? 6);
          return isJoinable;
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

  // Retrieve a persisted match receipt for reconnect/results recovery
  app.get('/api/progression/receipt/:matchId', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      const idToken = bearerToken || (typeof req.query.idToken === 'string' ? req.query.idToken : undefined);
      const identity = await verifyAuthToken(idToken);
      if (!identity) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const receipt = await getMatchReceipt(identity.uid, req.params.matchId);
      if (!receipt) {
        res.status(404).json({ error: 'Receipt not found' });
        return;
      }
      res.json({ summary: receipt });
    } catch (err) {
      console.error('[ConfluxServer] Error fetching receipt:', err);
      res.status(500).json({ error: 'Failed to fetch receipt' });
    }
  });

  // Publish a completed local/daily/gauntlet race to cloud profile, leaderboards, and match history
  app.post('/api/progression/local-match', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      const idToken = bearerToken || req.body?.idToken;
      const identity = await verifyAuthToken(idToken);
      if (!identity) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const summary = req.body?.summary as MatchSummary | undefined;
      const clientProfile = req.body?.profile as PilotProfile | undefined;
      if (!isSaneLocalSummary(summary)) {
        res.status(400).json({ error: 'Invalid match summary payload' });
        return;
      }

      // Local matches cannot grant ranked rating changes
      const sanitizedSummary: MatchSummary = {
        ...summary,
        mode: 'local',
        ratingChange: null,
        newRating: null,
        newTier: null,
      };

      const existingReceipt = await getMatchReceipt(identity.uid, sanitizedSummary.matchId);
      if (existingReceipt) {
        res.json({ summary: existingReceipt, deduplicated: true });
        return;
      }

      const updatedProfile = await updateProfileTransaction(identity.uid, (currentProfile) => {
        // Only cosmetic identity fields may seed a brand-new cloud profile;
        // progression fields are reset to starter values (server-owned).
        // Spread order also defaults any progression fields missing on an
        // existing cosmetic-only doc.
        const baseProfile = currentProfile
          ? { ...sanitizeSeedProfile(currentProfile), ...currentProfile }
          : (clientProfile ? sanitizeSeedProfile(clientProfile) : null);
        if (!baseProfile) return null;
        const applied = applyMatchSummaryToProfile(baseProfile, sanitizedSummary);
        return applied ?? baseProfile;
      });

      await saveMatchReceipt(identity.uid, sanitizedSummary);

      const effectiveProfile = updatedProfile;
      if (effectiveProfile) {
        const lbEntry: LeaderboardEntry = {
          userId: identity.uid,
          playerName: effectiveProfile.name,
          avatarId: effectiveProfile.avatarId,
          circuitPoints: effectiveProfile.circuitPoints,
          bestScore: sanitizedSummary.humanPlacement === 0 ? 1 : 0,
          updatedAt: sanitizedSummary.completedAt || Date.now(),
        };
        await writeLeaderboardEntry('allTime', lbEntry);

        if (sanitizedSummary.isDaily && sanitizedSummary.dailyIsNewBest && sanitizedSummary.dailyPersonalBest !== null) {
          await writeLeaderboardEntry('daily', { ...lbEntry, bestScore: sanitizedSummary.dailyPersonalBest }, sanitizedSummary.seed);
        }

        if (sanitizedSummary.isGauntlet && sanitizedSummary.gauntletNewHighScore && sanitizedSummary.gauntletTilesSurvived !== null) {
          await writeLeaderboardEntry('gauntlet', { ...lbEntry, bestScore: sanitizedSummary.gauntletTilesSurvived });
        }

        const historyEntry: MatchHistoryEntry = {
          matchId: sanitizedSummary.matchId,
          seed: sanitizedSummary.seed,
          mode: 'local',
          completedAt: sanitizedSummary.completedAt || Date.now(),
          runLength: sanitizedSummary.runLength,
          placement: sanitizedSummary.humanPlacement + 1,
          totalPlayers: Math.max(1, sanitizedSummary.standings?.length ?? 1),
          cpEarned: sanitizedSummary.cp.totalCp,
          isDaily: sanitizedSummary.isDaily,
          isGauntlet: sanitizedSummary.isGauntlet,
          rivalDefeated: sanitizedSummary.rivalDelta?.wins === 1,
          gauntletTilesSurvived: sanitizedSummary.gauntletTilesSurvived,
        };
        await writeMatchHistory(identity.uid, historyEntry);
      }

      res.json({ summary: sanitizedSummary, deduplicated: false });
    } catch (err) {
      console.error('[ConfluxServer] Error recording local match progression:', err);
      res.status(500).json({ error: 'Failed to record local match progression' });
    }
  });

  // Server-authoritative progression purchases: chassis/module/skill unlocks
  // and module equips. The client sends only the item identity; costs come
  // from the shared catalog and CP is debited inside the profile transaction.
  app.post('/api/progression/purchase', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      const idToken = bearerToken || req.body?.idToken;
      const identity = await verifyAuthToken(idToken);
      if (!identity) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const kind = req.body?.kind;
      const itemId = req.body?.itemId;
      if (!['chassis', 'module', 'skill', 'equipModule'].includes(kind)
          || (typeof itemId !== 'string' && itemId !== null)) {
        res.status(400).json({ error: 'Invalid purchase payload' });
        return;
      }

      let rejection: string | null = null;
      const updatedProfile = await updateProfileTransaction(identity.uid, (profile) => {
        const fail = (reason: string): null => {
          rejection = reason;
          return null;
        };
        if (!profile) return fail('profile-not-found');
        // Cosmetic-only docs may lack progression fields — fill defaults.
        const normalized: PilotProfile = { ...sanitizeSeedProfile(profile), ...profile };
        const cp = normalized.circuitPoints ?? 0;
        const spend = (cost: number): PilotProfile => ({
          ...normalized,
          circuitPoints: cp - cost,
          skills: normalized.skills ? { ...normalized.skills, availableCP: cp - cost } : normalized.skills,
        });

        switch (kind) {
          case 'chassis': {
            const def = CHASSIS_DEFINITIONS[itemId as ChassisId];
            if (!def) return fail('unknown-chassis');
            if (normalized.unlockedChassis.includes(itemId)) return fail('already-owned');
            if (cp < def.cost) return fail('insufficient-cp');
            const next = spend(def.cost);
            return { ...next, unlockedChassis: [...normalized.unlockedChassis, itemId as ChassisId] };
          }
          case 'module': {
            const mod = CHASSIS_MODULES.find(m => m.id === itemId);
            if (!mod) return fail('unknown-module');
            if ((normalized.unlockedModules ?? []).includes(itemId)) return fail('already-owned');
            if (cp < mod.cpCost) return fail('insufficient-cp');
            const next = spend(mod.cpCost);
            return { ...next, unlockedModules: [...(normalized.unlockedModules ?? []), itemId] };
          }
          case 'skill': {
            const node = SKILL_TREE_NODES.find(n => n.id === itemId);
            if (!node) return fail('unknown-skill');
            const owned = normalized.skills?.[node.tree] ?? {};
            if (owned[itemId]) return fail('already-owned');
            if (!node.prerequisites.every(p => owned[p])) return fail('missing-prerequisite');
            if (cp < node.cpCost) return fail('insufficient-cp');
            const next = spend(node.cpCost);
            const nextSkills = next.skills ?? { speed: {}, tech: {}, endurance: {}, availableCP: 0 };
            return {
              ...next,
              skills: {
                ...nextSkills,
                [node.tree]: { ...(nextSkills[node.tree] ?? {}), [itemId]: true },
              },
            };
          }
          case 'equipModule': {
            const chassisId = req.body?.chassisId as ChassisId;
            const slot = req.body?.slot as LoadoutSlot;
            if (!Object.values(ChassisId).includes(chassisId) || !['core', 'thrusters', 'shielding'].includes(slot)) {
              return fail('invalid-loadout');
            }
            if (!normalized.unlockedChassis.includes(chassisId)) return fail('chassis-not-unlocked');
            const moduleId = itemId === '' ? null : itemId;
            if (moduleId !== null && !(normalized.unlockedModules ?? []).includes(moduleId)) {
              return fail('module-not-unlocked');
            }
            const loadouts = { ...(normalized.loadouts ?? {}) };
            const existing = loadouts[chassisId] ?? { chassisId, modules: {} };
            loadouts[chassisId] = {
              ...existing,
              modules: { ...existing.modules, [slot]: moduleId ?? undefined },
            };
            return { ...normalized, loadouts };
          }
          default:
            return fail('unknown-kind');
        }
      });

      if (!updatedProfile) {
        const status = rejection === 'profile-not-found' ? 404 : 422;
        res.status(status).json({ error: rejection ?? 'Purchase failed' });
        return;
      }
      res.json({ profile: updatedProfile });
    } catch (err) {
      console.error('[ConfluxServer] Error processing purchase:', err);
      res.status(500).json({ error: 'Failed to process purchase' });
    }
  });

  return app;
}
