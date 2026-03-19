import React, { useState, useRef, useEffect } from 'react';
import { AVATARS } from '../constants';
import type { PilotAccountSummary } from '../services/profileService';

interface PilotProfileSetupProps {
  onProfileCreated: (data: { name: string, avatarId: string }) => void;
  existingProfiles?: PilotAccountSummary[];
  onSelectProfile?: (accountId: string) => void;
  onDeleteProfile?: (accountId: string) => void;
}

export const PilotProfileSetup: React.FC<PilotProfileSetupProps> = ({ onProfileCreated, existingProfiles = [], onSelectProfile, onDeleteProfile }) => {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [profilePendingDelete, setProfilePendingDelete] = useState<PilotAccountSummary | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onProfileCreated({
        name: name.trim(),
        avatarId: selectedAvatar,
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="relative w-full max-w-md glass-panel p-5 sm:p-8 text-center overflow-visible" role="form" aria-label="Create Pilot Profile">
        <h1 className="text-2xl sm:text-4xl font-black text-galaxy-cyan mb-2">Welcome, Pilot!</h1>
        <p className="text-gray-300 mb-4 sm:mb-6 text-sm sm:text-base">Create your racing profile to begin your career.</p>

        {profilePendingDelete && (
          <div className="absolute top-20 right-3 sm:right-4 z-30 w-56 sm:w-64 rounded-2xl border border-red-400/35 bg-gradient-to-b from-[#2a0f18]/95 to-[#170912]/95 backdrop-blur-sm shadow-[0_22px_50px_rgba(0,0,0,0.45)] p-4 text-left" role="alertdialog" aria-label="Delete Pilot Confirmation">
            <div className="text-[10px] font-black tracking-[0.22em] uppercase text-red-300 mb-2">Delete Pilot</div>
            <p className="text-sm text-gray-200 leading-relaxed mb-3">
              Remove <span className="font-semibold text-white">{profilePendingDelete.name}</span> and all progress tied to this pilot?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setProfilePendingDelete(null)}
                className="px-3 py-2 text-[11px] rounded-lg bg-white/5 text-gray-300 border border-white/10 active:bg-white/10 sm:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProfile?.(profilePendingDelete.id);
                  setProfilePendingDelete(null);
                }}
                className="px-3 py-2 text-[11px] rounded-lg bg-red-500 text-white font-bold active:opacity-80 sm:hover:opacity-90 transition-opacity shadow-[0_8px_20px_rgba(239,68,68,0.25)]"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {existingProfiles.length > 0 && (
          <div className="mb-6 text-left">
            <h2 className="text-sm font-bold text-nebula-pink uppercase tracking-widest mb-3">Saved Pilots</h2>
            <div className="space-y-2 max-h-56 overflow-y-auto mobile-scroll pr-1">
              {existingProfiles.map(account => (
                <div key={account.id} className={`relative bg-cosmic-blue/50 border border-white/10 rounded-xl p-3 sm:p-4 flex items-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)] ${profilePendingDelete?.id === account.id ? 'ring-1 ring-red-400/30' : ''}`}>
                  <div className="w-12 h-12 rounded-full bg-star-purple flex items-center justify-center text-2xl flex-shrink-0 border border-white/10 shadow-inner">
                    {account.avatarId}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <div className="text-white font-bold truncate">{account.name}</div>
                    <div className="text-xs text-gray-400">{account.circuitPoints} CP</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectProfile?.(account.id)}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-hyper-green text-cosmic-blue active:opacity-80 sm:hover:opacity-90 transition-opacity shadow-[0_6px_18px_rgba(77,255,175,0.2)]"
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfilePendingDelete(account)}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 active:bg-red-500/30 sm:hover:bg-red-500/30 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">Resume an existing pilot or create a fresh alt below.</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4 sm:mb-6">
            <label htmlFor="pilotName" className="block text-base sm:text-lg text-galaxy-cyan mb-2">Pilot Name</label>
            <input
              id="pilotName"
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={12}
              autoComplete="off"
              enterKeyHint="done"
              className="w-full px-4 py-3 bg-cosmic-blue border-2 border-star-purple rounded-md text-center text-lg sm:text-xl focus:outline-none focus:ring-2 focus:ring-galaxy-cyan"
              placeholder="Enter your name"
              required
            />
            <div className="text-right mt-1">
              <span className={`text-xs font-mono ${name.length >= 10 ? 'text-solar-orange' : 'text-gray-500'}`}>{name.length}/12</span>
            </div>
          </div>

          <div className="mb-6 sm:mb-8">
            <label className="block text-base sm:text-lg text-galaxy-cyan mb-2">Select Avatar</label>
            <div className="flex justify-center gap-2 sm:gap-3 flex-wrap">
              {AVATARS.map(avatar => (
                <button
                  key={avatar}
                  type="button"
                  onClick={() => setSelectedAvatar(avatar)}
                  aria-label={`Select avatar ${avatar}`}
                  aria-pressed={selectedAvatar === avatar}
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full text-3xl sm:text-4xl flex items-center justify-center transition-all transform active:scale-95 sm:hover:scale-110 ${selectedAvatar === avatar ? 'bg-hyper-green ring-4 ring-white' : 'bg-star-purple'}`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full py-4 sm:py-3 bg-hyper-green text-cosmic-blue font-bold text-lg sm:text-xl rounded-lg active:opacity-80 sm:hover:opacity-90 transition-opacity" aria-label="Create profile and enter hangar">
            Create Profile & Enter Hangar
          </button>
        </form>

      </div>
    </div>
  );
};
