

import { PilotProfile, ChassisId, RivalData, RivalTraitId, CorporationId } from '../types';
import { SeededRNG } from './seededRNG';
import { RIVAL_NAMES, AVATARS, RIVAL_TRAIT_DEFINITIONS } from '../constants';

const LEGACY_PROFILE_STORAGE_KEY = 'conflux-circuit-profile';
const PROFILE_ACCOUNTS_STORAGE_KEY = 'conflux-circuit-profiles';
const ACTIVE_PROFILE_ID_STORAGE_KEY = 'conflux-circuit-active-profile-id';

interface StoredPilotAccount {
    id: string;
    profile: PilotProfile;
    updatedAt: number;
}

export interface PilotAccountSummary {
    id: string;
    name: string;
    avatarId: string;
    circuitPoints: number;
    updatedAt: number;
}

const generateRival = (playerName: string, playerAvatar: string): RivalData => {
    const rivalRng = new SeededRNG(`rival-for-${playerName}`);
    
    // Ensure rival has a different name
    let rivalName = RIVAL_NAMES[rivalRng.nextInt(0, RIVAL_NAMES.length)];
    while(rivalName === playerName) {
         rivalName = RIVAL_NAMES[rivalRng.nextInt(0, RIVAL_NAMES.length)];
    }

    // Ensure rival has a different avatar
    let rivalAvatar = AVATARS[rivalRng.nextInt(0, AVATARS.length)];
    while (rivalAvatar === playerAvatar) {
        rivalAvatar = AVATARS[rivalRng.nextInt(0, AVATARS.length)];
    }

    const chassisOptions = [ChassisId.Aegis, ChassisId.Momentum, ChassisId.GlassCannon, ChassisId.Scavenger];
    const favoredChassis = chassisOptions[rivalRng.nextInt(0, chassisOptions.length)];

    const allTraitIds = Object.keys(RIVAL_TRAIT_DEFINITIONS) as RivalTraitId[];
    const shuffledTraits = rivalRng.shuffle([...allTraitIds]);
    const numTraits = rivalRng.nextInt(1, 3);
    const assignedTraits = shuffledTraits.slice(0, numTraits);

    return {
        name: rivalName,
        avatarId: rivalAvatar,
        favoredChassis: favoredChassis,
        wins: 0,
        losses: 0,
        traits: assignedTraits,
    };
};

const normalizeProfile = (input: Partial<PilotProfile & { rivalData: Partial<RivalData> }>): PilotProfile | null => {
    const parsed = { ...input } as Partial<PilotProfile & { rivalData: Partial<RivalData> }>;
    let needsSave = false;

    if (typeof parsed.gauntletHighScore !== 'number') {
        parsed.gauntletHighScore = 0;
        needsSave = true;
    }
    if (typeof parsed.winStreak !== 'number') {
        parsed.winStreak = 0;
        needsSave = true;
    }
    if (!parsed.unlockedAccolades) {
        parsed.unlockedAccolades = [];
        needsSave = true;
    }
    if (!parsed.rivalData) {
        parsed.rivalData = generateRival(parsed.name ?? 'Player', parsed.avatarId ?? '🤖');
        needsSave = true;
    }
    if (!parsed.rivalData.traits) {
        parsed.rivalData.traits = [];
        needsSave = true;
    }
    if (!parsed.sponsorships) {
        parsed.sponsorships = {
            [CorporationId.Cyberex]: { reputation: 0, activeContract: null },
            [CorporationId.Zenith]: { reputation: 0, activeContract: null },
            [CorporationId.Rogue]: { reputation: 0, activeContract: null },
        };
        needsSave = true;
    }
    if (!Array.isArray(parsed.appliedMatchIds)) {
        parsed.appliedMatchIds = [];
        needsSave = true;
    }
    if (!parsed.dailyBests || typeof parsed.dailyBests !== 'object') {
        parsed.dailyBests = {};
        needsSave = true;
    }
    // v5.0: Normalize new fields
    if (!parsed.skills) {
        parsed.skills = { speed: {}, tech: {}, endurance: {}, availableCP: 0 };
        needsSave = true;
    }
    if (!parsed.loadouts) {
        parsed.loadouts = {};
        needsSave = true;
    }
    if (!parsed.unlockedModules) {
        parsed.unlockedModules = [];
        needsSave = true;
    }
    if (!parsed.eventMastery) {
        parsed.eventMastery = {};
        needsSave = true;
    }
    if (!parsed.rank) {
        parsed.rank = {
            rating: 1000,
            tier: 'bronze',
            wins: 0,
            losses: 0,
            peakRating: 1000,
        };
        needsSave = true;
    }

    if (parsed.name && parsed.avatarId && parsed.unlockedChassis && parsed.rivalData && parsed.unlockedAccolades && parsed.sponsorships) {
        return parsed as PilotProfile;
    }

    return null;
};

const readStoredAccounts = (): StoredPilotAccount[] => {
    try {
        const saved = localStorage.getItem(PROFILE_ACCOUNTS_STORAGE_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved) as StoredPilotAccount[];
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map(account => {
                const normalizedProfile = normalizeProfile(account.profile as Partial<PilotProfile & { rivalData: Partial<RivalData> }>);
                if (!normalizedProfile || !account.id) return null;
                return {
                    id: account.id,
                    profile: normalizedProfile,
                    updatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : Date.now(),
                } as StoredPilotAccount;
            })
            .filter((account): account is StoredPilotAccount => account !== null);
    } catch (e) {
        console.error('Failed to load profiles from localStorage', e);
        return [];
    }
};

const writeStoredAccounts = (accounts: StoredPilotAccount[]): void => {
    try {
        localStorage.setItem(PROFILE_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    } catch (e) {
        console.error('Failed to save profiles to localStorage', e);
    }
};

const getActiveProfileId = (): string | null => {
    try {
        return localStorage.getItem(ACTIVE_PROFILE_ID_STORAGE_KEY);
    } catch {
        return null;
    }
};

const setActiveProfileId = (id: string | null): void => {
    try {
        if (id) {
            localStorage.setItem(ACTIVE_PROFILE_ID_STORAGE_KEY, id);
        } else {
            localStorage.removeItem(ACTIVE_PROFILE_ID_STORAGE_KEY);
        }
    } catch (e) {
        console.error('Failed to update active profile id', e);
    }
};

const createAccountId = (): string => `pilot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const migrateLegacySingleProfile = (): void => {
    const existingAccounts = readStoredAccounts();
    if (existingAccounts.length > 0) return;

    try {
        const legacySaved = localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY);
        if (!legacySaved) return;
        const parsed = JSON.parse(legacySaved) as Partial<PilotProfile & { rivalData: Partial<RivalData> }>;
        const normalized = normalizeProfile(parsed);
        if (!normalized) return;

        const migratedAccount: StoredPilotAccount = {
            id: createAccountId(),
            profile: normalized,
            updatedAt: Date.now(),
        };
        writeStoredAccounts([migratedAccount]);
        setActiveProfileId(migratedAccount.id);
        localStorage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
    } catch (e) {
        console.error('Failed to migrate legacy profile storage', e);
    }
};

migrateLegacySingleProfile();

export const listProfiles = (): PilotAccountSummary[] => {
    return readStoredAccounts()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(account => ({
            id: account.id,
            name: account.profile.name,
            avatarId: account.profile.avatarId,
            circuitPoints: account.profile.circuitPoints,
            updatedAt: account.updatedAt,
        }));
};

export const loadProfile = (accountId?: string): PilotProfile | null => {
    const accounts = readStoredAccounts();
    if (accounts.length === 0) return null;

    const desiredId = accountId ?? getActiveProfileId() ?? accounts[0].id;
    const account = accounts.find(entry => entry.id === desiredId) ?? accounts[0];
    setActiveProfileId(account.id);
    return account.profile;
};

export const saveProfile = (profile: PilotProfile): void => {
    const accounts = readStoredAccounts();
    const activeId = getActiveProfileId();
    const updatedAt = Date.now();

    if (!activeId) {
        const newAccount: StoredPilotAccount = { id: createAccountId(), profile, updatedAt };
        writeStoredAccounts([...accounts, newAccount]);
        setActiveProfileId(newAccount.id);
        return;
    }

    const updatedAccounts = accounts.map(account =>
        account.id === activeId ? { ...account, profile, updatedAt } : account
    );
    writeStoredAccounts(updatedAccounts);
};

export const createProfileAccount = (name: string, avatarId: string): PilotProfile => {
    const profile = createDefaultProfile(name, avatarId);
    const accounts = readStoredAccounts();
    const newAccount: StoredPilotAccount = {
        id: createAccountId(),
        profile,
        updatedAt: Date.now(),
    };
    writeStoredAccounts([...accounts, newAccount]);
    setActiveProfileId(newAccount.id);
    return profile;
};

export const setActiveProfile = (accountId: string): PilotProfile | null => {
    const accounts = readStoredAccounts();
    const account = accounts.find(entry => entry.id === accountId);
    if (!account) return null;
    setActiveProfileId(accountId);
    return account.profile;
};

export const deleteProfileAccount = (accountId: string): PilotProfile | null => {
    const accounts = readStoredAccounts();
    const remainingAccounts = accounts.filter(account => account.id !== accountId);
    writeStoredAccounts(remainingAccounts);

    const activeId = getActiveProfileId();
    if (activeId === accountId) {
        const nextActive = remainingAccounts[0]?.id ?? null;
        setActiveProfileId(nextActive);
    }

    return loadProfile();
};

export const clearProfile = (): void => {
    setActiveProfileId(null);
};

export const createDefaultProfile = (name: string, avatarId: string): PilotProfile => {
    return {
        name,
        avatarId,
        circuitPoints: 0,
        winStreak: 0,
        unlockedChassis: [ChassisId.Standard],
        unlockedAccolades: [],
        rivalData: generateRival(name, avatarId),
        gauntletHighScore: 0,
        sponsorships: {
            [CorporationId.Cyberex]: { reputation: 0, activeContract: null },
            [CorporationId.Zenith]: { reputation: 0, activeContract: null },
            [CorporationId.Rogue]: { reputation: 0, activeContract: null },
        },
        appliedMatchIds: [],
        dailyBests: {},
        // v5.0 fields
        skills: { speed: {}, tech: {}, endurance: {}, availableCP: 0 },
        loadouts: {},
        unlockedModules: [],
        eventMastery: {},
        rank: {
            rating: 1000,
            tier: 'bronze',
            wins: 0,
            losses: 0,
            peakRating: 1000,
        },
    };
};
