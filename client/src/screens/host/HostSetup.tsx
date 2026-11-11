import { useEffect, useMemo, useRef, useState } from 'react';
import type { HostView, PromptCategory, PromptSummary, RoomConfig } from '@shared/types';
import { MAX_ROUNDS } from '@shared/types';
import { Button } from '../../components/Button';
import { send } from '../../ws';

const SECONDS = [15, 20, 25, 30];
const CATEGORY_LABEL: Record<PromptCategory, string> = {
  starter: 'Starter prompts',
  local: 'Local flavour (draft)',
  closest: 'Closest to the pin (draft)',
};
const CATEGORY_ORDER: PromptCategory[] = ['starter', 'local', 'closest'];

/**
 * Setup panel. Keeps a local draft of the config and sends debounced
 * host:config patches; the server's echo is not re-applied while the panel
 * is open so typing never fights an incoming frame.
 */
export function HostSetup({ view }: { view: HostView }) {
  const [draft, setDraft] = useState<RoomConfig>(() => ({ ...view.config, specialAnswers: { ...view.config.specialAnswers } }));
  const [specialText, setSpecialText] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(view.config.specialAnswers ?? {}).map(([k, v]) => [k, v.join(', ')])),
  );
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const promptsById = useMemo(() => new Map(view.prompts.map((p) => [p.id, p])), [view.prompts]);
  const included = draft.promptIds.map((id) => promptsById.get(id)).filter((p): p is PromptSummary => !!p);
  const full = draft.promptIds.length >= MAX_ROUNDS;

  function patch(p: Partial<RoomConfig>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  // debounced send
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => sendPatch(draft), 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // flush on unmount (drawer closed)
  const latest = useRef(draft);
  latest.current = draft;
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        sendPatch(latest.current);
      }
    };
  }, []);

  function sendPatch(d: RoomConfig) {
    const specialAnswers: Record<string, string[]> = {};
    for (const id of d.promptIds) {
      const list = (d.specialAnswers[id] ?? []).map((s) => s.trim()).filter(Boolean);
      if (list.length) specialAnswers[id] = list.slice(0, 20);
    }
    const p: Partial<RoomConfig> = {
      secondsPerPrompt: d.secondsPerPrompt,
      endEarlyWhenAllAnswered: d.endEarlyWhenAllAnswered,
      specialAnswers,
      title: (d.title ?? '').slice(0, 40),
    };
    if (d.promptIds.length > 0) p.promptIds = d.promptIds.slice(0, MAX_ROUNDS);
    send({ t: 'host:config', patch: p });
  }

  function toggle(id: string) {
    if (draft.promptIds.includes(id)) patch({ promptIds: draft.promptIds.filter((x) => x !== id) });
    else if (!full) patch({ promptIds: [...draft.promptIds, id] });
  }

  function move(id: string, dir: -1 | 1) {
    const i = draft.promptIds.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= draft.promptIds.length) return;
    const next = [...draft.promptIds];
    const a = next[i];
    const b = next[j];
    if (a === undefined || b === undefined) return;
    next[i] = b;
    next[j] = a;
    patch({ promptIds: next });
  }

  function setSpecial(id: string, text: string) {
    setSpecialText((s) => ({ ...s, [id]: text }));
    const list = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    patch({ specialAnswers: { ...draft.specialAnswers, [id]: list } });
  }

  return (
    <div className="flex flex-col gap-7 pb-8">
      <section>
        <label className="block text-sm font-semibold text-foam-muted" htmlFor="title">
          Game title <span className="font-normal text-foam-faint">(shows on the big screen)</span>
        </label>
        <input
          id="title"
          value={draft.title ?? ''}
          onChange={(e) => patch({ title: e.target.value.slice(0, 40) })}
          maxLength={40}
          placeholder="Sep Creek 2026"
          className="mt-1.5 block h-12 w-full rounded-2xl border border-white/12 bg-white/6 px-4 text-foam outline-none focus:border-sun-400"
        />
      </section>

      <section>
        <p className="text-sm font-semibold text-foam-muted">Seconds per prompt</p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Seconds per prompt">
          {SECONDS.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={draft.secondsPerPrompt === s}
              onClick={() => patch({ secondsPerPrompt: s })}
              className={[
                'h-11 min-w-16 rounded-2xl border px-4 font-semibold tabular transition-colors',
                draft.secondsPerPrompt === s ? 'border-sun-400 bg-sun-500/15 text-sun-300' : 'border-white/12 bg-white/5 hover:bg-white/10',
              ].join(' ')}
            >
              {s}s
            </button>
          ))}
        </div>
        <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 py-3">
          <span>
            <span className="block font-semibold">End early when everyone's locked in</span>
            <span className="block text-sm text-foam-faint">Saves the dead air once the last phone answers.</span>
          </span>
          <input
            type="checkbox"
            checked={draft.endEarlyWhenAllAnswered}
            onChange={(e) => patch({ endEarlyWhenAllAnswered: e.target.checked })}
            className="size-6 accent-[var(--sun-500)]"
          />
        </label>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h3 className="display text-xl font-semibold">Your dive</h3>
          <span className={['text-sm tabular', full ? 'text-sun-300' : 'text-foam-faint'].join(' ')}>
            {draft.promptIds.length} of {MAX_ROUNDS} prompts
          </span>
        </div>
        {included.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Add at least one prompt below.
          </p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {included.map((p, i) => (
              <li key={p.id} className="rounded-2xl bg-white/5 p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-1 w-5 shrink-0 text-sm tabular text-foam-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{p.text}</p>
                    <p className="mt-0.5 text-xs text-foam-faint">
                      {p.type === 'numeric' ? 'closest to the pin' : `${p.answerCount} known answers`}
                      {!p.approved ? ' · draft' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton label="Move up" onClick={() => move(p.id, -1)} disabled={i === 0}>
                      ↑
                    </IconButton>
                    <IconButton label="Move down" onClick={() => move(p.id, 1)} disabled={i === included.length - 1}>
                      ↓
                    </IconButton>
                    <IconButton label="Remove" onClick={() => toggle(p.id)}>
                      ✕
                    </IconButton>
                  </div>
                </div>
                {p.type === 'open' && (
                  <label className="mt-2 block">
                    <span className="text-xs font-semibold text-foam-faint">Special answers (comma separated, always score 100)</span>
                    <input
                      value={specialText[p.id] ?? ''}
                      onChange={(e) => setSpecial(p.id, e.target.value)}
                      placeholder="e.g. cream kiss"
                      className="mt-1 block h-10 w-full rounded-xl border border-white/10 bg-creek-950/40 px-3 text-sm outline-none focus:border-sun-400"
                    />
                  </label>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h3 className="display text-xl font-semibold">Add prompts</h3>
        {view.prompts.length === 0 && <p className="mt-2 text-sm text-foam-faint">No prompt bank loaded on the server yet.</p>}
        {CATEGORY_ORDER.map((cat) => {
          const list = view.prompts.filter((p) => p.category === cat);
          if (list.length === 0) return null;
          return (
            <div key={cat} className="mt-4">
              <p className="text-sm font-semibold text-foam-muted">{CATEGORY_LABEL[cat]}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {list.map((p) => {
                  const on = draft.promptIds.includes(p.id);
                  const disabled = !on && full;
                  return (
                    <li key={p.id}>
                      <label
                        className={[
                          'flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2.5 transition-colors',
                          on ? 'border-sun-400/50 bg-sun-500/10' : 'border-white/8 bg-white/4 hover:bg-white/8',
                          disabled ? 'cursor-not-allowed opacity-40' : '',
                        ].join(' ')}
                      >
                        <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(p.id)} className="mt-1 size-5 accent-[var(--sun-500)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block leading-snug">{p.text}</span>
                          <span className="block text-xs text-foam-faint">
                            {p.type === 'numeric' ? 'closest to the pin' : `${p.answerCount} known answers`}
                            {!p.approved ? ' · draft' : ''}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <p className="text-xs text-foam-faint">Changes save automatically.</p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          const next = { ...view.config, specialAnswers: { ...view.config.specialAnswers } };
          setDraft(next);
          setSpecialText(Object.fromEntries(Object.entries(next.specialAnswers).map(([k, v]) => [k, v.join(', ')])));
        }}
      >
        Revert to saved
      </Button>
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-9 place-items-center rounded-xl bg-white/8 text-sm hover:bg-white/15 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
