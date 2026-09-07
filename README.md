# nebulosa

Owls see in the dark. So does SAR.

Ground-track visualizer for the Synspective StriX SAR constellation, built from public orbital data (CelesTrak GP, in OMM form). Named for *Strix nebulosa*, the great gray owl: same genus as the satellites, the iconic owl of Finland, and Latin for "cloudy", so an owl named *cloudy* for satellites built to see through clouds.

Unofficial demo project; not affiliated with Synspective.

Live at [nebulosa.misaki.fi](https://nebulosa.misaki.fi). [SCOPE.md](SCOPE.md) is the plan it was built from; [ARCHITECTURE.md](ARCHITECTURE.md) explains how it works and the maths behind it.

![The globe in the dark theme with STRIX-3 selected near the north pole: its details, a live readout of where it is and what comes next, a strip of its track with day and night, the radar's reach band beside the track](docs/screenshots/011-theme-dark.png)

<img src="docs/screenshots/010-focused-satellite-phone.png" alt="The same site on a phone: the satellite followed on the globe, the follow button lit under the compass" width="260">

Every capture, one per milestone and the light theme beside the dark, is shown in [docs/screenshots](docs/screenshots/README.md).

## What it shows

- Every StriX satellite's current position and ground track, propagated with SGP4 from the latest mean elements, colored by orbit family: sun-synchronous in yellow, mid-inclination in cyan, amber and blue on the light theme. The flown part of a track drops in brightness right behind the satellite and fades further back, so the direction of travel is readable at a glance and at any zoom.
- A clock: live, paused, or playing at up to 600×, with a slider over the displayed day and a date picker; a pause taken live resumes live. Positions, tracks and the day/night terminator follow it.
- Hover a track to see when the satellite is at that point. Tap a satellite, its label, its track, or its row in the list to select it; the list shows launch, orbit, altitude, period, eccentricity and element epoch, and the rest dims. Follow, `F` or the round button on the map, keeps the map centered on it as time plays; dragging the map lets go. Under the details a readout follows the displayed moment: where the satellite is over the ground, its height, speed and heading, its next pass over the selected place, and when its ground track next crosses the terminator. Below it a strip spans the drawn track, day and night along it and the passes over the selected place; point at it to put the probe there, as the arrow keys do.
- Places: several pins, added with a double click or a long press on the map and named after the nearest place label the map is showing, dragged to move or locked against stray drags, renamed, reordered or removed in their sheet, kept in the browser. One is selected at a time, or none. The last row of the list places a pin at the browser's own location, only when asked: it is drawn as a target, cannot be dragged, and moves only from the refresh on its row; the position stays in the browser like every other place.
- Passes over the selected place: the passes sheet lists every line-of-sight pass over the next 6 to 48 hours with rise, set and peak elevation, narrowed to the passes the radar can steer to or to the selected satellite. Show a pass to see where the satellite will be at its peak, or jump the clock to it.
- A toolbar of three pills, satellites, places and passes, each showing what is chosen in it and opening its sheet; while something is chosen the pill has a × on its right that clears it, and every sheet has a × of its own. `1`, `2` and `3` open the sheets in toolbar order, `↑ ↓` step through the open one, `Esc` peels the selection back one layer at a time, `?` lists every key.
- SAR reach: the band of ground 15° to 45° off nadir on either side of the selected satellite's track, and per pass, the look angle at the peak and whether it is inside that range. A satellite straight overhead cannot image the pin; one that peaks at 40° to 74° can.
- A globe, by default: `G` or the globe toggle in the title row flattens it to Mercator and back. Everything above follows the projection and the far side is hidden, so a mid-inclination orbit and the terminator read at a glance. The basemap has no data beyond 85°, so the poles are blank discs.
- Light and dark, following the system until `T` or the sun-and-moon toggle in the title row chooses; the basemap, the shading, the tracks and the panels all follow.
- English and Japanese, following the browser's language until the picker in the title row chooses; every word changes, the basemap's labels included, nothing else does.
- The element epoch and its age are always visible, because stale elements mean degraded accuracy.

Passes are geometric visibility above the horizon, not imaging opportunities. What the radar could reach is drawn from the one public figure, Synspective's stated 15° to 45° off-nadir steering range: selecting a satellite shades that band on both sides of its track, until the `SAR` toggle (or `R`) hides it, and a pass whose peak falls inside it is marked in the list, which can be narrowed to those passes. Which side the antenna looks, the swath actually chosen and the tasking are not public, so nothing here claims to be an imaging opportunity.

## Data

The orbital elements come from the CelesTrak GP API as CCSDS OMM in JSON, not TLE: the satellite catalog passed 99999 in July 2026, and objects numbered from 100000 up, StriX-9 among them, never appear in the fixed-width TLE format. Nothing is committed to this repository; a cron job on the host refreshes `data/elements.json` daily, and the app loads it from its own origin. As of September 2026 the constellation has nine satellites in orbit: StriX-1 to -3 in roughly 97.5° sun-synchronous orbits, StriX-4 to -9 at 38° to 50°.

## Develop

```sh
npm install
npm run elements # fetch public/data/elements.json from CelesTrak (not committed; do this first)
npm run dev      # Vite dev server
npm test         # Vitest
npm run lint     # oxlint
```

Stack: React, TypeScript and Vite; zustand for state; CSS Modules; satellite.js for SGP4; deck.gl interleaved into a MapLibre GL basemap with OpenFreeMap tiles; Vitest and React Testing Library. `scripts/screenshot.mjs` captures the site with headless Chrome over the DevTools protocol and reports page errors, with options to act on the page first, sweep the pointer across the map, and pick a viewport size.

## Deploy

Static files behind nginx over HTTPS (Let's Encrypt / certbot). The web root is owned by the deploying user, so nothing needs root after the one-time setup:

```sh
sudo install -d -o "$USER" -g "$USER" /var/www/nebulosa
```

[`deploy.sh`](deploy.sh) pulls, builds, copies the result to `releases/<sha>` under the web root, and points the `current` symlink at it; the last three releases are kept. The web root is asked on first run and saved to `.deploy.local`.

```sh
./deploy.sh                          # pull, build, publish
./deploy.sh --no-pull                # build the working tree as-is
WEBROOT=/some/other/path ./deploy.sh # override the web root
```

The orbital elements are not part of a release. A daily cron job fetches them into `data/` under the web root, which nginx serves at `/data/`; the first deploy fetches them once to get started and installs that job in the deploying user's crontab.

[`nginx.conf.example`](nginx.conf.example) is the server block it's served from.

## License

MIT. Orbital data from [CelesTrak](https://celestrak.org/). Map tiles from [OpenFreeMap](https://openfreemap.org/), © OpenStreetMap contributors.
