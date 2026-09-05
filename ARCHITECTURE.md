# Architecture

What is going on in nebulosa, for a reader who has the code in front of them: the shape of the thing, where the data comes from, and the maths that is not obvious from reading it. It does not walk through the code.

## The one-paragraph version

A static single-page app. Once a day a cron job on the host fetches the orbital elements of every StriX satellite from CelesTrak into a JSON file next to the site; the browser loads that file, propagates each satellite with SGP4 for whatever moment the clock shows, and draws positions, ground tracks, the day/night terminator and passes over a chosen location on a vector basemap. There is no backend and nothing is stored anywhere.

## Layout of `src`

Grouped by domain, not by kind of file. `orbit/` is everything about the satellites and the sky: elements, propagation and tracks, passes, the Sun, human-readable orbit descriptions. `time/` is the clock model, its easing, and the time bar. `map/` is the MapLibre and deck.gl wiring and the layer builders. `panels/` is the toolbar, the two sheets it opens and the corner toggles. `shared/` is what several domains use: formatting, the color palette, two small hooks. `App.tsx` at the root holds the state and wires the domains together. Tests sit next to what they test; fixtures live in `test/`. Dependencies point inward: panels and map use orbit and shared, time and orbit use only shared, shared uses nothing but a type from orbit.

## State

Two zustand stores. `store.ts` holds what the reader has chosen: the selection (satellite, ghost, active pass, probe), the places and which one is selected, the pass filters, the track span, the clock, and which sheet is open; its actions, such as showing a pass or the layered Esc, are plain functions and are unit-tested without React. `time/frame.ts` holds the two per-frame values, real time and the eased displayed time, written by one animation loop; only the map and the time bar subscribe to it, and a minute-rounded selector serves the age displays and the pass computation, so the rest of the tree never re-renders for a frame. Data loading and the passes worker stay in `App.tsx`, which passes lists to prop-driven components.

## Data

**Source.** CelesTrak's GP API returns the current mean elements per satellite. The request asks for CCSDS OMM in JSON rather than the classic two-line element set: TLE has a five-digit catalog number field, the catalog passed 99999 in July 2026, and objects numbered from 100000 up, StriX-9 among them, are simply absent from TLE output. OMM has no such limit and gives the epoch as an ISO timestamp.

**Refresh.** The elements are not part of the build or the repository. `deploy.sh` publishes a release under the web root and, on first run, fetches the elements once and installs a daily cron line that overwrites `data/elements.json` under the web root. nginx serves that path from outside the releases, so deploys never touch it. The app fetches it from its own origin and shows the newest epoch and its age in the panel, because accuracy decays with age: roughly a kilometer or two of along-track error per day for satellites at 450 to 570 km, more after a maneuver.

**Constellation.** Two orbit families, told apart by inclination: above 80° is sun-synchronous (StriX-1 to -3, about 97.5°, retrograde), the rest mid-inclination (StriX-4 to -9, 38° to 50°). The family only affects color.

## Propagation and tracks

**SGP4.** satellite.js turns an OMM record into a `SatRec` and propagates it to a date, giving a position in Earth-centered inertial coordinates. Converting to latitude and longitude needs the Earth's rotation angle at that moment, Greenwich mean sidereal time, which the same library computes from the date. The mean motion in the record is the Kozai value; the propagator's internal value is the Brouwer one, slightly different, so the period shown in the UI is computed from the record, not from the propagator.

**Ground track.** A track is the satellite's sub-point sampled every 30 seconds from `pastOrbits` periods before the displayed time to `futureOrbits` after it. Every sample keeps its timestamp, which is what lets hovering a track say when the satellite is at that point: the nearest sample to the pointer is found by distance in degrees with longitude wrapped, and its time is shown.

**Antimeridian.** Longitudes are kept in −180 to 180 and the path is never split. deck.gl's `wrapLongitude` draws a segment that crosses ±180° the short way round. An earlier version split the path at the crossing and left a 30-second hole there every orbit.

**Tail and lead.** The flown half of a track is drawn as a run of chunks whose opacity falls with age, from full at the satellite to a floor within the first 12% of the flown span, so the direction of travel reads at a glance and there is no notch where past meets future. The half ahead is one segment at full opacity. A satellite selected in the list keeps its tail well above the dimmed tracks of the others.

**Ghost.** Showing a pass draws a hollow marker where the satellite will be at the pass peak. If that moment lies beyond the drawn track, the track continues to it as a dashed line, sampled on a grid that passes through the ghost time so the dashes meet the marker.

## Time

**The clock** is a pair of anchors and a rate: `sim = anchorSim + (real − anchorReal) × rate`. Rate 1 with a zero offset is live, rate 0 is paused, 10 to 600 is fast-forward. Scrubbing moves the sim anchor; changing speed re-anchors at the current moment so nothing jumps. The date picker moves to the chosen UTC date at the same time of day and pauses.

**Smoothness.** Real time is read every animation frame, and the displayed simulated time eases toward the target with an exponential approach, time constant 120 ms, snapping when within a quarter second. A scrub therefore animates rather than cuts, and at 600× the display lags the true simulated time by a constant, invisible ~70 s while staying smooth. The easing loop is registered once and reads its target from a ref; re-registering it per frame canceled the pending step and froze the display, which was a real bug once.

**Cost control.** Positions are recomputed every frame, nine SGP4 evaluations. Tracks are recomputed only when the displayed minute changes and at most every 150 ms of real time, since a track shifted by under a minute is indistinguishable. Passes are recomputed when the selected place moves or changes or the real minute changes, and are anchored to real time so that scrubbing never changes the list under the reader.

## Terminator

The Sun's position from satellite.js gives right ascension and declination; subtracting Greenwich sidereal time from the right ascension gives the subsolar longitude, and the declination is the subsolar latitude. The terminator is the set of points where the Sun is on the horizon, which along a meridian at longitude λ sits at `tan(lat) = −cos(λ − λ_sun) / tan(decl)`. Sampling that per degree of longitude gives a curve; closing it over whichever pole is in darkness gives the night polygon. Web Mercator has no poles, so the polygon is closed at ±85° instead of ±90°. Near equinox the curve runs nearly pole to pole; at a solstice it reaches only ±66.6° and one polar cap is entirely in shade.

## Passes

A pass is a period of line-of-sight visibility above the horizon from the selected place, not an imaging opportunity; with no place selected there are none. Whether the radar could reach the pin during it is a separate question, answered below from the one public figure.

**Look angles.** The satellite's inertial position is rotated into Earth-fixed coordinates with sidereal time, then converted to azimuth, elevation and range from the observer.

**SAR reach.** A side-looking radar images a strip beside its track, not the ground under it, so a satellite straight overhead is useless to it. [Synspective's SAR data page](https://www.synspective.com/data/synspective-sar-data/) gives StriX an off-nadir steering range of 15° to 45° and a nominal Stripmap look of 30°; the look side, the swath chosen per acquisition and the tasking are not public. On a sphere, a look θ off nadir from altitude h meets the ground at a central angle `asin((R + h) / R · sin θ) − θ` from the sub-satellite point, about 134 km and 524 km at 500 km altitude for the two limits. The reach layer sweeps those two offsets perpendicular to the track heading on both sides, using each sample's own altitude, and cuts the ribbons into short polygons that are handed to the basemap as fills. For a pass, the look angle at the peak follows from the peak elevation e as `asin(R / (R + h) · cos e)`. Peaks between roughly 40° and 74° elevation fall inside the steering range and are marked; the list can be narrowed to them.

**Finding passes.** Elevation is sampled every 30 seconds over the horizon of 6 to 48 hours. Each interval above 0° is a pass; its rise and set are refined by bisection to under a second, and its peak by a one-second scan around the best sample. The scan starts 20 minutes before the requested start, longer than any low-Earth-orbit pass, so a pass already in progress is found from its true rise rather than from the scan boundary. Filtering by minimum elevation is applied afterwards on each pass's peak.

## Rendering

MapLibre GL draws the basemap from OpenFreeMap vector tiles, and deck.gl draws the tracks, positions, labels, ghost and hover marker through `@deck.gl/maplibre` in interleaved mode, inside MapLibre's own WebGL context and depth buffer. Two things about that arrangement are easy to get wrong. MapLibre 6 loads its web worker from a file next to its own script, which a bundled app does not have, so the worker is bundled explicitly and registered at startup. And MapLibre's control layer has a z-index of 2; the HTML panels must sit above it or the map paints over their text.

**Shaded surfaces.** The night side and the SAR reach band are not deck.gl polygons but MapLibre fill layers on GeoJSON sources, updated when the displayed minute changes. On the globe, deck.gl cuts a polygon into 10° cells whose flat interiors sag some 24 km below the sphere and fight the basemap's own surface for depth; lifting them fails because the cut vertices come back at ground level, and a depth bias trades the speckle for banding. MapLibre tessellates a fill onto its globe itself, hides the far side, and has nothing to fight. A reach ring that crosses the antimeridian is handed over unwrapped past ±180°, which the tiler handles, where a jump inside the ring would not be.

**Globe.** The map opens as a globe; `G` or the Globe pill flattens it to Mercator and back. MapLibre owns the projection, and the deck.gl overlay notices and swaps its own view to match, so tracks and picking carry over, and the far side is hidden by depth. Two adjustments make it clean: the text layer turns off back-face culling, because half the sphere's labels face away from the camera and would be dropped, and deck.gl's geometry floats 30 km above the ground in globe mode only, since a chord between two samples otherwise sinks in and out of the basemap's faceted sphere and reads as a dashed line. On the flat map the lift is zero, because a fixed altitude would displace things at street-level zoom, and deck.gl's depth test is off there, since nothing needs hiding and the test only made tracks z-fight with the ground at high zoom. The globe also yields to the flat map past zoom 5.5: curvature is invisible in a view that narrow, and the deck.gl MapLibre module, still a beta, clips its globe view away a little beyond that. The projection lives in the style, so it is applied when the style has loaded, on every toggle, and on every zoom.

The map view is loaded lazily, and MapLibre and deck.gl are built into chunks of their own so a deploy that touches only app code leaves them cached. satellite.js also ships an optional WASM propagator whose Emscripten glue targets Node; the app never loads it, and the build aliases its two entry points away so they stay out of the module graph.

Layer order is tracks, positions, labels, then the ghost's dashed track, marker and label, then the hover marker and label. Tracks are cut at the antimeridian before deck.gl sees them, since on the globe its grid cutter would otherwise read a hop from 179° to −179° as a trip the long way round. Tracks, positions, labels and the dashed continuation are pickable, with an eight-pixel picking radius so a 1.5-pixel line can be tapped; a picked layer may arrive without an object, and the hover handler must tolerate that or it takes the whole render loop down with it.

## Layout

A toolbar of pills sits above the time bar, one per list, and each pill shows what is chosen in its list while the list is closed: the satellite's name and family swatch, the active pass and its peak time. Tapping a pill opens that list as a sheet above the toolbar, one sheet at a time; the sheet grows upward as far as the top of the map, and its list scrolls. On desktop the satellites sheet is open at the start and choosing something leaves it open, since there is room. On viewports up to 720 px wide the map comes first: no sheet is open at the start, the sheet is capped at just over half the screen, and choosing a satellite or a pass closes it, so the screen goes back to the map with the choice still readable on the pill.

## Testing

Pure modules, orbit, passes, sun, clock, format, describe, are unit-tested against StriX-1 and StriX-9 elements and hand-computed values. Components are tested with React Testing Library; MapLibre and deck.gl are mocked, since jsdom has no WebGL, and the deck.gl layer builders are tested by inspecting the layer props and calling their accessors. What the mocks cannot see is checked with `scripts/screenshot.mjs`, which drives headless Chrome over the DevTools protocol against a local preview or the deployed site, can click things and sweep the pointer across the map first, and reports page exceptions. Every milestone's capture is kept under `docs/screenshots`.
