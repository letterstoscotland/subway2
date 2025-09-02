# Glasgow Subway Board (Modular)

A modular, self-hostable version of your Glasgow Subway dot‑matrix board.

- **HTTPS-friendly** and ready for GitHub Pages.
- All timings/messages live in `/config/*.json` so you can edit them without touching HTML/JS.
- One HTML page (`index.html`) that just draws the frame and loads assets.
- No external JS libraries required.

## Quick start (GitHub Pages)
1. Create a new GitHub repo and upload the contents of this folder.
2. Enable **Settings → Pages → Deploy from branch** (root).
3. Visit your `https://<user>.github.io/<repo>/` URL on iPad.

> iPadOS may still show a bar in Safari; that’s an iPad limitation. Functionality is unaffected.

## Edit messages & schedules
- `/config/messages.json` – advisory texts, special messages (terminations, football).
- `/config/schedule.json` – service windows and special-time windows in local time (Europe/London).
- `/config/settings.json` – display and behavior knobs (marquee speed, initial offsets, etc.).

## Files
- `index.html` – 4:3 frame and minimal markup.
- `css/style.css` – layout, dot‑matrix look.
- `js/board.js` – logic (countdowns, advisories, scheduling).
- `config/*.json` – editable configuration.
