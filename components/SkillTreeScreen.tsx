/**
 * components/SkillTreeScreen.tsx
 *
 * Displays the pilot skill tree with three branches: Speed, Tech, Endurance.
 * Players spend CP to unlock nodes.
 */

import React, { useState, useMemo } from 'react';
import { PilotProfile } from '../shared/types';
import { SKILL_TREE_NODES } from '../shared/constants';
import { useSound } from '../hooks/useSound';

interface SkillTreeScreenProps {
  profile: PilotProfile;
  onUnlock: (branch: 'speed' | 'tech' | 'endurance', nodeId: string, cost: number) => void;
  onBack: () => void;
}

type Branch = 'speed' | 'tech' | 'endurance';

const branchConfig: Record<Branch, { label: string; subtitle: string; icon: string; color: string; borderClass: string; textClass: string; bgClass: string }> = {
  speed: {
    label: 'Speed',
    subtitle: 'Overdrive velocity, energy generation & rapid deployment',
    icon: '⚡',
    color: '#00dffc',
    borderClass: 'border-galaxy-cyan',
    textClass: 'text-galaxy-cyan',
    bgClass: 'bg-galaxy-cyan/10',
  },
  tech: {
    label: 'Tech',
    subtitle: 'Tactical shields, sensor telemetry & offensive cyber-warfare',
    icon: '🔧',
    color: '#a77dff',
    borderClass: 'border-purple-400',
    textClass: 'text-purple-300',
    bgClass: 'bg-purple-500/10',
  },
  endurance: {
    label: 'Endurance',
    subtitle: 'Debuff resilience, pit stop recovery & fail-safe protocols',
    icon: '🛡️',
    color: '#4dffaf',
    borderClass: 'border-hyper-green',
    textClass: 'text-hyper-green',
    bgClass: 'bg-hyper-green/10',
  },
};

export const SkillTreeScreen: React.FC<SkillTreeScreenProps> = ({
  profile,
  onUnlock,
  onBack,
}) => {
  const [activeBranch, setActiveBranch] = useState<Branch>('speed');
  const { playSound } = useSound();
  const skills = profile.skills ?? { speed: {}, tech: {}, endurance: {}, availableCP: 0 };
  const availableCP = Math.max(profile.circuitPoints ?? 0, skills.availableCP ?? 0);

  const branchNodes = useMemo(() => {
    return SKILL_TREE_NODES.filter(node => node.tree === activeBranch)
      .sort((a, b) => a.tier - b.tier);
  }, [activeBranch]);

  const isUnlocked = (branch: Branch, nodeId: string): boolean => {
    const branchSkills = skills[branch] as Record<string, boolean>;
    return !!branchSkills?.[nodeId];
  };

  const isPrerequisiteMet = (node: typeof SKILL_TREE_NODES[0]): boolean => {
    if (!node.prerequisites || node.prerequisites.length === 0) return true;
    const branchSkills = skills[activeBranch] as Record<string, boolean>;
    return node.prerequisites.every(prereq => !!branchSkills?.[prereq]);
  };

  const totalUnlockedCount = useMemo(() => {
    return SKILL_TREE_NODES.filter(n => isUnlocked(n.tree as Branch, n.id)).length;
  }, [skills]);

  const unlockedNodesList = useMemo(() => {
    return SKILL_TREE_NODES.filter(n => isUnlocked(n.tree as Branch, n.id));
  }, [skills]);

  const handleUnlockClick = (branch: Branch, nodeId: string, cost: number) => {
    playSound('powerup-get');
    onUnlock(branch, nodeId, cost);
  };

  const currentTheme = branchConfig[activeBranch];

  return (
    <div className="min-h-screen w-full flex flex-col p-2 sm:p-4 md:p-6 animate-fade-in overflow-y-auto" role="region" aria-label="Pilot Skill Tree">
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <header className="glass-panel p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4 border-b-2 border-galaxy-cyan/40">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              className="px-3 sm:px-4 py-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-sm font-bold text-gray-200 transition-colors"
              onClick={() => { playSound('ui-click'); onBack(); }}
              aria-label="Back to Lobby"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-galaxy-cyan to-hyper-green tracking-tight uppercase">
                Neural Skill Matrix
              </h1>
              <p className="text-xs text-gray-400 font-mono">
                {totalUnlockedCount}/{SKILL_TREE_NODES.length} Neural Nodes Active
              </p>
            </div>
          </div>
          <div className="bg-cosmic-blue/80 border border-hyper-green/40 px-4 py-2 rounded-xl text-right shadow-[0_0_15px_rgba(77,255,175,0.15)]">
            <div className="text-[10px] uppercase tracking-widest text-gray-400">Available Credits</div>
            <div className="text-xl sm:text-2xl font-black text-hyper-green font-mono">{availableCP} CP</div>
          </div>
        </header>

        {/* Branch Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {(Object.keys(branchConfig) as Branch[]).map(branch => {
            const cfg = branchConfig[branch];
            const isActive = activeBranch === branch;
            const branchTotal = SKILL_TREE_NODES.filter(n => n.tree === branch).length;
            const branchUnlocked = SKILL_TREE_NODES.filter(n => n.tree === branch && isUnlocked(branch, n.id)).length;
            return (
              <button
                key={branch}
                className={`p-3 sm:p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isActive
                    ? `glass-panel ${cfg.borderClass} shadow-lg`
                    : 'bg-black/30 border-white/10 opacity-75 hover:opacity-100 hover:border-white/20'
                }`}
                onClick={() => { playSound('ui-click'); setActiveBranch(branch); }}
                aria-pressed={isActive}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-2xl sm:text-3xl" aria-hidden="true">{cfg.icon}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/10 text-white">
                    {branchUnlocked}/{branchTotal}
                  </span>
                </div>
                <div>
                  <div className={`text-sm sm:text-lg font-black uppercase tracking-wider ${isActive ? cfg.textClass : 'text-white'}`}>
                    {cfg.label}
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-400 hidden sm:block line-clamp-1 mt-0.5">
                    {cfg.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Branch Nodes */}
        <div className="glass-panel p-4 sm:p-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div>
              <h2 className={`text-lg sm:text-xl font-black uppercase tracking-wider ${currentTheme.textClass}`}>
                {currentTheme.icon} {currentTheme.label} Branch
              </h2>
              <p className="text-xs text-gray-400">{currentTheme.subtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {branchNodes.map(node => {
              const unlocked = isUnlocked(activeBranch, node.id);
              const prereqMet = isPrerequisiteMet(node);
              const canUnlock = !unlocked && prereqMet && availableCP >= node.cpCost;
              const prereqNames = node.prerequisites
                .map(pid => SKILL_TREE_NODES.find(n => n.id === pid)?.name ?? pid)
                .join(', ');

              return (
                <div
                  key={node.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    unlocked
                      ? `${currentTheme.bgClass} ${currentTheme.borderClass} shadow-[0_0_20px_rgba(0,223,252,0.1)]`
                      : prereqMet
                      ? 'bg-cosmic-blue/60 border-white/15 hover:border-white/30'
                      : 'bg-black/40 border-white/5 opacity-55'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl sm:text-3xl" aria-hidden="true">{node.icon}</span>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-white leading-tight">{node.name}</h3>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">
                            Tier {node.tier} Augmentation
                          </span>
                        </div>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        unlocked ? 'bg-hyper-green/20 text-hyper-green' : 'bg-white/10 text-gray-300'
                      }`}>
                        T{node.tier}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-gray-200 mb-3 leading-relaxed">{node.description}</p>

                    {!prereqMet && prereqNames && (
                      <p className="text-[11px] text-nebula-pink font-mono mb-2">
                        🔒 Requires: {prereqNames}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-2">
                    {unlocked ? (
                      <span className="text-xs sm:text-sm font-black text-hyper-green uppercase tracking-wider flex items-center gap-1.5">
                        <span>✓</span> Active in Circuit
                      </span>
                    ) : (
                      <>
                        <span className={`text-sm sm:text-base font-mono font-bold ${availableCP >= node.cpCost ? 'text-solar-orange' : 'text-gray-500'}`}>
                          {node.cpCost} CP
                        </span>
                        <button
                          className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wider transition-all ${
                            canUnlock
                              ? 'bg-gradient-to-r from-galaxy-cyan to-hyper-green text-cosmic-blue shadow-md hover:opacity-90 active:scale-95'
                              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                          }`}
                          disabled={!canUnlock}
                          onClick={() => handleUnlockClick(activeBranch, node.id, node.cpCost)}
                          aria-label={`Unlock ${node.name} for ${node.cpCost} CP`}
                        >
                          Unlock Node
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Neural Summary */}
        <div className="glass-panel p-4 sm:p-5">
          <h3 className="text-xs font-bold text-galaxy-cyan uppercase tracking-widest mb-3 border-b border-white/10 pb-2">
            Active Pilot Augmentations ({unlockedNodesList.length})
          </h3>
          {unlockedNodesList.length === 0 ? (
            <p className="text-xs text-gray-500 italic">
              No neural augmentations unlocked yet. Earn Circuit Points (CP) in races to unlock permanent pilot upgrades.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unlockedNodesList.map(node => (
                <div
                  key={node.id}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs flex items-center gap-2"
                  title={node.description}
                >
                  <span>{node.icon}</span>
                  <span className="font-bold text-white">{node.name}</span>
                  <span className="text-gray-400 hidden sm:inline">— {node.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
