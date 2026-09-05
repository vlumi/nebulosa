import type { Layer } from '@deck.gl/core'
import { PathStyleExtension, type PathStyleExtensionProps } from '@deck.gl/extensions'
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { formatOffset, hhmm, hhmmss } from '../shared/format'
import {
  DEFAULT_SPAN,
  nearestSample,
  positionAt,
  trackSamples,
  trackSamplesBetween,
  type LonLat,
  type OrbitFamily,
  type Satellite,
  type TrackSample,
  type TrackSpan,
} from '../orbit/orbit'
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
    segments.push({ ...track, half: 'past', age, path: chunk })
  }
  const future = path.slice(Math.max(0, split - 1))
  if (future.length > 1) segments.push({ ...track, half: 'future', age: 0, path: future })
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
): Layer[] {
  const nowMs = now.getTime()
  const lift = globe ? GLOBE_LIFT_M : 0
  // Depth hides the far side of the globe; on the flat map nothing needs hiding and the test only causes z-fighting.
  const depth = { depthCompare: globe ? 'less-equal' : 'always' } as const
  const above = ([lon, lat]: LonLat): [number, number, number] => [lon, lat, lift]
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

  const layers: Layer[] = [
    new PathLayer<SegmentDatum>({
      id: 'tracks',
      data: segments,
      pickable: true,
      wrapLongitude: true,
      getPath: (d) => d.path.map(above),
      getColor: (d) => {
        const { ahead, oldest } = ALPHA[emphasis(d)]
        return color(d, Math.round(ahead + (oldest - ahead) * tailFade(d.age)))
      },
      getWidth: (d) => WIDTH[emphasis(d)],
      widthUnits: 'pixels',
      parameters: depth,
      updateTriggers: { getPath: lift, getColor: selected, getWidth: selected },
    }),
    new ScatterplotLayer<PositionDatum>({
      id: 'positions',
      data: positions,
      pickable: true,
      getPosition: (d) => above(d.lonLat),
      getFillColor: (d) => color(d, emphasis(d) === 'dimmed' ? 50 : 255),
      getLineColor: [11, 13, 20],
      stroked: true,
      lineWidthMinPixels: 1.5,
      getRadius: (d) => (emphasis(d) === 'selected' ? 8 : 5),
      radiusUnits: 'pixels',
      parameters: depth,
      updateTriggers: { getPosition: lift, getFillColor: selected, getRadius: selected },
    }),
    new TextLayer<PositionDatum>({
      id: 'labels',
      data: positions,
      pickable: true,
      getPosition: (d) => above(d.lonLat),
      getText: (d) => d.name,
      getColor: (d) => [214, 217, 224, emphasis(d) === 'dimmed' ? 90 : 255],
      getSize: 12,
      getPixelOffset: [0, -14],
      fontFamily: 'system-ui, sans-serif',
      updateTriggers: { getPosition: lift, getColor: selected },
      // On the globe the text quads face away from the camera for half the sphere; culling would drop them.
      parameters: { ...depth, cullMode: 'none' },
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
      layers.push(
        new PathLayer<TrackDatum, PathStyleExtensionProps<TrackDatum>>({
          id: 'ghost-track',
          data: [continuation],
          pickable: true,
          wrapLongitude: true,
          getPath: (d) => d.samples.map((sample) => above(sample.lonLat)),
          getColor: [...FAMILY_COLORS[ghostSat.family], 150],
          getWidth: 1.5,
          widthUnits: 'pixels',
          getDashArray: [6, 4],
          extensions: [new PathStyleExtension({ dash: true })],
          parameters: depth,
        }),
      )
    }
    layers.push(
      new ScatterplotLayer<typeof datum>({
        id: 'ghost',
        data: [datum],
        getPosition: (d) => above(d.lonLat),
        getLineColor: (d) => FAMILY_COLORS[d.family],
        filled: false,
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: 7,
        radiusUnits: 'pixels',
        parameters: depth,
      }),
      new TextLayer<typeof datum>({
        id: 'ghost-label',
        data: [datum],
        getPosition: (d) => above(d.lonLat),
        getText: () => `${ghostSat.omm.OBJECT_NAME} · ${hhmm(ghost.timeMs)} UTC`,
        getColor: [214, 217, 224],
        getSize: 12,
        getPixelOffset: [0, 18],
        background: true,
        getBackgroundColor: [11, 13, 20, 220],
        backgroundPadding: [6, 3],
        fontFamily: 'system-ui, sans-serif',
        characterSet: 'auto',
        parameters: depth,
      }),
    )
  }

  if (hover) {
    const name = satellites.find((s) => s.omm.NORAD_CAT_ID === hover.noradId)?.omm.OBJECT_NAME ?? ''
    layers.push(
      new ScatterplotLayer<Hover>({
        id: 'hover-marker',
        data: [hover],
        getPosition: (d) => above(d.lonLat),
        getFillColor: [255, 255, 255],
        getRadius: 4,
        radiusUnits: 'pixels',
        parameters: depth,
      }),
      new TextLayer<Hover>({
        id: 'hover-label',
        data: [hover],
        getPosition: (d) => above(d.lonLat),
        getText: () => `${name} · ${hhmmss(hover.timeMs)} UTC · ${formatOffset(hover.timeMs, nowMs)}`,
        getColor: [214, 217, 224],
        getSize: 12,
        getPixelOffset: [0, 16],
        background: true,
        getBackgroundColor: [11, 13, 20, 220],
        backgroundPadding: [6, 3],
        fontFamily: 'system-ui, sans-serif',
        characterSet: 'auto',
        parameters: depth,
      }),
    )
  }

  return layers
}
