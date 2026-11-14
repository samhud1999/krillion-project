/* eslint-disable no-console */
/**
 * End-to-end run against a real server with real browsers.
 *
 *   node scripts/e2e.cjs [baseUrl=http://localhost:8787] [outDir=docs/screenshots]
 *
 * The host screen creates a room in Chromium (1920×1080), one phone joins through
 * the UI (390×844), nineteen WebSocket bots join, and a full seven-prompt game is
 * played: lobby → prompts → reveals (with one moderation) → results → reload the
 * phone to prove it resumes → "Play again" back to the lobby. Screenshots of every
 * screen land in outDir. Exit code 1 on any page error or timeout.
 *
 * Needs Playwright with Chromium: `npm i -D playwright && npx playwright install chromium`
 * (not a dependency of the game itself).
 */
const path = require('node:path');
const fs = require('node:fs');
const WebSocket = require('ws');
const { chromium } = require('playwright');

const base = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '');
const OUT = path.resolve(process.argv[3] || 'docs/screenshots');
fs.mkdirSync(OUT, { recursive: true });
const wsUrl = base.replace(/^http/, 'ws') + '/ws';

const AVATARS = ['koala', 'kookaburra', 'echidna', 'wombat', 'platypus', 'wallaby', 'kingparrot', 'cockatoo', 'rosella', 'magpie', 'possum', 'bluetongue', 'crab', 'starfish', 'octopus', 'seal', 'penguin', 'pelican', 'hoodedplover', 'bluebottle'];
const NAMES = ['Sam', 'Jess', 'Tom', 'Bec', 'Liam', 'Georgie', 'Mick', 'Ella', 'Josh', 'Hannah', 'Dave', 'Grandma', 'Kate', 'Ned', 'Lou', 'Harry', 'Pip', 'Ollie', 'Maddie', 'Charlie'];

/** Realistic-ish crowd answers: a few common ones repeated, a tail of rarer picks, one dud. */
const ANSWERS = {
  's1-deadly-animal': ['snake', 'snake', 'snake', 'snake', 'crocodile', 'crocodile', 'crocodile', 'shark', 'shark', 'shark', 'box jellyfish', 'box jellyfish', 'funnel web spider', 'funnel-web', 'cassowary', 'blue ringed octopus', 'stonefish', 'dingo', 'magpie', 'drop bear'],
  's2-vic-country-town': ['Ballarat', 'Ballarat', 'Ballarat', 'Bendigo', 'Bendigo', 'Bendigo', 'Geelong', 'Geelong', 'Shepparton', 'Mildura', 'Warrnambool', 'Echuca', 'Horsham', 'Wangaratta', 'Bright', 'Colac', 'Daylesford', 'Castlemaine', 'Nhill', 'Omeo'],
  's3-aussie-biscuit': ['Tim Tam', 'Tim Tam', 'Tim Tam', 'Tim Tam', 'Tim Tam', 'Anzac', 'Anzac biscuit', 'Anzacs', 'Iced VoVo', 'Iced Vovo', 'Monte Carlo', 'Kingston', 'Kingston', 'Scotch Finger', 'Mint Slice', 'Shortbread Cream', 'Gaiety', 'Yo-Yo', 'Jatz', 'Teddy Bear'],
  's5-aussie-slang': ['arvo', 'arvo', 'arvo', 'servo', 'servo', 'bogan', 'bogan', 'mate', 'mate', 'sheila', 'brekkie', 'chockers', 'dunny', 'fair dinkum', 'maccas', 'esky', 'ute', 'thongs', 'snag', 'bottle-o'],
  's6-afl-player': ['Gary Ablett', 'Gary Ablett', 'Dustin Martin', 'Dustin Martin', 'Dusty', 'Buddy Franklin', 'Lance Franklin', 'Patrick Dangerfield', 'Scott Pendlebury', 'Joel Selwood', 'Marcus Bontempelli', 'Tony Lockett', 'Wayne Carey', 'Nick Riewoldt', 'Nat Fyfe', 'Max Gawn', 'Leigh Matthews', 'Jimmy Bartel', 'Polly Farmer', 'Chris Judd'],
  's7-melbourne-suburb': ['Richmond', 'Richmond', 'Richmond', 'Fitzroy', 'Fitzroy', 'St Kilda', 'St Kilda', 'Brunswick', 'Footscray', 'Hawthorn', 'Carlton', 'Collingwood', 'Werribee', 'Frankston', 'Dandenong', 'Toorak', 'Northcote', 'Yarraville', 'Montmorency', 'Altona'],
  's8-gor-town': ['Lorne', 'Lorne', 'Lorne', 'Lorne', 'Apollo Bay', 'Apollo Bay', 'Apollo Bay', 'Torquay', 'Torquay', 'Anglesea', 'Anglesea', 'Port Campbell', 'Wye River', 'Kennett River', 'Aireys Inlet', 'Separation Creek', 'Skenes Creek', 'Princetown', 'Peterborough', 'Fairhaven'],
  's9-servo-meat-pie': ['gravy', 'gravy', 'gravy', 'meat', 'meat', 'pastry', 'pastry', 'sauce', 'beef', 'mystery meat', 'onion', 'pepper', 'gristle', 'cheese', 'mushroom', 'peas', 'regret', 'steam', 'salt', 'carrot'],
  'l1-freshwater-creek-bakery': ['vanilla slice', 'vanilla slice', 'pie', 'pie', 'pie', 'sausage roll', 'sausage roll', 'lamington', 'cream bun', 'scone', 'custard tart', 'apple turnover', 'cream kiss', 'neenish tart', 'hedgehog', 'caramel slice', 'cinnamon scroll', 'jam doughnut', 'pasty', 'matchstick'],
};
const GENERIC = ['beach', 'coffee', 'sunscreen', 'esky', 'thongs', 'towel', 'hat', 'snacks', 'boardies', 'jumper', 'camera', 'book', 'speaker', 'pie', 'bait', 'ice', 'wine', 'beer', 'chips', 'sausages'];
const answerFor = (promptId, i) => (ANSWERS[promptId] || GENERIC)[i % 20];

/** Counted across all bots: answers the server bounced as not_in_bank (the duds in the lists above). */
let bounced = 0;
let retriesOk = 0;

function bot(code, i) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { origin: base } });
    const answered = new Set();
    let current = null; // {idx, promptId, retried}
    const timer = setTimeout(() => reject(new Error(`bot ${NAMES[i]} join timeout`)), 10_000);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'player:join', code, name: NAMES[i], avatar: AVATARS[i] })));
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.t === 'player:joined') {
        clearTimeout(timer);
        resolve(ws);
      }
      if (m.t === 'error' && m.code === 'not_in_bank' && current && !current.retried) {
        // Strict validation bounced the dud — retry once with a known-good answer,
        // exercising the keep-trying flow end to end.
        bounced += 1;
        current.retried = true;
        const fallback = answerFor(current.promptId, 2);
        ws.readyState === 1 && ws.send(JSON.stringify({ t: 'player:answer', roundIndex: current.idx, text: fallback }));
        retriesOk += 1;
      } else if (m.t === 'error' && m.code !== 'not_in_bank') {
        console.log('bot', NAMES[i], 'error', m.code, m.message);
      }
      if (m.t === 'state' && m.view.phase === 'prompt' && m.view.round && !answered.has(m.view.round.index)) {
        const idx = m.view.round.index;
        answered.add(idx);
        current = { idx, promptId: m.view.round.promptId, retried: false };
        const text = answerFor(m.view.round.promptId, i);
        setTimeout(() => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'player:answer', roundIndex: idx, text })), 400 + Math.random() * 3000);
      }
    });
    ws.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

const view = (p) => p.evaluate(() => (window.__sck ? window.__sck.state().view : null));
const waitPhase = (p, phase, timeout = 45_000) =>
  p.waitForFunction((ph) => {
    const v = window.__sck && window.__sck.state().view;
    return !!v && v.phase === ph;
  }, phase, { timeout });
const shot = (p, name, opts = {}) => p.screenshot({ path: path.join(OUT, `${name}.png`), ...opts });

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch();
  const errors = [];
  const hook = (p, name) => {
    p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    p.on('console', (m) => {
      if (m.type() === 'error') errors.push(`${name}: console ${m.text()}`);
    });
  };

  // --- host creates the room ---------------------------------------------
  const host = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const hp = await host.newPage();
  hook(hp, 'host');
  await hp.goto(`${base}/host`, { waitUntil: 'networkidle' });
  const create = hp.getByRole('button', { name: 'Create a room' });
  if (await create.count()) await create.click();
  await hp.waitForFunction(() => {
    const v = window.__sck && window.__sck.state().view;
    return !!v && v.role === 'host';
  }, null, { timeout: 15_000 });
  const code = (await view(hp)).code;
  const available = (await view(hp)).prompts.map((p) => p.id);
  const want = ['s1-deadly-animal', 's2-vic-country-town', 's3-aussie-biscuit', 's5-aussie-slang', 's6-afl-player', 's7-melbourne-suburb', 's8-gor-town', 's9-servo-meat-pie', 'l1-freshwater-creek-bakery']
    .filter((id) => available.includes(id))
    .slice(0, 7);
  await hp.evaluate(
    (ids) => window.__sck.send({ t: 'host:config', patch: { promptIds: ids, title: 'Sep Creek 2026', secondsPerPrompt: 15 } }),
    want,
  );
  console.log(`room ${code} · prompts: ${want.join(', ')}`);

  // --- one real phone joins through the UI ---------------------------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pp = await phone.newPage();
  hook(pp, 'phone');
  await pp.goto(`${base}/join/${code}`, { waitUntil: 'networkidle' });
  await pp.evaluate(() => document.fonts.ready);
  await pp.waitForTimeout(400);
  await pp.fill('#f-your-name', 'Sam');
  await pp.getByRole('button', { name: 'Koala' }).click();
  await shot(pp, 'phone-join');
  await pp.getByRole('button', { name: 'Dive in' }).click();
  await pp.waitForFunction(() => {
    const v = window.__sck && window.__sck.state().view;
    return !!v && v.role === 'player';
  }, null, { timeout: 15_000 });
  await pp.waitForTimeout(600);
  await shot(pp, 'phone-lobby');

  // --- nineteen bots ---------------------------------------------------------
  const bots = [];
  for (let i = 1; i < 20; i++) bots.push(await bot(code, i));
  await hp.waitForFunction(() => window.__sck.state().view.players.length === 20, null, { timeout: 15_000 });
  await hp.waitForTimeout(900);
  await shot(hp, 'host-lobby');
  await hp.keyboard.press('Escape');
  await hp.waitForTimeout(700);
  await shot(hp, 'host-setup');
  await hp.keyboard.press('Escape');
  await hp.waitForTimeout(400);

  // --- the dive --------------------------------------------------------------
  await hp.keyboard.press('s');
  for (let round = 0; round < want.length; round++) {
    await waitPhase(hp, 'prompt');
    const promptId = (await view(hp)).round.promptId;
    await pp.waitForSelector('#answer', { timeout: 10_000 });
    if (round === 0) {
      // The phone fumbles first: a made-up answer must bounce ("not on our
      // list"), unlock, and let the player try again.
      await pp.fill('#answer', 'xyzzy blurp');
      await pp.getByRole('button', { name: 'Lock it in' }).click();
      await pp.waitForSelector('[role="alert"]', { timeout: 10_000 });
      await shot(pp, 'phone-bounced');
      await pp.fill('#answer', answerFor(promptId, 0));
    } else {
      await pp.fill('#answer', answerFor(promptId, 0));
    }
    if (round === 0) {
      await hp.waitForTimeout(1200);
      await shot(hp, 'host-prompt');
      await shot(pp, 'phone-prompt');
    }
    await pp.getByRole('button', { name: 'Lock it in' }).click();
    if (round === 0) {
      await pp.waitForTimeout(600);
      await shot(pp, 'phone-prompt-locked');
    }
    await waitPhase(hp, 'reveal');
    await hp.waitForTimeout(2400);
    if (round === 0) {
      await shot(hp, 'host-reveal');
      await shot(pp, 'phone-reveal', { fullPage: true });
      const reject = hp.getByRole('button', { name: /^Reject/ }).first();
      if (await reject.count()) {
        await reject.click();
        await hp.waitForTimeout(900);
        await shot(hp, 'host-reveal-moderated');
      }
      // the host judges an answer: pin the top row to One in a Krillion
      const judge = hp.getByRole('button', { name: /^Judge/ }).first();
      if (await judge.count()) {
        await judge.click();
        await hp.getByRole('button', { name: /as One in a Krillion, 100 metres$/ }).first().click();
        await hp.waitForTimeout(800);
        if (!(await hp.getByText("host's call").count())) errors.push('host: judge override did not apply');
        await shot(hp, 'host-reveal-judged');
      } else {
        errors.push('host: no Judge button on the reveal');
      }
    }
    if (round === 2) await shot(hp, 'host-reveal-round-3');
    console.log(`round ${round + 1}/${want.length} · ${promptId} · ${Math.round((Date.now() - t0) / 1000)}s`);
    await hp.keyboard.press(' ');
  }
  await waitPhase(hp, 'results');
  await hp.waitForTimeout(2600);
  await shot(hp, 'host-results');
  await pp.waitForTimeout(500);
  await shot(pp, 'phone-results', { fullPage: true });

  // 720p TV check of the results screen
  await hp.setViewportSize({ width: 1280, height: 720 });
  await hp.waitForTimeout(800);
  await shot(hp, 'host-results-720p');
  await hp.setViewportSize({ width: 1920, height: 1080 });

  // --- resilience ------------------------------------------------------------
  await pp.reload({ waitUntil: 'networkidle' });
  await waitPhase(pp, 'results', 15_000);
  console.log('phone resumed after reload: ok');
  await hp.getByRole('button', { name: 'Play again' }).click();
  await waitPhase(hp, 'lobby');
  await waitPhase(pp, 'lobby');
  console.log('play again → lobby: ok');

  for (const b of bots) b.close();
  await browser.close();
  console.log(`strict validation: ${bounced} dud answer(s) bounced, ${retriesOk} retried fine`);
  if (bounced === 0) {
    console.log('EXPECTED at least one not_in_bank bounce (the dud answers in the bot lists)');
    process.exitCode = 1;
  }
  console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s · screenshots in ${OUT}`);
  if (errors.length) {
    console.log('PAGE ERRORS:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('no page errors');
  }
})().catch((e) => {
  console.error('E2E FAILED', e);
  process.exit(1);
});
