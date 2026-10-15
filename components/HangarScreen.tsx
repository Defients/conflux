/**
 * components/HangarScreen.tsx
 *
 * Chassis selection and module loadout customization screen.
 */

import React, { useState, useMemo } from 'react';
import { PilotProfile, ChassisId, LoadoutSlot } from '../shared/types';
import { CHASSIS_DEFINITIONS, CHASSIS_MODULES } from '../shared/constants';
import { useSound } from '../hooks/useSound';

interface HangarScreenProps {
  profile: PilotProfile;
  onSelectChassis: (chassisId: ChassisId) => void;
  onEquipModule: (chassisId: ChassisId, slot: 'core' | 'thrusters' | 'shielding', moduleId: string | null) => void;
  onUnlockModule?: (moduleId: string, cost: number) => void;
  onUnlockChassis?: (chassisId: ChassisId, cost: number) => void;
  onBack: () => void;
}

const slotConfig: Record<LoadoutSlot, { label: string; icon: string; subtitle: string }> = {
  core: { label: 'Core Reactor', icon: '🔋', subtitle: 'Initial energy & defensive protocols' },
  thrusters: { label: 'Thruster Array', icon: '🚀', subtitle: 'Track velocity & starting payload' },
  shielding: { label: 'Shield Matrix', icon: '🛡️', subtitle: 'Debuff cleansing & fortified barriers' },
};

export const HangarScreen: React.FC<HangarScreenProps> = ({
  profile,
  onSelectChassis,
  onEquipModule,
  onUnlockModule,
  onUnlockChassis,
  onBack,
}) => {
  const [selectedChassis, setSelectedChassis] = useState<ChassisId>(
    profile.unlockedChassis[0] ?? ChassisId.Standard
  );
  const { playSound } = useSound();

  const unlockedChassis = profile.unlockedChassis;
  const currentLoadout = profile.loadouts?.[selectedChassis];
  const unlockedModules = profile.unlockedModules ?? [];
  const availableCP = profile.circuitPoints ?? 0;

  const equippedModule = (slot: LoadoutSlot): string | null => {
    return currentLoadout?.modules?.[slot] ?? null;
  };

  // Compute live telemetry preview for the selected chassis + equipped modules
  const telemetrySummary = useMemo(() => {
    const equippedIds = (['core', 'thrusters', 'shielding'] as const)
      .map(s => currentLoadout?.modules?.[s])
      .filter(Boolean) as string[];
    const mods = equippedIds
      .map(id => CHASSIS_MODULES.find(m => m.id === id))
      .filter(Boolean);

    let moveBonusPct = 0;
    let startEnergy = 0;
    let debuffRes = 0;
    const perks: string[] = [];

    if (selectedChassis === ChassisId.Aegis) perks.push('🛡️ Starts with Shield');
    if (selectedChassis === ChassisId.Momentum) perks.push('⚡ +10% Speed after first 3★');
    if (selectedChassis === ChassisId.Scavenger) perks.push('♻️ +20% Shield upgrade chance');
    if (selectedChassis === ChassisId.GlassCannon) {
      moveBonusPct += 15;
      perks.push('💥 +1 Tile Debuff vulnerability');
    }

    for (const m of mods) {
      if (!m) continue;
      if (m.effects.movementBonus) moveBonusPct += Math.round(m.effects.movementBonus * 100);
      if (m.effects.energyBonus) startEnergy += m.effects.energyBonus;
      if (m.effects.debuffDurationReduction) debuffRes += m.effects.debuffDurationReduction;
      if (m.effects.startWithShield && !perks.includes('🛡️ Starts with Shield')) perks.push('🛡️ Starts with Shield');
      if (m.effects.startWithPowerUp) perks.push(`✨ Starts with ${m.effects.startWithPowerUp}`);
      if (m.effects.randomStartPowerUp) perks.push('🔧 Starts with Random Power-Up');
      if (m.effects.fortifiedShield) perks.push('🏰 2-Charge Fortified Shield');
    }

    return { moveBonusPct, startEnergy, debuffRes, perks };
  }, [selectedChassis, currentLoadout]);

  return (
    <div className="min-h-screen w-full flex flex-col p-2 sm:p-4 md:p-6 animate-fade-in overflow-y-auto" role="region" aria-label="Hangar Bay">
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <header className="glass-panel p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4 border-b-2 border-solar-orange/40">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              className="px-3 sm:px-4 py-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-sm font-bold text-gray-200 transition-colors"
              onClick={() => { playSound('ui-click'); onBack(); }}
              aria-label="Back to Lobby"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-solar-orange via-galaxy-cyan to-hyper-green tracking-tight uppercase">
                Orbital Hangar & Loadout Bay
              </h1>
              <p className="text-xs text-gray-400 font-mono">
                {unlockedChassis.length}/{Object.keys(CHASSIS_DEFINITIONS).length} Chassis • {unlockedModules.length}/{CHASSIS_MODULES.length} Modules Unlocked
              </p>
            </div>
          </div>
          <div className="bg-cosmic-blue/80 border border-hyper-green/40 px-4 py-2 rounded-xl text-right shadow-[0_0_15px_rgba(77,255,175,0.15)]">
            <div className="text-[10px] uppercase tracking-widest text-gray-400">Available Credits</div>
            <div className="text-xl sm:text-2xl font-black text-hyper-green font-mono">{availableCP} CP</div>
          </div>
        </header>

        {/* Chassis Selection Grid */}
        <div className="glass-panel p-4 sm:p-6">
          <h2 className="text-xs font-bold text-solar-orange uppercase tracking-widest mb-3 border-b border-white/10 pb-2">
            1. Select or Unlock Racing Chassis
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {(Object.entries(CHASSIS_DEFINITIONS) as [ChassisId, typeof CHASSIS_DEFINITIONS[ChassisId]][]).map(([chassisId, def]) => {
              const isUnlocked = unlockedChassis.includes(chassisId);
              const isSelected = chassisId === selectedChassis;
              const canAfford = availableCP >= def.cost;

              return (
                <div
                  key={chassisId}
                  onClick={() => {
                    if (isUnlocked) {
                      playSound('ui-click');
                      setSelectedChassis(chassisId);
                      onSelectChassis(chassisId);
                    }
                  }}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-hyper-green bg-hyper-green/10 shadow-[0_0_20px_rgba(77,255,175,0.15)] cursor-pointer'
                      : isUnlocked
                      ? 'border-white/15 bg-white/5 hover:bg-white/10 cursor-pointer'
                      : 'border-white/5 bg-black/40 opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-3xl" aria-hidden="true">{def.icon}</span>
                      {isSelected ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-hyper-green text-cosmic-blue uppercase">
                          Active
                        </span>
                      ) : isUnlocked ? (
                        <span className="text-[10px] font-mono text-gray-400">Owned</span>
                      ) : (
                        <span className="text-xs font-mono font-bold text-solar-orange">{def.cost} CP</span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">{def.name}</h3>
                    <p className="text-[11px] text-gray-300 leading-snug mb-2">{def.description}</p>
                  </div>
                  <div className="pt-2 border-t border-white/10 mt-2">
                    {isUnlocked ? (
                      <div className="text-[10px] font-mono text-galaxy-cyan">
                        {def.stats.movementGain} • {def.stats.debuffDuration}
                      </div>
                    ) : (
                      <button
                        disabled={!canAfford || !onUnlockChassis}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onUnlockChassis && canAfford) {
                            playSound('powerup-get');
                            onUnlockChassis(chassisId, def.cost);
                            setSelectedChassis(chassisId);
                          }
                        }}
                        className={`w-full py-1.5 rounded font-bold text-xs uppercase transition-all ${
                          canAfford
                            ? 'bg-solar-orange text-cosmic-blue hover:opacity-90'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Unlock ({def.cost} CP)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Module Loadout & Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Module Slots (8 cols) */}
          <div className="lg:col-span-8 glass-panel p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h2 className="text-xs font-bold text-galaxy-cyan uppercase tracking-widest">
                2. Module Loadout — {CHASSIS_DEFINITIONS[selectedChassis].name}
              </h2>
              <span className="text-xs text-gray-400 font-mono">3 Augmentation Slots</span>
            </div>

            {(['core', 'thrusters', 'shielding'] as const).map(slot => {
              const equipped = equippedModule(slot);
              const allSlotModules = CHASSIS_MODULES.filter(m => m.slot === slot);
              const cfg = slotConfig[slot];

              return (
                <div key={slot} className="bg-cosmic-blue/40 border border-white/10 rounded-xl p-3.5 sm:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        <span>{cfg.icon}</span>
                        <span>{cfg.label}</span>
                      </h3>
                      <p className="text-[11px] text-gray-400">{cfg.subtitle}</p>
                    </div>
                    {equipped && (
                      <button
                        onClick={() => {
                          playSound('ui-click');
                          onEquipModule(selectedChassis, slot, null);
                        }}
                        className="px-2.5 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-gray-300"
                      >
                        Unequip
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {allSlotModules.map(mod => {
                      const isModUnlocked = unlockedModules.includes(mod.id);
                      const isEquipped = equipped === mod.id;
                      const canAffordMod = availableCP >= mod.cpCost;

                      return (
                        <div
                          key={mod.id}
                          className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                            isEquipped
                              ? 'border-galaxy-cyan bg-galaxy-cyan/15 shadow-[0_0_12px_rgba(0,223,252,0.2)]'
                              : isModUnlocked
                              ? 'border-white/15 bg-white/5 hover:border-white/30'
                              : 'border-white/5 bg-black/30'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-lg" aria-hidden="true">{mod.icon}</span>
                              {isEquipped ? (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-galaxy-cyan text-cosmic-blue uppercase">
                                  Equipped
                                </span>
                              ) : isModUnlocked ? (
                                <span className="text-[9px] font-mono text-hyper-green">Unlocked</span>
                              ) : (
                                <span className="text-xs font-mono font-bold text-solar-orange">{mod.cpCost} CP</span>
                              )}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-white">{mod.name}</div>
                            <p className="text-[11px] text-gray-300 mt-1 leading-snug">{mod.description}</p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-white/10">
                            {isModUnlocked ? (
                              <button
                                onClick={() => {
                                  playSound('ui-click');
                                  onEquipModule(selectedChassis, slot, isEquipped ? null : mod.id);
                                }}
                                className={`w-full py-1.5 rounded text-xs font-bold uppercase transition-all ${
                                  isEquipped
                                    ? 'bg-white/15 text-white hover:bg-white/25'
                                    : 'bg-galaxy-cyan text-cosmic-blue hover:opacity-90'
                                }`}
                              >
                                {isEquipped ? '✓ Equipped' : 'Equip Module'}
                              </button>
                            ) : (
                              <button
                                disabled={!canAffordMod || !onUnlockModule}
                                onClick={() => {
                                  if (onUnlockModule && canAffordMod) {
                                    playSound('powerup-get');
                                    onUnlockModule(mod.id, mod.cpCost);
                                  }
                                }}
                                className={`w-full py-1.5 rounded text-xs font-bold uppercase transition-all ${
                                  canAffordMod
                                    ? 'bg-solar-orange text-cosmic-blue hover:opacity-90'
                                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                Unlock ({mod.cpCost} CP)
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live Frame Telemetry (4 cols) */}
          <div className="lg:col-span-4 glass-panel p-4 sm:p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold text-hyper-green uppercase tracking-widest mb-4 border-b border-white/10 pb-2">
                📊 Computed Frame Telemetry
              </h2>

              <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-cosmic-blue/60 border border-white/10">
                <span className="text-4xl">{CHASSIS_DEFINITIONS[selectedChassis].icon}</span>
                <div>
                  <div className="text-base font-black text-white">{CHASSIS_DEFINITIONS[selectedChassis].name}</div>
                  <div className="text-xs text-galaxy-cyan font-mono">
                    {Object.values(currentLoadout?.modules ?? {}).filter(Boolean).length}/3 Modules Equipped
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center p-2.5 rounded bg-black/30 border border-white/5">
                  <span className="text-xs text-gray-400 uppercase">Velocity Multiplier</span>
                  <span className="text-sm font-mono font-bold text-hyper-green">
                    +{telemetrySummary.moveBonusPct}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded bg-black/30 border border-white/5">
                  <span className="text-xs text-gray-400 uppercase">Starting Reactor Energy</span>
                  <span className="text-sm font-mono font-bold text-solar-orange">
                    +{telemetrySummary.startEnergy}⚡
                  </span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded bg-black/30 border border-white/5">
                  <span className="text-xs text-gray-400 uppercase">Debuff Duration Reduction</span>
                  <span className="text-sm font-mono font-bold text-galaxy-cyan">
                    -{telemetrySummary.debuffRes} Tile(s)
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Active Frame Systems
                </h3>
                {telemetrySummary.perks.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Standard balanced configuration. Equip modules to add specialized systems.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {telemetrySummary.perks.map((perk, i) => (
                      <li key={i} className="text-xs text-gray-200 bg-white/5 px-2.5 py-1.5 rounded border border-white/10">
                        {perk}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <button
              onClick={() => { playSound('ui-click'); onBack(); }}
              className="w-full mt-6 py-3 bg-gradient-to-r from-galaxy-cyan to-hyper-green text-cosmic-blue font-black text-sm uppercase tracking-wider rounded-xl shadow-lg hover:opacity-90"
            >
              Confirm Loadout & Return
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
