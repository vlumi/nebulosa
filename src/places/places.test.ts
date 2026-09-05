import { loadPlaces, newPlace, savePlaces, SEED, TOKYO } from './places'

class MemoryStorage {
  private items = new Map<string, string>()
  getItem = (key: string) => this.items.get(key) ?? null
  setItem = (key: string, value: string) => void this.items.set(key, value)
}
const memory = () => new MemoryStorage() as unknown as Storage

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
  savePlaces({ places: [TOKYO, helsinki], placeId: helsinki.id }, store)
  expect(loadPlaces(store)).toEqual({ places: [TOKYO, helsinki], placeId: helsinki.id })
  savePlaces({ places: [TOKYO], placeId: 'gone' }, store)
  expect(loadPlaces(store)).toEqual({ places: [TOKYO], placeId: null })
})

test('a new place is named after its coordinates and gets a fresh id', () => {
  const a = newPlace({ lat: 60.17, lon: 24.94 })
  const b = newPlace({ lat: 60.17, lon: 24.94 })
  expect(a.name).toBe('60.17°N 24.94°E')
  expect(newPlace({ lat: 60.17, lon: 24.94 }, 'Helsinki').name).toBe('Helsinki')
  expect(a.id).not.toBe(b.id)
})
