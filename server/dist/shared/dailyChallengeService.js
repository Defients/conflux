"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeeklyPreset = exports.getWeeklySeed = exports.getDailyPersonalBest = exports.saveDailyPersonalBest = exports.getDailySeed = void 0;
const constants_1 = require("../constants");
const seededRNG_1 = require("./seededRNG");
const getDailySeed = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
exports.getDailySeed = getDailySeed;
const getStorageKey = () => {
    return `cc-daily-best-${(0, exports.getDailySeed)()}`;
};
const saveDailyPersonalBest = (score) => {
    try {
        localStorage.setItem(getStorageKey(), String(score));
    }
    catch (e) {
        console.error("Failed to save daily best to localStorage", e);
    }
};
exports.saveDailyPersonalBest = saveDailyPersonalBest;
const getDailyPersonalBest = () => {
    try {
        const saved = localStorage.getItem(getStorageKey());
        if (saved !== null) {
            const score = parseFloat(saved);
            return isNaN(score) ? null : score;
        }
        return null;
    }
    catch (e) {
        console.error("Failed to load daily best from localStorage", e);
        return null;
    }
};
exports.getDailyPersonalBest = getDailyPersonalBest;
// --- V2 UPGRADE: WEEKLY CHALLENGE ---
const getWeeklySeed = () => {
    const now = new Date();
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
};
exports.getWeeklySeed = getWeeklySeed;
const getWeeklyPreset = (seed) => {
    const rng = new seededRNG_1.SeededRNG(seed);
    const presetIndex = rng.nextInt(0, constants_1.WEEKLY_CUP_PRESETS.length);
    return constants_1.WEEKLY_CUP_PRESETS[presetIndex];
};
exports.getWeeklyPreset = getWeeklyPreset;
//# sourceMappingURL=dailyChallengeService.js.map