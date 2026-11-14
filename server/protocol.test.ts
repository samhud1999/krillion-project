import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './protocol.js';

describe('parseClientMessage', () => {
  it('accepts every message type', () => {
    const cases = [
      { t: 'host:create' },
      { t: 'host:create', config: { secondsPerPrompt: 25, promptIds: ['a'] }, pin: '1234' },
      { t: 'host:resume', code: 'abcd', hostToken: 'x'.repeat(16) },
      { t: 'host:config', patch: { title: 'Sep Creek' } },
      { t: 'host:start' },
      { t: 'host:end_round' },
      { t: 'host:next' },
      { t: 'host:moderate', roundIndex: 0, key: 'free:weet bix', accepted: false },
      { t: 'host:override', roundIndex: 0, key: 'bank:mint slice', tier: 'krillion' },
      { t: 'host:override', roundIndex: 0, key: 'bank:mint slice', tier: null },
      { t: 'host:kick', playerId: 'p1' },
      { t: 'host:restart' },
      { t: 'player:join', code: 'ABCD', name: 'Sam', avatar: 'koala' },
      { t: 'player:resume', code: 'ABCD', token: 'y'.repeat(36) },
      { t: 'player:answer', roundIndex: 3, text: 'Tim Tam' },
      { t: 'ping', sentAt: 123 },
    ];
    for (const c of cases) {
      const r = parseClientMessage(JSON.stringify(c));
      expect(r.ok, JSON.stringify(c)).toBe(true);
    }
  });

  it('uppercases room codes', () => {
    const r = parseClientMessage(JSON.stringify({ t: 'player:join', code: 'abcd', name: 'Sam', avatar: 'koala' }));
    expect(r.ok && r.msg.t === 'player:join' && r.msg.code).toBe('ABCD');
  });

  it('rejects garbage without throwing', () => {
    expect(parseClientMessage('not json').ok).toBe(false);
    expect(parseClientMessage('{}').ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ t: 'nope' })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ t: 'player:join', code: 'ABC', name: 'Sam', avatar: 'koala' })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ t: 'player:join', code: 'ABCD', name: '', avatar: 'koala' })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ t: 'player:join', code: 'ABCD', name: 'Sam', avatar: 'dragon' })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ t: 'host:config', patch: { secondsPerPrompt: 999 } })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ t: 'host:config', patch: { bogus: 1 } })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ t: 'player:answer', roundIndex: -1, text: 'x' })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify({ t: 'host:override', roundIndex: 0, key: 'k', tier: 'legendary' })).ok).toBe(false);
    expect(parseClientMessage(Buffer.from(JSON.stringify({ t: 'ping', sentAt: 1 }))).ok).toBe(true);
    expect(parseClientMessage(12 as unknown as string).ok).toBe(false);
    expect(parseClientMessage('x'.repeat(10_000)).ok).toBe(false);
  });
});
