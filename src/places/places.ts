import type { Location } from '../orbit/passes'
import { formatLocation } from '../shared/format'

/** A pinned location; passes are computed for the selected one. */
export interface Place extends Location {
  id: string
  name: string
}

export interface PlacesState {
  places: Place[]
  /** The selected place, or none. */
  placeId: string | null
}

export const TOKYO: Place = { id: 'tokyo', name: 'Tokyo', lat: 35.68, lon: 139.69 }
export const SEED: PlacesState = { places: [TOKYO], placeId: TOKYO.id }

const KEY = 'nebulosa.places'

function storage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const isPlace = (p: unknown): p is Place =>
  typeof p === 'object' &&
  p !== null &&
  typeof (p as Place).id === 'string' &&
  typeof (p as Place).name === 'string' &&
  Number.isFinite((p as Place).lat) &&
  Number.isFinite((p as Place).lon)

/** The places kept in this browser, or the seed when there are none or they cannot be read. */
export function loadPlaces(store = storage()): PlacesState {
  try {
    const raw = store?.getItem(KEY)
    if (!raw) return SEED
    const parsed = JSON.parse(raw) as Partial<PlacesState>
    const places = Array.isArray(parsed.places) ? parsed.places.filter(isPlace) : []
    if (places.length === 0) return SEED
    const placeId = places.some((p) => p.id === parsed.placeId) ? (parsed.placeId as string) : null
    return { places, placeId }
  } catch {
    return SEED
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
