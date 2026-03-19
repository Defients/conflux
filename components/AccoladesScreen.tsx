
import React from 'react';
import { PilotProfile } from '../types';
import { ACCOLADE_DEFINITIONS } from '../constants';
import { useSound } from '../hooks/useSound';

interface AccoladesScreenProps {
  profile: PilotProfile;
  onBack: () => void;
}

export const AccoladesScreen: React.FC<AccoladesScreenProps> = ({ profile, onBack }) => {
    const { playSound } = useSound();
    const unlockedCount = profile.unlockedAccolades.length;
    const totalCount = Object.keys(ACCOLADE_DEFINITIONS).length;

    const handleBackClick = () => {
        playSound('ui-click');
        onBack();
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 animate-fade-in" role="region" aria-label="Accolades">
            <div className="w-full max-w-4xl h-[90vh] flex flex-col">
                <div className="flex-shrink-0 text-center mb-3 sm:mb-4">
                    <h1 className="text-3xl sm:text-5xl font-black text-galaxy-cyan tracking-tighter">ACCOLADES</h1>
                    <p className="text-nebula-pink text-sm sm:text-base">Unlocked: {unlockedCount} / {totalCount}</p>
                </div>

                <div className="flex-grow glass-panel p-3 sm:p-6 overflow-y-auto mobile-scroll">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                        {Object.entries(ACCOLADE_DEFINITIONS).map(([id, accolade]) => {
                            const isUnlocked = profile.unlockedAccolades.includes(id as any);
                            return (
                                <div key={id} className={`p-3 sm:p-4 rounded-lg flex items-start gap-3 sm:gap-4 transition-all ${isUnlocked ? 'bg-hyper-green/10 border-2 border-hyper-green' : 'bg-cosmic-blue/50 border border-star-purple/50 opacity-60'}`}>
                                    <span className="text-3xl sm:text-4xl mt-0.5 sm:mt-1" aria-hidden="true">{isUnlocked ? accolade.icon : '🔒'}</span>
                                    <div>
                                        <h3 className={`text-base sm:text-lg font-bold ${isUnlocked ? 'text-hyper-green' : 'text-white'}`}>{accolade.name}</h3>
                                        <p className="text-xs sm:text-sm text-gray-400">{accolade.description}</p>
                                        {!isUnlocked && <p className="text-[10px] sm:text-xs text-galaxy-cyan/60 mt-1 italic">Complete the objective to unlock</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex-shrink-0 mt-3 sm:mt-4">
                    <button onClick={handleBackClick} className="w-full py-4 sm:py-3 bg-star-purple text-white font-bold text-base sm:text-lg rounded-lg active:bg-nebula-pink sm:hover:bg-nebula-pink transition-colors" aria-label="Return to hangar">
                        Back to Hangar
                    </button>
                </div>
            </div>
        </div>
    );
};
