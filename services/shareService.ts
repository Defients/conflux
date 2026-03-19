import { GameSettings, ChassisId } from '../types';

// Compact keys for smaller URL
interface CompactSettings {
    p: number; // playerCount
    e: number; // easyBots
    i: number; // intermediateBots
    s: string; // seed
    l: number; // runLength
    o: boolean; // sound (sOund)
    a: boolean; // accessibility
    u?: boolean; // uiEffects
    c?: ChassisId; // chassis
// FIX: Add colorBlindMode property to the compact interface.
    b?: boolean; // colorBlindMode
}

function toCompact(settings: GameSettings): CompactSettings {
    return {
        p: settings.playerCount,
        e: settings.easyBots,
        i: settings.intermediateBots,
        s: settings.seed,
        l: settings.runLength,
        o: settings.sound,
        a: settings.accessibility,
        u: settings.uiEffects,
        c: settings.selectedChassis,
// FIX: Add colorBlindMode to the compacting function.
        b: settings.colorBlindMode,
    };
}

function fromCompact(compact: CompactSettings): GameSettings {
    return {
        playerCount: compact.p,
        easyBots: compact.e,
        intermediateBots: compact.i,
        seed: compact.s,
        runLength: compact.l,
        sound: compact.o,
        accessibility: compact.a,
        uiEffects: compact.u ?? true,
// FIX: Add colorBlindMode to the settings object being created from a compact representation.
        colorBlindMode: compact.b ?? false,
        selectedChassis: compact.c ?? ChassisId.Standard,
    };
}

export function encodeSettings(settings: GameSettings): string {
    try {
        const compact = toCompact(settings);
        const jsonString = JSON.stringify(compact);
        return btoa(jsonString);
    } catch (e) {
        console.error("Failed to encode settings:", e);
        return '';
    }
}

export function decodeSettings(settings: string): GameSettings | null {
    try {
        const jsonString = atob(settings);
        const compact = JSON.parse(jsonString) as CompactSettings;
        // Basic validation
        if (
            typeof compact.p === 'number' &&
            typeof compact.e === 'number' &&
            typeof compact.i === 'number' &&
            typeof compact.s === 'string' &&
            typeof compact.l === 'number' &&
            typeof compact.o === 'boolean' &&
            typeof compact.a === 'boolean'
        ) {
            return fromCompact(compact);
        }
        return null;
    } catch (e) {
        console.error("Failed to decode settings:", e);
        return null;
    }
}
