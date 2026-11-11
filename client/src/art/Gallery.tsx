import { useState } from 'react';
import type { AvatarId, PlayerPublic, TierId, ZoneId } from '@shared/types';
import { AVATARS, TIER_ORDER, ZONES } from '@shared/theme';
import { Avatar } from './Avatar';
import { Backdrop } from './Backdrop';
import { CreekScene } from './CreekScene';
import { DepthMeter } from './DepthMeter';
import { Logo } from './Logo';
import { TierBadge } from './TierBadge';
import './tokens.css';

const NAMES = [
  'Sam', 'Grandma', 'Jess', 'Tom', 'Priya', 'Dave', 'Mel', 'Kiri', 'Ollie', 'Nat',
  'Benno', 'Ruby', 'Hamish', 'Zoe', 'Luca', 'Georgie', 'Finn', 'Ana', 'Marcus', 'Tilly',
];

export function fakePlayers(n = 20, spread = true): PlayerPublic[] {
  return AVATARS.slice(0, n).map((a, i) => ({
    id: `p${i}`,
    name: NAMES[i] ?? `Player ${i + 1}`,
    avatar: a.id as AvatarId,
    connected: i !== 7,
    depth: spread ? Math.round((i * 37 + 11) % 700) : 0,
    lastTier: TIER_ORDER[i % TIER_ORDER.length],
    joinedAt: i,
  }));
}

const section: React.CSSProperties = {
  padding: '28px 24px',
  borderBottom: '1px solid rgba(244,241,232,0.08)',
};
const h: React.CSSProperties = {
  fontFamily: 'var(--sck-font-display)',
  fontSize: 24,
  margin: '0 0 16px',
  color: 'var(--sck-text)',
};
const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' };
const cap: React.CSSProperties = { fontSize: 11, color: 'var(--sck-text-dim)', textAlign: 'center', marginTop: 4 };

const DEMO_DEPTHS = [0, 120, 350, 650];

/** Live check that markers ease between depths inside the SVG. */
function MotionDemo() {
  const [step, setStep] = useState(0);
  const base = fakePlayers(3, false);
  const players = base.map((p, i) => ({ ...p, depth: DEMO_DEPTHS[(step + i) % DEMO_DEPTHS.length]! }));
  return (
    <div data-testid="motion-demo" style={{ width: 240 }}>
      <button
        type="button"
        data-testid="motion-next"
        onClick={() => setStep((s) => s + 1)}
        style={{ marginBottom: 8, padding: '6px 12px', borderRadius: 8, border: 0, background: 'var(--sck-accent)', color: '#fff', fontWeight: 700 }}
      >
        Dive ({DEMO_DEPTHS.map((d, i) => players[i] ? `${players[i]!.name} ${players[i]!.depth}` : '').filter(Boolean).join(' · ')})
      </button>
      <CreekScene players={players} variant="phone" highlightPlayerId="p0" showZoneLabels={false} />
    </div>
  );
}

/** Dev page: every art component at several sizes. Mount at /gallery. */
export function Gallery() {
  const spread = fakePlayers(20, true);
  const lobby = fakePlayers(20, false);
  return (
    <div
      style={{
        background: 'var(--sck-night)',
        color: 'var(--sck-text)',
        fontFamily: 'var(--sck-font-ui)',
        minHeight: '100vh',
      }}
    >
      <section style={section}>
        <h2 style={h}>Logo</h2>
        <div style={{ ...row, alignItems: 'center' }}>
          <div style={{ width: 440 }}>
            <Logo />
          </div>
          <div style={{ width: 96 }}>
            <Logo variant="mark" />
          </div>
        </div>
      </section>

      <section style={section}>
        <h2 style={h}>Avatars · 32 / 64 / 160</h2>
        {[32, 64, 160].map((sz) => (
          <div key={sz} style={{ ...row, marginBottom: 20 }}>
            {AVATARS.map((a) => (
              <div key={a.id} style={{ width: Math.max(sz, 56) }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Avatar id={a.id} size={sz} title={a.name} />
                </div>
                {sz === 64 ? <div style={cap}>{a.name}</div> : null}
              </div>
            ))}
          </div>
        ))}
      </section>

      <section style={section}>
        <h2 style={h}>Tier badges</h2>
        <div style={{ ...row, marginBottom: 20 }}>
          {TIER_ORDER.map((t: TierId) => (
            <div key={t} style={{ width: 110 }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <TierBadge tier={t} size="lg" />
              </div>
              <div style={cap}>{t} · static</div>
            </div>
          ))}
        </div>
        <div style={row}>
          {TIER_ORDER.map((t: TierId) => (
            <div key={t} style={{ width: 70 }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <TierBadge tier={t} size="md" animate />
              </div>
              <div style={cap}>animated</div>
            </div>
          ))}
          {TIER_ORDER.map((t: TierId) => (
            <TierBadge key={`sm-${t}`} tier={t} size="sm" />
          ))}
        </div>
      </section>

      <section style={section}>
        <h2 style={h}>Depth meter</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {[0, 60, 180, 340, 530, 700].map((d) => (
            <div key={d} style={{ maxWidth: 440 }}>
              <DepthMeter depth={d} label={`Depth ${d}`} />
            </div>
          ))}
        </div>
        <div style={{ ...row, marginTop: 24 }}>
          {[40, 250, 610].map((d) => (
            <div key={d} style={{ width: 96 }}>
              <DepthMeter depth={d} orientation="vertical" label="Sam" />
            </div>
          ))}
        </div>
      </section>

      <section style={section}>
        <h2 style={h}>Backdrops</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {ZONES.map((z) => (
            <div key={z.id} style={{ position: 'relative', height: 260, borderRadius: 16, overflow: 'hidden' }}>
              <Backdrop zone={z.id as ZoneId} phase="prompt" />
              <div style={{ position: 'relative', padding: 20 }}>
                <div style={{ fontFamily: 'var(--sck-font-display)', fontSize: 28 }}>{z.label}</div>
                <div style={{ color: 'var(--sck-text-dim)', maxWidth: 260 }}>{z.blurb}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={section}>
        <h2 style={h}>Creek scene</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 600px))', gap: 24, alignItems: 'start' }}>
          <div>
            <div style={cap}>host · 20 players spread · Sam highlighted</div>
            <CreekScene players={spread} variant="host" highlightPlayerId="p0" />
          </div>
          <div>
            <div style={cap}>results · everyone named</div>
            <CreekScene players={spread} variant="results" highlightPlayerId="p3" />
          </div>
          <div style={{ maxWidth: 360 }}>
            <div style={cap}>phone · lobby (everyone on the bridge)</div>
            <CreekScene players={lobby} variant="phone" highlightPlayerId="p5" />
            <div style={{ ...cap, marginTop: 24 }}>phone · spread</div>
            <CreekScene players={spread.slice(0, 12)} variant="phone" highlightPlayerId="p2" />
          </div>
          <div>
            <div style={cap}>motion check · click to dive</div>
            <MotionDemo />
          </div>
        </div>
      </section>
    </div>
  );
}
