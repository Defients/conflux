

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

    public setEnabled(enabled: boolean) {
        if (enabled && !this.audioContext) {
            this.init(true);
        } else if (!enabled && this.audioContext) {
            this.audioContext.close().then(() => {
                this.audioContext = null;
            });
        }
        this.isEnabled = enabled;
    }

    public playSound(sound: SoundEvent) {
        if (!this.isEnabled || !this.audioContext || !this.audioBuffers[sound]) {
            if (this.isEnabled && !this.audioBuffers[sound]) {
                console.warn(`Sound not loaded or available: ${sound}`);
            }
            return;
        }

        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.audioBuffers[sound]!;
            source.connect(this.audioContext.destination);
            source.start(0);
        } catch (e) {
            console.error(`Error playing sound: ${sound}`, e);
        }
    }
}

export const audioService = new AudioService();
