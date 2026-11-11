/** Tiny leveled logger: one line per event, optional JSON context. */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let current: LogLevel = 'info';

function emit(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
  if (ORDER[level] < ORDER[current]) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${msg}`;
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (data && Object.keys(data).length > 0) {
    out.write(`${line} ${safeJson(data)}\n`);
  } else {
    out.write(`${line}\n`);
  }
}

function safeJson(data: unknown): string {
  try {
    return JSON.stringify(data, (_k, v) => (v instanceof Error ? { message: v.message, stack: v.stack } : v));
  } catch {
    return '[unserialisable]';
  }
}

export const log = {
  setLevel(level: string | undefined): void {
    if (level && level in ORDER) current = level as LogLevel;
  },
  level(): LogLevel {
    return current;
  },
  debug: (msg: string, data?: Record<string, unknown>) => emit('debug', msg, data),
  info: (msg: string, data?: Record<string, unknown>) => emit('info', msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => emit('warn', msg, data),
  error: (msg: string, data?: Record<string, unknown>) => emit('error', msg, data),
};
