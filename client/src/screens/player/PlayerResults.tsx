import { useState } from 'react';
import { motion } from 'motion/react';
import type { PlayerView } from '@shared/types';
import { TIERS, zoneForDepth } from '@shared/theme';
import { CreekScene, TierBadge } from '../../artApi';
import { BackdropLayer } from '../../components/BackdropLayer';
import { Button } from '../../components/Button';
import { metres, ordinal, rankPlayers, shareText } from '../../lib/format';
import { leaveSession } from '../../ws';

export function PlayerResults({ view }: { view: PlayerView }) {
  const ranked = rankPlayers(view.players);
  const mine = ranked.find((r) => r.player.id === view.me.id);
  const me = mine?.player;
  const depth = me?.depth ?? 0;
  const zone = zoneForDepth(depth);
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = shareText({ depth, history: view.me.history, roundCount: view.roundCount, title: view.config.title });
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* user cancelled the share sheet */
    }
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 safe-x safe-top safe-bottom">
      <BackdropLayer zone={zone.id} phase="results" />
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-foam-faint">Final results</p>
        {view.config.title && <p className="text-sm text-foam-muted">{view.config.title}</p>}
      </header>

      <motion.section
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="rounded-3xl glass p-5 text-center"
      >
        <p className="display text-6xl font-bold text-sun-300">{metres(depth)}</p>
        <h1 className="display mt-1 text-3xl font-semibold">{zone.label}</h1>
        <p className="mt-1 text-sm text-foam-muted">{zone.blurb}</p>
        {mine && (
          <p className="mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
            {ordinal(mine.rank)} deepest of {view.players.length}
          </p>
        )}
      </motion.section>

      {/* sized by the scene's own 360:900 ratio so it fills the card instead of floating in it */}
      <section className="mx-auto w-[min(100%,calc(72dvh*0.4))] aspect-[360/900] overflow-hidden rounded-3xl glass p-2">
        <CreekScene players={view.players} variant="phone" highlightPlayerId={view.me.id} showZoneLabels className="h-full" />
      </section>

      <section className="rounded-3xl glass p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-foam-faint">Your dive</p>
        <ol className="flex items-end justify-between gap-1">
          {Array.from({ length: Math.max(view.roundCount, view.me.history.length) }).map((_, i) => {
            const h = view.me.history[i];
            const tier = h?.tier ?? 'dry';
            return (
              <li key={i} className="flex flex-col items-center gap-1" title={h ? `${TIERS[tier].label}: ${h.raw || 'no answer'}` : 'not played'}>
                <TierBadge tier={tier} size="sm" />
                <span className="text-[10px] text-foam-faint">{i + 1}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-col gap-2">
        <Button size="xl" block onClick={share}>
          {copied ? 'Copied!' : 'Share your dive'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm('Leave the room?')) leaveSession();
          }}
        >
          Leave room
        </Button>
      </div>
      <p className="pb-2 text-center text-xs text-foam-faint">Waiting for the host… if they play again you'll be sent back to the bridge.</p>
    </main>
  );
}
