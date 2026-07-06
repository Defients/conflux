/**
 * hooks/useConnectionStatus.ts
 *
 * Tracks connection quality from the network service and provides
 * a reactive status for UI components.
 */

import { useState, useEffect } from 'react';
import { networkService } from '../services/networkService';
import { ConnectionQuality } from '../shared/types';

export function useConnectionStatus() {
  const [quality, setQuality] = useState<ConnectionQuality>('critical');
  const [rttMs, setRttMs] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const unsub = networkService.setHandlers({
      onConnectionChange: (connected) => {
        setIsConnected(connected);
        if (connected) {
          setQuality(networkService.connectionQuality);
          setRttMs(networkService.rttMs);
        } else {
          setQuality('critical');
        }
      },
      onConnectionQualityChange: (q) => {
        setQuality(q);
        setRttMs(networkService.rttMs);
      },
    });

    // Sync initial state
    setIsConnected(networkService.isConnected);
    setQuality(networkService.connectionQuality);
    setRttMs(networkService.rttMs);

    return unsub;
  }, []);

  return {
    quality,
    rttMs,
    isConnected,
    isGood: quality === 'excellent' || quality === 'good',
    isPoor: quality === 'poor' || quality === 'critical',
  };
}
