import type { AvatarId } from '@shared/types';

export type Session =
  | { role: 'player'; code: string; playerId: string; token: string; name: string; avatar: AvatarId }
  | { role: 'host'; code: string; hostToken: string };

const KEY = 'sck.session.v1';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session> | null;
    if (!s || typeof s !== 'object' || typeof s.code !== 'string') return null;
    if (s.role === 'player' && typeof (s as { token?: unknown }).token === 'string') return s as Session;
    if (s.role === 'host' && typeof (s as { hostToken?: unknown }).hostToken === 'string') return s as Session;
    return null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota — the game still works for this tab */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
