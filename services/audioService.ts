

import { SoundEvent } from '../types';

class AudioService {
    private isEnabled = true;
    private audioContext: AudioContext | null = null;
    private audioBuffers: { [key in SoundEvent]?: AudioBuffer } = {};

    private soundFiles: { [key in SoundEvent]: string } = {
        'ui-click': 'https://storage.googleapis.com/shaka-demo-assets/angel-one/ui_click.mp3',
        'countdown-beep': 'https://storage.googleapis.com/shaka-demo-assets/angel-one/countdown_beep.mp3',
        'event-start': 'https://storage.googleapis.com/shaka-demo-assets/angel-one/event_start.mp3',
        'event-success': 'https://storage.googleapis.com/shaka-demo-assets/angel-one/event_success.mp3',
        'event-fail': 'https://storage.googleapis.com/shaka-demo-assets/angel-one/event_fail.mp3',
        'powerup-use': 'https://storage.googleapis.com/shaka-demo-assets/angel-one/powerup_use.mp3',
        'powerup-get': 'https://storage.googleapis.com/shaka-demo-assets/angel-one/powerup_get.mp3',
        'debuff-hit': 'https://storage.googleapis.com/shaka-demo-assets/angel-one/debuff_hit.mp3',
        'overdrive-activate': 'https://storage.googleapis.com/shaka-demo-assets/angel-one/overdrive_activate.mp3',
        'overdrive-success': 'https://storage.googleapis.com/shaka-demo-assets/angel-one/overdrive_success.mp3',
        'overdrive-fail': 'https://storage.googleapis.com/shaka-demo-assets/angel-one/overdrive_fail.mp3',
        'rival-tell': 'https://storage.googleapis.com/shaka-demo-assets/angel-one/debuff_hit.mp3', // Re-using sound for now
    };

    public async init(enabled: boolean) {
        this.isEnabled = enabled;
        if (this.isEnabled && !this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                await this.loadAllSounds();
                console.log('AudioService Initialized and sounds loaded.');
            } catch (e) {
                console.error('Web Audio API is not supported in this browser.', e);
                this.isEnabled = false;
            }
        } else if (!this.isEnabled && this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    private async loadSound(sound: SoundEvent): Promise<void> {
        if (!this.audioContext || !this.soundFiles[sound]) return;
        try {
            const response = await fetch(this.soundFiles[sound]);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.audioBuffers[sound] = audioBuffer;
        } catch (e) {
            console.error(`Failed to load sound: ${sound}`, e);
        }
    }

    private async loadAllSounds(): Promise<void> {
        const soundPromises = Object.keys(this.soundFiles).map(key => this.loadSound(key as SoundEvent));
        await Promise.all(soundPromises);
    }

    public unlockOnFirstGesture() {
    // Many mobile browsers require a user gesture before audio can start.
    const resume = async () => {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                await this.loadAllSounds();
            } else if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (e) {
            console.warn('Audio unlock failed:', e);
        } finally {
            window.removeEventListener('pointerdown', resume);
            window.removeEventListener('keydown', resume);
            window.removeEventListener('touchstart', resume);
        }
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
    window.addEventListener('touchstart', resume, { once: true });
}

    public async setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
        if (enabled && !this.audioContext) {
            await this.init(true);
        } else if (!enabled && this.audioContext) {
            this.audioContext.close().then(() => {
                this.audioContext = null;
            });
        }
    }

    public playSound(sound: SoundEvent) {
        if (!this.isEnabled) return;

        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch {
                return;
            }
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }

        if (this.audioBuffers[sound]) {
            try {
                const source = this.audioContext.createBufferSource();
                source.buffer = this.audioBuffers[sound]!;
                source.connect(this.audioContext.destination);
                source.start(0);
                return;
            } catch (e) {
                console.error(`Error playing sound: ${sound}`, e);
            }
        }

        // Zero-dependency Web Audio API procedural synth fallback
        this.playSynthesizedSound(sound);
    }

    public playTone(
        frequencyHz: number,
        durationSec: number = 0.12,
        type: OscillatorType = 'triangle',
        gainPeak: number = 0.12
    ) {
        if (!this.isEnabled) return;
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch {
                return;
            }
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }
        try {
            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(Math.max(20, frequencyHz), now);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + durationSec + 0.02);
        } catch {
            // Ignore audio synthesis errors on restricted contexts
        }
    }

    private playSynthesizedSound(sound: SoundEvent) {
        const ctx = this.audioContext;
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const playTone = (
                freqStart: number,
                freqEnd: number,
                duration: number,
                type: OscillatorType = 'sine',
                gainPeak: number = 0.12,
                startTime: number = now
            ) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freqStart, startTime);
                if (freqEnd !== freqStart) {
                    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startTime + duration);
                }
                gain.gain.setValueAtTime(0.0001, startTime);
                gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(startTime);
                osc.stop(startTime + duration + 0.02);
            };

            switch (sound) {
                case 'ui-click':
                    playTone(880, 440, 0.045, 'triangle', 0.08);
                    break;
                case 'countdown-beep':
                    playTone(660, 660, 0.09, 'sine', 0.1);
                    break;
                case 'event-start':
                    playTone(523.25, 1046.5, 0.18, 'triangle', 0.14);
                    break;
                case 'event-success':
                    playTone(523.25, 523.25, 0.1, 'triangle', 0.12, now);
                    playTone(659.25, 659.25, 0.1, 'triangle', 0.12, now + 0.08);
                    playTone(783.99, 1046.5, 0.2, 'triangle', 0.14, now + 0.16);
                    break;
                case 'event-fail':
                    playTone(300, 140, 0.25, 'sawtooth', 0.1);
                    break;
                case 'powerup-get':
                    playTone(440, 880, 0.12, 'sine', 0.12, now);
                    playTone(880, 1320, 0.15, 'sine', 0.12, now + 0.1);
                    break;
                case 'powerup-use':
                    playTone(600, 1200, 0.16, 'triangle', 0.13);
                    break;
                case 'debuff-hit':
                    playTone(220, 90, 0.28, 'sawtooth', 0.14);
                    break;
                case 'overdrive-activate':
                    playTone(260, 1040, 0.28, 'sawtooth', 0.14);
                    break;
                case 'overdrive-success':
                    playTone(587.33, 880, 0.12, 'triangle', 0.14, now);
                    playTone(880, 1174.66, 0.24, 'triangle', 0.16, now + 0.11);
                    break;
                case 'overdrive-fail':
                    playTone(350, 95, 0.35, 'sawtooth', 0.15);
                    break;
                case 'rival-tell':
                    playTone(440, 392, 0.12, 'square', 0.09, now);
                    playTone(392, 311.13, 0.2, 'square', 0.09, now + 0.12);
                    break;
            }
        } catch {
            // Ignore audio synthesis errors on restricted contexts
        }
    }
}

export const audioService = new AudioService();
