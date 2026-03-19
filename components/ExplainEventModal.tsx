import React, { useEffect } from 'react';
import { GameEvent } from '../types';
import { STAR_MOVEMENT_MULTIPLIERS } from '../constants';

interface ExplainEventModalProps {
  event: GameEvent;
  onClose: () => void;
}

export const ExplainEventModal: React.FC<ExplainEventModalProps> = ({ event, onClose }) => {
  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getScoringDescription = () => {
    let description = 'Perform the task as quickly and accurately as possible. Better performance earns more stars, which means more movement on the track.';
    
    switch (event.performanceDimension) {
        case 'reaction':
            description = 'React as quickly as possible. Lower reaction times earn more stars and give you a bigger boost on the track.';
            break;
        case 'typing':
            description = 'Type with high speed and accuracy. A high Words-Per-Minute (WPM) with few errors will grant you the most stars.';
            break;
        case 'precision':
            description = 'Be precise with your inputs. Accuracy is key to getting 3 stars and maximizing your movement.';
            break;
        case 'memory':
            description = 'Recall patterns and sequences correctly. Perfect recall is required for 3 stars and a big speed advantage.';
            break;
        case 'rhythm':
            description = 'Keep to the beat and time your actions perfectly. Excellent timing will award the most stars.';
            break;
        case 'logic':
            description = 'Solve the puzzle efficiently. The faster you find the solution, the more stars you will earn.';
            break;
    }

    return description;
  };

  return (
    <div
      className="fixed inset-0 bg-cosmic-blue/80 sm:backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="glass-panel w-full max-w-2xl max-h-[85vh] flex flex-col p-4 sm:p-6 animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-2 mb-3 sm:mb-4 flex-shrink-0">
          <h2 id="modal-title" className="text-xl sm:text-3xl font-black text-hyper-green tracking-tighter">
            EVENT BRIEFING: {event.displayName}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl text-gray-400 active:text-white sm:hover:text-white p-2 -mr-2 -mt-1 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="overflow-y-auto pr-2 prose text-gray-300">
            <h3>OBJECTIVE</h3>
            <p>{event.instructions}</p>
            
            <h3>SCORING TIPS</h3>
            <p>{getScoringDescription()}</p>
            
            <h3>STARS & MOVEMENT</h3>
            <p>
                Earning more stars from an event gives you a larger speed boost on the track, helping you pull ahead of your rivals.
                <br />★ = {STAR_MOVEMENT_MULTIPLIERS[1]}x Speed
                <br />★★ = {STAR_MOVEMENT_MULTIPLIERS[2]}x Speed
                <br />★★★ = {STAR_MOVEMENT_MULTIPLIERS[3]}x Speed
            </p>
        </div>
      </div>
    </div>
  );
};
