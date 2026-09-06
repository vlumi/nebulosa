import { useApp } from '../store'
import { STRINGS, type Strings } from './strings'

/** The dictionary of the chosen language. */
export function useStrings(): Strings {
  return useApp((s) => STRINGS[s.lang])
}
