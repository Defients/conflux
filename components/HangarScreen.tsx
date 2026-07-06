/**
 * components/HangarScreen.tsx
 *
 * Chassis selection and module loadout customization screen.
 */

import React, { useState } from 'react';
import { PilotProfile, ChassisId, ChassisLoadout } from '../shared/types';
import { CHASSIS_DEFINITIONS, CHASSIS_MODULES } from '../shared/constants';

interface HangarScreenProps {
  profile: PilotProfile;
  onSelectChassis: (chassisId: ChassisId) => void;
  onEquipModule: (chassisId: ChassisId, slot: 'core' | 'thrusters' | 'shielding', moduleId: string | null) => void;
  onBack: () => void;
}

const slotLabels: Record<'core' | 'thrusters' | 'shielding', string> = {
  core: 'Core',
  thrusters: 'Thrusters',
  shielding: 'Shielding',
};

export const HangarScreen: React.FC<HangarScreenProps> = ({
  profile,
  onSelectChassis,
  onEquipModule,
  onBack,
}) => {
  const [selectedChassis, setSelectedChassis] = useState<ChassisId>(
    profile.unlockedChassis[0] ?? ChassisId.Standard
  );

  const unlockedChassis = profile.unlockedChassis;
  const currentLoadout = profile.loadouts?.[selectedChassis];
  const unlockedModules = profile.unlockedModules ?? [];

  const modulesForSlot = (slot: 'core' | 'thrusters' | 'shielding') => {
    return CHASSIS_MODULES.filter(m => m.slot === slot && unlockedModules.includes(m.id));
  };

  const equippedModule = (slot: 'core' | 'thrusters' | 'shielding'): string | null => {
    return currentLoadout?.modules?.[slot] ?? null;
  };

  return (
    <div className="hangar-screen">
      <div className="hangar-screen__header">
        <button className="hangar-screen__back" onClick={onBack}>← Back</button>
        <h2>Hangar</h2>
      </div>

      <div className="hangar-screen__chassis-list">
        {unlockedChassis.map(chassisId => {
          const def = CHASSIS_DEFINITIONS[chassisId];
          const isSelected = chassisId === selectedChassis;
          return (
            <button
              key={chassisId}
              className={`chassis-card ${isSelected ? 'chassis-card--selected' : ''}`}
              onClick={() => {
                setSelectedChassis(chassisId);
                onSelectChassis(chassisId);
              }}
            >
              <span className="chassis-card__name">{def.name}</span>
              <span className="chassis-card__desc">{def.description}</span>
            </button>
          );
        })}
      </div>

      <div className="hangar-screen__loadout">
        <h3>Loadout — {CHASSIS_DEFINITIONS[selectedChassis].name}</h3>
        {(['core', 'thrusters', 'shielding'] as const).map(slot => {
          const equipped = equippedModule(slot);
          const available = modulesForSlot(slot);

          return (
            <div key={slot} className="loadout-slot">
              <span className="loadout-slot__label">{slotLabels[slot]}</span>
              <div className="loadout-slot__options">
                <button
                  className={`module-option ${!equipped ? 'module-option--active' : ''}`}
                  onClick={() => onEquipModule(selectedChassis, slot, null)}
                >
                  Empty
                </button>
                {available.map(mod => (
                  <button
                    key={mod.id}
                    className={`module-option ${equipped === mod.id ? 'module-option--active' : ''}`}
                    onClick={() => onEquipModule(selectedChassis, slot, mod.id)}
                    title={mod.description}
                  >
                    {mod.name}
                  </button>
                ))}
                {available.length === 0 && (
                  <span className="loadout-slot__empty">No modules unlocked</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
