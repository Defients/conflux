/**
 * components/SettingsScreen.tsx
 *
 * Game settings: sound, music, haptics, reduced motion, color contrast.
 */

import React, { useState, useEffect } from 'react';

export interface UISettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

interface SettingsScreenProps {
  settings: UISettings;
  onSave: (settings: UISettings) => void;
  onBack: () => void;
}

const SETTINGS_KEY = 'conflux-game-settings';

export const loadSettings = (): UISettings => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return JSON.parse(saved) as UISettings;
  } catch {
    // ignore
  }
  return {
    soundEnabled: true,
    musicEnabled: true,
    hapticsEnabled: true,
    reducedMotion: false,
    highContrast: false,
  };
};

export const saveSettings = (settings: UISettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const toggle = (key: keyof UISettings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    saveSettings(updated);
    onSave(updated);
  };

  const settingRows: { key: keyof UISettings; label: string; description: string }[] = [
    { key: 'soundEnabled', label: 'Sound Effects', description: 'Event sounds and UI feedback' },
    { key: 'musicEnabled', label: 'Music', description: 'Background music during races' },
    { key: 'hapticsEnabled', label: 'Haptics', description: 'Vibration feedback on mobile' },
    { key: 'reducedMotion', label: 'Reduced Motion', description: 'Minimize screen shake and animations' },
    { key: 'highContrast', label: 'High Contrast', description: 'Increase color contrast for accessibility' },
  ];

  return (
    <div className="settings-screen">
      <div className="settings-screen__header">
        <button className="settings-screen__back" onClick={onBack}>← Back</button>
        <h2>Settings</h2>
      </div>

      <div className="settings-screen__list">
        {settingRows.map(row => (
          <div key={row.key} className="setting-row">
            <div className="setting-row__info">
              <span className="setting-row__label">{row.label}</span>
              <span className="setting-row__description">{row.description}</span>
            </div>
            <button
              className={`toggle-switch ${settings[row.key] ? 'toggle-switch--on' : ''}`}
              onClick={() => toggle(row.key)}
              role="switch"
              aria-checked={settings[row.key]}
              aria-label={row.label}
            >
              <span className="toggle-switch__thumb" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

