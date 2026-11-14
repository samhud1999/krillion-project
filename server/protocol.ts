/**
 * Runtime validation of everything a socket can send us. Mirrors
 * `ClientMessage` in shared/types.ts, plus the server-only `pin` field on
 * host:create (used when HOST_PIN is configured).
 */
import { z } from 'zod';
import type { AvatarId, TierId } from '../shared/types.js';
import { LIMITS, MAX_ROUNDS } from '../shared/types.js';
import { AVATAR_IDS, TIER_ORDER } from '../shared/theme.js';

export const avatarIdSchema = z.enum(AVATAR_IDS as [AvatarId, ...AvatarId[]]);
export const tierIdSchema = z.enum(TIER_ORDER as [TierId, ...TierId[]]);

const roomCode = z
  .string()
  .trim()
  .min(4)
  .max(4)
  .transform((s) => s.toUpperCase());

const token = z.string().min(8).max(128);

export const configPatchSchema = z
  .object({
    promptIds: z.array(z.string().min(1).max(64)).min(1).max(MAX_ROUNDS).optional(),
    secondsPerPrompt: z.number().int().min(LIMITS.minSecondsPerPrompt).max(LIMITS.maxSecondsPerPrompt).optional(),
    endEarlyWhenAllAnswered: z.boolean().optional(),
    specialAnswers: z.record(z.string().max(64), z.array(z.string().max(80)).max(20)).optional(),
    title: z.string().max(40).optional(),
  })
  .strict();

export const clientMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('host:create'), config: configPatchSchema.optional(), pin: z.string().max(64).optional() }),
  z.object({ t: z.literal('host:resume'), code: roomCode, hostToken: token }),
  z.object({ t: z.literal('host:config'), patch: configPatchSchema }),
  z.object({ t: z.literal('host:start') }),
  z.object({ t: z.literal('host:end_round') }),
  z.object({ t: z.literal('host:next') }),
  z.object({
    t: z.literal('host:moderate'),
    roundIndex: z.number().int().min(0).max(MAX_ROUNDS - 1),
    key: z.string().min(1).max(200),
    accepted: z.boolean(),
  }),
  z.object({
    t: z.literal('host:override'),
    roundIndex: z.number().int().min(0).max(MAX_ROUNDS - 1),
    key: z.string().min(1).max(200),
    tier: tierIdSchema.nullable(),
  }),
  z.object({ t: z.literal('host:kick'), playerId: z.string().min(1).max(64) }),
  z.object({ t: z.literal('host:restart') }),
  z.object({
    t: z.literal('player:join'),
    code: roomCode,
    name: z.string().trim().min(1).max(LIMITS.maxNameLength),
    avatar: avatarIdSchema,
  }),
  z.object({ t: z.literal('player:resume'), code: roomCode, token }),
  z.object({
    t: z.literal('player:answer'),
    roundIndex: z.number().int().min(0).max(MAX_ROUNDS - 1),
    text: z.string().max(LIMITS.maxAnswerLength * 2),
  }),
  z.object({ t: z.literal('ping'), sentAt: z.number() }),
]);

export type ParsedClientMessage = z.infer<typeof clientMessageSchema>;

export type ParseOutcome = { ok: true; msg: ParsedClientMessage } | { ok: false; error: string };

/** Parses raw socket data (string/Buffer) into a validated client message. */
export function parseClientMessage(raw: unknown): ParseOutcome {
  let text: string;
  if (typeof raw === 'string') text = raw;
  else if (raw instanceof Buffer) text = raw.toString('utf8');
  else if (Array.isArray(raw)) text = Buffer.concat(raw as Buffer[]).toString('utf8');
  else if (raw instanceof ArrayBuffer) text = Buffer.from(raw).toString('utf8');
  else return { ok: false, error: 'unsupported frame' };

  if (text.length > 8_192) return { ok: false, error: 'message too large' };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  const result = clientMessageSchema.safeParse(json);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path?.length ? ` at ${first.path.join('.')}` : '';
    return { ok: false, error: `${first?.message ?? 'invalid message'}${where}` };
  }
  return { ok: true, msg: result.data };
}
