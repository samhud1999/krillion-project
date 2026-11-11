/**
 * Projections of a Room for each kind of socket. The host sees everything;
 * players see the public state plus their own private bits. During 'prompt'
 * nobody sees anyone else's answer.
 */
import type {
  HostView,
  PlayerPublic,
  PlayerView,
  PromptSummary,
  RoomPublic,
  RoundPublic,
  RoundResultEntry,
} from '../shared/types.js';
import type { Room, RoundRecord } from './room.js';

export function roundToPublic(room: Room, round: RoundRecord): RoundPublic {
  const prompt = room.bank.getPrompt(round.promptId);
  const pub: RoundPublic = {
    index: round.index,
    promptId: round.promptId,
    prompt: { text: prompt?.text ?? round.promptId, type: prompt?.type ?? 'open' },
    startedAt: round.startedAt,
    endsAt: round.endsAt,
    submittedPlayerIds: [...round.submissions.keys()].filter((id) => room.players.has(id)),
  };
  if (round.closed && round.groups && round.results) {
    pub.groups = round.groups;
    pub.results = pickExisting(room, round.results);
    pub.validCount = round.validCount;
    if (round.numericAnswer) pub.numericAnswer = round.numericAnswer;
  }
  return pub;
}

function pickExisting(room: Room, results: Record<string, RoundResultEntry>): Record<string, RoundResultEntry> {
  const out: Record<string, RoundResultEntry> = {};
  for (const [pid, r] of Object.entries(results)) if (room.players.has(pid)) out[pid] = r;
  return out;
}

export function playersToPublic(room: Room): PlayerPublic[] {
  return [...room.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      connected: p.connected,
      depth: p.depth,
      lastTier: p.lastTier,
      lastPoints: p.lastPoints,
      joinedAt: p.joinedAt,
    }));
}

export function buildRoomPublic(room: Room, now: number): RoomPublic {
  const round = room.currentRound;
  return {
    code: room.code,
    phase: room.phase,
    config: room.config,
    players: playersToPublic(room),
    round: round ? roundToPublic(room, round) : undefined,
    roundCount: room.roundCount,
    hostConnected: room.hostConnected,
    serverNow: now,
    createdAt: room.createdAt,
    version: room.version,
  };
}

export function buildHostView(room: Room, prompts: PromptSummary[], joinUrl: string, now: number): HostView {
  return {
    ...buildRoomPublic(room, now),
    role: 'host',
    prompts,
    roundHistory: room.rounds.filter((r) => r.closed).map((r) => roundToPublic(room, r)),
    joinUrl,
  };
}

export function buildPlayerView(room: Room, playerId: string, now: number): PlayerView | undefined {
  const player = room.players.get(playerId);
  if (!player) return undefined;
  const round = room.currentRound;
  const history: RoundResultEntry[] = [];
  for (const r of room.rounds) {
    if (!r.closed || !r.results) continue;
    const mine = r.results[playerId];
    if (mine) history.push(mine);
  }
  return {
    ...buildRoomPublic(room, now),
    // Sam's special answers are the host's secret, and the prompt order is a
    // surprise: phones get neither (they only need roundCount).
    config: { ...room.config, specialAnswers: {}, promptIds: [] },
    role: 'player',
    me: {
      id: player.id,
      token: player.token,
      submission: round?.submissions.get(playerId)?.raw,
      result: round?.closed ? round.results?.[playerId] : undefined,
      history,
    },
  };
}
