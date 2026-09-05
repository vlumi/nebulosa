import type { Feature, MultiPolygon, Polygon } from 'geojson'
import type { LonLat, OrbitFamily, TrackSample } from '../orbit/orbit'
import { nightPolygon, POLE_CAP } from '../orbit/sun'
import { reachRibbons } from '../orbit/swath'
import { FAMILY_COLORS } from '../shared/palette'

/**
 * The two shaded surfaces, night and SAR reach, are MapLibre fill layers rather than deck.gl polygons:
 * the basemap tessellates them onto its own globe, hides the far side and has nothing to z-fight with.
 */
export const NIGHT_LAYER = 'night'
export const REACH_LAYER = 'reach'

/** No antialiasing, as on the style's own water: a fill that spans the antimeridian is tiled in two halves, and
 * their antialiased edges would meet in a hairline twice as dark as the fill. */
export const NIGHT_PAINT = { 'fill-color': 'rgb(0 4 20)', 'fill-opacity': 90 / 255, 'fill-antialias': false } as const
export const REACH_OPACITY = 45 / 255

export const reachFill = (family: OrbitFamily) => `rgb(${FAMILY_COLORS[family].join(' ')})`

export const EMPTY: Feature<MultiPolygon> = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'MultiPolygon', coordinates: [] },
}

export function nightFeature(date: Date): Feature<Polygon> {
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [nightPolygon(date)] } }
}

/** A ring that crosses the antimeridian is unwrapped past ±180°, which the tiler handles; a jump within it would not be. */
function unwrapped(ring: LonLat[]): LonLat[] {
  let offset = 0
  return ring.map(([lon, lat], i) => {
    if (i > 0) {
      const previous = ring[i - 1][0] + offset
      const candidate = lon + offset
      if (candidate - previous > 180) offset -= 360
      else if (previous - candidate > 180) offset += 360
    }
    return [lon + offset, lat]
  })
}

/** The fill ends where Mercator does; the polar caps beyond show as blank, like the basemap there. */
const belowCap = (ring: LonLat[]) => ring.every(([, lat]) => Math.abs(lat) <= POLE_CAP)

export function reachFeature(samples: TrackSample[]): Feature<MultiPolygon> {
  const rings = reachRibbons(samples)
    .filter(belowCap)
    .map(unwrapped)
    .map((ring) => [[...ring, ring[0]]])
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: rings } }
}
