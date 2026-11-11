import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { PlayerView } from '@shared/types';
import { LIMITS } from '@shared/types';
import { zoneForDepth } from '@shared/theme';
import { BackdropLayer } from '../../components/BackdropLayer';
import { Button } from '../../components/Button';
import { CountdownRing } from '../../components/CountdownRing';
import { PromptText } from '../../components/PromptText';
import { useCountdown } from '../../hooks/useCountdown';
import { cancelQueued, send, useStore } from '../../ws';

/**
 * One prompt. Mounted fresh per round (keyed by round index in PlayerGame),
 * so local answer state never leaks between rounds.
 */
export function PlayerPrompt({ view }: { view: PlayerView }) {
  const round = view.round;
  const me = view.players.find((p) => p.id === view.me.id);
  const zone = zoneForDepth(me?.depth ?? 0);
  const cd = useCountdown(round?.endsAt, round?.startedAt);
  const [text, setText] = useState('');
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const serverSubmission = view.me.submission;
  const locked = serverSubmission ?? optimistic;
  const isNumeric = round?.prompt.type === 'numeric';
  const lockedCount = round?.submittedPlayerIds.length ?? 0;
  const total = view.players.filter((p) => p.connected).length || view.players.length;
  const { status } = useStore();
  const online = status === 'open';
  /** sent but not yet confirmed by the server */
  const pendingOffline = optimistic !== null && serverSubmission === undefined && !online;

  useEffect(() => {
    if (serverSubmission !== undefined) setSending(false);
  }, [serverSubmission]);

  // Online and the server never recorded the answer within 6 s (it answered
  // with an error, say): unlock for one clean retry, dropping anything still
  // queued so two answers can never go out. While offline the lock stays and
  // the queued answer is delivered on reconnect.
  useEffect(() => {
    if (!optimistic || serverSubmission !== undefined || !online) return;
    const roundIndex = round?.index;
    const t = setTimeout(() => {
      if (!cd.done) {
        cancelQueued((m) => m.t === 'player:answer' && m.roundIndex === roundIndex);
        setOptimistic(null);
        setText('');
      }
      setSending(false);
    }, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optimistic, serverSubmission, online]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!round || locked || sending || cd.done) return;
    const t = text.trim().slice(0, LIMITS.maxAnswerLength);
    if (!t) return;
    setSending(true);
    setOptimistic(t);
    send({ t: 'player:answer', roundIndex: round.index, text: t });
    inputRef.current?.blur();
  }

  if (!round) return null;

  const remaining = LIMITS.maxAnswerLength - text.length;

  return (
    <main className="flex min-h-dvh flex-col safe-x safe-top safe-bottom">
      <BackdropLayer zone={zone.id} phase="prompt" />
      <header className="flex items-center justify-between py-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foam-faint">Prompt</p>
          <p className="display text-2xl font-semibold leading-none">
            {round.index + 1} <span className="text-foam-faint">of {view.roundCount}</span>
          </p>
        </div>
        <CountdownRing fraction={cd.fraction} seconds={cd.seconds} done={cd.done} size={72} strokeWidth={7} />
      </header>

      <section className="flex min-h-0 flex-1 flex-col justify-center py-3">
        <div className="min-h-0 flex-1 max-h-[38dvh]">
          <PromptText text={round.prompt.text} min={22} max={46} />
        </div>
      </section>

      <section className="pb-2">
        {locked ? (
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-5 text-center"
            role="status"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">{pendingOffline ? 'Locking in' : 'Locked in'}</p>
            <p className="display mt-1 text-3xl font-semibold break-words">{locked}</p>
            <p className="mt-3 text-sm text-foam-muted">
              {pendingOffline ? (
                <>Reconnecting — your answer will send when we're back</>
              ) : (
                <>
                  {lockedCount} of {total} locked in
                  {!cd.done && ' · hang tight'}
                </>
              )}
            </p>
          </motion.div>
        ) : cd.done ? (
          <div className="rounded-3xl glass p-5 text-center" role="status">
            <p className="display text-2xl font-semibold">Time's up.</p>
            <p className="mt-1 text-sm text-foam-muted">No answer this round — the reveal is coming.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
            <label className="sr-only" htmlFor="answer">
              Your answer
            </label>
            <div className="relative">
              <input
                id="answer"
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, LIMITS.maxAnswerLength))}
                onFocus={(e) => {
                  const el = e.currentTarget;
                  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
                }}
                autoFocus
                enterKeyHint="done"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                maxLength={LIMITS.maxAnswerLength}
                inputMode={isNumeric ? 'decimal' : 'text'}
                placeholder={isNumeric ? 'Your best guess' : 'One answer…'}
                className="block h-16 w-full rounded-2xl border border-white/15 bg-creek-950/60 px-4 text-2xl text-foam placeholder:text-foam-faint outline-none backdrop-blur focus:border-sun-400"
              />
              {remaining <= 15 && (
                <span className={['absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular', remaining <= 5 ? 'text-amber-300' : 'text-foam-faint'].join(' ')}>
                  {remaining}
                </span>
              )}
            </div>
            <Button type="submit" size="xl" block disabled={!text.trim() || sending} loading={sending}>
              Lock it in
            </Button>
            <p className="text-center text-xs text-foam-faint">
              {lockedCount} of {total} locked in
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
