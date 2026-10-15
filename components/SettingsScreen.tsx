/**
 * components/SettingsScreen.tsx
 *
 * Game settings: sound, music, haptics, reduced motion, color contrast.
 */

import React, { useState, useEffect } from 'react';
import { useSound } from '../hooks/useSound';

export interface UISettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  colorBlindMode?: boolean;
}

interface SettingsScreenProps {
  settings: UISettings;
  onSave: (settings: UISettings) => void;
  onBack: () => void;
}

const SETTINGS_KEY = 'conflux-game-settings';
const LOBBY_SETTINGS_KEY = 'conflux-circuit-settings';

export const loadSettings = (): UISettings => {
  const defaults: UISettings = {
    soundEnabled: true,
    musicEnabled: true,
    hapticsEnabled: true,
    reducedMotion: false,
    highContrast: false,
    colorBlindMode: false,
  };
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    const lobbySaved = localStorage.getItem(LOBBY_SETTINGS_KEY);
    const parsed = saved ? (JSON.parse(saved) as Partial<UISettings>) : {};
    const lobbyParsed = lobbySaved ? JSON.parse(lobbySaved) : {};
    return {
      ...defaults,
      ...parsed,
      soundEnabled: parsed.soundEnabled ?? lobbyParsed.sound ?? defaults.soundEnabled,
      hapticsEnabled: parsed.hapticsEnabled ?? lobbyParsed.uiEffects ?? defaults.hapticsEnabled,
      reducedMotion: parsed.reducedMotion ?? lobbyParsed.accessibility ?? defaults.reducedMotion,
      colorBlindMode: parsed.colorBlindMode ?? lobbyParsed.colorBlindMode ?? defaults.colorBlindMode,
    };
  } catch {
    return defaults;
  }
};

export const saveSettings = (settings: UISettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Keep Lobby localStorage preferences synchronized without conflating highContrast with gameplay timer accessibility
    const lobbySaved = localStorage.getItem(LOBBY_SETTINGS_KEY);
    const lobbyParsed = lobbySaved ? JSON.parse(lobbySaved) : {};
    localStorage.setItem(
      LOBBY_SETTINGS_KEY,
      JSON.stringify({
        ...lobbyParsed,
        sound: settings.soundEnabled,
        uiEffects: settings.hapticsEnabled,
        accessibility: settings.reducedMotion,
        colorBlindMode: !!settings.colorBlindMode,
      })
    );
  } catch {
    // ignore
  }
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings: initialSettings,
  onSave,
  onBack,
}) => {
  const [settings, setSettings] = useState<UISettings>(initialSettings);
  const { playSound } = useSound();

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const toggle = (key: keyof UISettings) => {
    playSound('ui-click');
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    saveSettings(updated);
    onSave(updated);
  };

  const settingRows: { key: keyof UISettings; label: string; description: string; icon: string }[] = [
    { key: 'soundEnabled', label: 'Sound Effects & Synth Audio', description: 'Event audio cues, countdown beeps, and procedural WebAudio SFX', icon: '🔊' },
    { key: 'hapticsEnabled', label: 'Visual Shake & Haptics', description: 'Screen shake on impacts and vibration feedback on mobile devices', icon: '📳' },
    { key: 'reducedMotion', label: 'Reduced Motion & Accessible Timers', description: 'Minimize animations and extend event timers where supported', icon: '🐢' },
    { key: 'highContrast', label: 'High Contrast Mode', description: 'Increase border and text contrast for maximum legibility', icon: '🌓' },
    { key: 'colorBlindMode', label: 'Color-Blind Palette', description: 'Use high-distinction color palettes across events and HUD', icon: '🎨' },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 animate-fade-in" role="region" aria-label="System Settings">
      <div className="w-full max-w-2xl flex flex-col gap-4 sm:gap-6">
        <header className="glass-panel p-4 sm:p-6 flex items-center justify-between border-b-2 border-galaxy-cyan/40">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              className="px-3 sm:px-4 py-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-sm font-bold text-gray-200 transition-colors"
              onClick={() => { playSound('ui-click'); onBack(); }}
            >
              ← Back
            </button>
            <div>
              <h1 className="text-xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-galaxy-cyan to-hyper-green uppercase tracking-tight">
                System Preferences
              </h1>
              <p className="text-xs text-gray-400 font-mono">Audio, Accessibility & Telemetry Controls</p>
            </div>
          </div>
        </header>

        <div className="glass-panel p-4 sm:p-6 divide-y divide-white/10">
          {settingRows.map(row => {
            const isChecked = !!settings[row.key];
            return (
              <div key={row.key} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5" aria-hidden="true">{row.icon}</span>
                  <div>
                    <div className="text-sm sm:text-base font-bold text-white">{row.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{row.description}</div>
                  </div>
                </div>
                <button
                  onClick={() => toggle(row.key)}
                  role="switch"
                  aria-checked={isChecked}
                  aria-label={row.label}
                  className={`relative inline-flex h-7 w-13 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    isChecked ? 'bg-hyper-green' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-cosmic-blue shadow ring-0 transition duration-200 ease-in-out ${
                      isChecked ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

