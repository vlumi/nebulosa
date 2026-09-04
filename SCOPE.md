# nebulosa — scope

Ground-track visualizer for the Synspective StriX SAR constellation, from public orbital data.

**The name:** *Strix nebulosa*, the great grey owl — same genus as the StriX satellites,
the iconic owl of Finland, and Latin for "cloudy": an owl named *cloudy*, for satellites
built to see through clouds. Owls see in the dark; so does SAR.

**Status:** unofficial demo project. Not affiliated with Synspective. All data is public
(NORAD GP data via CelesTrak).

## Data

- **Source:** CelesTrak GP API — `https://celestrak.org/NORAD/elements/gp.php?NAME=STRIX&FORMAT=TLE`
- **Constellation (as of 2026-09):** 8 satellites, two distinct orbit families:
  - StriX-1, -2, -3 — ~97.5° sun-synchronous (NORAD 53815, 62406, 59224)
  - StriX-4 … -8 — ~42–50° mid-inclination (NORAD 60352, 65971, 68291, 69177, 69701)
- **Refresh strategy:** a cron job on the host fetches TLEs daily into the web root as
  `data/tles.json`, which the app loads at runtime from its own origin; the first deploy fetches
  once to get started. Nothing is committed: CelesTrak is the single source. No backend, no
  browser-side dependency on CelesTrak, respectful of their rate limits. Optional in-browser
  "refresh now" live fetch as fallback.
- TLE epoch age shown in the UI (stale elements = degraded accuracy; honesty in the UI).

## Tech

- **App:** React + TypeScript + Vite
- **Propagation:** satellite.js (SGP4)
- **Rendering:** deck.gl over a MapLibre GL basemap (OpenFreeMap vector tiles — free, no API key)
- **Testing:** Vitest + React Testing Library; UI smoke tests for the map wiring
- **CI:** GitHub Actions — lint/test/build on push and pull requests
- **Hosting:** https://nebulosa.misaki.fi — owner-managed host, nginx serving static files
  (same pattern as sibling sites); `deploy.sh` builds and swaps the web root, cron refreshes the data
- **License:** MIT

## Features

### M0 — skeleton
Vite scaffold, CI pipeline green, site live at nebulosa.misaki.fi from day one (walking skeleton).

### M1 — MVP
- All 8 satellites: current position + ground track (±1 orbit), color-coded by orbit family
- TLE decode: name, NORAD ID, epoch age
- Deployed, linkable, README with screenshot

### M2 — time
- Time slider: scrub past/future positions and tracks
- Play/pause animation at selectable speed
- Day/night terminator overlay (SAR context: imaging works on both sides of it)

### M3 — detail
- Per-satellite panel: inclination, period, altitude, eccentricity, epoch — decoded
  into human-readable form from the TLE
- Select/highlight a satellite; dim the rest

### M4 — passes
- Pick a location on the map (default: Tokyo) → upcoming passes per satellite
  (time window, max elevation)
- The seed of actual ops-planning thinking; keep the math honest (SGP4 + geometry, no fudge)

## Non-goals

- No backend, no accounts, no persistence beyond the static TLE snapshot
- No imaging/tasking simulation (SAR swath modeling is out — real antenna parameters aren't public)
- No claim of operational accuracy — this is a visualization, not flight dynamics software
