import type { Location } from '../orbit/passes'
import { formatLocation } from '../shared/format'
import { storage } from '../shared/storage'

/** A pinned location; passes are computed for the selected one. */
export interface Place extends Location {
  id: string
  name: string
}

export interface PlacesState {
  places: Place[]
  /** The selected place, or none. */
  placeId: string | null
  /** Pins cannot be dragged while locked, so a stray drag cannot move a place. */
  pinsLocked: boolean
}

export const TOKYO: Place = { id: 'tokyo', name: 'Tokyo', lat: 35.68, lon: 139.69 }
export const SEED: PlacesState = { places: [TOKYO], placeId: TOKYO.id, pinsLocked: false }
/** The same seed for a Japanese interface: place names are the reader's own words, so the first one is in theirs. */
export const SEED_JA: PlacesState = { ...SEED, places: [{ ...TOKYO, name: '東京' }] }

const KEY = 'nebulosa.places'

const isPlace = (p: unknown): p is Place =>
  typeof p === 'object' &&
  p !== null &&
  typeof (p as Place).id === 'string' &&
  typeof (p as Place).name === 'string' &&
  Number.isFinite((p as Place).lat) &&
  Number.isFinite((p as Place).lon)

/** The places kept in this browser, or the seed when there are none or they cannot be read. */
export function loadPlaces(store = storage(), seed = SEED): PlacesState {
  try {
    const raw = store?.getItem(KEY)
    if (!raw) return seed
    const parsed = JSON.parse(raw) as Partial<PlacesState>
    const places = Array.isArray(parsed.places) ? parsed.places.filter(isPlace) : []
    if (places.length === 0) return seed
    const placeId = places.some((p) => p.id === parsed.placeId) ? (parsed.placeId as string) : null
    return { places, placeId, pinsLocked: parsed.pinsLocked === true }
  } catch {
    return seed
  }
}

export function savePlaces(state: PlacesState, store = storage()): void {
  try {
    store?.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage full or forbidden: the places live on for this visit only.
  }
}

export function newPlace(location: Location, name = formatLocation(location)): Place {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)
  return { id, name, lat: location.lat, lon: location.lon }
}
