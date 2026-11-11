import { useEffect, useState } from 'react';
import type { PlayerView } from '@shared/types';
import { BackdropLayer } from '../../components/BackdropLayer';
import { Button } from '../../components/Button';
import { usePlayerView } from '../../hooks/useSession';
import { navigate } from '../../router';
import { useStore } from '../../ws';
import { PlayerLobby } from './PlayerLobby';
import { PlayerPrompt } from './PlayerPrompt';
import { PlayerReveal } from './PlayerReveal';
import { PlayerResults } from './PlayerResults';

/** Dispatches on the room phase. A new round remounts the prompt screen. */
export function PlayerGame() {
  const view = usePlayerView();
  if (!view) return <Waiting />;
  return (
    <>
      {view.hostConnected === false && <HostOffline />}
      <Screen view={view} />
    </>
  );
}

function Screen({ view }: { view: PlayerView }) {
  switch (view.phase) {
    case 'lobby':
      return <PlayerLobby view={view} />;
    case 'prompt':
      return <PlayerPrompt key={`r${view.round?.index ?? 0}`} view={view} />;
    case 'reveal':
      return <PlayerReveal view={view} />;
    case 'results':
      return <PlayerResults view={view} />;
    default:
      return <Waiting />;
  }
}

/** The laptop closed its tab or lost Wi-Fi: say so instead of an endless "waiting for the host". */
function HostOffline() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 safe-bottom" role="status">
      <div className="mb-2 rounded-full bg-creek-950/85 px-4 py-1.5 text-xs font-semibold text-amber-200 shadow backdrop-blur">
        The host screen is offline — hang tight
      </div>
    </div>
  );
}

function Waiting() {
  const { session, status } = useStore();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 safe-x text-center">
      <BackdropLayer zone="bridge" />
      <div className="size-10 rounded-full border-4 border-white/15 border-t-creek-300 animate-spin" aria-hidden />
      <p className="text-foam-muted">
        {status === 'open' ? 'Finding your spot' : 'Connecting'}
        {session ? ` in room ${session.code}` : ''}…
      </p>
      {slow && (
        // keeps the seat: the join screen offers Rejoin / Leave explicitly
        <Button variant="ghost" onClick={() => navigate('/')}>
          Taking too long? Back to the start
        </Button>
      )}
    </main>
  );
}
