import { useCallback } from 'react';
import type { HostView } from '@shared/types';
import { BackdropLayer } from '../../components/BackdropLayer';
import { Button } from '../../components/Button';
import { CountdownRing } from '../../components/CountdownRing';
import { PlayerChip } from '../../components/PlayerChip';
import { PromptText } from '../../components/PromptText';
import { useCountdown } from '../../hooks/useCountdown';
import { useKey } from '../../hooks/useKey';
import { send } from '../../ws';

export function HostPrompt({ view }: { view: HostView }) {
  const round = view.round;
  const cd = useCountdown(round?.endsAt, round?.startedAt);
  const endNow = useCallback(() => send({ t: 'host:end_round' }), []);
  useKey(['e', 'E'], endNow);

  if (!round) return null;
  const locked = new Set(round.submittedPlayerIds);
  const connected = view.players.filter((p) => p.connected);
  const total = connected.length || view.players.length;

  return (
    <main className="relative flex min-h-dvh flex-col safe-x safe-top safe-bottom">
      <BackdropLayer zone="rockpools" phase="prompt" />
      {/* thin progress bar */}
      <div className="fixed inset-x-0 top-0 h-1.5 bg-white/10" aria-hidden>
        <div
          className={['h-full transition-[width] duration-200', cd.seconds <= 5 ? 'bg-amber-400' : 'bg-creek-300'].join(' ')}
          style={{ width: `${cd.fraction * 100}%` }}
        />
      </div>

      <header className="flex items-center justify-between py-2">
        <p className="display text-2xl font-semibold">
          Prompt {round.index + 1} <span className="text-foam-faint">of {view.roundCount}</span>
        </p>
        <p className="text-sm text-foam-faint">
          {view.config.title?.trim() || 'Separation Creek Krillion'} · room {view.code}
        </p>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-1 items-center gap-10 py-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-h-0 h-[52dvh] lg:h-[60dvh]">
          <PromptText text={round.prompt.text} min={28} max={132} />
        </div>
        <div className="flex flex-col items-center gap-6">
          <CountdownRing fraction={cd.fraction} seconds={cd.seconds} done={cd.done} size={240} strokeWidth={16} />
          <p className="display text-3xl font-semibold tabular">
            {locked.size} <span className="text-foam-faint">of {total}</span>
            <span className="block text-center text-sm font-normal text-foam-muted">locked in</span>
          </p>
          <Button variant="secondary" size="lg" onClick={endNow}>
            End now <kbd className="ml-2 rounded bg-white/10 px-1.5 text-xs">E</kbd>
          </Button>
        </div>
      </section>

      <footer className="rounded-3xl border border-white/10 bg-creek-950/75 px-4 py-3 backdrop-blur-md">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-3" aria-label="Who has answered">
          {view.players.map((p) => (
            <li key={p.id}>
              <PlayerChip player={p} size="md" locked={locked.has(p.id)} dimUnlessLocked />
            </li>
          ))}
        </ul>
      </footer>
    </main>
  );
}
