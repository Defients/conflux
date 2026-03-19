import React from 'react';
import { PowerUp } from '../types';
import { POWERUP_DEFINITIONS } from '../constants';
import { useSound } from '../hooks/useSound';

interface PowerUpIconProps {
  powerUp: PowerUp;
  onClick: () => void;
  isDisabled?: boolean;
  shouldGlow?: boolean;
}

export const PowerUpIcon: React.FC<PowerUpIconProps> = ({ powerUp, onClick, isDisabled, shouldGlow }) => {
  const definition = POWERUP_DEFINITIONS[powerUp];
  const disabledTitle = isDisabled ? `${definition.description} (Disabled)` : definition.description;
  const { playSound } = useSound();

  const handleClick = () => {
    if (!isDisabled) {
        playSound('ui-click');
        onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      title={disabledTitle}
      disabled={isDisabled}
      aria-label={`Use ${definition.icon} power-up: ${definition.description}`}
      className={`w-12 h-12 flex items-center justify-center bg-cosmic-blue border-2 rounded-lg text-2xl
                 transition-transform transform 
                 ${isDisabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'active:scale-95 active:border-hyper-green sm:hover:border-hyper-green sm:hover:scale-110 cursor-pointer'
                 }
                 ${shouldGlow ? 'animate-pulse border-hyper-green' : 'border-star-purple'}`}
    >
      <span aria-hidden="true">{definition.icon}</span>
    </button>
  );
};
