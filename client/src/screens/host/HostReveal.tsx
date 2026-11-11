import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { HostView, PlayerPublic } from '@shared/types';
import { CreekScene } from '../../artApi';
import { BackdropLayer } from '../../components/BackdropLayer';
import { Button } from '../../components/Button';
import { GroupRow } from '../../components/GroupRow';
import { useKey } from '../../hooks/useKey';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { send } from '../../ws';

export function HostReveal({ view }: { view: HostView }) {
  const round = view.round;
  const next = useCallback(() => send({ t: 'host:next' }), []);
  // Enter is left to whatever button has focus (Vouch/Reject must never advance the round)
  useKey([' ', 'ArrowRight'], next);
  const wide = useMediaQuery('(min-width: 1536px)');

  // Paint the creek at last round's depths first, then let everyone drop on the big screen.
  const roundIndex = round?.index ?? -1;
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 900);
    return () => clearTimeout(t);
  }, [roundIndex]);
  const scenePlayers = useMemo<PlayerPublic[]>(
    () => (settled ? view.players : view.players.map((p) => ({ ...p, depth: Math.max(0, p.depth - (p.lastPoints ?? 0)) }))),
    [settled, view.players],
  );

  if (!round) return null;
  const groups = round.groups ?? [];
  // on a wide TV with a long list, two columns reading down then across
  const twoCol = wide && groups.length > 10;
  const rows = Math.ceil(groups.length / 2);
  const isLast = round.index + 1 >= view.roundCount;
  const isNumeric = round.prompt.type === 'numeric';
  const answered = round.validCount ?? groups.reduce((n, g) => n + g.count, 0);
  const silent = view.players.filter((p) => !round.results?.[p.id] || !round.results[p.id]?.raw);
  const unverified = groups.filter((g) => g.status === 'unverified').length;

  return (
    <main className="relative grid h-dvh grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden safe-x safe-top safe-bottom">
      <BackdropLayer zone="beach" phase="reveal" />
      <header className="flex items-center justify-between gap-6 pt-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-foam-faint">
            Prompt {round.index + 1} of {view.roundCount} · the reveal
          </p>
          <h1 className="display mt-1 truncate text-3xl font-semibold">{round.prompt.text}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <p className="hidden text-xs text-foam-faint lg:block">
            <kbd className="rounded bg-white/10 px-1.5 py-0.5">Space</kbd> next
          </p>
          <Button size="xl" onClick={next}>
            {isLast ? 'Final results' : 'Next prompt'} →
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <section
          className="h-[46dvh] min-h-0 overflow-hidden rounded-3xl glass p-2 lg:h-full lg:aspect-[600/1400]"
          aria-label="The creek"
        >
          <CreekScene players={scenePlayers} variant="host" showZoneLabels className="h-full" />
        </section>

        <section className="flex min-h-0 flex-col gap-3">
          {isNumeric && round.numericAnswer && (
            <div className="rounded-3xl border border-tier-krillion/40 bg-tier-krillion/10 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-tier-krillion">The answer</p>
              <p className="display text-5xl font-bold">
                {round.numericAnswer.answer.toLocaleString('en-AU')}
                {round.numericAnswer.unit ? <span className="text-2xl font-semibold text-foam-muted"> {round.numericAnswer.unit}</span> : null}
              </p>
              {(round.numericAnswer.source || round.numericAnswer.alternatives) && (
                <p className="mt-1 text-sm text-foam-muted">
                  {round.numericAnswer.source && (
                    <a href={round.numericAnswer.source} target="_blank" rel="noreferrer" className="underline decoration-foam-faint hover:text-foam">
                      source
                    </a>
                  )}
                  {round.numericAnswer.source && round.numericAnswer.alternatives ? ' · ' : ''}
                  {round.numericAnswer.alternatives}
                </p>
              )}
            </div>
          )}

          <div className="flex items-baseline justify-between px-1">
            <p className="text-sm text-foam-muted">
              {answered} {answered === 1 ? 'answer' : 'answers'} · rarest first
              {silent.length > 0 && ` · ${silent.length} ${silent.length === 1 ? 'person' : 'people'} missed it`}
            </p>
            {unverified > 0 && (
              <p className="text-xs text-foam-faint">
                {unverified} not in the answer bank — vouch for the good ones (+85), reject the wrong ones
              </p>
            )}
          </div>

          <ol
            className={['min-h-0 flex-1 overflow-y-auto pr-1', twoCol ? 'grid grid-flow-col grid-cols-2 gap-x-4 gap-y-2' : 'space-y-2'].join(' ')}
            style={twoCol ? { gridTemplateRows: `repeat(${rows}, max-content)` } : undefined}
            aria-label="Answers"
          >
            <AnimatePresence initial={false}>
              {groups.map((g, i) => (
                <motion.li
                  key={g.key}
                  layout
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.6), duration: 0.3 }}
                >
                  <GroupRow
                    group={g}
                    index={i + 1}
                    players={view.players}
                    showWho
                    tv
                    onModerate={(key, accepted) => send({ t: 'host:moderate', roundIndex: round.index, key, accepted })}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
            {groups.length === 0 && <li className="rounded-2xl glass p-6 text-center text-foam-muted">Nobody got an answer in. Brutal.</li>}
          </ol>
        </section>
      </div>
    </main>
  );
}
