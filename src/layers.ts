import type { Layer } from '@deck.gl/core'
import { PathLayer, ScatterplotLayer, SolidPolygonLayer, TextLayer } from '@deck.gl/layers'
import { formatOffset } from './clock'
import { nearestSample, positionAt, trackSamples, type LonLat, type OrbitFamily, type Satellite, type TrackSample } from './orbit'
import { nightPolygon } from './sun'

export type Rgb = [number, number, number]
export type Rgba = [number, number, number, number]

export const FAMILY_COLORS: Record<OrbitFamily, Rgb> = {
  'sun-synchronous': [238, 221, 102],
  'mid-inclination': [102, 204, 238],
}

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

export function trackData(satellites: Satellite[], time: Date): TrackDatum[] {
  return satellites.map((sat) => ({ samples: trackSamples(sat, time), noradId: sat.omm.NORAD_CAT_ID, family: sat.family }))
}

export function hoverAt(track: TrackDatum, lonLat: LonLat): Hover {
  const sample = track.samples[nearestSample(track.samples, lonLat)]
  return { noradId: track.noradId, lonLat: sample.lonLat, timeMs: sample.timeMs }
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
): Layer[] {
  const nowMs = now.getTime()
  const segments = tracks.flatMap((track) => segmentsOf(track, nowMs))
  const positions: PositionDatum[] = satellites.flatMap((sat) => {
    const p = positionAt(sat, now)
    if (!p) return []
    return [{ name: sat.omm.OBJECT_NAME, lonLat: [p.lon, p.lat] as LonLat, noradId: sat.omm.NORAD_CAT_ID, family: sat.family }]
  })
  const emphasis = (d: SatelliteDatum): 'selected' | 'dimmed' | 'normal' =>
    selected === null ? 'normal' : d.noradId === selected ? 'selected' : 'dimmed'
  const color = (d: SatelliteDatum, alpha: number): Rgba => [...FAMILY_COLORS[d.family], alpha]

  const layers: Layer[] = [
    new SolidPolygonLayer<LonLat[]>({
      id: 'night',
      data: [nightPolygon(now)],
      getPolygon: (d) => d,
      getFillColor: [0, 4, 20, 90],
      pickable: false,
    }),
    new PathLayer<SegmentDatum>({
      id: 'tracks',
      data: segments,
      pickable: true,
      wrapLongitude: true,
      getPath: (d) => d.path,
      getColor: (d) => {
        const { ahead, oldest } = ALPHA[emphasis(d)]
        return color(d, Math.round(ahead + (oldest - ahead) * tailFade(d.age)))
      },
      getWidth: (d) => WIDTH[emphasis(d)],
      widthUnits: 'pixels',
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
      updateTriggers: { getFillColor: selected, getRadius: selected },
    }),
    new TextLayer<PositionDatum>({
      id: 'labels',
      data: positions,
      pickable: true,
      getPosition: (d) => d.lonLat,
      getText: (d) => d.name,
      getColor: (d) => [214, 217, 224, emphasis(d) === 'dimmed' ? 90 : 255],
      getSize: 12,
      getPixelOffset: [0, -14],
      fontFamily: 'system-ui, sans-serif',
      updateTriggers: { getColor: selected },
    }),
  ]

  const ghostSat = ghost && satellites.find((s) => s.omm.NORAD_CAT_ID === ghost.noradId)
  const ghostPosition = ghostSat && positionAt(ghostSat, new Date(ghost.timeMs))
  if (ghostSat && ghostPosition) {
    const datum = { lonLat: [ghostPosition.lon, ghostPosition.lat] as LonLat, family: ghostSat.family }
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
      }),
      new TextLayer<typeof datum>({
        id: 'ghost-label',
        data: [datum],
        getPosition: (d) => d.lonLat,
        getText: () => `${ghostSat.omm.OBJECT_NAME} · ${new Date(ghost.timeMs).toISOString().slice(11, 16)} UTC`,
        getColor: [214, 217, 224],
        getSize: 12,
        getPixelOffset: [0, 18],
        background: true,
        getBackgroundColor: [11, 13, 20, 220],
        backgroundPadding: [6, 3],
        fontFamily: 'system-ui, sans-serif',
      }),
    )
  }

  if (hover) {
    const name = satellites.find((s) => s.omm.NORAD_CAT_ID === hover.noradId)?.omm.OBJECT_NAME ?? ''
    const at = new Date(hover.timeMs).toISOString().slice(11, 19)
    layers.push(
      new ScatterplotLayer<Hover>({
        id: 'hover-marker',
        data: [hover],
        getPosition: (d) => d.lonLat,
        getFillColor: [255, 255, 255],
        getRadius: 4,
        radiusUnits: 'pixels',
      }),
      new TextLayer<Hover>({
        id: 'hover-label',
        data: [hover],
        getPosition: (d) => d.lonLat,
        getText: () => `${name} · ${at} UTC · ${formatOffset(hover.timeMs, nowMs)}`,
        getColor: [214, 217, 224],
        getSize: 12,
        getPixelOffset: [0, 16],
        background: true,
        getBackgroundColor: [11, 13, 20, 220],
        backgroundPadding: [6, 3],
        fontFamily: 'system-ui, sans-serif',
      }),
    )
  }

  return layers
}
