import { EventPreset } from "../types";
import { WEEKLY_CUP_PRESETS } from "../constants";
import { SeededRNG } from "./seededRNG";

export const getDailySeed = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getStorageKey = (): string => {
    return `cc-daily-best-${getDailySeed()}`;
};

export const saveDailyPersonalBest = (score: number): void => {
    try {
        localStorage.setItem(getStorageKey(), String(score));
    } catch (e) {
        console.error("Failed to save daily best to localStorage", e);
    }
};

export const getDailyPersonalBest = (): number | null => {
    try {
        const saved = localStorage.getItem(getStorageKey());
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

export const getWeeklySeed = (): string => {
    const now = new Date();
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};

export const getWeeklyPreset = (seed: string): EventPreset => {
    const rng = new SeededRNG(seed);
    const presetIndex = rng.nextInt(0, WEEKLY_CUP_PRESETS.length);
    return WEEKLY_CUP_PRESETS[presetIndex];
};
