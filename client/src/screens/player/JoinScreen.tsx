import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { AvatarId } from '@shared/types';
import { LIMITS } from '@shared/types';
import { AVATARS } from '@shared/theme';
import { Avatar, Logo } from '../../artApi';
import { BackdropLayer } from '../../components/BackdropLayer';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Field } from '../../components/Field';
import { navigate } from '../../router';
import { describeError, dismissNotice, joinRoom, leaveSession, useStore, waitFor } from '../../ws';

/** GET /api/rooms/:code → { exists, phase, players: <count>, takenAvatars, title }. Older/other shapes tolerated. */
interface RoomInfo {
  exists?: boolean;
  phase?: string;
  players?: number | { name?: string; avatar?: string }[];
  takenAvatars?: string[];
  playerCount?: number;
  title?: string | null;
}

function playerCountOf(info: RoomInfo | null): number | undefined {
  if (!info) return undefined;
  if (typeof info.players === 'number') return info.players;
  if (Array.isArray(info.players)) return info.players.length;
  return info.playerCount;
}

const CODE_RE = /[^A-Z0-9]/g;

export function JoinScreen({ prefillCode }: { prefillCode: string | null }) {
  const { session, notice, kicked, status } = useStore();
  const [code, setCode] = useState(prefillCode ?? '');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<AvatarId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefillCode) setCode(prefillCode);
  }, [prefillCode]);

  // Peek at the room once we have a full code: which avatars are taken, has it started?
  useEffect(() => {
    if (code.length !== 4) {
      setRoom(null);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    fetch(`/api/rooms/${code}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<RoomInfo>) : null))
      .then((info) => {
        if (!cancelled) setRoom(info && typeof info === 'object' ? info : null);
      })
      .catch(() => {
        if (!cancelled) setRoom(null);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [code]);

  const taken = useMemo(() => {
    const s = new Set<string>();
    if (Array.isArray(room?.takenAvatars)) room.takenAvatars.forEach((a) => s.add(a));
    if (Array.isArray(room?.players)) room.players.forEach((p) => p?.avatar && s.add(p.avatar));
    return s;
  }, [room]);
  const roomCount = playerCountOf(room);

  const canSubmit = code.length === 4 && name.trim().length > 0 && !!avatar && !submitting;
  const selectedTaken = !!avatar && taken.has(avatar);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!submitting && code.length === 4 && name.trim().length > 0 && !avatar) {
      setError('Pick an animal');
      return;
    }
    if (!canSubmit || !avatar) return;
    setSubmitting(true);
    setError(null);
    joinRoom(code, name.trim(), avatar);
    try {
      const m = await waitFor(['player:joined'], 10_000);
      if (m.t === 'error') {
        setError(describeError(m.code, m.message));
        if (m.code === 'avatar_taken') setAvatar(null);
        setSubmitting(false);
        return;
      }
      navigate('/play');
    } catch {
      setError(status === 'open' ? 'The host screen did not answer. Try again.' : 'Still connecting to the game server. Try again in a moment.');
      setSubmitting(false);
    }
  }

  const started = room?.phase && room.phase !== 'lobby';

  return (
    <main className="relative flex min-h-dvh flex-col safe-x safe-top safe-bottom">
      <BackdropLayer zone="bridge" phase="lobby" />
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-4 py-2">
        <Logo className="h-12 w-auto shrink-0" />
        <button
          onClick={() => navigate('/host')}
          className="-mr-3 inline-flex min-h-11 items-center px-3 text-xs font-semibold text-foam-muted hover:text-foam"
        >
          Hosting?
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 py-4">
        <AnimatePresence>
          {(notice || kicked) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start justify-between gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
              role="status"
            >
              <span className="py-1">{notice ?? 'The host removed you from the game.'}</span>
              <button
                onClick={dismissNotice}
                className="-m-2 grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl font-bold hover:bg-white/10"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {session?.role === 'player' && (
          <Card tone="solid" className="flex items-center gap-3">
            <Avatar id={session.avatar} size={44} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">You're in room {session.code}</div>
              <div className="text-sm text-foam-muted">as {session.name || 'a player'}</div>
            </div>
            <Button size="sm" onClick={() => navigate('/play')}>
              Rejoin
            </Button>
            <Button size="sm" variant="ghost" onClick={() => leaveSession()}>
              Leave
            </Button>
          </Card>
        )}
        {session?.role === 'host' && (
          <Card tone="solid" className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">You're hosting room {session.code}</div>
              <div className="text-sm text-foam-muted">Open the big screen to keep going.</div>
            </div>
            <Button size="sm" onClick={() => navigate('/host')}>
              Host screen
            </Button>
          </Card>
        )}

        <div>
          <h1 className="display text-4xl font-semibold leading-tight text-balance">How deep can you go down the creek?</h1>
          <p className="mt-2 text-foam-muted">
            Seven prompts, one answer each. The rarer your answer, the deeper you dive.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field
            ref={codeRef}
            label="Room code"
            hint="4 letters on the host screen"
            value={code}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().replace(CODE_RE, '').slice(0, 4);
              setCode(v);
              setError(null);
              if (v.length === 4) setTimeout(() => nameRef.current?.focus(), 50);
            }}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            maxLength={4}
            placeholder="ABCD"
            inputClassName="display text-3xl font-semibold tracking-[0.4em] uppercase text-center"
            error={started ? 'That game has already started — ask the host to restart, or wait for the next one.' : null}
          />
          <Field
            ref={nameRef}
            label="Your name"
            hint={`${name.length}/${LIMITS.maxNameLength}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value.slice(0, LIMITS.maxNameLength));
              setError(null);
            }}
            maxLength={LIMITS.maxNameLength}
            autoComplete="nickname"
            autoCapitalize="words"
            enterKeyHint="next"
            placeholder="What the crew calls you"
            onKeyDown={(e) => {
              // the submit button is disabled until an animal is picked, which
              // blocks the browser's implicit submit; say what is missing instead
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              }
            }}
          />

          <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-semibold text-foam-muted">Pick your animal</legend>
            <div className="grid grid-cols-5 gap-2">
              {AVATARS.map((a) => {
                const isTaken = taken.has(a.id);
                const selected = avatar === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAvatar(a.id);
                      setError(null);
                    }}
                    aria-pressed={selected}
                    aria-label={isTaken ? `${a.name}, already taken` : a.name}
                    className={[
                      'relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-2xl border p-1 transition-all',
                      selected ? 'border-sun-400 bg-sun-500/15 scale-[1.04]' : 'border-white/10 bg-white/5 hover:bg-white/10',
                      isTaken && !selected ? 'opacity-45 grayscale' : '',
                    ].join(' ')}
                  >
                    <Avatar id={a.id} size={40} title={a.name} />
                    <span className="w-full truncate text-center text-[10px] leading-tight text-foam-muted">{a.name}</span>
                    {isTaken && (
                      <span className="absolute inset-x-1 bottom-1 rounded-md bg-creek-950/80 text-[9px] font-bold uppercase tracking-wide text-foam-faint">
                        taken
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedTaken && (
              <p className="mt-2 text-xs text-amber-200">
                Someone's already the {AVATARS.find((a) => a.id === avatar)?.name.toLowerCase()}. Once all twenty animals are taken you can double up; until then pick a free one.
              </p>
            )}
          </fieldset>

          {error && (
            <p role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          )}

          <Button type="submit" size="xl" block disabled={!canSubmit} loading={submitting}>
            {submitting ? 'Joining…' : 'Dive in'}
          </Button>
          {roomCount !== undefined && roomCount > 0 && (
            <p className="text-center text-xs text-foam-faint">
              {roomCount} {roomCount === 1 ? 'person is' : 'people are'} already on the bridge
              {room?.title ? ` · ${room.title}` : ''}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
