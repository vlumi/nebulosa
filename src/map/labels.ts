import type { Map as MapLibre } from 'maplibre-gl'
import type { Lang } from '../i18n/strings'

/** How far, in pixels, a basemap label may be from the tap to name the place after it. */
const LABEL_RADIUS_PX = 60
/** Where the map lands to name a typed place: city labels are drawn, and the radius spans some 40 km. */
export const NAMING_ZOOM = 7
const SETTLEMENTS = new Set(['city', 'town', 'village'])

/** The nearest settlement label the basemap shows within reach of the point, else the nearest country label unless told not to. */
export function nearestLabel(
  map: MapLibre | null,
  point: { x: number; y: number },
  lang: Lang = 'en',
  { countries = true } = {},
): string | undefined {
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
  const label =
    pick((cls) => SETTLEMENTS.has(String(cls))) ?? (countries ? pick((cls) => cls === 'country') : undefined)
  return label
    ? String(label.properties[`name:${lang}`] ?? label.properties.name_en ?? label.properties.name)
    : undefined
}

/**
 * The basemap's labels in the chosen language: its style shows local names with a Latin transliteration, and
 * the tiles carry a name per language, so every symbol layer that shows a name is retargeted at that one,
 * falling back to the Latin form and then the local name where the language has none.
 */
export function labelLanguage(map: MapLibre, lang: Lang): void {
  const named = map
    .getStyle()
    .layers.filter((layer) => layer.type === 'symbol' && JSON.stringify(layer.layout?.['text-field']).includes('"name'))
  for (const layer of named) {
    map.setLayoutProperty(layer.id, 'text-field', [
      'coalesce',
      ['get', `name:${lang}`],
      ['get', 'name:latin'],
      ['get', 'name'],
    ])
  }
}
