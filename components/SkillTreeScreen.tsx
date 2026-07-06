/**
 * components/SkillTreeScreen.tsx
 *
 * Displays the pilot skill tree with three branches: Speed, Tech, Endurance.
 * Players spend CP to unlock nodes.
 */

import React, { useState, useMemo } from 'react';
import { PilotProfile, PilotSkills } from '../shared/types';
import { SKILL_TREE_NODES } from '../shared/constants';

interface SkillTreeScreenProps {
  profile: PilotProfile;
  onUnlock: (branch: 'speed' | 'tech' | 'endurance', nodeId: string, cost: number) => void;
  onBack: () => void;
}

type Branch = 'speed' | 'tech' | 'endurance';

const branchConfig: Record<Branch, { label: string; icon: string; color: string }> = {
  speed: { label: 'Speed', icon: '⚡', color: '#3b82f6' },
  tech: { label: 'Tech', icon: '🔧', color: '#8b5cf6' },
  endurance: { label: 'Endurance', icon: '🛡️', color: '#10b981' },
};

export const SkillTreeScreen: React.FC<SkillTreeScreenProps> = ({
  profile,
  onUnlock,
  onBack,
}) => {
  const [activeBranch, setActiveBranch] = useState<Branch>('speed');
  const skills = profile.skills ?? { speed: {}, tech: {}, endurance: {}, availableCP: 0 };
  const availableCP = skills.availableCP ?? 0;

  const branchNodes = useMemo(() => {
    return SKILL_TREE_NODES.filter(node => node.tree === activeBranch)
      .sort((a, b) => a.tier - b.tier);
  }, [activeBranch]);

  const isUnlocked = (nodeId: string): boolean => {
    const branchSkills = skills[activeBranch] as Record<string, boolean>;
    return !!branchSkills[nodeId];
  };

  const isPrerequisiteMet = (node: typeof SKILL_TREE_NODES[0]): boolean => {
    if (!node.prerequisites || node.prerequisites.length === 0) return true;
    const branchSkills = skills[activeBranch] as Record<string, boolean>;
    return node.prerequisites.every(prereq => !!branchSkills[prereq]);
  };

  return (
    <div className="skill-tree-screen">
      <div className="skill-tree-screen__header">
        <button className="skill-tree-screen__back" onClick={onBack}>← Back</button>
        <h2>Skill Tree</h2>
        <div className="skill-tree-screen__cp">
          <span className="cp-display">{availableCP} CP</span>
        </div>
      </div>

      <div className="skill-tree-screen__branches">
        {(Object.keys(branchConfig) as Branch[]).map(branch => (
          <button
            key={branch}
            className={`branch-tab ${activeBranch === branch ? 'branch-tab--active' : ''}`}
            style={{ '--branch-color': branchConfig[branch].color } as React.CSSProperties}
            onClick={() => setActiveBranch(branch)}
          >
            <span className="branch-tab__icon">{branchConfig[branch].icon}</span>
            <span className="branch-tab__label">{branchConfig[branch].label}</span>
          </button>
        ))}
      </div>

      <div className="skill-tree-screen__nodes">
        {branchNodes.map(node => {
          const unlocked = isUnlocked(node.id);
          const prereqMet = isPrerequisiteMet(node);
          const canUnlock = !unlocked && prereqMet && availableCP >= node.cpCost;

          return (
            <div
              key={node.id}
              className={`skill-node ${unlocked ? 'skill-node--unlocked' : ''} ${!prereqMet ? 'skill-node--locked' : ''}`}
              style={{ '--node-color': branchConfig[activeBranch].color } as React.CSSProperties}
            >
              <div className="skill-node__header">
                <span className="skill-node__name">{node.name}</span>
                <span className="skill-node__tier">T{node.tier}</span>
              </div>
              <p className="skill-node__description">{node.description}</p>
              <div className="skill-node__footer">
                {unlocked ? (
                  <span className="skill-node__status skill-node__status--unlocked">✓ Unlocked</span>
                ) : (
                  <>
                    <span className="skill-node__cost">{node.cpCost} CP</span>
                    <button
                      className="skill-node__unlock-btn"
                      disabled={!canUnlock}
                      onClick={() => onUnlock(activeBranch, node.id, node.cpCost)}
                    >
                      Unlock
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
