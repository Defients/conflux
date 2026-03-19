class HapticsService {
    private isEnabled = true;
    private reducedMotion = false;

    constructor() {
        if (typeof window !== 'undefined' && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            this.reducedMotion = mediaQuery.matches;
            mediaQuery.addEventListener('change', () => {
                this.reducedMotion = mediaQuery.matches;
            });
        }
    }

    public setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
    }

    public trigger(pattern: 'light' | 'medium' | 'long' | number | number[]) {
        if (!this.isEnabled || this.reducedMotion || !('vibrate' in navigator)) {
            return;
        }

        let vibrationPattern: number | number[];
        switch (pattern) {
            case 'light':
                vibrationPattern = 50;
                break;
            case 'medium':
                vibrationPattern = [100, 30, 100];
                break;
            case 'long':
                vibrationPattern = 200;
                break;
            default:
                vibrationPattern = pattern;
        }

        try {
            navigator.vibrate(vibrationPattern);
        } catch (e) {
            console.warn("Haptic feedback failed:", e);
        }
    }
}

export const hapticsService = new HapticsService();
