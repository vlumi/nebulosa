import type { Map as MapLibre } from 'maplibre-gl'

/** How far, in pixels, a basemap label may be from the tap to name the place after it. */
const LABEL_RADIUS_PX = 60
const SETTLEMENTS = new Set(['city', 'town', 'village'])

/** The nearest settlement label the basemap shows within reach of the point, else the nearest country label. */
export function nearestLabel(map: MapLibre | null, point: { x: number; y: number }): string | undefined {
  if (!map) return undefined
  const r = LABEL_RADIUS_PX
  const features = map.queryRenderedFeatures([
    [point.x - r, point.y - r],
    [point.x + r, point.y + r],
  ])
  const named = features.filter((f) => f.sourceLayer === 'place' && typeof f.properties?.name === 'string')
  const rank = (f: (typeof named)[number]) => {
    const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates
    const p = map.project([lon, lat])
    return Math.hypot(p.x - point.x, p.y - point.y)
  }
  const pick = (test: (cls: unknown) => boolean) =>
    named.filter((f) => test(f.properties.class)).sort((a, b) => rank(a) - rank(b))[0]
  const label = pick((cls) => SETTLEMENTS.has(String(cls))) ?? pick((cls) => cls === 'country')
  return label ? String(label.properties['name:en'] ?? label.properties.name_en ?? label.properties.name) : undefined
}
