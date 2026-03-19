
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GameEvent, EventPreset, PerformanceDimension } from '../types';
import { eventRegistry } from '../events/eventRegistry';
import { savePresets, loadPresets } from '../services/presetService';
import { useSound } from '../hooks/useSound';

interface EventListProps {
    onBack: () => void;
    onApplyConfig: (eventIds: string[]) => void;
    onPlaytest: (event: GameEvent, difficulty: number) => void;
    initialActiveIds: string[];
}

const DIMENSION_COLORS: Record<PerformanceDimension, string> = {
    reaction: 'bg-nebula-pink/50 text-nebula-pink',
    typing: 'bg-galaxy-cyan/50 text-galaxy-cyan',
    precision: 'bg-hyper-green/50 text-hyper-green',
    memory: 'bg-star-purple/50 text-star-purple',
    rhythm: 'bg-solar-orange/50 text-solar-orange',
    logic: 'bg-blue-500/50 text-blue-400',
};
const DIMENSION_FILTERS: (PerformanceDimension | 'all')[] = ['all', 'reaction', 'typing', 'precision', 'memory', 'rhythm', 'logic'];


const Toggle = ({ checked, onChange, id, label }: { checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, id: string, label: string }) => (
    <label htmlFor={id} className="relative mr-2 inline-flex h-4 w-8 cursor-pointer items-center" role="switch" aria-checked={checked} aria-label={label}>
        <input type="checkbox" id={id} checked={checked} onChange={onChange} className="peer sr-only" aria-label={label} />
        <span className="h-4 w-8 rounded-full bg-gray-600 transition-colors duration-200 peer-checked:bg-hyper-green/80"></span>
        <span className="pointer-events-none absolute left-[2px] h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-4"></span>
    </label>
);

export const EventList: React.FC<EventListProps> = ({ onBack, onApplyConfig, onPlaytest, initialActiveIds }) => {
    const { playSound } = useSound();
    const [activeEventIds, setActiveEventIds] = useState<Set<string>>(new Set(initialActiveIds));
    const [presets, setPresets] = useState<EventPreset[]>([]);
    const [presetName, setPresetName] = useState('');
    const [selectedPreset, setSelectedPreset] = useState('');
    const [filter, setFilter] = useState<PerformanceDimension | 'all'>('all');
    
    const [playtestConfig, setPlaytestConfig] = useState<{ event: GameEvent, difficulty: number } | null>(null);

    useEffect(() => {
        setPresets(loadPresets());
    }, []);

    const handleToggle = (eventId: string) => {
        playSound('ui-click');
        const newSet = new Set(activeEventIds);
        if (newSet.has(eventId)) {
            newSet.delete(eventId);
        } else {
            newSet.add(eventId);
        }
        setActiveEventIds(newSet);
    };
    
    const handleSelectAll = (select: boolean) => {
        playSound('ui-click');
        if (select) {
            setActiveEventIds(new Set(eventRegistry.map(e => e.id)));
        } else {
            setActiveEventIds(new Set());
        }
    };

    const handleSavePreset = () => {
        playSound('ui-click');
        if (!presetName.trim() || presets.some(p => p.name === presetName.trim())) {
            // Add toast feedback here in a real app
            console.warn("Preset name is empty or already exists.");
            return;
        }
        const newPreset: EventPreset = { name: presetName.trim(), eventIds: Array.from(activeEventIds) };
        const newPresets = [...presets, newPreset];
        setPresets(newPresets);
        savePresets(newPresets);
        setPresetName('');
    };

    const handleLoadPreset = () => {
        playSound('ui-click');
        const preset = presets.find(p => p.name === selectedPreset);
        if (preset) {
            setActiveEventIds(new Set(preset.eventIds));
        }
    };
    
    const handleDeletePreset = () => {
        playSound('ui-click');
        if(!selectedPreset) return;
        const newPresets = presets.filter(p => p.name !== selectedPreset);
        setPresets(newPresets);
        savePresets(newPresets);
        setSelectedPreset('');
    }

    const handleBack = () => {
        onApplyConfig(Array.from(activeEventIds));
        onBack();
    };
    
    const handlePlaytestClick = (event: GameEvent) => {
        playSound('ui-click');
        setPlaytestConfig({ event, difficulty: 1 }); // Default to difficulty 1
    }

    const filteredEvents = useMemo(() => {
        if (filter === 'all') return eventRegistry;
        return eventRegistry.filter(e => e.performanceDimension === filter);
    }, [filter]);

    if (playtestConfig) {
        return (
             <div className="min-h-screen w-full flex flex-col items-center justify-center p-3 sm:p-4 animate-fade-in glass-panel">
                <h2 className="text-xl sm:text-3xl font-bold mb-4 text-galaxy-cyan text-center">Playtest: {playtestConfig.event.displayName}</h2>
                <div className="mb-6">
                    <label className="block text-galaxy-cyan mb-2 text-base sm:text-lg text-center">Select Difficulty</label>
                    <div className="flex justify-center gap-3 sm:space-x-4">
                        {[1, 2, 3].map(d => (
                            <button 
                                key={d}
                                onClick={() => setPlaytestConfig(c => c ? { ...c, difficulty: d } : null)}
                                className={`px-5 sm:px-6 py-3 text-lg sm:text-xl font-bold rounded-lg transition-colors ${playtestConfig.difficulty === d ? 'bg-hyper-green text-cosmic-blue' : 'bg-star-purple'}`}
                                aria-label={`Difficulty ${d} stars`}
                                aria-pressed={playtestConfig.difficulty === d}
                            >
                                {'★'.repeat(d).padEnd(3, '☆')}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex gap-3 sm:space-x-4">
                     <button onClick={() => setPlaytestConfig(null)} className="px-6 py-3 bg-gray-600 font-semibold rounded-md active:bg-gray-500 sm:hover:bg-gray-500 transition-colors">Cancel</button>
                    <button onClick={() => onPlaytest(playtestConfig.event, playtestConfig.difficulty)} className="px-6 py-3 bg-hyper-green text-cosmic-blue font-bold rounded-md active:opacity-80 sm:hover:opacity-90 transition-opacity">Start Playtest</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 animate-fade-in">
            <div className="w-full max-w-4xl h-[90vh] flex flex-col">
                <div className="flex-shrink-0 text-center mb-3 sm:mb-4">
                    <h1 className="text-3xl sm:text-5xl font-black text-galaxy-cyan tracking-tighter">EVENT WORKSHOP</h1>
                    <p className="text-nebula-pink text-sm sm:text-base">Customize the event pool for your runs.</p>
                </div>

                <div className="flex-grow glass-panel p-3 sm:p-6 flex flex-col overflow-hidden">
                    {/* Preset Management */}
                    <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-star-purple/50">
                        <div>
                            <label className="block text-galaxy-cyan mb-1 text-sm">Load/Delete Preset</label>
                            <div className="flex gap-2">
                                <select value={selectedPreset} onChange={e => setSelectedPreset(e.target.value)} className="w-full px-3 py-2 bg-cosmic-blue border border-star-purple rounded-md focus:outline-none focus:ring-2 focus:ring-galaxy-cyan">
                                    <option value="">-- Select --</option>
                                    {presets.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                </select>
                                <button onClick={handleLoadPreset} disabled={!selectedPreset} className="px-3 py-2 bg-star-purple text-white font-semibold rounded-md hover:bg-nebula-pink disabled:opacity-50 transition-colors">Load</button>
                                <button onClick={handleDeletePreset} disabled={!selectedPreset} className="px-3 py-2 bg-nebula-pink text-white font-semibold rounded-md hover:opacity-80 disabled:opacity-50 transition-colors">Del</button>
                            </div>
                        </div>
                         <div>
                            <label className="block text-galaxy-cyan mb-1 text-sm">Save Current Selection</label>
                            <div className="flex gap-2">
                                <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="New preset name..." className="w-full px-3 py-2 bg-cosmic-blue border border-star-purple rounded-md focus:outline-none focus:ring-2 focus:ring-galaxy-cyan" />
                                <button onClick={handleSavePreset} className="px-3 py-2 bg-hyper-green text-cosmic-blue font-bold rounded-md hover:opacity-90 disabled:opacity-50 transition-colors">Save</button>
                            </div>
                        </div>
                    </div>

                    {/* Event List */}
                     <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                        <div className="flex gap-2">
                             <button onClick={() => handleSelectAll(true)} className="text-xs sm:text-sm px-3 py-2 sm:py-1 bg-star-purple rounded active:bg-nebula-pink sm:hover:bg-nebula-pink">Select All</button>
                             <button onClick={() => handleSelectAll(false)} className="text-xs sm:text-sm px-3 py-2 sm:py-1 bg-star-purple rounded active:bg-nebula-pink sm:hover:bg-nebula-pink">Deselect All</button>
                             <p className="font-semibold text-xs sm:text-sm flex items-center">{activeEventIds.size}/{eventRegistry.length}</p>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 bg-cosmic-blue/50 p-1 rounded-md overflow-x-auto max-w-full mobile-scroll">
                            {DIMENSION_FILTERS.map(f => (
                                <button key={f} onClick={() => setFilter(f)} className={`px-2 py-1.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded transition-colors capitalize whitespace-nowrap ${filter === f ? 'bg-galaxy-cyan text-cosmic-blue' : 'text-gray-300 active:bg-star-purple/50 sm:hover:bg-star-purple/50'}`}>
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-1 sm:pr-2 space-y-2 mobile-scroll">
                        {filteredEvents.map(event => (
                             <div key={event.id} className="p-2.5 sm:p-3 rounded-lg flex items-center bg-cosmic-blue/50 border border-star-purple/50 gap-2 sm:gap-4">
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                        <h3 className="text-sm sm:text-lg font-semibold text-white truncate">{event.displayName}</h3>
                                        <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${DIMENSION_COLORS[event.performanceDimension]}`}>{event.performanceDimension}</span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-400 line-clamp-1 sm:line-clamp-none">{event.instructions}</p>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                                    <button onClick={() => handlePlaytestClick(event)} className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm bg-solar-orange text-cosmic-blue font-bold rounded-md active:opacity-70 sm:hover:opacity-80">Play</button>
                                    <Toggle checked={activeEventIds.has(event.id)} onChange={() => handleToggle(event.id)} id={`toggle-${event.id}`} label={`Toggle ${event.displayName}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-shrink-0 mt-3 sm:mt-4">
                    <button onClick={handleBack} className="w-full py-4 sm:py-3 bg-hyper-green text-cosmic-blue font-bold text-base sm:text-lg rounded-lg active:opacity-80 sm:hover:opacity-90 transition-opacity" aria-label="Save and return to lobby">
                        Back to Lobby
                    </button>
                </div>
            </div>
        </div>
    );
};
