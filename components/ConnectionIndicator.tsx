/**
 * components/ConnectionIndicator.tsx
 *
 * Shows real-time connection quality (RTT, signal bars) for online matches.
 */

import React from 'react';
import { ConnectionQuality } from '../shared/types';

interface ConnectionIndicatorProps {
  quality: ConnectionQuality;
  rttMs: number;
  showLabel?: boolean;
}

const qualityConfig: Record<ConnectionQuality, { label: string; bars: number; color: string }> = {
  excellent: { label: 'Excellent', bars: 4, color: '#4ade80' },
  good: { label: 'Good', bars: 3, color: '#a3e635' },
  poor: { label: 'Poor', bars: 2, color: '#fbbf24' },
  critical: { label: 'Critical', bars: 1, color: '#ef4444' },
};

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  quality,
  rttMs,
  showLabel = false,
}) => {
  const config = qualityConfig[quality];

  return (
    <div className="connection-indicator" title={`${config.label} — ${rttMs}ms RTT`}>
      <div className="connection-indicator__bars">
        {[1, 2, 3, 4].map(level => (
          <div
            key={level}
            className="connection-indicator__bar"
            style={{
              backgroundColor: level <= config.bars ? config.color : 'rgba(255,255,255,0.15)',
              height: `${level * 3 + 3}px`,
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="connection-indicator__label" style={{ color: config.color }}>
          {rttMs > 0 ? `${rttMs}ms` : config.label}
        </span>
      )}
    </div>
  );
};
