import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  query: URLSearchParams;
}

const listeners = new Set<() => void>();

function read(): Route {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  return { path, query: new URLSearchParams(location.search) };
}

let current: Route = read();

function emit() {
  current = read();
  listeners.forEach((l) => l());
}

window.addEventListener('popstate', emit);

export function navigate(to: string, opts?: { replace?: boolean }) {
  if (opts?.replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

/** Room code prefill from /join/ABCD or ?code=ABCD */
export function codeFromRoute(r: Route): string | null {
  const m = r.path.match(/^\/join\/([A-Za-z0-9]{3,8})$/);
  if (m?.[1]) return m[1].toUpperCase();
  const q = r.query.get('code');
  if (q && /^[A-Za-z0-9]{3,8}$/.test(q)) return q.toUpperCase();
  return null;
}
