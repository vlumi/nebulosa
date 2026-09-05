# nebulosa — scope

Ground-track visualizer for the Synspective StriX SAR constellation, from public orbital data.

**The name:** *Strix nebulosa*, the great grey owl: same genus as the StriX satellites, the iconic owl of Finland, and Latin for "cloudy", so an owl named *cloudy* for satellites built to see through clouds. Owls see in the dark; so does SAR.

**Status:** unofficial demo project, not affiliated with Synspective. All data is public (NORAD GP data via CelesTrak). Milestones M0 to M6 below were delivered on 2026-09-04; this file stays as the record of the plan, and [docs/screenshots](docs/screenshots/README.md) holds one capture per milestone.

## Data

- **Source:** CelesTrak GP API, `https://celestrak.org/NORAD/elements/gp.php?NAME=STRIX&FORMAT=JSON`. CCSDS OMM as JSON, not TLE: the catalog passed 99999 in July 2026 and newer objects, StriX-9 included, never appear in the fixed-width TLE format.
- **Constellation (as of 2026-09):** 9 satellites in two orbit families. StriX-1, -2, -3 at roughly 97.5°, sun-synchronous (NORAD 53815, 62406, 59224); StriX-4 to -9 at 38° to 50°, mid-inclination (NORAD 60352, 65971, 68291, 69177, 69701, 100561). StriX-α and -β have decayed.
- **Refresh strategy:** a cron job on the host fetches the elements daily into the web root as `data/elements.json`, which the app loads at runtime from its own origin; the first deploy fetches once to get started. Nothing is committed: CelesTrak is the single source. No backend, no browser-side dependency on CelesTrak, respectful of their rate limits.
- The element epoch and its age are shown in the UI: stale elements mean degraded accuracy, and the UI should say so.

## Tech

- **App:** React + TypeScript + Vite
- **Propagation:** satellite.js (SGP4)
- **Rendering:** deck.gl interleaved into a MapLibre GL basemap (OpenFreeMap vector tiles, free, no API key), flat or globe
- **Testing:** Vitest + React Testing Library; the map wiring is tested with the map libraries mocked; headless Chrome captures over the DevTools protocol check the rendered result and report page errors
- **CI:** GitHub Actions, lint/test/build on push and pull requests
- **Hosting:** [nebulosa.misaki.fi](https://nebulosa.misaki.fi), an owner-managed host with nginx serving static files, the same pattern as sibling sites; `deploy.sh` publishes releases under the web root, cron refreshes the data
- **License:** MIT

## Features

### M0 — skeleton

Vite scaffold, CI pipeline green, site live at nebulosa.misaki.fi from day one (walking skeleton).

### M1 — MVP

- All satellites: current position and ground track (±1 orbit), color-coded by orbit family
- Element decode: name, NORAD ID, epoch age
- Tap a satellite, its label or its track (on the map or in the list) to highlight it and dim the rest
- Deployed, linkable, README with screenshot

### M2 — time

- Time slider: scrub past and future positions and tracks
- Play/pause animation at selectable speed
- Time along the track: hovering a track shows when the satellite is at that point, with a marker on the path; the flown half fades behind the satellite, which also makes the direction of travel readable at a glance instead of by watching the dot move
- Day/night terminator overlay (SAR context: imaging works on both sides of it)

### M3 — detail

- Per-satellite details: inclination, period, altitude, eccentricity, epoch, decoded into human-readable form from the elements
- Selecting a satellite from the list also centers the map on its current position
- Esc clears the selection

### M4 — passes

- Pick a location on the map (default: Tokyo) and see the upcoming passes per satellite: time window, maximum elevation
- Showing a pass marks where the satellite will be at its peak; going to it also moves the clock there
- The seed of actual ops-planning thinking; keep the math honest (SGP4 and geometry, no fudge)

### M5 — small screens

- The panels are desktop boxes and cover the map on a phone. Collapsible panels docked at the top, one open at a time on narrow viewports, the time bar spanning the bottom.

### M6 — settings

- Track length, past and future separately
- Pass list horizon: a choice of hours ahead instead of a fixed 24 h
- The whole pass list, scrolling, instead of ten rows and a count
- Pass filters: minimum elevation, and the selected satellite only, with a way to see all again
- A date picker for the clock, to look at solstices or a launch day

## Non-goals

- No backend, no accounts, no persistence beyond the fetched element set
- No imaging/tasking simulation: the reach layer uses the one published figure, the 15° to 45° steering range; the look side, swath choice and tasking aren't public
- No claim of operational accuracy: this is a visualization, not flight dynamics software
