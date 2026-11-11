# Live leaderboard · obvious-answer scoring · Almost-Pixel retro restyle

**Date:** 2026-11-11 · **Status:** implemented same-day (user approved direction and asked to skip remaining gates)

Three features for Separation Creek Krillion, decided through brainstorming with
visual mockups (choices recorded below).

## Decisions

| Question | Choice |
|---|---|
| How should obvious answers score low? | **Dedicated `obvious` flag**: flagged bank entries always score a puddle (10 m), regardless of count. Rejected alternatives: tier-caps-unique-score (changes balance game-wide), both. |
| Where does the live leaderboard live? | **Host TV only**, as a third column on the reveal screen. Phones keep their personal reveal. (User constraint: app is mobile-first for players; only the host area is landscape.) |
| Retro art direction | **B — "Almost-Pixel" vector** (user picked from 3 visual mockups): 16-bit *language* — stair-stepped band edges, sparse dither, notched-corner panels, chunky borders, pixel display font for headings/scores — rendered as crisp vector. Not a full 8-bit conversion (A), not HUD-chrome-only (C). |
| Descent cinematic placement | **Phone, every reveal** (recommended default; user deferred). Camera-follow of your own avatar, duration scaled to metres gained, gold burst + krill escort on a Krillion. TV keeps the overview + leaderboard. |

## 1. Obvious-answer scoring

- `BankAnswer.obvious?: boolean` (shared/types.ts), accepted by the zod schema
  (server/bank.ts) and carried through `buildMatcher` → `AnswerGroup.obvious`
  (shared/scoring.ts).
- `tierForRarity`: `special` → krillion still wins first; then `obvious` →
  `puddle`, before all rarity rules. Host **Reject** still zeroes the group.
- Data: Lorne, Wye River, Separation Creek and Kennett River flagged in
  `s2-vic-country-town` and `s8-gor-town` (Kennett River added after the
  adversarial review showed the exploit just moves one town south; `sepo` and
  `seppo` aliases added so nicknames can't dodge the pin). Grey River stays a
  genuine deep cut. The draft `l11-gor-car-window` prompt is left alone:
  spotting the Separation Creek *sign* out the window is a fair answer.
- `bankAnswerSchema` is `.strict()` so a typo'd flag (`"obvoius"`) fails
  `bank:check` loudly instead of being silently stripped.
- Reveal UI: bank groups with the flag show a **too obvious** tag (GroupRow).
- Tests: tierForRarity pinning (incl. special-beats-obvious), scoreOpenRound
  group flagging with a fixture entry.

## 2. Live leaderboard (host reveal)

- New `client/src/components/Leaderboard.tsx`: `rankPlayers` over the same
  (rewound-then-settled) players array the creek uses, so the rows reorder in
  sync with the avatars dropping. `motion.li layout` handles the slide.
- Gains (`+N` chip coloured by `lastTier`) appear only once the reveal settles.
- HostReveal grid becomes `creek | answers | leaderboard(13–15 rem)` at `lg+`;
  hidden below `lg` (TVs always qualify). Short screens cap at 10 rows.

## 3. Almost-Pixel restyle + descent cinematic

Foundation (applies everywhere):
- Pixelify Sans (variable, self-hosted via @fontsource) as `--font-pixel` /
  `--sck-font-pixel`. The `.display` utility now points at it; the Fraunces
  serif remains as `.serif-display` (Logo wordmark untouched).
- `.notch` / `.notch-sm` clip-path utilities: square-notched "pixel corner"
  panels; Card, GroupRow, HostReveal panels, PlayerReveal cards use them.
- Buttons: chunky bevel (2px border + 4px bottom edge, presses down on
  :active), pixel labels.
- Avatar badge and TierBadge frames: notched squares instead of circles
  (same 100×100 footprint, no caller changes).
- CreekScene water: the smooth gradient replaced by flat zone bands with
  stair-stepped edges (`steppedBandPath`) + sparse dither squares; label pills
  squared; zone/name labels in the pixel font. Scenery (ferns, anemones,
  kelp, bridge) stays smooth vector — that is the "almost".
- Host cue: `PRESS SPACE ▶ NEXT` in pixel type on the reveal header.

Descent cinematic (`client/src/art/DescentScene.tsx`, exported via artApi):
- A viewport div with a tall world SVG (3 SVG units per metre, 0–700 m).
  The world translates so the camera follows *your* avatar (fixed centre
  overlay, slight tilt + bubble trail while moving) from `depthBefore` to
  `depthAfter`; CSS transition, duration `0.9s + 0.022s/m` capped at 3.2 s.
- World contents: bridge + stars above the waterline, stepped zone bands,
  dither, zone-name pills, anemone ledges, sand bars, kelp, glow specks,
  sea floor — and every other player parked at their settled depth, so you
  float past the room.
- HUD depth ticker (`▼ Nm`, rAF easeInOutCubic) matches the scroll.
- Krillion: gold pulse ring on arrival + a pixel-krill escort swarm near the
  landing depth.
- Tap to skip; `prefers-reduced-motion` renders the end state immediately
  (the global reduced-motion kill-switch also zeroes the CSS transition).
- PlayerReveal swaps its static phone CreekScene for DescentScene;
  PlayerResults keeps CreekScene (full-game overview is the right picture
  there).

## Verification

- 63 → 65+ vitest tests pass; both tsconfigs typecheck; vite + tsc build.
- `scripts/e2e.cjs` full 7-round 20-player browser game: no page errors;
  screenshots regenerated in docs/screenshots (leaderboard, pixel chrome,
  stepped bands, descent viewport all visible).
- Real-bank spot check: on `s8-gor-town`, lone `wye river`, `sepo`,
  `separation creek`, `Lorne` → **puddle 10 m, OBVIOUS**; `Big Hill` →
  krillion; `Apollo Bay` → deepcut (unchanged).

## Out of scope / later

- TV-takeover camera for Krillion moments (option B of the descent question).
- Pixelising the Backdrop ambience layers and the 20 animal illustrations.
- Flagging further "home turf" answers (e.g. Cumberland River) — add
  `"obvious": true` in the bank JSON as needed.
