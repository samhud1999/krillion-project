import type { PlayerPublic } from '@shared/types';
import { Avatar } from '../artApi';

export interface PlayerChipProps {
  player: PlayerPublic;
  size?: 'sm' | 'md' | 'lg';
  /** show a tick overlay (locked in) */
  locked?: boolean;
  /** dim until locked */
  dimUnlessLocked?: boolean;
  me?: boolean;
  showName?: boolean;
  trailing?: React.ReactNode;
  className?: string;
}

const AV = { sm: 32, md: 44, lg: 64 };

export function PlayerChip({ player, size = 'md', locked, dimUnlessLocked, me, showName = true, trailing, className = '' }: PlayerChipProps) {
  const dim = dimUnlessLocked && !locked;
  return (
    <div
      className={[
        'flex items-center gap-2 min-w-0 transition-opacity duration-300',
        dim ? 'opacity-50' : 'opacity-100',
        !player.connected ? 'grayscale' : '',
        className,
      ].join(' ')}
      title={player.connected ? player.name : `${player.name} (offline)`}
    >
      <span className="relative shrink-0">
        <Avatar id={player.avatar} size={AV[size]} ring={me} title={player.name} />
        {locked && (
          <span
            aria-label="locked in"
            className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-emerald-400 text-ink text-[11px] font-black shadow animate-pop"
          >
            ✓
          </span>
        )}
        {!player.connected && (
          <span aria-label="offline" className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-rose-400 ring-2 ring-creek-950" />
        )}
      </span>
      {showName && (
        <span className={['truncate font-medium', size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'].join(' ')}>
          {player.name}
          {me ? <span className="text-foam-faint font-normal"> (you)</span> : null}
        </span>
      )}
      {trailing}
    </div>
  );
}
