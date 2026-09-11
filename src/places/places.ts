import { tryParseCoordinates } from 'geo-coord'
import type { Location } from '../orbit/passes'
import { formatLocation } from '../shared/format'
import { storage } from '../shared/storage'

/** A pinned location; passes are computed for the selected one. */
export interface Place extends Location {
  id: string
  name: string
  /** Placed from the browser's own location: drawn as a target, never dragged, moved only by locating again. */
  located?: true
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

export const LOCATED_ID = 'located'

export function locatedPlace(location: Location, name: string): Place {
  return { id: LOCATED_ID, name, lat: location.lat, lon: location.lon, located: true }
}

/**
 * Coordinates typed or pasted in any common shape: "35.68, 139.69", "35.6812° N, 139.7671° E",
 * "35°41′N 139°46′E", "N35.68 E139.77", a geo: URI, or signed numbers; anything else is null.
 */
export function parseLocation(text: string): Location | null {
  const coordinates = tryParseCoordinates(text)
  return coordinates && { lat: coordinates.latitude, lon: coordinates.longitude }
}

export function newPlace(location: Location, name = formatLocation(location)): Place {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)
  return { id, name, lat: location.lat, lon: location.lon }
}
