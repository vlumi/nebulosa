import type { Layer } from '@deck.gl/core'
import { Matrix4 } from '@math.gl/core'
import { PathStyleExtension, type PathStyleExtensionProps } from '@deck.gl/extensions'
import { PathLayer, ScatterplotLayer, SolidPolygonLayer, TextLayer } from '@deck.gl/layers'
import { formatOffset, hhmm, hhmmss } from '../shared/format'
import {
  DEFAULT_SPAN,
  nearestSample,
  positionAt,
  splitAtAntimeridian,
  trackSamples,
  trackSamplesBetween,
  type LonLat,
  type OrbitFamily,
  type Satellite,
  type TrackSample,
  type TrackSpan,
} from '../orbit/orbit'
import { POLE_CAP } from '../orbit/sun'
import type { Rgba } from '../shared/palette'
import { PALETTES, type Palette } from '../shared/theme'

export interface SatelliteDatum {
  noradId: number
  family: OrbitFamily
}

export interface TrackDatum extends SatelliteDatum {
  samples: TrackSample[]
}

interface SegmentDatum extends SatelliteDatum {
  path: LonLat[]
  half: 'past' | 'future'
  /** 0 at the satellite, 1 at the oldest point of the flown half. */
  age: number
}

interface PositionDatum extends SatelliteDatum {
  name: string
  lonLat: LonLat
}

/** A point on a track under the pointer, with the moment the satellite is there. */
export interface Hover {
  noradId: number
  lonLat: LonLat
  timeMs: number
}

/** Where a satellite will be at some other moment than the displayed one, shown as a hollow marker. */
export interface Ghost {
  noradId: number
  timeMs: number
}

export function trackData(satellites: Satellite[], time: Date, span: TrackSpan = DEFAULT_SPAN): TrackDatum[] {
  return satellites.map((sat) => ({
    samples: trackSamples(sat, time, 30, span),
    noradId: sat.omm.NORAD_CAT_ID,
    family: sat.family,
  }))
}

export function hoverAt(track: TrackDatum, lonLat: LonLat): Hover {
  const sample = track.samples[nearestSample(track.samples, lonLat)]
  return { noradId: track.noradId, lonLat: sample.lonLat, timeMs: sample.timeMs }
}

const GHOST_MARGIN_MS = 5 * 60_000

/**
 * The time span a dashed continuation must cover so a ghost outside the drawn track connects to it, measured
 * from the track's own first and last samples; null when the ghost already sits on the drawn track.
 */
function ghostReach(track: TrackDatum | undefined, ghostMs: number): [number, number] | null {
  if (!track || track.samples.length === 0) return null
  const drawnStart = track.samples[0].timeMs
  const drawnEnd = track.samples[track.samples.length - 1].timeMs
  if (ghostMs > drawnEnd) return [drawnEnd, ghostMs + GHOST_MARGIN_MS]
  if (ghostMs < drawnStart) return [ghostMs - GHOST_MARGIN_MS, drawnStart]
  return null
}

/**
 * A polar cap as 36 cells of 10° from the rim to just short of the pole: in longitude and latitude a cap is a
 * band across all longitudes, which the globe renderer only draws right in pieces narrower than half the world.
 */
function capCells(rimLat: number): LonLat[][] {
  const pole = Math.sign(rimLat) * 89.99
  const cells: LonLat[][] = []
  for (let lon = -180; lon < 180; lon += 10) {
    cells.push([
      [lon, rimLat],
      [lon + 10, rimLat],
      [lon + 10, pole],
      [lon, pole],
    ])
  }
  return cells
}

const TAIL_CHUNKS = 60
/** Share of the flown half over which the tail fades to its floor; flat beyond it. */
const TAIL_FADE_SPAN = 0.04
/** Share of the drop taken at once behind the satellite, so the head has an edge even when zoomed in close. */
const TAIL_STEP = 0.65

/**
 * The track split at `now`. The half ahead is one segment; the flown half is a run of chunks with
 * increasing `age`, so it can fade out behind the satellite. Neighbours share a boundary point.
 */
function splitIndex(track: TrackDatum, nowMs: number): number {
  const i = track.samples.findIndex((s) => s.timeMs > nowMs)
  return i === -1 ? track.samples.length : i
}

function segmentsOf(track: TrackDatum, split: number): SegmentDatum[] {
  const path = track.samples.map((s) => s.lonLat)
  const past = path.slice(0, split + 1)
  const segments: SegmentDatum[] = []
  const chunkSize = Math.max(2, Math.ceil(past.length / TAIL_CHUNKS))
  for (let start = 0; start < past.length - 1; start += chunkSize - 1) {
    const chunk = past.slice(start, start + chunkSize)
    const age = 1 - (start + chunk.length - 1) / (past.length - 1)
    for (const piece of splitAtAntimeridian(chunk)) segments.push({ ...track, half: 'past', age, path: piece })
  }
  const future = path.slice(Math.max(0, split - 1))
  for (const piece of splitAtAntimeridian(future)) segments.push({ ...track, half: 'future', age: 0, path: piece })
  return segments
}

/**
 * The segments of a set of tracks, rebuilt only when a split moves to another sample, so deck.gl keeps its path
 * geometry between frames; the same array comes back while nothing changed.
 */
const segmentCache = new WeakMap<TrackDatum[], { splits: number[]; segments: SegmentDatum[] }>()

function segmentsFor(tracks: TrackDatum[], nowMs: number): SegmentDatum[] {
  const splits = tracks.map((track) => splitIndex(track, nowMs))
  const cached = segmentCache.get(tracks)
  if (cached && cached.splits.every((split, i) => split === splits[i])) return cached.segments
  const segments = tracks.flatMap((track, i) => segmentsOf(track, splits[i]))
  segmentCache.set(tracks, { splits, segments })
  return segments
}

/** Both polar caps, once: they never change. */
const CAPS = [...capCells(POLE_CAP), ...capCells(-POLE_CAP)]

/**
 * On the globe, deck draws straight chords between samples while the basemap draws its own faceted sphere;
 * geometry at exactly ground level sinks in and out of that mesh, so it floats this high instead.
 */
const GLOBE_LIFT_M = 30_000

/**
 * Track alpha ahead of the satellite and at the oldest end of the flown half; the flown half fades between them.
 * One table for both themes: the contrast only has to tell head from tail at a glance.
 */
const ALPHA = {
  selected: { ahead: 255, oldest: 90 },
  normal: { ahead: 215, oldest: 35 },
  dimmed: { ahead: 28, oldest: 8 },
}
const WIDTH = { selected: 3, normal: 1.5, dimmed: 1.5 }

/** A step to TAIL_STEP right behind the satellite, then a smoothstep to 1 at TAIL_FADE_SPAN of the way back. */
function tailFade(age: number): number {
  const t = Math.min(1, age / TAIL_FADE_SPAN)
  return TAIL_STEP + (1 - TAIL_STEP) * t * t * (3 - 2 * t)
}

export interface LayerOptions {
  /** A NORAD catalog number; everything else is dimmed while one is set. */
  selected?: number | null
  hover?: Hover | null
  ghost?: Ghost | null
  globe?: boolean
  /** On the globe, whether a point faces the camera; labels of points that do not are left out. */
  onNearSide?: (lonLat: LonLat) => boolean
  palette?: Palette
}

export function buildLayers(
  satellites: Satellite[],
  tracks: TrackDatum[],
  now: Date,
  {
    selected = null,
    hover = null,
    ghost = null,
    globe = false,
    onNearSide = () => true,
    palette = PALETTES.dark,
  }: LayerOptions = {},
): Layer[] {
  const nowMs = now.getTime()
  const segments = segmentsFor(tracks, nowMs)
  const positions: PositionDatum[] = satellites.flatMap((sat) => {
    const p = positionAt(sat, now)
    if (!p) return []
    return [
      {
        name: sat.omm.OBJECT_NAME,
        lonLat: [p.lon, p.lat] as LonLat,
        noradId: sat.omm.NORAD_CAT_ID,
        family: sat.family,
      },
    ]
  })
  const emphasis = (d: SatelliteDatum): 'selected' | 'dimmed' | 'normal' =>
    selected === null ? 'normal' : d.noradId === selected ? 'selected' : 'dimmed'
  const color = (d: SatelliteDatum, alpha: number): Rgba => [...palette.family[d.family], alpha]
  // Depth hides the far side of the globe; on the flat map nothing needs hiding and the test only causes z-fighting.
  const depth = { depthCompare: globe ? 'less-equal' : 'always' } as const
  // A translation applied after tessellation: deck's globe grid cutter mangles paths given a third coordinate.
  const modelMatrix = globe ? new Matrix4().translate([0, 0, GLOBE_LIFT_M]) : undefined
  const surface = { modelMatrix, parameters: depth } as const
  // A label is a billboard at the lifted position: depth-tested, the sphere cuts it near the limb, and its quads face
  // away from the camera for half the globe, so labels skip both tests and far-side ones are dropped instead.
  const text = { modelMatrix, parameters: { depthCompare: 'always', cullMode: 'none' } } as const
  // Beyond ±85° the basemap has no data and draws a fan that picks up whatever touches it. Rather than patch
  // the night and the reach into that, the caps are blank gray discs: honest holes, in a neutral neither theme nor
  // the night uses.
  const layers: Layer[] = [
    new SolidPolygonLayer<LonLat[]>({
      id: 'poles',
      data: CAPS,
      wrapLongitude: !globe,
      getPolygon: (d) => d,
      getFillColor: [...palette.cap, 255],
      updateTriggers: { getFillColor: palette },
      pickable: false,
      ...surface,
    }),
    new PathLayer<SegmentDatum>({
      id: 'tracks',
      data: segments,
      pickable: true,
      getPath: (d) => d.path,
      getColor: (d) => {
        const { ahead, oldest } = ALPHA[emphasis(d)]
        return color(d, d.half === 'future' ? ahead : Math.round(ahead + (oldest - ahead) * tailFade(d.age)))
      },
      getWidth: (d) => WIDTH[emphasis(d)],
      widthUnits: 'pixels',
      ...surface,
      updateTriggers: { getColor: [selected, palette], getWidth: selected },
    }),
    new ScatterplotLayer<PositionDatum>({
      id: 'positions',
      data: positions,
      pickable: true,
      getPosition: (d) => d.lonLat,
      getFillColor: (d) => color(d, emphasis(d) === 'dimmed' ? 50 : 255),
      getLineColor: palette.bg,
      stroked: true,
      lineWidthMinPixels: 1.5,
      getRadius: (d) => (emphasis(d) === 'selected' ? 8 : 5),
      radiusUnits: 'pixels',
      ...surface,
      updateTriggers: { getFillColor: [selected, palette], getRadius: selected },
    }),
    new TextLayer<PositionDatum>({
      id: 'labels',
      data: positions.filter((d) => onNearSide(d.lonLat)),
      pickable: true,
      getPosition: (d) => d.lonLat,
      getText: (d) => d.name,
      getColor: (d) => [...palette.text, emphasis(d) === 'dimmed' ? 90 : 255],
      getSize: 12,
      getPixelOffset: [0, -14],
      fontFamily: 'system-ui, sans-serif',
      updateTriggers: { getColor: [selected, palette] },
      ...text,
    }),
  ]

  const ghostSat = ghost && satellites.find((s) => s.omm.NORAD_CAT_ID === ghost.noradId)
  const ghostPosition = ghostSat && positionAt(ghostSat, new Date(ghost.timeMs))
  if (ghostSat && ghostPosition) {
    const datum = { lonLat: [ghostPosition.lon, ghostPosition.lat] as LonLat, family: ghostSat.family }
    const reach = ghostReach(
      tracks.find((t) => t.noradId === ghostSat.omm.NORAD_CAT_ID),
      ghost.timeMs,
    )
    if (reach) {
      // Sample on a grid through the ghost time itself, so the dashes pass through the marker.
      const stepMs = 30_000
      const from = ghost.timeMs - Math.ceil((ghost.timeMs - reach[0]) / stepMs) * stepMs
      const continuation: TrackDatum = {
        noradId: ghostSat.omm.NORAD_CAT_ID,
        family: ghostSat.family,
        samples: trackSamplesBetween(ghostSat, from, reach[1]),
      }
      const pieces = splitAtAntimeridian(continuation.samples.map((sample) => sample.lonLat))
      layers.push(
        new PathLayer<TrackDatum & { path: LonLat[] }, PathStyleExtensionProps<TrackDatum>>({
          id: 'ghost-track',
          data: pieces.map((path) => ({ ...continuation, path })),
          pickable: true,
          getPath: (d) => d.path,
          getColor: [...palette.family[ghostSat.family], 150],
          getWidth: 1.5,
          widthUnits: 'pixels',
          getDashArray: [6, 4],
          extensions: [new PathStyleExtension({ dash: true })],
          ...surface,
        }),
      )
    }
    layers.push(
      new ScatterplotLayer<typeof datum>({
        id: 'ghost',
        data: [datum],
        getPosition: (d) => d.lonLat,
        getLineColor: (d) => palette.family[d.family],
        filled: false,
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: 7,
        radiusUnits: 'pixels',
        ...surface,
      }),
      new TextLayer<typeof datum>({
        id: 'ghost-label',
        data: onNearSide(datum.lonLat) ? [datum] : [],
        getPosition: (d) => d.lonLat,
        getText: () => `${ghostSat.omm.OBJECT_NAME} · ${hhmm(ghost.timeMs)} UTC`,
        getColor: palette.text,
        getSize: 12,
        getPixelOffset: [0, 18],
        background: true,
        getBackgroundColor: palette.panel,
        backgroundPadding: [6, 3],
        fontFamily: 'system-ui, sans-serif',
        characterSet: 'auto',
        ...text,
      }),
    )
  }

  if (hover) {
    const name = satellites.find((s) => s.omm.NORAD_CAT_ID === hover.noradId)?.omm.OBJECT_NAME ?? ''
    layers.push(
      new ScatterplotLayer<Hover>({
        id: 'hover-marker',
        data: [hover],
        getPosition: (d) => d.lonLat,
        getFillColor: palette.marker,
        getRadius: 4,
        radiusUnits: 'pixels',
        ...surface,
      }),
      new TextLayer<Hover>({
        id: 'hover-label',
        data: [hover],
        getPosition: (d) => d.lonLat,
        getText: () => `${name} · ${hhmmss(hover.timeMs)} UTC · ${formatOffset(hover.timeMs, nowMs)}`,
        getColor: palette.text,
        getSize: 12,
        getPixelOffset: [0, 16],
        background: true,
        getBackgroundColor: palette.panel,
        backgroundPadding: [6, 3],
        fontFamily: 'system-ui, sans-serif',
        characterSet: 'auto',
        ...text,
      }),
    )
  }

  return layers
}
