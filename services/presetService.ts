import { EventPreset } from '../types';

const PRESETS_STORAGE_KEY = 'conflux-circuit-presets';

export const savePresets = (presets: EventPreset[]): void => {
    try {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
        console.error("Failed to save presets to localStorage", e);
    }
};

export const loadPresets = (): EventPreset[] => {
    try {
        const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved) as EventPreset[];
            // Basic validation
            if (Array.isArray(parsed) && parsed.every(p => typeof p.name === 'string' && Array.isArray(p.eventIds))) {
                return parsed;
            }
        }
    } catch (e) {
        console.error("Failed to load presets from localStorage", e);
    }
    // Return an empty array if nothing is saved or if data is corrupt
    return [];
};
