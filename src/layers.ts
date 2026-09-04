import type { Layer } from '@deck.gl/core'
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { groundTrack, positionAt, type LonLat, type OrbitFamily, type Satellite } from './orbit'

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

interface TrackDatum extends SatelliteDatum {
  path: LonLat[]
}

interface PositionDatum extends SatelliteDatum {
  name: string
  lonLat: LonLat
}

/** `selected` is a NORAD catalog number; everything else is dimmed while one is set. */
export function buildLayers(satellites: Satellite[], now: Date, selected: number | null = null): Layer[] {
  const tracks: TrackDatum[] = satellites.map((sat) => ({
    path: groundTrack(sat, now),
    noradId: sat.omm.NORAD_CAT_ID,
    family: sat.family,
  }))
  const positions: PositionDatum[] = satellites.flatMap((sat) => {
    const p = positionAt(sat, now)
    if (!p) return []
    return [{ name: sat.omm.OBJECT_NAME, lonLat: [p.lon, p.lat] as LonLat, noradId: sat.omm.NORAD_CAT_ID, family: sat.family }]
  })
  const emphasis = (d: SatelliteDatum): 'selected' | 'dimmed' | 'normal' =>
    selected === null ? 'normal' : d.noradId === selected ? 'selected' : 'dimmed'
  const alpha = { selected: 255, normal: 160, dimmed: 50 }
  const color = (d: SatelliteDatum): Rgba => [...FAMILY_COLORS[d.family], alpha[emphasis(d)]]

  return [
    new PathLayer<TrackDatum>({
      id: 'tracks',
      data: tracks,
      pickable: true,
      wrapLongitude: true,
      getPath: (d) => d.path,
      getColor: color,
      getWidth: (d) => (emphasis(d) === 'selected' ? 3 : 1.5),
      widthUnits: 'pixels',
      updateTriggers: { getColor: selected, getWidth: selected },
    }),
    new ScatterplotLayer<PositionDatum>({
      id: 'positions',
      data: positions,
      pickable: true,
      getPosition: (d) => d.lonLat,
      getFillColor: color,
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
}
