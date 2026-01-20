# Neon Survivors (GitHub Pages)

A **survivor-like** top-down mobile-first action game built with **vanilla HTML/CSS/JS + Canvas**.

- Auto-aim + auto-attack
- XP gems + level-up choices (3-card selection)
- Multiple weapons (wand, orbit blades, pulse nova, chain spark)
- Scaling wave director + elite spawns
- Touch joystick + keyboard support
- Saves best/last time in localStorage
- **Original visuals (simple shapes)** to avoid copyrighted assets

## Run locally
Open `index.html` in a browser.

## Deploy to GitHub Pages
1. Create a repo
2. Upload these files to the repo root
3. In GitHub: Settings → Pages → Deploy from branch → select `main` and `/root`
4. Open your Pages URL

## Customize
- Edit upgrade numbers in `script.js` under `UPGRADE_POOL`
- Add new enemy types in `spawnEnemy()` base table
- Add new weapons by:
  1) defining a weapon in `makePlayer().weapons`
  2) ticking it in the update loop
  3) creating upgrades in `UPGRADE_POOL`
