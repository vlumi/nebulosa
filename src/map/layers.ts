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
import { FAMILY_COLORS, type Rgba } from '../shared/palette'

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
 * The time span a dashed continuation must cover so a ghost outside the drawn ±1-orbit track
 * connects to it; null when the ghost already sits on the drawn track.
 */
function ghostReach(sat: Satellite, ghostMs: number, nowMs: number, span: TrackSpan): [number, number] | null {
  const periodMs = sat.periodMinutes * 60_000
  const drawnEnd = nowMs + span.futureOrbits * periodMs
  const drawnStart = nowMs - span.pastOrbits * periodMs
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
/** Share of the flown half over which the tail fades from full to floor; flat beyond it. */
const TAIL_FADE_SPAN = 0.12

/**
 * The track split at `now`. The half ahead is one segment; the flown half is a run of chunks with
 * increasing `age`, so it can fade out behind the satellite. Neighbours share a boundary point.
 */
function segmentsOf(track: TrackDatum, nowMs: number): SegmentDatum[] {
  const i = track.samples.findIndex((s) => s.timeMs > nowMs)
  const split = i === -1 ? track.samples.length : i
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
 * On the globe, deck draws straight chords between samples while the basemap draws its own faceted sphere;
 * geometry at exactly ground level sinks in and out of that mesh, so it floats this high instead.
 */
const GLOBE_LIFT_M = 30_000

const ALPHA = {
  selected: { ahead: 255, oldest: 130 },
  normal: { ahead: 200, oldest: 40 },
  dimmed: { ahead: 40, oldest: 12 },
}
const WIDTH = { selected: 3, normal: 1.5, dimmed: 1.5 }

/** Smoothstep from 0 at the satellite to 1 at TAIL_FADE_SPAN of the way back, then 1. */
function tailFade(age: number): number {
  const t = Math.min(1, age / TAIL_FADE_SPAN)
  return t * t * (3 - 2 * t)
}

/** `selected` is a NORAD catalog number; everything else is dimmed while one is set. */
export function buildLayers(
  satellites: Satellite[],
  tracks: TrackDatum[],
  now: Date,
  selected: number | null = null,
  hover: Hover | null = null,
  ghost: Ghost | null = null,
  span: TrackSpan = DEFAULT_SPAN,
  globe = false,
  /** On the globe, whether a point faces the camera; labels of points that do not are left out. */
  onNearSide: (lonLat: LonLat) => boolean = () => true,
): Layer[] {
  const nowMs = now.getTime()
  const segments = tracks.flatMap((track) => segmentsOf(track, nowMs))
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
  const color = (d: SatelliteDatum, alpha: number): Rgba => [...FAMILY_COLORS[d.family], alpha]
  // Depth hides the far side of the globe; on the flat map nothing needs hiding and the test only causes z-fighting.
  const depth = { depthCompare: globe ? 'less-equal' : 'always' } as const
  // A translation applied after tessellation: deck's globe grid cutter mangles paths given a third coordinate.
  const modelMatrix = globe ? new Matrix4().translate([0, 0, GLOBE_LIFT_M]) : undefined
  const surface = { modelMatrix, parameters: depth } as const
  // A label is a billboard at the lifted position: depth-tested, the sphere cuts it near the limb, and its quads face
  // away from the camera for half the globe, so labels skip both tests and far-side ones are dropped instead.
  const text = { modelMatrix, parameters: { depthCompare: 'always', cullMode: 'none' } } as const
  // Beyond ±85° the basemap has no data and draws a fan that picks up whatever touches it. Rather than patch
  // the night and the reach into that, the caps are blank discs in the page color: honest holes.
  const caps = [...capCells(POLE_CAP), ...capCells(-POLE_CAP)]
  const layers: Layer[] = [
    new SolidPolygonLayer<LonLat[]>({
      id: 'poles',
      data: caps,
      wrapLongitude: !globe,
      getPolygon: (d) => d,
      getFillColor: [11, 13, 20, 255],
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
        return color(d, Math.round(ahead + (oldest - ahead) * tailFade(d.age)))
      },
      getWidth: (d) => WIDTH[emphasis(d)],
      widthUnits: 'pixels',
      ...surface,
      updateTriggers: { getColor: selected, getWidth: selected },
    }),
    new ScatterplotLayer<PositionDatum>({
      id: 'positions',
      data: positions,
      pickable: true,
      getPosition: (d) => d.lonLat,
      getFillColor: (d) => color(d, emphasis(d) === 'dimmed' ? 50 : 255),
      getLineColor: [11, 13, 20],
      stroked: true,
      lineWidthMinPixels: 1.5,
      getRadius: (d) => (emphasis(d) === 'selected' ? 8 : 5),
      radiusUnits: 'pixels',
      ...surface,
      updateTriggers: { getFillColor: selected, getRadius: selected },
    }),
    new TextLayer<PositionDatum>({
      id: 'labels',
      data: positions.filter((d) => onNearSide(d.lonLat)),
      pickable: true,
      getPosition: (d) => d.lonLat,
      getText: (d) => d.name,
      getColor: (d) => [214, 217, 224, emphasis(d) === 'dimmed' ? 90 : 255],
      getSize: 12,
      getPixelOffset: [0, -14],
      fontFamily: 'system-ui, sans-serif',
      updateTriggers: { getColor: selected },
      ...text,
    }),
  ]

  const ghostSat = ghost && satellites.find((s) => s.omm.NORAD_CAT_ID === ghost.noradId)
  const ghostPosition = ghostSat && positionAt(ghostSat, new Date(ghost.timeMs))
  if (ghostSat && ghostPosition) {
    const datum = { lonLat: [ghostPosition.lon, ghostPosition.lat] as LonLat, family: ghostSat.family }
    const reach = ghostReach(ghostSat, ghost.timeMs, nowMs, span)
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
          getColor: [...FAMILY_COLORS[ghostSat.family], 150],
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
        getLineColor: (d) => FAMILY_COLORS[d.family],
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
        getColor: [214, 217, 224],
        getSize: 12,
        getPixelOffset: [0, 18],
        background: true,
        getBackgroundColor: [11, 13, 20, 220],
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
        getFillColor: [255, 255, 255],
        getRadius: 4,
        radiusUnits: 'pixels',
        ...surface,
      }),
      new TextLayer<Hover>({
        id: 'hover-label',
        data: [hover],
        getPosition: (d) => d.lonLat,
        getText: () => `${name} · ${hhmmss(hover.timeMs)} UTC · ${formatOffset(hover.timeMs, nowMs)}`,
        getColor: [214, 217, 224],
        getSize: 12,
        getPixelOffset: [0, 16],
        background: true,
        getBackgroundColor: [11, 13, 20, 220],
        backgroundPadding: [6, 3],
        fontFamily: 'system-ui, sans-serif',
        characterSet: 'auto',
        ...text,
      }),
    )
  }

  return layers
}
