import { motion } from 'motion/react';
import type { HostView, PlayerPublic, TierId } from '@shared/types';
import { TIERS, zoneForDepth } from '@shared/theme';
import { Avatar, CreekScene } from '../../artApi';
import { BackdropLayer } from '../../components/BackdropLayer';
import { Button } from '../../components/Button';
import { useShortScreen } from '../../hooks/useMediaQuery';
import { metres, ordinal, rankPlayers } from '../../lib/format';
import { navigate } from '../../router';
import { leaveSession, send } from '../../ws';

const CONFETTI_COLOURS = ['var(--tier-krillion)', 'var(--sun-400)', 'var(--creek-300)', 'var(--tier-rockpool)', 'var(--sand-300)'];

export function HostResults({ view }: { view: HostView }) {
  const ranked = rankPlayers(view.players);
  const short = useShortScreen();
  const top = ranked.slice(0, 3);
  const podiumOrder = [top[1], top[0], top[2]].filter((r): r is NonNullable<typeof r> => !!r);
  const tiersFor = (p: PlayerPublic): TierId[] =>
    view.roundHistory.map((r) => r.results?.[p.id]?.tier ?? 'dry');

  return (
    <main className="relative flex h-dvh flex-col gap-5 overflow-hidden safe-x safe-top safe-bottom">
      <BackdropLayer zone="mouth" phase="results" />
      <div className="confetti" aria-hidden>
        {Array.from({ length: 28 }).map((_, i) => (
          <i
            key={i}
            style={
              {
                '--x': `${(i * 37) % 100}%`,
                '--delay': `${(i % 7) * 0.45}s`,
                '--dur': `${3 + (i % 5) * 0.5}s`,
                '--c': CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <header className="flex items-end justify-between gap-4 pt-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-foam-faint">Final results</p>
          <h1 className="display text-4xl font-semibold">{view.config.title?.trim() || 'How deep did we go?'}</h1>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onClick={() => send({ t: 'host:restart' })}>
            Play again
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              if (confirm('Close this room and start a new one? Players will need to rejoin.')) {
                leaveSession();
                navigate('/host');
              }
            }}
          >
            New game
          </Button>
        </div>
      </header>

      {/* podium */}
      <section className="flex items-end justify-center gap-6" aria-label="Podium">
        {podiumOrder.map((r) => {
          const first = r.rank === 1;
          const size = (first ? 128 : r.rank === 2 ? 96 : 84) * (short ? 0.7 : 1);
          return (
            <motion.div
              key={r.player.id}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: first ? 0.3 : 0.1, type: 'spring', stiffness: 200, damping: 20 }}
              className={[
                'flex flex-col items-center rounded-3xl',
                short ? 'gap-1 px-5 pt-3 pb-3' : 'gap-2 px-6 pt-5 pb-4',
                first ? 'bg-tier-krillion/15 border border-tier-krillion/50' : 'glass',
              ].join(' ')}
            >
              <Avatar id={r.player.avatar} size={size} ring={first} title={r.player.name} />
              <p className={['display font-semibold', short ? 'text-xl' : 'text-2xl'].join(' ')}>{r.player.name}</p>
              <p className={['display font-bold tabular', first ? (short ? 'text-3xl' : 'text-4xl') + ' text-tier-krillion' : (short ? 'text-xl' : 'text-2xl') + ' text-sun-300'].join(' ')}>
                {metres(r.player.depth)}
              </p>
              <p className="text-xs text-foam-muted">
                {ordinal(r.rank)} · {zoneForDepth(r.player.depth).label}
              </p>
            </motion.div>
          );
        })}
        {podiumOrder.length === 0 && <p className="text-foam-muted">No divers this time.</p>}
      </section>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <section
          className="h-[46dvh] min-h-0 overflow-hidden rounded-3xl glass p-2 lg:h-full lg:aspect-[600/1400]"
          aria-label="Everyone in the creek"
        >
          <CreekScene players={view.players} variant="results" showZoneLabels className="h-full" />
        </section>
        <section className="min-h-0 overflow-y-auto rounded-3xl glass">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-creek-900/90 text-xs uppercase tracking-wide text-foam-faint backdrop-blur">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-2 py-3 font-semibold">Diver</th>
                <th className="px-2 py-3 text-right font-semibold">Depth</th>
                <th className="hidden px-2 py-3 font-semibold md:table-cell">Zone</th>
                <th className="px-4 py-3 font-semibold">Dive</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.player.id} className="border-t border-white/6">
                  <td className="px-4 py-2 tabular text-foam-muted">{r.rank}</td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-2">
                      <Avatar id={r.player.avatar} size={32} title={r.player.name} />
                      <span className="font-semibold">{r.player.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular font-semibold">{metres(r.player.depth)}</td>
                  <td className="hidden px-2 py-2 text-foam-muted md:table-cell">{zoneForDepth(r.player.depth).label}</td>
                  <td className="px-4 py-2">
                    <span className="flex gap-1" aria-label={tiersFor(r.player).map((t) => TIERS[t].label).join(', ')}>
                      {tiersFor(r.player).map((t, i) => (
                        <span
                          key={i}
                          title={TIERS[t].label}
                          className="size-3.5 rounded-full ring-1 ring-black/20"
                          style={{ background: `var(--tier-${t})` }}
                        />
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
