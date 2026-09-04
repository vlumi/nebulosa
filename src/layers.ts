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

export function trackData(satellites: Satellite[], time: Date): TrackDatum[] {
  return satellites.map((sat) => ({ samples: trackSamples(sat, time), noradId: sat.omm.NORAD_CAT_ID, family: sat.family }))
}

export function hoverAt(track: TrackDatum, lonLat: LonLat): Hover {
  const sample = track.samples[nearestSample(track.samples, lonLat)]
  return { noradId: track.noradId, lonLat: sample.lonLat, timeMs: sample.timeMs }
}

/** The track split at `now`: the flown half and the half still ahead, sharing the boundary point. */
function halves(track: TrackDatum, nowMs: number): SegmentDatum[] {
  const i = track.samples.findIndex((s) => s.timeMs > nowMs)
  const split = i === -1 ? track.samples.length : i
  const path = track.samples.map((s) => s.lonLat)
  const past: SegmentDatum = { ...track, half: 'past', path: path.slice(0, split + 1) }
  const future: SegmentDatum = { ...track, half: 'future', path: path.slice(Math.max(0, split - 1)) }
  return [past, future].filter((segment) => segment.path.length > 1)
}

const ALPHA = {
  past: { selected: 140, normal: 90, dimmed: 25 },
  future: { selected: 255, normal: 200, dimmed: 50 },
}
const WIDTH = {
  past: { selected: 2, normal: 1, dimmed: 1 },
  future: { selected: 3, normal: 1.5, dimmed: 1.5 },
}

/** `selected` is a NORAD catalog number; everything else is dimmed while one is set. */
export function buildLayers(
  satellites: Satellite[],
  tracks: TrackDatum[],
  now: Date,
  selected: number | null = null,
  hover: Hover | null = null,
): Layer[] {
  const nowMs = now.getTime()
  const segments = tracks.flatMap((track) => halves(track, nowMs))
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
      getColor: (d) => color(d, ALPHA[d.half][emphasis(d)]),
      getWidth: (d) => WIDTH[d.half][emphasis(d)],
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
