import { audioService } from '../services/audioService';
import { SoundEvent } from '../types';

export const useSound = () => {
    // This hook provides a simple interface to the singleton audioService.
    return {
        playSound: (sound: SoundEvent) => audioService.playSound(sound),
    };
};
