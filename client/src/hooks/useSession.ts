import type { HostView, PlayerView } from '@shared/types';
import { useStore } from '../ws';
import type { Session } from '../session';

export function useSession(): Session | null {
  return useStore().session;
}

export function usePlayerView(): PlayerView | null {
  const v = useStore().view;
  return v && v.role === 'player' ? v : null;
}

export function useHostView(): HostView | null {
  const v = useStore().view;
  return v && v.role === 'host' ? v : null;
}
