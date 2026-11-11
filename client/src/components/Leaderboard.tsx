import { motion } from 'motion/react';
import type { PlayerPublic } from '@shared/types';
import { Avatar } from '../artApi';
import { metres, rankPlayers } from '../lib/format';

export interface LeaderboardProps {
  /** pass the same (possibly rewound) players the creek is showing so both reorder together */
  players: PlayerPublic[];
  /** reveal has settled: show this round's +gain chips */
  showGains?: boolean;
  maxRows?: number;
  className?: string;
}

const RANK_COLOR = ['text-tier-krillion', 'text-foam', 'text-tier-rockpool'];

/**
 * Live standings for the host TV. Rows are motion.li with `layout`, so when the
 * reveal settles and depths jump, positions slide to their new order in sync
 * with the avatars dropping in the creek.
 */
export function Leaderboard({ players, showGains, maxRows = 20, className = '' }: LeaderboardProps) {
  const ranked = rankPlayers(players);
  const shown = ranked.slice(0, maxRows);
  const extra = ranked.length - shown.length;
  return (
    <div className={['flex min-h-0 flex-col rounded-none notch glass p-3', className].join(' ')}>
      <p className="pixel px-1 pb-2 text-xs font-semibold uppercase tracking-[0.3em] text-foam-faint">Leaderboard</p>
      <ol className="min-h-0 flex-1 space-y-1 overflow-hidden" aria-label="Standings">
        {shown.map(({ player: p, rank }) => {
          const gain = showGains ? (p.lastPoints ?? 0) : null;
          const tier = p.lastTier ?? 'dry';
          return (
            <motion.li
              key={p.id}
              layout
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="flex items-center gap-2 rounded-sm bg-white/4 px-2 py-1"
            >
              <span className={['pixel w-6 shrink-0 text-right text-sm font-bold tabular', RANK_COLOR[rank - 1] ?? 'text-foam-faint'].join(' ')}>
                {rank}
              </span>
              <Avatar id={p.avatar} size={24} />
              <span className={['min-w-0 flex-1 truncate text-sm font-semibold', p.connected ? '' : 'opacity-50'].join(' ')}>{p.name}</span>
              {gain !== null && gain > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="pixel shrink-0 rounded-sm bg-white/8 px-1 text-xs font-bold"
                  style={{ color: `var(--tier-${tier})` }}
                >
                  +{gain}
                </motion.span>
              )}
              <span className="pixel w-14 shrink-0 text-right text-sm font-bold tabular text-foam-muted">{metres(p.depth)}</span>
            </motion.li>
          );
        })}
      </ol>
      {extra > 0 && <p className="pixel pt-1 text-center text-xs text-foam-faint">+{extra} more in the creek</p>}
    </div>
  );
}
