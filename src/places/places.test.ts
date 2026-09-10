import { loadPlaces, newPlace, parseLocation, savePlaces, SEED, SEED_JA, TOKYO } from './places'

class MemoryStorage {
  private items = new Map<string, string>()
  getItem = (key: string) => this.items.get(key) ?? null
  setItem = (key: string, value: string) => void this.items.set(key, value)
}
const memory = () => new MemoryStorage() as unknown as Storage

test('an empty store yields the seed of the given language', () => {
  expect(loadPlaces(memory(), SEED_JA).places[0].name).toBe('東京')
})

test('an empty or unreadable store yields the seed', () => {
  expect(loadPlaces(memory())).toEqual(SEED)
  const broken = memory()
  broken.setItem('nebulosa.places', '{not json')
  expect(loadPlaces(broken)).toEqual(SEED)
  const noPlaces = memory()
  noPlaces.setItem('nebulosa.places', JSON.stringify({ places: [{ id: 1 }], placeId: 'x' }))
  expect(loadPlaces(noPlaces)).toEqual(SEED)
  expect(loadPlaces(undefined)).toEqual(SEED)
})

test('places round-trip through storage; a selection of a missing place is dropped', () => {
  const store = memory()
  const helsinki = { ...newPlace({ lat: 60.17, lon: 24.94 }), name: 'Helsinki' }
  savePlaces({ places: [TOKYO, helsinki], placeId: helsinki.id, pinsLocked: true }, store)
  expect(loadPlaces(store)).toEqual({ places: [TOKYO, helsinki], placeId: helsinki.id, pinsLocked: true })
  savePlaces({ places: [TOKYO], placeId: 'gone', pinsLocked: false }, store)
  expect(loadPlaces(store)).toEqual({ places: [TOKYO], placeId: null, pinsLocked: false })
})

test('a new place is named after its coordinates and gets a fresh id', () => {
  const a = newPlace({ lat: 60.17, lon: 24.94 })
  const b = newPlace({ lat: 60.17, lon: 24.94 })
  expect(a.name).toBe('60.17°N 24.94°E')
  expect(newPlace({ lat: 60.17, lon: 24.94 }, 'Helsinki').name).toBe('Helsinki')
  expect(a.id).not.toBe(b.id)
})

test('coordinates are read from decimal, signed, lettered and DMS text, and not from anything else', () => {
  expect(parseLocation('35.6812, 139.7671')).toEqual({ lat: 35.6812, lon: 139.7671 })
  expect(parseLocation(' -33.8688 -70.6483 ')).toEqual({ lat: -33.8688, lon: -70.6483 })
  expect(parseLocation('35.6812° N, 139.7671° E')).toEqual({ lat: 35.6812, lon: 139.7671 })
  expect(parseLocation('33.8688°s 70.6483°w')).toEqual({ lat: -33.8688, lon: -70.6483 })
  expect(parseLocation('35°41′N 139°46′E')?.lat).toBeCloseTo(35.6833, 4)
  expect(parseLocation('35°41′N 139°46′E')?.lon).toBeCloseTo(139.7667, 4)
  for (const text of ['', 'hello', '35.68', '91, 0', '35.68, 181', '35,68 139,69'])
    expect(parseLocation(text)).toBeNull()
})
