import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { HostView } from '@shared/types';
import { Avatar, Logo } from '../../artApi';
import { BackdropLayer } from '../../components/BackdropLayer';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { QrCode } from '../../components/QrCode';
import { useKey } from '../../hooks/useKey';
import { send } from '../../ws';
import { HostSetup } from './HostSetup';

export function HostLobby({ view }: { view: HostView }) {
  const [setupOpen, setSetupOpen] = useState(false);
  const joinUrl = view.joinUrl || `${location.origin}/join/${view.code}`;
  const prettyUrl = joinUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const canStart = view.players.length > 0 && view.config.promptIds.length > 0;

  const start = useCallback(() => {
    if (canStart) send({ t: 'host:start' });
  }, [canStart]);
  const toggleSetup = useCallback(() => setSetupOpen((o) => !o), []);

  useKey(['Escape'], toggleSetup, { allowInInputs: true });
  useKey(['s', 'S'], start, { enabled: !setupOpen });

  return (
    <main className="relative grid min-h-dvh grid-rows-[1fr_auto] safe-x safe-top safe-bottom">
      <BackdropLayer zone="bridge" phase="lobby" />
      <div className="grid min-h-0 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* left: how to join */}
        <section className="flex min-h-0 flex-col justify-center gap-5 py-4">
          <Logo className="h-[clamp(64px,13vh,140px)] w-auto" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-foam-faint">
              {view.config.title?.trim() || 'Join the dive'}
            </p>
            <p
              className="display mt-1 text-[clamp(3.5rem,13vh,9.5rem)] font-bold leading-none tracking-[0.18em] text-sun-300"
              aria-label={`Room code ${view.code.split('').join(' ')}`}
            >
              {view.code}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <QrCode value={joinUrl} className="w-[clamp(150px,27vh,280px)] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-base text-foam-muted">Scan to join, or go to</p>
              <p className="display mt-1 break-words text-[clamp(1.1rem,2.1vw,1.9rem)] font-semibold leading-tight">{prettyUrl}</p>
              <p className="mt-3 hidden text-sm text-foam-faint xl:block">
                Pick a name and an animal. You get about {view.config.secondsPerPrompt} seconds a prompt.
              </p>
            </div>
          </div>
        </section>

        {/* right: who's here */}
        <section className="flex min-h-0 flex-col py-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="display text-3xl font-semibold">
              {view.players.length === 0 ? 'Nobody on the bridge yet' : `${view.players.length} on the bridge`}
            </h2>
            <span className="text-sm text-foam-faint">up to 24 divers</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-3xl glass p-4">
            {view.players.length === 0 ? (
              <p className="grid h-full place-items-center text-center text-foam-muted">
                Players appear here as they scan the code.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label="Players">
                <AnimatePresence initial={false}>
                  {view.players.map((p) => (
                    <motion.li
                      key={p.id}
                      layout
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                      className={['group relative flex items-center gap-3 rounded-2xl bg-white/6 p-3', p.connected ? '' : 'opacity-50 grayscale'].join(' ')}
                    >
                      <Avatar id={p.avatar} size={56} title={p.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold">{p.name}</p>
                        <p className="text-xs text-foam-faint">{p.connected ? 'ready' : 'offline'}</p>
                      </div>
                      <button
                        aria-label={`Remove ${p.name}`}
                        title="Remove player"
                        onClick={() => {
                          if (confirm(`Remove ${p.name} from the room?`)) send({ t: 'host:kick', playerId: p.id });
                        }}
                        className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/40 text-xs text-foam-faint opacity-0 transition-opacity hover:bg-rose-500/80 hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        ✕
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* bottom bar */}
      <footer className="flex flex-wrap items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="lg" onClick={toggleSetup}>
            Setup
          </Button>
          <p className="text-sm text-foam-muted">
            {view.config.promptIds.length} {view.config.promptIds.length === 1 ? 'prompt' : 'prompts'} · {view.config.secondsPerPrompt} s each
            {view.config.endEarlyWhenAllAnswered ? ' · ends early when everyone’s in' : ''}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="hidden text-xs text-foam-faint md:block">
            <kbd className="rounded bg-white/10 px-1.5 py-0.5">S</kbd> start · <kbd className="rounded bg-white/10 px-1.5 py-0.5">Esc</kbd> setup
          </p>
          <Button size="xl" onClick={start} disabled={!canStart}>
            Start the dive
          </Button>
        </div>
      </footer>

      <Drawer open={setupOpen} onClose={() => setSetupOpen(false)} title="Game setup">
        <HostSetup view={view} />
      </Drawer>
    </main>
  );
}
