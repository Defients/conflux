import { EventPreset } from "./types";
import { WEEKLY_CUP_PRESETS, getIsoWeekNumber } from "./constants";
import { SeededRNG } from "./seededRNG";

/**
 * Returns the canonical UTC date string (YYYY-MM-DD) so client and server
 * always agree on the daily challenge seed regardless of local timezone.
 */
export const getDailySeed = (date: Date = new Date()): string => {
    return date.toISOString().slice(0, 10);
};

const getActivePilotKeySuffix = (profileId?: string): string => {
    if (profileId) return `-${profileId}`;
    try {
        if (typeof localStorage !== 'undefined') {
            const activeId = localStorage.getItem('conflux-circuit-active-profile-id');
            if (activeId) return `-${activeId}`;
        }
    } catch {
        // ignore storage errors
    }
    return '';
};

const getStorageKey = (profileId?: string): string => {
    return `cc-daily-best${getActivePilotKeySuffix(profileId)}-${getDailySeed()}`;
};

export const saveDailyPersonalBest = (score: number, profileId?: string): void => {
    try {
        localStorage.setItem(getStorageKey(profileId), String(score));
    } catch (e) {
        console.error("Failed to save daily best to localStorage", e);
    }
};

export const getDailyPersonalBest = (profileId?: string): number | null => {
    try {
        const saved = localStorage.getItem(getStorageKey(profileId)) ?? localStorage.getItem(`cc-daily-best-${getDailySeed()}`);
        if (saved !== null) {
            const score = parseFloat(saved);
            return isNaN(score) ? null : score;
        }
        return null;
    } catch (e) {
        console.error("Failed to load daily best from localStorage", e);
        return null;
    }
};

// --- V2 UPGRADE: WEEKLY CHALLENGE ---

export const getWeeklySeed = (date: Date = new Date()): string => {
    const weekNumber = getIsoWeekNumber(date);
    return `${date.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

export const getWeeklyPreset = (seed: string): EventPreset => {
    const rng = new SeededRNG(seed);
    const presetIndex = rng.nextInt(0, WEEKLY_CUP_PRESETS.length);
    return WEEKLY_CUP_PRESETS[presetIndex];
};
