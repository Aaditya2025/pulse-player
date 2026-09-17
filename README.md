# Pulse Player

> A production-grade web music player built with **zero frameworks** — just vanilla JavaScript, the Web Audio API, and modern CSS. Designed to demonstrate what a senior frontend engineer reaches for when there's no React to hide behind.

[**Live Demo**](https://pulse-player-beta.vercel.app/) 

![Pulse Player screenshot](./docs/screenshot.png)

---

## Why this exists

Most "Spotify clone" tutorials stop at *play / pause / next*. That's a tutorial, not a project. Pulse Player is a rebuild of a first-year project — this time with the engineering decisions I'd actually make on a production team: audio events driving UI state (never the other way around), guarded index math, graceful degradation on `file://`, and a real accessibility story.

The point isn't the clone. The point is **what the clone forced me to learn about state, events, and the browser platform**.

---

## Features

### Playback
- ▶️ Play, pause, next, previous with full queue wrap-around
- 🔀 **Shuffle** (Fisher–Yates-friendly, no repeat-until-exhausted)
- 🔁 **Repeat** with three states — off / all / one
- 📊 Draggable **seek bar** with live time preview
- 🔉 **Volume** control with mute toggle and remembered last volume
- 📱 **Media Session API** integration — OS lock screen, notification, and hardware media keys work

### UX
- ⌨️ **Keyboard shortcuts** — `Space` play/pause, `←`/`→` seek ±5s, `↑`/`↓` volume, `M` mute
- 🎬 **Now-playing equaliser animation** on the active track
- 🖼️ **Dynamic hydration** — the entire track list renders from a single `songs` array
- 📐 **Fully responsive** — collapses gracefully from desktop → tablet → mobile
- 🎨 **CSS custom properties** for theming; range inputs styled cross-browser (WebKit + Firefox)

### Engineering
- 🧪 **Defensive state management** — every array access guarded, every index validated with `Number.isInteger`
- 🎯 **Event-driven UI** — play/pause icons update from `audio` events, never optimistically
- ♿ **Accessible** — ARIA labels, `aria-current`, `aria-pressed`, `focus-visible` rings, reduced-motion support
- 🚫 **Zero dependencies** — no build step, no bundler, no framework

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Structure | Semantic HTML5 | Screen reader + SEO friendly |
| Styling | Modern CSS (Grid, custom properties, `clamp()`, `prefers-reduced-motion`) | No preprocessor needed |
| Logic | Vanilla JavaScript (ES2020+) | Demonstrates platform fluency |
| Audio | HTML5 `<audio>` + Web Audio API hooks | Native, no library |
| Integration | Media Session API | Hardware/OS media controls |
| Icons | Font Awesome 6 (CSS CDN) | Tree-shakeable, no JS kit |

---

## Project Structure

```
pulse-player/
├── index.html          # Semantic markup + ARIA
├── style.css           # Design tokens → layout → components → responsive
├── script.js           # Playback engine (IIFE-scoped, no globals)
├── songs/              # Audio files (1.mp3 … 10.mp3)
├── covers/             # Cover art (1.jpg … 10.jpg)
├── logo.png
└── playing.gif         # Now-playing indicator
```

---

## Key Engineering Decisions

### 1. Audio events drive the UI — not the click handler
The naive approach flips the icon inside the `click` handler. That lies to the user when `play()` rejects (autoplay policy, missing file, codec error). Pulse Player updates the icon **only** from the `play` and `pause` events, with a `revertToPaused()` fallback on rejection.

```js
audio.addEventListener("play",  () => setPlayIcon(true));
audio.addEventListener("pause", () => setPlayIcon(false));

function safePlay() {
  audio.play().catch(() => revertToPaused());  // UI never lies
}
```

### 2. Every index is validated before it touches a URL
The original version did `` `songs/${songIndex + 1}.mp3` `` — which produces `songs/NaN.mp3` the moment `songIndex` goes bad. Now every entry point (click, next, prev, auto-advance) passes through the same guard:

```js
if (!Number.isInteger(index) || index < 0 || index >= songs.length) return;
```

### 3. Graceful degradation on `file://`
Media Session and `MediaMetadata` throw SecurityErrors on `file://` origins. Rather than crash, the player detects the protocol and skips the feature:

```js
const isFileProtocol = location.protocol === "file:";
if (!isFileProtocol && "mediaSession" in navigator) { /* … */ }
```

---

## Getting Started

```bash
git clone https://github.com/<you>/pulse-player.git
cd pulse-player

# Serve it (don't open index.html directly — Media Session needs http://)
npx serve .
# or
python -m http.server 8000
```

Open `http://localhost:8000`.

**To use your own tracks:** edit the `songs` array at the top of `script.js`. That's the only file you need to touch — the DOM hydrates from it.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `←` `→` | Seek −5s / +5s |
| `↑` `↓` | Volume ±5% |
| `M` | Mute / Unmute |

---

## Roadmap

- [ ] Playlist / queue drawer with drag-to-reorder
- [ ] Web Audio API visualiser (AnalyserNode + Canvas)
- [ ] IndexedDB persistence for "last played" and volume
- [ ] Search + filter for large libraries
- [ ] PWA — offline caching via Service Worker

---

## What I'd do differently at scale

Vanilla JS was the right call for a 10-track playlist — it proved I understand the platform. At 10,000 tracks I'd reach for a framework: a virtualised list, a real state machine (XState or Redux), and a component model that isn't four nested `querySelector` calls. The interesting part of this project isn't the stack — it's knowing **when the stack would change**.

---

## License

MIT — see [LICENSE](./LICENSE).

Audio files are for demo purposes only and are not distributed with this repo.
