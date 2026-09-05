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

/**
 * The fill ends where Mercator does, at the rim of the blank polar cap: corners beyond it are pulled back onto
 * the rim so the band runs into the disc without a staircase. A quad that straddles the pole itself spans half
 * the world in longitude, which no longitude-based renderer draws right, and is left out under the disc.
 */
const toRim = (ring: LonLat[]): LonLat[] =>
  ring.map(([lon, lat]) => [lon, Math.max(-POLE_CAP, Math.min(POLE_CAP, lat))])
const narrow = (ring: LonLat[]) => {
  const lons = ring.map(([lon]) => lon)
  return Math.max(...lons) - Math.min(...lons) < 90
}

export function reachFeature(samples: TrackSample[]): Feature<MultiPolygon> {
  const rings = reachRibbons(samples)
    .map(toRim)
    .map(unwrapped)
    .filter(narrow)
    .map((ring) => [[...ring, ring[0]]])
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: rings } }
}
