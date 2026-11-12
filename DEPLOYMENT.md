# Running Separation Creek Krillion for 20 people

This guide gets the game running for a room of about 20 players, with the host screen on a TV and everyone else on their phones. Pick one of two setups:

| | Option A: laptop on the house Wi-Fi | Option B: cloud (Railway) |
|---|---|---|
| Internet needed | No. Phones only need the house Wi-Fi | Yes, for every phone |
| Cost | Free | Railway Hobby plan, roughly US$5 a month, cancel after the weekend |
| Setup time | 15 minutes | 20 minutes |
| Best for | A holiday house with patchy mobile reception | Playing from different places, or a house with good internet and a flaky router |
| Database | Optional | Included (one click) |

Twenty players is a light load for either. The server holds one small state object per room and pushes a few kilobytes to each phone after every answer. A single instance on the smallest plan, or a 2019 laptop, has headroom for several rooms at once. The one rule: run **exactly one** server instance. Game state lives in that process, so two instances behind a load balancer would split the room.

A database is optional in both setups. Without one, the game runs entirely in memory, which is fine for one night: a server restart ends the game in progress, and that is all. With Postgres connected, every answer is stored, in-progress rooms survive a restart, and you keep the results.

---

## Before game night: what you need

- The code: this repository, folder `games/separation-creek-krillion`.
- A laptop with an HDMI cable (or AirPlay/Chromecast) to put the host screen on the TV.
- For Option A: [Docker Desktop](https://www.docker.com/products/docker-desktop/) **or** [Node.js 22](https://nodejs.org/) on that laptop.
- For Option B: a free [GitHub](https://github.com) account with this repository pushed to it, and a [Railway](https://railway.com) account.
- About 20 phones on the same Wi-Fi (Option A) or with mobile data (Option B).

> **Hotspots do not work for 20 people.** An iPhone personal hotspot allows about 5 devices and Android about 10. Use the house Wi-Fi or a travel router for Option A. If the house has no Wi-Fi, use Option B over mobile data.

---

## Option A: laptop on the house Wi-Fi

Everything runs on one laptop. Phones open the laptop's address in their browser.

### A1. Get the code onto the laptop

```bash
git clone https://github.com/Samhud99/DriveHub.git
cd DriveHub/games/separation-creek-krillion
```

(Or download the repository as a ZIP from GitHub and unzip it.)

### A2. Start it

**With Docker Desktop (recommended, includes the database):**

1. Open Docker Desktop and wait until it says "Engine running".
2. In a terminal, in the game folder:

   ```bash
   docker compose up --build
   ```

   The first build takes two or three minutes. When the log shows a line beginning `listening {"url":"http://localhost:8787"` the game is up. The database runs alongside it and migrations are applied automatically. Results are kept in a Docker volume (`krillion_pgdata`, which Docker lists as `separation-creek-krillion_krillion_pgdata`) between restarts.

3. Stop it later with `Ctrl+C`, or `docker compose down` from another terminal (`docker compose down -v` also deletes the stored results).

**With Node.js only (no database, no Docker):**

```bash
npm install
npm run build
npm start
```

The server prints a log line beginning `listening {"url":"http://localhost:8787"`.

### A3. Find the laptop's address

Players need the laptop's IP address on the Wi-Fi.

- **macOS:** System Settings, Wi-Fi, click Details next to the network. The IP address is listed, for example `192.168.1.42`.
- **Windows:** open a terminal and run `ipconfig`; use the IPv4 Address under your Wi-Fi adapter.
- **Linux:** `hostname -I`.

The join address and the QR code are built from the address the host screen itself was opened at. So always open the host screen using the laptop's IP address, never `localhost` (that would put `localhost` in the QR code and no phone could follow it). To pin the address regardless, create a `.env` file in the game folder before starting:

```
PUBLIC_URL=http://192.168.1.42:8787
```

(Docker Compose forwards `PUBLIC_URL`, `HOST_PIN` and `LOG_LEVEL` from `.env`; the other settings are fixed inside the container.)

### A4. Open the host screen on the TV

On the laptop, open `http://192.168.1.42:8787/host` (your IP from A3) in Chrome or Safari, press F11 (macOS: `Ctrl+Cmd+F`) for full screen, and mirror or extend the display to the TV. The room code and a QR code appear. Check that the address printed under the QR code is the IP address, not `localhost`.

### A5. Let a phone in

On one phone, scan the QR code (or type `http://192.168.1.42:8787` and the four-letter code). If the page loads, you are done. If it does not:

- Make sure the phone is on the **same Wi-Fi network** as the laptop, not mobile data. Many phones prefer mobile data when Wi-Fi has no internet; turn mobile data off for the night, or tell the phone to stay on Wi-Fi.
- Some routers have a "guest network" or "client isolation" setting that stops devices talking to each other. Join the main network instead, or turn client isolation off in the router settings.
- macOS and Windows firewalls may ask whether to allow Node or Docker to accept incoming connections. Click Allow. On Windows, if you missed the prompt: Settings, Privacy & security, Windows Security, Firewall, Allow an app through firewall, tick Node.js (or Docker Desktop) for Private networks.

### A6. Optional: keep results in a database without Docker

If you run with Node directly but still want results stored, install [Postgres.app](https://postgresapp.com/) (macOS) or [PostgreSQL](https://www.postgresql.org/download/windows/) (Windows), create a database called `krillion`, and set in `.env`:

```
DATABASE_URL=postgres://postgres:yourpassword@localhost:5432/krillion
```

The server runs its migrations on start.

---

## Option B: cloud on Railway

Railway builds the app from this repository, gives it a public `https://` address, supports WebSockets out of the box, and offers Postgres in the same project. Players use mobile data or any Wi-Fi.

### B1. Push the repository to GitHub

Railway deploys from GitHub. This repository is self-contained: the app, its `Dockerfile`, and `railway.json` all live at the repository root. Just make sure the branch you want is pushed.

### B2. Create the project

1. Sign in at [railway.com](https://railway.com) and click **New Project**.
2. Choose **Deploy from GitHub repo**, authorise Railway for this repository (`krillion-project`) and select it.
3. Railway creates a service and reads `railway.json`, so the **Builder is already set to Dockerfile** and a **healthcheck on `/healthz`** is configured — there is nothing to change on the Settings → Build screen. (No Root Directory is needed; the app is at the repository root.)
4. In Settings, under **Networking**, click **Generate Domain**. Railway gives you something like `krillion-project-production.up.railway.app`. When asked for a port, enter `8787`.

> **Keep it to one instance.** `railway.json` sets `numReplicas: 1`. The game holds each room's live state in memory for one process, so running two or more replicas would scatter players across instances that cannot see each other. Do not raise the replica count.

### B3. Add the database (one click)

1. In the project canvas, click **+ New**, choose **Database**, then **Add PostgreSQL**.
2. Open the game service, go to **Variables**, click **+ New Variable**, and add a **Reference**: pick the Postgres service's `DATABASE_URL`. Railway fills in `${{Postgres.DATABASE_URL}}`.

Migrations run automatically on the first start.

### B4. Set the remaining variables

In the same Variables tab add:

| Variable | Value |
|---|---|
| `PUBLIC_URL` | `https://<your-generated-domain>` (no trailing slash) |
| `HOST_PIN` | a PIN of six or more characters, for example `creek-2026`. Anyone who finds the URL can play, but only someone with the PIN can create a room. Set it before you share the link: five wrong guesses lock an address out for a minute, but a longer PIN is still the real protection |
| `PORT` | `8787` |

Railway redeploys after variable changes. Watch the **Deployments** tab until it shows Active, then open `https://<your-domain>/healthz`; it returns `{"ok":true,...}`.

### B5. Open the host screen

Go to `https://<your-domain>/host`, enter the PIN, and you have a room. Everything else is the same as Option A.

### B6. After the weekend

Delete the project in Railway (Project Settings, Danger, Delete Project) or at least remove the Postgres service, so nothing keeps billing. If you want to keep the results, export them first:

```bash
# from your laptop, with the Railway CLI installed and linked to the project
railway connect Postgres
\copy (select * from submissions order by created_at) to 'answers.csv' csv header
```

### Alternatives to Railway

- **Render** (render.com): New, Web Service, connect the repo (no Root Directory needed — the app is at the root), Runtime Docker, instance type Starter (the free tier sleeps after 15 minutes idle and would end a game). Add a Render Postgres instance and paste its Internal Database URL as `DATABASE_URL`. Set `PUBLIC_URL` to the `onrender.com` address.
- **Fly.io**: `fly launch` at the repository root detects the Dockerfile; set `fly secrets set PUBLIC_URL=... HOST_PIN=...`; add Postgres with `fly postgres create` and `fly postgres attach`. Keep it to one machine (`fly scale count 1`).
- **Neon or Supabase** for the database with any host: create a project, copy the pooled connection string, and use it as `DATABASE_URL`. Both require SSL. Neon's string already ends in `?sslmode=require`; for Supabase append it yourself. The server also honours `PGSSL=require|no-verify|disable` and `PGSSL_CA=<path to a CA file>` when a provider needs something different. On the first connection the `pg` driver prints a multi-line "SECURITY WARNING" about `sslmode=require`; it is informational, not an error. PostgreSQL 14, 15 and 16 all work.

Any provider works as long as it runs one long-lived Node or Docker process and passes WebSocket upgrades through. Static-only hosts (GitHub Pages, Netlify static, Vercel without a server) cannot run the game server.

---

## Game night runbook

**The day before**

1. Start the server the way you will on the night and play a one-person test round from your phone.
2. On the host screen, open **Setup** (press Esc in the lobby) and:
   - choose the seven prompts (the nine starters are approved; the local-flavour and closest-to-the-pin prompts are drafts you can switch on);
   - set the timer (20 seconds is the default; 25 is kinder after a few drinks);
   - add any **special answers** per prompt, comma separated. These score One in a Krillion no matter how many people say them. The cream kiss at Freshwater Creek Bakery is already in.
3. Run `npm run simulate -- ws://localhost:8787/ws 20` from the game folder to watch 20 bots play a full game and confirm the laptop and TV cope with the animation. If you set `HOST_PIN`, add `--pin=<your pin>`. Note that a one-person test round can never show One in a Krillion for a deep cut: that tier needs at least four answers in the round (special answers always qualify).

**On the night**

1. Start the server, open `/host` full screen on the TV.
2. Get everyone to join while people arrive. Names must be unique. There are 20 animals and each can be picked once; if all 20 are taken, latecomers can double up, to a room cap of 24.
3. Press **Start**. During a prompt the TV shows who has locked in. Press **E** to end a prompt early.
4. Answers that are not in the curated bank can no longer be locked in at all — the phone bounces them ("not on our list") and the player keeps trying until the timer runs out. So the reveal only ever shows recognised answers. If something slipped through that is wrong in context, the moderation controls still let you knock a row back to zero.
5. **Space** or **Enter** moves to the next prompt. After the seventh, the results screen shows the podium, the full leaderboard and everyone's position on the creek.
6. **Play again** keeps the same players and resets depths. Change the prompt set in Setup first if you want different questions.

**If something drops out**

- A phone that loses Wi-Fi reconnects on its own and lands back in the right place; their locked-in answer is kept. If they close the browser, reopening the same address resumes their seat (the seat is remembered on that phone). If the phone dies entirely, the player still appears in results with what they scored so far.
- If the host laptop closes the tab, reopen `/host`: the room resumes. With a database connected, even a server restart keeps the room (rooms touched in the last 12 hours that had not reached results are restored).
- If the TV mirroring drops, the room keeps running; just reopen `/host`.
- Rooms are tidied up on their own: an empty lobby nobody is connected to is forgotten after 10 minutes, a finished game after 2 hours, and any room with no connections after 6 hours.

---

## Capacity and limits

| | Value |
|---|---|
| Players per room | 24 (set by `maxPlayersPerRoom` in `shared/types.ts`) |
| Rooms per server | Up to 50 at once (`MAX_LIVE_ROOMS` in `server/rooms.ts`), and at most 5 new rooms per address every 10 minutes. A room's state is tens of kilobytes |
| Bandwidth per player | Under 10 KB per state update, roughly 30 updates a game, so well under 1 MB per phone per game |
| Server | One Node process. 512 MB RAM is plenty |
| Database | Tiny: a 20-player game writes about 140 answer rows |

Message rate limiting (20 messages a second per socket) and input limits (16-character names, 60-character answers) are enforced server-side.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Phones cannot open the laptop address | Same Wi-Fi? Mobile data off? Firewall allowed Node/Docker? Router client isolation off? Try `http://<ip>:8787/healthz` first |
| QR code points to `localhost` or the wrong address | Open the host screen via the laptop's IP address, or set `PUBLIC_URL` in `.env` and restart |
| Host screen or phones sit on "Still connecting" | The WebSocket origin check refused them (server log shows `rejected origin`). Behind a proxy or custom domain, set `PUBLIC_URL` to the address people type. If you set `ALLOWED_ORIGINS`, it must include that address too |
| Uptime monitor says everything is fine but the game is not | Any page path returns the app shell, so point monitors at `/healthz` |
| "Game already started" when joining | The host must press Play again (results) or restart the room; players can only join in the lobby |
| Timer looks out of sync on one phone | Clock drift is corrected from the server every few seconds; a frozen tab in the background may lag until it comes forward |
| Host screen says "Reconnecting" | The server restarted. Without a database the room is gone: create a new one. With a database it resumes within a few seconds |
| Railway deploy fails at build | `railway.json` already pins the Builder to Dockerfile; if a build still fails, confirm the service is this repo's root and the branch is pushed |
| `/healthz` returns 502 on Railway | The service port must be 8787; check the Networking setting and the `PORT` variable. Railway's own healthcheck already targets `/healthz` via `railway.json` |
| Postgres connection refused on a hosted DB | Use the pooled/external URL with `sslmode=require`; for Railway use the `DATABASE_URL` reference variable, not the public proxy URL |
| A clearly right answer keeps bouncing ("not on our list") | The bank cannot hold everything. Add it (with aliases) to `server/data/bank/<prompt>.json` and restart; or, on the night, add it as a host **special answer** in Setup — specials are always accepted |

---

## Updating prompts and answers

Every prompt is a JSON file in `server/data/bank/`. Add or edit entries, then run `npm run bank:check`. Each answer has a `canonical` name, lowercase `aliases` (misspellings, nicknames, plurals) and a `tier` from `common` to `deep`. A `deep` entry that only one person says scores One in a Krillion. Add `"obvious": true` to pin an answer to a puddle (10 m) no matter how few people say it — Lorne, Wye River, Separation Creek and Kennett River ship pinned on both town prompts, because naming the town outside the window is not a dive. Restart the server to load changes; with Docker Compose the banks are baked into the image, so run `docker compose up --build`.

To add a brand-new prompt, copy an existing file, give it a new `id`, set `approved` to `true` if it should appear in the default list, and restart. It will show up in the host's Setup drawer.
