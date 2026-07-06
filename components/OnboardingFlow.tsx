/**
 * components/OnboardingFlow.tsx
 *
 * First-time player onboarding: name, avatar, chassis, tutorial prompt.
 */

import React, { useState } from 'react';
import { ChassisId } from '../shared/types';
import { CHASSIS_DEFINITIONS } from '../shared/constants';
import { AVATARS } from '../constants';

interface OnboardingFlowProps {
  onComplete: (name: string, avatarId: string, chassisId: ChassisId) => void;
}

type Step = 'name' | 'avatar' | 'chassis' | 'welcome';

const starterChassis: ChassisId[] = [ChassisId.Standard, ChassisId.Aegis, ChassisId.Momentum];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState(AVATARS[0]);
  const [chassisId, setChassisId] = useState<ChassisId>(ChassisId.Standard);

  const handleNext = () => {
    if (step === 'name' && name.trim()) setStep('avatar');
    else if (step === 'avatar') setStep('chassis');
    else if (step === 'chassis') setStep('welcome');
    else if (step === 'welcome') onComplete(name.trim(), avatarId, chassisId);
  };

  const handleBack = () => {
    if (step === 'avatar') setStep('name');
    else if (step === 'chassis') setStep('avatar');
    else if (step === 'welcome') setStep('chassis');
  };

  return (
    <div className="onboarding-flow">
      <div className="onboarding-flow__progress">
        {(['name', 'avatar', 'chassis', 'welcome'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`progress-dot ${step === s ? 'progress-dot--active' : ''} ${
              (['name', 'avatar', 'chassis', 'welcome'] as Step[]).indexOf(step) > i ? 'progress-dot--done' : ''
            }`}
          />
        ))}
      </div>

      {step === 'name' && (
        <div className="onboarding-step">
          <h2>Welcome to Conflux Circuit!</h2>
          <p>What should we call you, pilot?</p>
          <input
            type="text"
            className="onboarding-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your pilot name"
            maxLength={20}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleNext()}
          />
          <button className="onboarding-btn" disabled={!name.trim()} onClick={handleNext}>
            Continue
          </button>
        </div>
      )}

      {step === 'avatar' && (
        <div className="onboarding-step">
          <h2>Choose Your Avatar</h2>
          <div className="avatar-grid">
            {AVATARS.map(av => (
              <button
                key={av}
                className={`avatar-option ${avatarId === av ? 'avatar-option--selected' : ''}`}
                onClick={() => setAvatarId(av)}
              >
                <span className="avatar-option__icon">{av}</span>
              </button>
            ))}
          </div>
          <div className="onboarding-step__actions">
            <button className="onboarding-btn onboarding-btn--secondary" onClick={handleBack}>Back</button>
            <button className="onboarding-btn" onClick={handleNext}>Continue</button>
          </div>
        </div>
      )}

      {step === 'chassis' && (
        <div className="onboarding-step">
          <h2>Pick Your Starter Chassis</h2>
          <div className="chassis-grid">
            {starterChassis.map(cid => {
              const def = CHASSIS_DEFINITIONS[cid];
              return (
                <button
                  key={cid}
                  className={`chassis-option ${chassisId === cid ? 'chassis-option--selected' : ''}`}
                  onClick={() => setChassisId(cid)}
                >
                  <span className="chassis-option__name">{def.name}</span>
                  <span className="chassis-option__desc">{def.description}</span>
                </button>
              );
            })}
          </div>
          <div className="onboarding-step__actions">
            <button className="onboarding-btn onboarding-btn--secondary" onClick={handleBack}>Back</button>
            <button className="onboarding-btn" onClick={handleNext}>Continue</button>
          </div>
        </div>
      )}

      {step === 'welcome' && (
        <div className="onboarding-step">
          <h2>You're All Set!</h2>
          <div className="onboarding-summary">
            <span className="onboarding-summary__avatar">{avatarId}</span>
            <span className="onboarding-summary__name">{name}</span>
            <span className="onboarding-summary__chassis">{CHASSIS_DEFINITIONS[chassisId].name}</span>
          </div>
          <p>Ready to race? You can change your chassis and unlock new ones in the Hangar.</p>
          <div className="onboarding-step__actions">
            <button className="onboarding-btn onboarding-btn--secondary" onClick={handleBack}>Back</button>
            <button className="onboarding-btn" onClick={handleNext}>Start Racing!</button>
          </div>
        </div>
      )}
    </div>
  );
};
