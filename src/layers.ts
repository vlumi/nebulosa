import type { Layer } from '@deck.gl/core'
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { groundTrack, positionAt, type LonLat, type OrbitFamily, type Satellite } from './orbit'

export type Rgb = [number, number, number]

export const FAMILY_COLORS: Record<OrbitFamily, Rgb> = {
  'sun-synchronous': [238, 221, 102],
  'mid-inclination': [102, 204, 238],
}

interface TrackDatum {
  path: LonLat[]
  family: OrbitFamily
}

interface PositionDatum {
  name: string
  lonLat: LonLat
  family: OrbitFamily
}

export function buildLayers(satellites: Satellite[], now: Date): Layer[] {
  const tracks: TrackDatum[] = satellites.map((sat) => ({ path: groundTrack(sat, now), family: sat.family }))
  const positions: PositionDatum[] = satellites.flatMap((sat) => {
    const p = positionAt(sat, now)
    return p ? [{ name: sat.omm.OBJECT_NAME, lonLat: [p.lon, p.lat] as LonLat, family: sat.family }] : []
  })

  return [
    new PathLayer<TrackDatum>({
      id: 'tracks',
      data: tracks,
      wrapLongitude: true,
      getPath: (d) => d.path,
      getColor: (d) => [...FAMILY_COLORS[d.family], 160],
      getWidth: 1.5,
      widthUnits: 'pixels',
    }),
    new ScatterplotLayer<PositionDatum>({
      id: 'positions',
      data: positions,
      getPosition: (d) => d.lonLat,
      getFillColor: (d) => FAMILY_COLORS[d.family],
      getLineColor: [11, 13, 20],
      stroked: true,
      lineWidthMinPixels: 1.5,
      radiusMinPixels: 5,
      radiusMaxPixels: 5,
    }),
    new TextLayer<PositionDatum>({
      id: 'labels',
      data: positions,
      getPosition: (d) => d.lonLat,
      getText: (d) => d.name,
      getColor: [214, 217, 224],
      getSize: 12,
      getPixelOffset: [0, -14],
      fontFamily: 'system-ui, sans-serif',
    }),
  ]
}
