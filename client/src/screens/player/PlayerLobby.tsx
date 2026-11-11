import { AnimatePresence, motion } from 'motion/react';
import type { PlayerView } from '@shared/types';
import { Avatar, Logo } from '../../artApi';
import { BackdropLayer } from '../../components/BackdropLayer';
import { Button } from '../../components/Button';
import { leaveSession } from '../../ws';

export function PlayerLobby({ view }: { view: PlayerView }) {
  const me = view.players.find((p) => p.id === view.me.id);
  const others = view.players.filter((p) => p.id !== view.me.id);
  return (
    <main className="flex min-h-dvh flex-col safe-x safe-top safe-bottom">
      <BackdropLayer zone="bridge" phase="lobby" />
      <header className="flex items-center justify-between py-1">
        <Logo variant="mark" className="size-11" />
        <span className="rounded-full glass px-3 py-1 text-xs font-semibold tracking-[0.25em]">{view.code}</span>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        {me && (
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
            <div className="animate-float">
              <Avatar id={me.avatar} size={128} ring title={me.name} />
            </div>
          </motion.div>
        )}
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foam-faint">On the bridge</p>
          <h1 className="display mt-1 text-4xl font-semibold leading-tight">
            {me ? `You're in, ${me.name}.` : "You're in."}
          </h1>
          {view.config.title && <p className="mt-1 text-foam-muted">{view.config.title}</p>}
        </div>

        <div className="w-full max-w-sm rounded-3xl glass p-4">
          <p className="mb-3 text-sm text-foam-muted">
            {view.players.length} {view.players.length === 1 ? 'diver' : 'divers'} on the bridge
          </p>
          <ul className="flex flex-wrap justify-center gap-2" aria-label="Players in the room">
            <AnimatePresence initial={false}>
              {others.map((p) => (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: p.connected ? 1 : 0.4 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  className="flex flex-col items-center gap-1"
                  title={p.name}
                >
                  <Avatar id={p.avatar} size={40} title={p.name} />
                  <span className="max-w-14 truncate text-[11px] text-foam-muted">{p.name}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>

        <p className="flex items-center gap-2 text-foam-muted">
          Waiting for the host to start
          <span className="inline-flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 rounded-full bg-foam-muted animate-pulse-soft" style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
          </span>
        </p>
      </section>

      <footer className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm('Leave the room? You can rejoin with the code.')) leaveSession();
          }}
        >
          Leave room
        </Button>
      </footer>
    </main>
  );
}
