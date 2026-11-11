import { useEffect, useState } from 'react';
import { Logo } from '../../artApi';
import { BackdropLayer } from '../../components/BackdropLayer';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Field } from '../../components/Field';
import { useHostView } from '../../hooks/useSession';
import { navigate } from '../../router';
import { createRoom, describeError, leaveSession, useStore, waitFor } from '../../ws';
import { HostLobby } from './HostLobby';
import { HostPrompt } from './HostPrompt';
import { HostReveal } from './HostReveal';
import { HostResults } from './HostResults';

export function HostScreen() {
  const { session } = useStore();
  const view = useHostView();

  if (!session || session.role !== 'host') return <HostCreate />;
  if (!view) return <HostWaiting code={session.code} />;

  switch (view.phase) {
    case 'lobby':
      return <HostLobby view={view} />;
    case 'prompt':
      return <HostPrompt key={`r${view.round?.index ?? 0}`} view={view} />;
    case 'reveal':
      return <HostReveal view={view} />;
    case 'results':
      return <HostResults view={view} />;
    default:
      return <HostWaiting code={session.code} />;
  }
}

function HostCreate() {
  const { session, status } = useStore();
  const [pin, setPin] = useState('');
  const [needPin, setNeedPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    if (session?.role === 'player') leaveSession();
    createRoom(undefined, pin.trim() || undefined);
    try {
      const m = await waitFor(['host:created'], 10_000);
      if (m.t === 'error') {
        const pinProblem = m.code === 'pin_required' || m.code === 'not_host' || (m.code === 'bad_request' && /pin/i.test(m.message));
        if (pinProblem) {
          setNeedPin(true);
          setError(pin ? 'That PIN is not right.' : 'This server needs a host PIN.');
        } else {
          setError(describeError(m.code, m.message));
        }
      }
    } catch {
      setError(status === 'open' ? 'The server did not answer. Try again.' : 'Still connecting to the server…');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 safe-x safe-top safe-bottom">
      <BackdropLayer zone="bridge" phase="lobby" />
      <Logo className="h-20 w-auto" />
      <Card tone="solid" padding="lg" className="w-full max-w-md">
        <h1 className="display text-3xl font-semibold">Host a game</h1>
        <p className="mt-2 text-foam-muted">
          Put this screen on the telly. Everyone else scans the code with their phone. Seven prompts, about twenty seconds each.
        </p>
        {session?.role === 'player' && (
          <p className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            This device is currently a player in room {session.code}. Creating a room will leave that game.
          </p>
        )}
        <form onSubmit={create} className="mt-5 flex flex-col gap-4" noValidate>
          {needPin && (
            <Field
              label="Host PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="Set by whoever runs the server"
              error={error}
            />
          )}
          {!needPin && error && (
            <p role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          )}
          <Button type="submit" size="xl" block loading={busy}>
            Create a room
          </Button>
        </form>
      </Card>
      <button onClick={() => navigate('/')} className="text-sm text-foam-faint hover:text-foam">
        Playing instead? Go to the join screen
      </button>
    </main>
  );
}

function HostWaiting({ code }: { code: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 safe-x text-center">
      <BackdropLayer zone="bridge" />
      <div className="size-10 rounded-full border-4 border-white/15 border-t-creek-300 animate-spin" aria-hidden />
      <p className="text-foam-muted">Reconnecting to room {code}…</p>
      {slow && (
        <Button
          variant="ghost"
          onClick={() => {
            // abandoning a room strands everyone in it; make that a deliberate choice
            if (window.confirm(`Leave room ${code} and start a new one? Anyone still in it will have to join the new room.`)) {
              leaveSession();
            }
          }}
        >
          Start a new room instead
        </Button>
      )}
    </main>
  );
}
