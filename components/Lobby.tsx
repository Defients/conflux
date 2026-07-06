import React, { useState, useEffect } from 'react';
import { GameSettings, PilotProfile, ChassisId } from '../types';
import { decodeSettings } from '../services/shareService';
import { useSound } from '../hooks/useSound';
import { getDailySeed, getWeeklySeed, getWeeklyPreset } from '../shared/dailyChallengeService';
import { CHASSIS_DEFINITIONS } from '../constants';
import { saveProfile } from '../services/profileService';

interface LobbyProps {
  profile: PilotProfile;
  setProfile: React.Dispatch<React.SetStateAction<PilotProfile | null>>;
  onStartGame: (settings: GameSettings, customEventIds?: string[]) => void;
  onStartGauntlet: (settings: GameSettings) => void;
  onGoToEventList: () => void;
  onGoToAccolades: () => void;
  onGoToOnline?: () => void;
  onGoToLeaderboard?: () => void;
  onGoToMatchHistory?: () => void;
  onSwitchPilot?: () => void;
}

const defaultSettings: Omit<GameSettings, 'seed' | 'selectedChassis'> = {
    playerCount: 4,
    easyBots: 2,
    intermediateBots: 1,
    runLength: 8,
    sound: true,
    accessibility: false,
    uiEffects: true,
    colorBlindMode: false,
};

const loadSettings = (): Partial<GameSettings> => {
    try {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#cc=')) {
            const encodedData = hash.substring('#cc='.length);
            const decoded = decodeSettings(encodedData);
            if (decoded) {
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
                return decoded;
            }
        }
        if (hash && hash.startsWith('#seed=')) {
            const seed = hash.substring('#seed='.length);
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            return { seed };
        }
    } catch (e) {
        console.error("Failed to load settings from URL hash", e);
    }

    try {
        const saved = localStorage.getItem('conflux-circuit-settings');
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.error("Failed to load settings from localStorage", e);
    }
    
    return {};
};

const saveSettings = (settings: GameSettings) => {
    localStorage.setItem('conflux-circuit-settings', JSON.stringify(settings));
};

const Slider = ({ label, value, min, max, onChange, id, formatValue }: { label: string, value: number, min: number, max: number, onChange: (val: number) => void, id: string, formatValue?: (v: number) => string }) => (
  <div className="mb-5">
    <div className="flex justify-between mb-1">
        <label htmlFor={id} className='text-xs font-bold tracking-wider uppercase text-galaxy-cyan'>{label}</label>
        <span className="text-xs font-mono text-white" aria-live="polite">{formatValue ? formatValue(value) : value}</span>
    </div>
    <input id={id} type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value, 10))} className="w-full" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={formatValue ? formatValue(value) : String(value)} />
  </div>
);

const Toggle = ({ label, checked, onChange, id }: { label: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, id: string }) => (
  <div className="flex items-center justify-between py-3 sm:py-2 border-b border-white/5 last:border-0 active:bg-white/5 sm:hover:bg-white/5 px-2 rounded transition-colors">
      <label htmlFor={id} className="text-sm text-gray-300 cursor-pointer select-none flex-grow pr-4">{label}</label>
      <label htmlFor={id} className="relative inline-flex h-4 w-8 cursor-pointer items-center">
          <input type="checkbox" id={id} checked={checked} onChange={onChange} className="peer sr-only" aria-label={label} />
          <span className="h-4 w-8 rounded-full bg-gray-700 transition-colors duration-200 peer-checked:bg-hyper-green/80"></span>
          <span className="pointer-events-none absolute left-[2px] h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-4"></span>
      </label>
  </div>
);

export const Lobby: React.FC<LobbyProps> = ({ profile, setProfile, onStartGame, onStartGauntlet, onGoToEventList, onGoToAccolades, onGoToOnline, onGoToLeaderboard, onGoToMatchHistory, onSwitchPilot }) => {
    const [settings, setSettings] = useState<GameSettings>(() => {
        const loaded = loadSettings();
        const chassis = loaded.selectedChassis && profile.unlockedChassis.includes(loaded.selectedChassis)
            ? loaded.selectedChassis
            : profile.unlockedChassis[0];
            
        return {
            ...defaultSettings,
            ...loaded,
            seed: loaded.seed || String(Math.floor(Math.random() * 1000000)),
            selectedChassis: chassis,
        };
    });
    
  const { playSound } = useSound();
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const totalBots = settings.easyBots + settings.intermediateBots;

  useEffect(() => {
    const desiredBots = settings.playerCount - 1;
    if (totalBots !== desiredBots) {
        const intermediateCount = Math.min(settings.intermediateBots, desiredBots);
        const easyCount = desiredBots - intermediateCount;
        setSettings(s => ({ ...s, easyBots: easyCount, intermediateBots: intermediateCount }));
    }
  }, [settings.playerCount, settings.easyBots, settings.intermediateBots, totalBots]);

  useEffect(() => {
      saveSettings(settings);
  }, [settings]);
  
  const handleStartDailyChallenge = () => {
      playSound('ui-click');
      const dailySettings: GameSettings = {
        ...settings,
        playerCount: 4,
        easyBots: 1,
        intermediateBots: 2,
        seed: getDailySeed(),
        runLength: 10,
      };
      onStartGame(dailySettings);
  };
  
  const handleStartWeeklyCup = () => {
      playSound('ui-click');
      const weeklySeed = getWeeklySeed();
      const weeklyPreset = getWeeklyPreset(weeklySeed);
      const weeklySettings: GameSettings = {
          ...settings,
          playerCount: 6,
          easyBots: 2,
          intermediateBots: 3,
          seed: weeklySeed,
          runLength: 12,
      };
      onStartGame(weeklySettings, weeklyPreset.eventIds);
  }

  const handlePlayerCountChange = (value: number) => {
      playSound('ui-click');
      setSettings(s => ({ ...s, playerCount: value }));
  };
  
  const handleBotChange = (value: number) => {
      playSound('ui-click');
      const desiredBots = settings.playerCount - 1;
      const easy = Math.max(0, Math.min(value, desiredBots));
      const intermediate = desiredBots - easy;
      setSettings(s => ({ ...s, easyBots: easy, intermediateBots: intermediate }));
  };

  const [seedFlash, setSeedFlash] = useState(false);
  const randomizeSeed = () => {
    playSound('ui-click');
    setSettings(s => ({ ...s, seed: String(Math.floor(Math.random() * 1000000)) }));
    setSeedFlash(true);
    setTimeout(() => setSeedFlash(false), 300);
  };

  const handleStartClick = () => {
    playSound('ui-click');
    onStartGame(settings);
  }

  const handleStartGauntlet = () => {
    playSound('ui-click');
    const gauntletSettings: GameSettings = {
        ...settings,
        playerCount: 1,
        easyBots: 0,
        intermediateBots: 0,
        seed: String(Math.floor(Math.random() * 1000000)),
        runLength: 50,
        isGauntlet: true,
    };
    onStartGauntlet(gauntletSettings);
  }
  
  const handleEventListClick = () => {
    playSound('ui-click');
    onGoToEventList();
  }
  
  const handleAccoladesClick = () => {
    playSound('ui-click');
    onGoToAccolades();
  }
  
  const handleUnlockChassis = (chassisId: ChassisId) => {
      playSound('ui-click');
      const chassis = CHASSIS_DEFINITIONS[chassisId];
      if (profile.circuitPoints >= chassis.cost && !profile.unlockedChassis.includes(chassisId)) {
          const updatedProfile = {
              ...profile,
              circuitPoints: profile.circuitPoints - chassis.cost,
              unlockedChassis: [...profile.unlockedChassis, chassisId]
          };
          saveProfile(updatedProfile);
          setProfile(updatedProfile);
      }
  }

  return (
    <div className="min-h-screen w-full flex flex-col p-2 sm:p-4 md:p-6 animate-fade-in overflow-y-auto overflow-x-hidden pb-4" role="region" aria-label="Game Lobby">
        {/* Header */}
        <header className="flex-shrink-0 flex justify-between items-center mb-4 sm:mb-6 px-2 sm:px-4">
            <div>
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-galaxy-cyan to-hyper-green tracking-tighter">
                    CONFLUX CIRCUIT
                </h1>
                <p className="text-xs sm:text-sm text-nebula-pink font-mono tracking-widest uppercase">Hyper-Competitive Racing Simulation</p>
            </div>
            <div className="text-right hidden md:block">
                <p className="text-sm text-gray-400">Version 3.2</p>
                <div className="flex gap-2 text-xs text-gray-500">
                    <span>REACT</span>
                    <span>TAILWIND</span>
                    <span>VITE</span>
                </div>
            </div>
        </header>
        
        {/* Main Grid */}
        <div className="flex-grow w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lobby-grid">
            
            {/* Left Column: Pilot & Chassis (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4 sm:gap-6 overflow-y-auto sm:pr-2">
                {/* Pilot Profile Card */}
                <div className="glass-panel p-4 sm:p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                        <span className="text-8xl">{profile.avatarId}</span>
                    </div>
                    <h2 className="text-xs font-bold text-solar-orange uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Active Pilot</h2>
                    
                    <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-star-purple to-cosmic-blue border-2 border-galaxy-cyan flex items-center justify-center text-3xl sm:text-4xl shadow-lg shadow-galaxy-cyan/20">
                            {profile.avatarId}
                        </div>
                        <div>
                            <div className="text-xl sm:text-2xl font-bold text-white leading-none mb-1">{profile.name}</div>
                            <div className="text-xs text-hyper-green font-mono bg-hyper-green/10 px-2 py-0.5 rounded inline-block">
                                RANK: {profile.winStreak > 5 ? 'ELITE' : profile.winStreak > 2 ? 'VETERAN' : 'ROOKIE'}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
                        <div className="bg-cosmic-blue/40 p-2 sm:p-3 rounded border border-white/5">
                            <div className="text-xs text-gray-400 uppercase mb-1">Credits</div>
                            <div className="text-lg sm:text-xl font-bold text-hyper-green font-mono">{profile.circuitPoints} CP</div>
                        </div>
                        <div className="bg-cosmic-blue/40 p-2 sm:p-3 rounded border border-white/5">
                            <div className="text-xs text-gray-400 uppercase mb-1">Rival W/L</div>
                            <div className="text-lg sm:text-xl font-bold text-white font-mono">{profile.rivalData.wins}/{profile.rivalData.losses}</div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={handleAccoladesClick} className="flex-1 py-3 sm:py-2 text-sm bg-white/5 active:bg-white/15 sm:hover:bg-white/10 border border-white/10 rounded transition-colors text-gray-300" aria-label="View Accolades">
                          Accolades
                        </button>
                        <button onClick={handleEventListClick} className="flex-1 py-3 sm:py-2 text-sm bg-white/5 active:bg-white/15 sm:hover:bg-white/10 border border-white/10 rounded transition-colors text-gray-300" aria-label="Open Workshop">
                          Workshop
                        </button>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <button onClick={() => onGoToLeaderboard?.()} className="flex-1 py-3 sm:py-2 text-sm bg-white/5 active:bg-white/15 sm:hover:bg-white/10 border border-white/10 rounded transition-colors text-gray-300" aria-label="View Leaderboards">
                          🏆 Leaderboards
                        </button>
                        <button onClick={() => onGoToMatchHistory?.()} className="flex-1 py-3 sm:py-2 text-sm bg-white/5 active:bg-white/15 sm:hover:bg-white/10 border border-white/10 rounded transition-colors text-gray-300" aria-label="View Match History">
                          🏁 History
                        </button>
                    </div>
                    <button onClick={() => onSwitchPilot?.()} className="w-full mt-2 py-3 sm:py-2 text-sm bg-white/5 active:bg-white/15 sm:hover:bg-white/10 border border-white/10 rounded transition-colors text-gray-300" aria-label="Switch pilot profile">
                      Switch Pilot
                    </button>
                </div>

                {/* Chassis Selector */}
                <div className="glass-panel p-4 sm:p-6 flex-grow flex flex-col">
                     <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-3 sm:mb-4">
                        <h2 className="text-xs font-bold text-solar-orange uppercase tracking-widest">Hangar Bay</h2>
                        <span className="text-xs text-gray-500">{profile.unlockedChassis.length}/{Object.keys(CHASSIS_DEFINITIONS).length} Unlocked</span>
                     </div>
                     
                     <div className="space-y-2 sm:space-y-3 overflow-y-auto max-h-[250px] sm:max-h-[400px] pr-1 sm:pr-2 mobile-scroll">
                        {Object.entries(CHASSIS_DEFINITIONS).map(([id, chassis]) => {
                            const isUnlocked = profile.unlockedChassis.includes(id as ChassisId);
                            const isSelected = settings.selectedChassis === id;
                            const canAfford = profile.circuitPoints >= chassis.cost;
                            
                            return (
                                <div 
                                    key={id} 
                                    onClick={() => isUnlocked && setSettings(s => ({...s, selectedChassis: id as ChassisId}))}
                                    className={`p-3 rounded-lg border transition-all cursor-pointer relative group
                                        ${isSelected ? 'border-hyper-green bg-hyper-green/10 shadow-[0_0_15px_rgba(77,255,175,0.15)]' : 
                                          isUnlocked ? 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20' : 
                                          'border-white/5 bg-black/20 opacity-60 grayscale'}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2 sm:gap-3">
                                            <span className="text-2xl sm:text-3xl filter drop-shadow-lg">{chassis.icon}</span>
                                            <div>
                                                <h3 className={`text-sm font-bold ${isSelected ? 'text-hyper-green' : 'text-gray-200'}`}>{chassis.name}</h3>
                                                <div className="text-xs text-gray-400 line-clamp-1">{chassis.stats.movementGain}, {chassis.stats.debuffDuration}</div>
                                            </div>
                                        </div>
                                        {!isUnlocked && (
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); handleUnlockChassis(id as ChassisId); }} 
                                                disabled={!canAfford} 
                                                className="px-2 py-1 text-xs font-bold rounded bg-solar-orange text-cosmic-blue hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                                            >
                                                {chassis.cost}
                                            </button>
                                        )}
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-hyper-green shadow-[0_0_5px_#4dffaf]"></div>}
                                    </div>
                                </div>
                            );
                        })}
                     </div>
                </div>
            </div>

            {/* Center Column: Mission Control (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-6">
                <div className="glass-panel p-4 sm:p-6 flex-grow flex flex-col">
                    <h2 className="text-xs font-bold text-galaxy-cyan uppercase tracking-widest mb-6 border-b border-white/10 pb-2">Mission Configuration</h2>
                    
                    <div className="space-y-6 mb-8">
                        <div className="bg-cosmic-blue/30 p-4 rounded-lg border border-white/5">
                             <Slider 
                                id="players" 
                                label="Race Size" 
                                value={settings.playerCount} 
                                min={2} max={6} 
                                onChange={handlePlayerCountChange} 
                                formatValue={(v) => `${v} Pilots`}
                            />
                            
                            <div className="mt-4">
                                <div className="flex justify-between text-xs mb-2">
                                    <span className="font-bold text-galaxy-cyan uppercase tracking-wider">Opponent Difficulty</span>
                                    <span className="text-gray-400 font-mono">{settings.easyBots} Easy / {settings.intermediateBots} Int</span>
                                </div>
                                <div className="relative h-10 bg-gray-800 rounded-lg overflow-hidden flex border border-white/10">
                                    {/* Easy Range */}
                                    <div style={{width: `${(settings.easyBots / (settings.playerCount-1)) * 100}%`}} className="bg-solar-orange/50 h-full flex items-center justify-center transition-all duration-300 border-r border-black/20 text-xs font-bold text-white/80">
                                        {settings.easyBots > 0 && 'EASY'}
                                    </div>
                                    {/* Int Range */}
                                    <div style={{width: `${(settings.intermediateBots / (settings.playerCount-1)) * 100}%`}} className="bg-nebula-pink/50 h-full flex items-center justify-center transition-all duration-300 text-xs font-bold text-white/80">
                                        {settings.intermediateBots > 0 && 'INT'}
                                    </div>
                                    {/* Invisible slider overlay */}
                                    <input 
                                        type="range" 
                                        min={0} 
                                        max={settings.playerCount - 1} 
                                        value={settings.easyBots} 
                                        onChange={(e) => handleBotChange(parseInt(e.target.value, 10))}
                                        className="absolute top-0 left-0 w-full h-full opacity-0 cursor-ew-resize"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1 text-center">Drag to adjust difficulty balance</p>
                            </div>
                        </div>

                        <Slider 
                            id="length" 
                            label="Circuit Length" 
                            value={settings.runLength} 
                            min={8} max={12} 
                            onChange={val => setSettings(s => ({...s, runLength: val}))} 
                            formatValue={(v) => `${v} Tiles`}
                        />

                        <div>
                            <label htmlFor="seed" className='text-xs font-bold tracking-wider uppercase text-galaxy-cyan mb-1 block'>Simulation Seed</label>
                            <div className="flex gap-2">
                                <input id="seed" type="text" value={settings.seed} onChange={e => setSettings(s => ({ ...s, seed: e.target.value }))} className={`flex-grow px-3 py-2 bg-cosmic-blue border rounded font-mono text-sm text-white focus:outline-none focus:border-galaxy-cyan transition-all duration-300 ${seedFlash ? 'border-hyper-green shadow-[0_0_10px_rgba(57,255,20,0.3)]' : 'border-star-purple/50'}`} />
                                <button onClick={randomizeSeed} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded transition-colors text-xs font-bold uppercase tracking-wider">
                                    Random
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Launch Controls */}
                    <div className="mt-auto space-y-3">
                        {/* Online Multiplayer — Hero Button */}
                        <button
                            onClick={() => { playSound('ui-click'); onGoToOnline?.(); }}
                            className="w-full py-5 sm:py-6 rounded-xl relative overflow-hidden group transition-all active:scale-[0.98] sm:hover:scale-[1.01]"
                            aria-label="Online Multiplayer — Play with friends in real-time"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-galaxy-cyan via-hyper-green to-galaxy-cyan bg-[length:200%_100%] animate-[gradientShift_3s_ease-in-out_infinite]"></div>
                            <div className="absolute inset-0 shadow-[0_0_30px_rgba(0,212,255,0.3)] group-hover:shadow-[0_0_40px_rgba(77,255,175,0.5)] transition-shadow"></div>
                            <div className="relative z-10 flex items-center justify-center gap-3">
                                <div className="text-left">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg sm:text-xl font-black text-cosmic-blue tracking-wider uppercase">🌐 Online Multiplayer</span>
                                        <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black uppercase rounded animate-pulse">LIVE</span>
                                    </div>
                                    <div className="text-xs sm:text-sm text-cosmic-blue/80 font-semibold mt-0.5">Race against friends in real-time</div>
                                </div>
                            </div>
                        </button>

                        {/* Secondary Launch Grid (3 buttons) */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                         <button onClick={handleStartDailyChallenge} className="p-2 sm:p-3 bg-gradient-to-b from-[#ff6a00] to-[#c73800] rounded-xl active:opacity-80 sm:hover:opacity-90 transition-all shadow-lg relative overflow-hidden group flex flex-col items-center justify-center aspect-square text-center border-t border-white/20" aria-label="Start Daily Challenge">
                            <div className="absolute inset-0 scanline-overlay opacity-40"></div>
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 hidden sm:block"></div>
                            <div className="text-[10px] sm:text-xs font-black text-black/90 uppercase tracking-widest mb-1 z-10">Daily</div>
                            <div className="text-[13px] sm:text-sm md:text-base lg:text-lg font-bold text-white z-10 leading-tight">Challenge</div>
                        </button>
                         <button onClick={handleStartWeeklyCup} className="p-2 sm:p-3 bg-gradient-to-b from-[#f9329e] to-[#7b1798] rounded-xl active:opacity-80 sm:hover:opacity-90 transition-all shadow-lg relative overflow-hidden group flex flex-col items-center justify-center aspect-square text-center border-t border-white/20" aria-label="Start Weekly Cup">
                            <div className="absolute inset-0 scanline-overlay opacity-40"></div>
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 hidden sm:block"></div>
                            <div className="text-[10px] sm:text-xs font-black text-white/80 uppercase tracking-widest mb-1 z-10">Weekly</div>
                            <div className="text-[13px] sm:text-sm md:text-base lg:text-lg font-bold text-white z-10 leading-tight">Cup Series</div>
                        </button>
                         <button onClick={handleStartGauntlet} className="p-2 sm:p-3 bg-gradient-to-b from-[#e32424] to-[#800f14] rounded-xl active:opacity-80 sm:hover:opacity-90 transition-all shadow-lg relative overflow-hidden group flex flex-col items-center justify-center aspect-square text-center border-t border-white/20" aria-label="Start Solo Gauntlet">
                            <div className="absolute inset-0 scanline-overlay opacity-40"></div>
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 hidden sm:block"></div>
                            <div className="text-[10px] sm:text-xs font-black text-white/80 uppercase tracking-widest mb-1 z-10">Solo</div>
                            <div className="text-[13px] sm:text-sm md:text-base lg:text-lg font-bold text-white z-10 leading-tight">Gauntlet</div>
                        </button>
                        </div>
                        <button onClick={handleStartClick} className="w-full py-4 sm:py-5 bg-gradient-to-r from-hyper-green to-emerald-600 text-cosmic-blue font-black text-xl sm:text-2xl rounded-xl active:shadow-[0_0_30px_rgba(77,255,175,0.4)] sm:hover:shadow-[0_0_30px_rgba(77,255,175,0.4)] transition-all tracking-widest" aria-label="Initialize Race Run">
                          INITIALIZE RUN
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Column: Settings — collapsible on mobile */}
            <div className="lg:col-span-3 flex flex-col h-full">
                {/* Mobile settings toggle */}
                <button 
                    onClick={() => setShowMobileSettings(!showMobileSettings)} 
                    className="lg:hidden glass-panel p-4 flex items-center justify-between w-full mb-2 active:bg-white/5"
                    aria-expanded={showMobileSettings}
                    aria-controls="settings-panel"
                >
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">⚙️ System Preferences</span>
                    <span className={`text-gray-400 transition-transform duration-200 ${showMobileSettings ? 'rotate-180' : ''}`}>▼</span>
                </button>
                <div id="settings-panel" className={`glass-panel p-4 sm:p-6 h-full ${showMobileSettings ? 'block' : 'hidden lg:block'}`}>
                     <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 sm:mb-6 border-b border-white/10 pb-2 hidden lg:block">System Preferences</h2>
                     <div className="space-y-1">
                        <Toggle id="sound" label="Audio / SFX" checked={settings.sound} onChange={e => { playSound('ui-click'); setSettings(s => ({ ...s, sound: e.target.checked })); }} />
                        <Toggle id="uiEffects" label="Visual FX" checked={settings.uiEffects} onChange={e => { playSound('ui-click'); setSettings(s => ({ ...s, uiEffects: e.target.checked })); }} />
                        <Toggle id="colorBlind" label="Color Blind Mode" checked={settings.colorBlindMode} onChange={e => { playSound('ui-click'); setSettings(s => ({ ...s, colorBlindMode: e.target.checked })); }} />
                        <Toggle id="accessibility" label="Reduced Motion" checked={settings.accessibility} onChange={e => { playSound('ui-click'); setSettings(s => ({ ...s, accessibility: e.target.checked })); }} />
                     </div>

                     {profile.gauntletHighScore > 0 && (
                        <div className="mt-6 p-4 bg-red-900/20 rounded-lg border border-red-500/20">
                            <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Gauntlet Record</h3>
                            <p className="text-2xl font-black text-white">{profile.gauntletHighScore} <span className="text-sm text-gray-400 font-normal">tiles survived</span></p>
                        </div>
                     )}

                     <div className="mt-4 p-3 sm:p-4 bg-white/5 rounded-lg border border-white/5">
                        <h3 className="text-xs font-bold text-galaxy-cyan mb-2">Pro Tip</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            {profile.winStreak >= 3
                                ? <>You're on a {profile.winStreak}-win streak! Try the <span className="text-white">Gauntlet</span> to push your limits in solo survival mode.</>
                                : profile.rivalData.losses > profile.rivalData.wins
                                ? <>Your rival <span className="text-white">{profile.rivalData.name}</span> is ahead. Try the <span className="text-white">Glass Cannon</span> chassis for aggressive play.</>
                                : <>Equip the <span className="text-white">Scavenger Chassis</span> if you prefer defensive play. It increases Shield drop rates significantly.</>
                            }
                        </p>
                     </div>
                </div>
            </div>

        </div>
    </div>
  );
};
