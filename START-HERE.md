# Separation Creek Krillion — project package

What is in this folder

- README.md — how the game plays, scoring tiers, zones, special answers, scripts, configuration.
- DEPLOYMENT.md — step-by-step setup for 20 players: laptop on the house Wi-Fi (Docker Compose) or Railway + Postgres, game-night runbook, troubleshooting.
- screenshots/ — every screen, taken from a real 20-player game (host at 1920x1080, phone at 390x844).
- videos/ — phone-gameplay.mp4 (portrait, one phone's view of a game) and tv-and-phone-gameplay.mp4 (host screen beside the phone).
- repository/krillion.bundle — the complete source code as a git repository (branch main, 19 commits).

Put the code on GitHub (repository named krillion)

1. On GitHub, create an empty repository called krillion (no README).
2. In a terminal, in this folder:

    git clone -b main repository/krillion.bundle krillion
    cd krillion
    git remote set-url origin https://github.com/<your-account>/krillion.git
    git push -u origin main

Run it on a laptop without GitHub at all

    git clone -b main repository/krillion.bundle krillion
    cd krillion
    npm install
    npm run build
    npm start

Then open http://<laptop-ip>:8787/host on the laptop and have phones scan the QR code.
Full details, including the Docker and Railway options, are in DEPLOYMENT.md.
