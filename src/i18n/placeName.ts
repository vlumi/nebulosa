import type { Place } from '../places/places'
import type { Strings } from './strings'

/** A located place has no name of its own: its label is fixed and comes in the reader's language. */
export const placeName = (place: Pick<Place, 'name' | 'located'>, s: Strings): string =>
  place.located ? s.places.myLocation : place.name
