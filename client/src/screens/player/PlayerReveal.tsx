import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { PlayerPublic, PlayerView } from '@shared/types';
import { TIERS, zoneForDepth } from '@shared/theme';
import { CreekScene, DepthMeter, TierBadge } from '../../artApi';
import { BackdropLayer } from '../../components/BackdropLayer';
import { CountUp } from '../../components/CountUp';
import { GroupRow } from '../../components/GroupRow';
import { diveLine, zoneCrossing } from '../../lib/copy';
import { metres, ordinal } from '../../lib/format';

/** Everyone's depth before this round's points landed, so the bubbles can be seen dropping. */
function rewind(players: PlayerPublic[]): PlayerPublic[] {
  return players.map((p) => ({ ...p, depth: Math.max(0, p.depth - (p.lastPoints ?? 0)) }));
}

export function PlayerReveal({ view }: { view: PlayerView }) {
  const round = view.round;
  const roundIndex = round?.index ?? -1;

  // Show the creek at last round's depths first, then let everyone drop.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(t);
  }, [roundIndex]);
  const scenePlayers = useMemo(() => (settled ? view.players : rewind(view.players)), [settled, view.players]);

  if (!round) return null;
  const me = view.players.find((p) => p.id === view.me.id);
  const result = view.me.result ?? round.results?.[view.me.id];
  const tier = result?.tier ?? 'dry';
  const info = TIERS[tier];
  const depth = result?.depthAfter ?? me?.depth ?? 0;
  const depthBefore = Math.max(0, depth - (result?.points ?? 0));
  const zone = zoneForDepth(depth);
  const groups = round.groups ?? [];
  const myKey = result?.key;
  const myGroup = myKey ? groups.find((g) => g.key === myKey) : undefined;
  const isNumeric = round.prompt.type === 'numeric';
  const answered = !!result && result.raw.trim().length > 0;
  const countedAs =
    !isNumeric && answered && myGroup && myGroup.display.trim().toLowerCase() !== result.raw.trim().toLowerCase()
      ? myGroup.display
      : null;
  const crossing = zoneCrossing(depthBefore, depth);
  const line = diveLine(tier, round.index, result?.raw.length ?? 0);

  return (
    <main className="flex min-h-dvh flex-col gap-4 safe-x safe-top safe-bottom">
      <BackdropLayer zone={zone.id} phase="reveal" />
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foam-faint">
          Prompt {round.index + 1} of {view.roundCount}
        </p>
        <p className="mt-0.5 text-sm text-foam-muted text-balance">{round.prompt.text}</p>
      </header>

      <motion.section
        key={round.index}
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className={[
          'rounded-3xl p-5 text-center',
          tier === 'krillion' ? 'bg-tier-krillion/15 border border-tier-krillion/50' : 'glass',
        ].join(' ')}
        aria-live="polite"
      >
        <div className="flex justify-center">
          <TierBadge tier={tier} size="lg" animate />
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-foam-faint">{info.krillionName}</p>
        <h1 className="display text-4xl font-semibold leading-tight">{info.label}</h1>
        <p className="display mt-1 text-5xl font-bold text-sun-300">
          <CountUp to={result?.points ?? 0} prefix="+" suffix=" m" replayKey={round.index} />
        </p>
        <p className="mt-3 text-foam-muted">
          {answered ? (
            <>
              You said <span className="font-semibold text-foam">“{result?.raw}”</span>
            </>
          ) : (
            'You didn’t get an answer in.'
          )}
        </p>
        {countedAs && (
          <p className="mt-1 text-sm text-creek-300">
            Close enough, we counted it as <span className="font-semibold">{countedAs}</span>
          </p>
        )}
        {myGroup?.status === 'unverified' && !myGroup.vouched && (
          <p className="mt-1 text-sm text-foam-faint">Not on our list yet. The host can vouch for it, which is worth more.</p>
        )}
        {myGroup?.status === 'unverified' && myGroup.vouched && (
          <p className="mt-1 text-sm text-creek-300">The host vouched for it. Deep cut!</p>
        )}
        {myGroup?.status === 'rejected' && <p className="mt-1 text-sm text-foam-faint">The host knocked that one back.</p>}
        <p className="mt-2 text-base font-medium text-foam">{line}</p>

        {isNumeric && round.numericAnswer && (
          <div className="mt-4 rounded-2xl bg-creek-950/50 p-3 text-sm">
            <p>
              The answer: <span className="font-bold text-foam">{round.numericAnswer.answer.toLocaleString('en-AU')}</span>
              {round.numericAnswer.unit ? ` ${round.numericAnswer.unit}` : ''}
            </p>
            {result?.numeric?.guess !== null && result?.numeric?.guess !== undefined && (
              <p className="text-foam-muted">
                You guessed {result.numeric.guess.toLocaleString('en-AU')}
                {result.numeric.distance !== null ? ` · ${result.numeric.distance.toLocaleString('en-AU')} off` : ''}
                {result.numeric.rank ? ` · ${ordinal(result.numeric.rank)} closest` : ''}
              </p>
            )}
          </div>
        )}
      </motion.section>

      <section className="rounded-3xl glass p-3" aria-label="Where you are in the creek">
        <div className="flex items-baseline justify-between px-1">
          <p className="text-sm font-semibold">
            {metres(depth)} down <span className="font-normal text-foam-muted">· {zone.label}</span>
          </p>
          {result && result.points > 0 && <p className="text-sm text-sun-300">↓ {metres(result.points)} this round</p>}
        </div>
        {crossing && (
          <motion.p
            key={`${round.index}-crossing`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6 }}
            className="display mt-1 px-1 text-lg font-semibold text-creek-300"
          >
            {crossing}
          </motion.p>
        )}
        <div className="mx-auto mt-2 w-[min(100%,calc(62dvh*0.4))] aspect-[360/900]">
          <CreekScene players={scenePlayers} variant="phone" highlightPlayerId={view.me.id} showZoneLabels className="h-full" />
        </div>
        <DepthMeter depth={depth} className="mt-2" label="Down the creek" />
        <p className="mt-2 px-1 text-xs text-foam-faint">{zone.blurb}</p>
      </section>

      {groups.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-foam-faint">
            Everyone's answers · {round.validCount ?? groups.reduce((n, g) => n + g.count, 0)} in
          </h2>
          <ul className="flex flex-col gap-1.5">
            {groups.map((g) => (
              <motion.li key={g.key} layout transition={{ duration: 0.25 }}>
                <GroupRow group={g} compact highlight={g.key === myKey} />
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      <p className="pb-2 text-center text-xs text-foam-faint">Waiting for the host…</p>
    </main>
  );
}
