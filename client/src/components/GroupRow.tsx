import { useState } from 'react';
import type { AnswerGroup, PlayerPublic, TierId } from '@shared/types';
import { TIERS } from '@shared/theme';
import { Avatar, TierBadge } from '../artApi';
import { Button } from './Button';

export interface GroupRowProps {
  group: AnswerGroup;
  players?: PlayerPublic[];
  highlight?: boolean;
  /** show avatars of who said it */
  showWho?: boolean;
  /** host moderation callbacks: accepted=true vouches for an unverified answer or un-rejects one */
  onModerate?: (key: string, accepted: boolean) => void;
  /** host judging: pin the group to a tier, or null to clear the pin */
  onOverride?: (key: string, tier: TierId | null) => void;
  compact?: boolean;
  /** TV density: tighter padding, viewport-scaled type so more rows fit at 720p/1080p */
  tv?: boolean;
  /** rank 1..n for a leading number */
  index?: number;
}

/** the five scoring tiers a host can pin an answer to (Reject covers zero) */
const JUDGE_TIERS: TierId[] = ['puddle', 'shallows', 'rockpool', 'deepcut', 'krillion'];

const TAG = 'pixel shrink-0 rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide';

export function GroupRow({ group, players, highlight, showWho, onModerate, onOverride, compact, tv, index }: GroupRowProps) {
  const info = TIERS[group.tier];
  const rejected = group.status === 'rejected';
  const unverified = group.status === 'unverified';
  const [judging, setJudging] = useState(false);
  const who = players ? group.playerIds.map((id) => players.find((p) => p.id === id)).filter((p): p is PlayerPublic => !!p) : [];
  const shown = who.slice(0, compact ? 4 : 8);
  const extra = who.length - shown.length;

  const pad = compact ? 'px-3 py-2' : tv ? 'px-3 py-[clamp(0.3rem,0.9vh,0.75rem)]' : 'px-4 py-3';
  const nameSize = compact ? 'text-base' : tv ? 'text-[clamp(1rem,2vh,1.45rem)]' : 'text-xl';
  const metaSize = compact ? 'text-xs' : tv ? 'text-[clamp(0.7rem,1.3vh,0.9rem)]' : 'text-sm';
  const pointsSize = compact ? 'text-base' : tv ? 'text-[clamp(1.1rem,2.4vh,1.6rem)]' : 'text-2xl';
  const badgeSize = compact || tv ? 'sm' : 'md';

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-none notch-sm border-2 transition-colors',
        pad,
        highlight ? 'border-sun-400/70 bg-sun-500/10' : 'border-white/8 bg-white/4',
        rejected ? 'opacity-45' : '',
      ].join(' ')}
    >
      {index !== undefined && <span className="w-6 shrink-0 text-right tabular text-foam-faint text-sm">{index}</span>}
      <TierBadge tier={group.tier} size={badgeSize} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className={['truncate font-semibold', nameSize, rejected ? 'line-through' : ''].join(' ')}>{group.display}</span>
          {group.status === 'special' && <span className={`${TAG} bg-tier-krillion/20 font-bold text-tier-krillion`}>special</span>}
          {group.overridden && <span className={`${TAG} bg-tier-krillion/15 text-tier-krillion`}>host's call</span>}
          {group.obvious && group.status === 'bank' && !group.overridden && <span className={`${TAG} bg-white/8 text-foam-faint`}>too obvious</span>}
          {unverified && !group.vouched && <span className={`${TAG} bg-white/8 text-foam-faint`}>unverified</span>}
          {unverified && group.vouched && <span className={`${TAG} bg-emerald-500/15 text-emerald-200`}>vouched</span>}
          {rejected && <span className={`${TAG} bg-rose-500/15 text-rose-300`}>rejected</span>}
        </div>
        <div className={['text-foam-muted', metaSize].join(' ')}>
          {group.count} {group.count === 1 ? 'person' : 'people'} · {info.label}
        </div>
      </div>
      {showWho && shown.length > 0 && (
        <div className="hidden sm:flex items-center -space-x-2 shrink-0">
          {shown.map((p) => (
            <span key={p.id}>
              <Avatar id={p.avatar} size={compact || tv ? 24 : 30} title={p.name} />
            </span>
          ))}
          {extra > 0 && (
            <span className="pixel grid size-7 place-items-center rounded-sm bg-white/10 text-xs font-semibold ring-2 ring-creek-950">+{extra}</span>
          )}
        </div>
      )}
      <div className={['pixel shrink-0 tabular font-bold', pointsSize, rejected ? 'text-foam-faint' : ''].join(' ')}>
        {rejected ? '0' : `+${group.points}`}
        <span className="text-xs font-medium text-foam-faint"> m</span>
      </div>
      {onModerate && (unverified || rejected) && (
        <div className="flex shrink-0 gap-1.5">
          {rejected ? (
            <Button size="sm" variant="success" onClick={() => onModerate(group.key, true)} aria-label={`Accept ${group.display}`}>
              Accept
            </Button>
          ) : (
            <>
              {!group.vouched && (
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => onModerate(group.key, true)}
                  aria-label={`Vouch for ${group.display}`}
                  title="Count it as a deep cut, +85"
                >
                  Vouch
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={() => onModerate(group.key, false)} aria-label={`Reject ${group.display}`}>
                Reject
              </Button>
            </>
          )}
        </div>
      )}
      {onOverride &&
        (judging ? (
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Judge ${group.display}`}>
            {JUDGE_TIERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onOverride(group.key, t);
                  setJudging(false);
                }}
                title={`${TIERS[t].label} — ${TIERS[t].points} m`}
                aria-label={`Score ${group.display} as ${TIERS[t].label}, ${TIERS[t].points} metres`}
                className={[
                  'pixel grid h-8 w-10 place-items-center rounded-sm border-2 text-xs font-bold transition-transform hover:scale-110',
                  group.tier === t && group.overridden ? 'ring-2 ring-white/60' : '',
                ].join(' ')}
                style={{ color: `var(--tier-${t})`, borderColor: `var(--tier-${t})`, background: 'rgba(255,255,255,0.05)' }}
              >
                {TIERS[t].points}
              </button>
            ))}
            {onModerate && !rejected && (
              <Button size="sm" variant="danger" onClick={() => { onModerate(group.key, false); setJudging(false); }} aria-label={`Reject ${group.display}`}>
                0
              </Button>
            )}
            {group.overridden && (
              <Button size="sm" variant="ghost" onClick={() => { onOverride(group.key, null); setJudging(false); }} aria-label={`Clear the host's call on ${group.display}`}>
                Auto
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setJudging(false)} aria-label="Close judging">
              ✕
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => setJudging(true)}
            aria-label={`Judge ${group.display}`}
            title="Set this answer's score by hand"
          >
            Judge
          </Button>
        ))}
    </div>
  );
}
