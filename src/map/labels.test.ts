import type { Map as MapLibre } from 'maplibre-gl'
import { nearestLabel } from './labels'

const feature = (sourceLayer: string, cls: string, name: string, x: number, extra: Record<string, string> = {}) => ({
  sourceLayer,
  properties: { class: cls, name, ...extra },
  geometry: { type: 'Point', coordinates: [x, 0] },
})

function mapWith(features: unknown[]): MapLibre {
  return {
    queryRenderedFeatures: () => features,
    project: ([lon, lat]: [number, number]) => ({ x: lon, y: lat }),
  } as unknown as MapLibre
}

test('the nearest settlement wins over a nearer country label, in its English name when it has one', () => {
  const map = mapWith([
    feature('place', 'country', 'Suomi', 1, { 'name:en': 'Finland' }),
    feature('place', 'city', 'Helsingfors', 30, { 'name:en': 'Helsinki' }),
    feature('place', 'town', 'Espoo', 4),
    feature('water', 'lake', 'Nope', 2),
  ])
  expect(nearestLabel(map, { x: 2, y: 0 })).toBe('Espoo')
})

test('the country is passed over when asked, so a remote place keeps its coordinates', () => {
  const country = mapWith([feature('place', 'country', 'Suomi', 1, { 'name:en': 'Finland' })])
  expect(nearestLabel(country, { x: 0, y: 0 }, 'en', { countries: false })).toBeUndefined()
  const town = mapWith([feature('place', 'town', 'Kerava', 2), feature('place', 'country', 'Suomi', 1)])
  expect(nearestLabel(town, { x: 0, y: 0 }, 'en', { countries: false })).toBe('Kerava')
})

test('with no settlement in reach the country serves, and with nothing named there is no name', () => {
  expect(
    nearestLabel(mapWith([feature('place', 'country', 'Suomi', 1, { 'name:en': 'Finland' })]), { x: 0, y: 0 }),
  ).toBe('Finland')
  expect(nearestLabel(mapWith([feature('water', 'lake', 'Nope', 2)]), { x: 0, y: 0 })).toBeUndefined()
  expect(nearestLabel(null, { x: 0, y: 0 })).toBeUndefined()
})

test('the name comes in the chosen language when the label has one, else as the basemap shows it', () => {
  const tokyo = feature('place', 'city', '東京都', 0, { 'name:en': 'Tokyo', 'name:ja': '東京都' })
  const nameless = feature('place', 'town', 'Somewhere', 0)
  expect(nearestLabel(mapWith([tokyo]), { x: 0, y: 0 }, 'ja')).toBe('東京都')
  expect(nearestLabel(mapWith([tokyo]), { x: 0, y: 0 })).toBe('Tokyo')
  expect(nearestLabel(mapWith([nameless]), { x: 0, y: 0 }, 'ja')).toBe('Somewhere')
})
