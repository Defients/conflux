/**
 * components/RankBadge.tsx
 *
 * Displays a player's ranked tier badge with rating and W/L record.
 */

import React from 'react';
import { RankInfo, RankTier } from '../shared/types';
import { getTierColor, getTierIcon } from '../shared/rankSystem';

interface RankBadgeProps {
  rank?: RankInfo | null;
  size?: 'small' | 'medium' | 'large';
  showRating?: boolean;
  showRecord?: boolean;
}

export const RankBadge: React.FC<RankBadgeProps> = ({
  rank,
  size = 'medium',
  showRating = true,
  showRecord = false,
}) => {
  if (!rank) {
    return (
      <div className="rank-badge rank-badge--unranked" data-size={size}>
        <span className="rank-badge__icon">?</span>
        <span className="rank-badge__tier">Unranked</span>
      </div>
    );
  }

  const tierColor = getTierColor(rank.tier);
  const tierIcon = getTierIcon(rank.tier);
  const sizeClass = `rank-badge--${size}`;

  return (
    <div
      className={`rank-badge ${sizeClass}`}
      style={{ '--tier-color': tierColor } as React.CSSProperties}
    >
      <span className="rank-badge__icon" style={{ color: tierColor }}>
        {tierIcon}
      </span>
      <div className="rank-badge__info">
        <span className="rank-badge__tier" style={{ color: tierColor }}>
          {rank.tier.toUpperCase()}
        </span>
        {showRating && (
          <span className="rank-badge__rating">{rank.rating} RP</span>
        )}
        {showRecord && (
          <span className="rank-badge__record">
            {rank.wins}W / {rank.losses}L
          </span>
        )}
      </div>
    </div>
  );
};
