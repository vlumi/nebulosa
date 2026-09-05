# nebulosa — scope

Ground-track visualizer for the Synspective StriX SAR constellation, from public orbital data.

**The name:** *Strix nebulosa*, the great gray owl: same genus as the StriX satellites, the iconic owl of Finland, and Latin for "cloudy", so an owl named *cloudy* for satellites built to see through clouds. Owls see in the dark; so does SAR.

**Status:** unofficial demo project, not affiliated with Synspective. All data is public (NORAD GP data via CelesTrak). Milestones M0 to M6 below were delivered on 2026-09-04, SAR reach and the globe on the two days after, the shell (M7) and places (M8) on 2026-09-05; [Next](#next) is the plan from here, and [docs/screenshots](docs/screenshots/README.md) holds one capture per milestone.

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

## Next

Five pieces of UI work and two chores, ordered so that each lands on a settled base instead of on a panel that the next step redraws. The shell comes first because every later piece needs a home in it; places before focus mode because focus mode reads the selected place; the theme last because it touches only tokens and the basemap once the shell is stable.

### Chores, first and independent (done)

- **en-US everywhere.** A dozen British spellings across code comments, test names and the docs: colour, centre, kilometres, the great grey owl. One pass, one PR, no conflicts with anything below.
- **Resize bug.** Resizing the window leaves the deck.gl overlay at its old size while the basemap re-lays out, so tracks and satellites drift off the map, globe and flat alike. Reproduced by shrinking the map container; re-applying the overlay's props on MapLibre's resize event does not cure it, so the fault is in the beta module's own resize handling. Next probe is to set the overlay's width and height explicitly from the container on that event, and failing that, to recreate the overlay. Small, isolated, worth doing before the shell so the shell's own resizes are trustworthy.

### M7 — shell (done)

The two panels cover the whole screen on a phone, and choosing something should hand the screen back to the map while still saying what was chosen.

- A **toolbar of buttons along the bottom** (satellites, places, passes; the clock stays where it is), each showing its current selection while closed: the satellite's name and swatch, the place's name, the count and next time of passes.
- Tapping a button opens **one sheet** with that list; choosing something closes the sheet on a phone. On desktop the same sheet opens as the left column does today, and choosing keeps it open, since there is room.
- Keyboard scheme: S, W and P open the sheets, ↑ ↓ step through the open one, Esc closes them first.
- Open question: whether desktop keeps a permanently open column at all, or also goes to the toolbar with sheets. The toolbar-only design is simpler and one code path; the column shows more at once. Prototype the toolbar on both and decide with screenshots.
- Conflicts: this rewrites `App.tsx`, the panels and their styles. Nothing else should be in flight against those files while it lands.

### M8 — places (done)

- **Several pins**, not one. Add a place with a long press on a phone or a double click on desktop; name it from the reverse geocode if cheap, else from its coordinates; remove it from the list.
- **One place selected at a time, or none.** Passes are computed for the selected place; with none selected the passes button says so and the list is empty. Unselecting is a tap on the selected place.
- **Jump to a place** from its row, the same way a satellite row centers the map.
- Places persist in the browser (`localStorage`), no account. Tokyo remains the seed on first visit.
- Conflicts: store, `usePasses` and the pass worker request, `MapView` markers, and the places sheet from M7. Wait for M7.

### M9 — focused satellite

Where a satellite is, has been and will be, beyond a highlighted track.

- **Follow:** the map keeps the focused satellite centered as time plays, on the globe by rotating it. A toggle, off by default, since it fights panning.
- **Readout:** sub-satellite point, altitude, speed, direction, time to the next pass over the selected place, and time to the next terminator crossing, in the satellite's sheet while focused.
- **Own timeline:** the arrow-key probe becomes a visible strip under the readout, showing the next few passes and the day and night stretches along the track; dragging it moves the ghost.
- Conflicts: store selection, `layers.ts`, the satellite sheet from M7. Wait for M7; independent of M8 except for the next-pass field.

### Small things noticed along the way

- The last two quads at either end of a reach ribbon render more saturated than the rest; the geometry is verified clean, so it is a rendering effect.

### M10 — theme

- **Light and dark**, following the system by default, with a toggle in the corner beside Globe and SAR reach.
- OpenFreeMap serves five styles without a key: `fiord` (the current dark blue), `dark`, `positron` (light grey), `bright` and `liberty` (light, colored). Dark stays on fiord; light goes to positron, with bright as the alternative to compare. The night shading, the reach band, the track palette and the panel tokens each need a light variant; the family colors probably survive as they are.
- Conflicts: CSS tokens, `palette.ts`, `MapView`'s basemap and the surface paints. Small, and last.

## Non-goals

- No backend, no accounts; places live in the browser and nothing else persists beyond the fetched element set
- No imaging/tasking simulation: the reach layer uses the one published figure, the 15° to 45° steering range; the look side, swath choice and tasking aren't public
- No claim of operational accuracy: this is a visualization, not flight dynamics software
