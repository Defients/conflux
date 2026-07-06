import React, { useState, useEffect } from 'react';

interface WelcomePopupProps {
  onClose: () => void;
  onGoOnline: () => void;
}

const STORAGE_KEY = 'conflux-welcome-seen';

export const WelcomePopup: React.FC<WelcomePopupProps> = ({ onClose, onGoOnline }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      requestAnimationFrame(() => setVisible(true));
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
    setTimeout(onClose, 300);
  };

  const handleGoOnline = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
    setTimeout(onGoOnline, 300);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Online Multiplayer Announcement"
    >
      <div
        className="relative max-w-md w-full mx-4 p-6 sm:p-8 rounded-2xl bg-cosmic-blue/95 border-2 border-transparent animate-[popupScale_0.3s_ease-out]"
        style={{
          backgroundImage:
            'linear-gradient(#0a0e27, #0a0e27), linear-gradient(135deg, #00d4ff, #4dffaf, #f9329e)',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          boxShadow: '0 0 40px rgba(0, 212, 255, 0.3), 0 0 80px rgba(77, 255, 175, 0.15)',
        }}
      >
        {/* Animated glow accent */}
        <div className="absolute -top-1 -left-1 -right-1 -bottom-1 rounded-2xl pointer-events-none opacity-50 blur-md bg-gradient-to-r from-galaxy-cyan via-hyper-green to-nebula-pink bg-[length:200%_100%] animate-[gradientShift_3s_ease-in-out_infinite] -z-10"></div>

        {/* Content */}
        <div className="text-center">
          {/* Icon / Badge */}
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-galaxy-cyan to-hyper-green shadow-lg shadow-galaxy-cyan/30">
            <span className="text-3xl" aria-hidden="true">🌐</span>
          </div>

          {/* LIVE Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 bg-red-500/20 border border-red-500/40 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">LIVE NOW</span>
          </div>

          {/* Headline */}
          <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-galaxy-cyan to-hyper-green mb-2 tracking-tight">
            ONLINE MULTIPLAYER IS LIVE
          </h2>

          {/* Subtitle */}
          <p className="text-sm text-gray-300 mb-4 leading-relaxed">
            Challenge your friends in real-time multiplayer races! Create a room, share the code, and compete head-to-head.
          </p>

          {/* Date + Credit */}
          <div className="mb-6 space-y-1">
            <p className="text-xs font-mono text-galaxy-cyan/80 tracking-widest uppercase">
              July 6, 2026
            </p>
            <p className="text-xs text-gray-500">
              Brought to you by <span className="text-hyper-green font-bold">Deffy Urz</span>
            </p>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleGoOnline}
            className="w-full py-4 mb-3 bg-gradient-to-r from-galaxy-cyan to-hyper-green text-cosmic-blue font-black text-lg rounded-xl active:scale-[0.98] hover:shadow-[0_0_30px_rgba(77,255,175,0.4)] transition-all tracking-wider"
            aria-label="Go to online multiplayer lobby"
          >
            LET'S RACE 🏁
          </button>

          {/* Dismiss link */}
          <button
            onClick={dismiss}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Dismiss announcement"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export const hasSeenWelcome = (): boolean => {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
};
