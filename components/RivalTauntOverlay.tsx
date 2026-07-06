import React, { useEffect, useState } from 'react';

interface RivalTauntOverlayProps {
  message: string | null;
}

export const RivalTauntOverlay: React.FC<RivalTauntOverlayProps> = ({ message }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [message]);

  if (!visible || !message) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-red-900/10 mix-blend-color-burn animate-pulse" />
      <div 
        className="text-2xl sm:text-4xl md:text-6xl font-black text-red-500 uppercase tracking-tighter opacity-80 transform -skew-x-12 glitch-effect px-4 text-center"
        data-text={message}
        style={{ textShadow: '4px 4px 0px rgba(0,0,0,0.8), -2px -2px 0px #00f0ff' }}
        role="alert"
        aria-live="assertive"
      >
        {message}
      </div>
      {/* Scanline interference */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSIxIiBmaWxsPSJyZ2JhKDI1NSwgMCwgMCwgMC4xKSIvPgo8L3N2Zz4=')] opacity-50" />
    </div>
  );
};
