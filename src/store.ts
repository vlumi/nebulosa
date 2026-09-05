import { create } from 'zustand'
import type { Ghost } from './map/layers'
import type { Focus } from './map/MapView'
import { DEFAULT_SPAN, type TrackSpan } from './orbit/orbit'
import { DEFAULT_FILTERS, type Location, type Pass, type PassFilters } from './orbit/passes'
import { loadPlaces, newPlace, savePlaces, SEED, type Place, type PlacesState } from './places/places'
import { liveClock, scrubbedTo, withRate, type Clock } from './time/clock'

/** What the reader is looking at: a satellite, and possibly a pass of it with its ghost, or a probe along its track. */
export interface Selection {
  noradId: number | null
  ghost: Ghost | null
  activePass: Pass | null
  /** A moment along the selected satellite's track being inspected from the keyboard. */
  probeMs: number | null
}

export const NOTHING: Selection = { noradId: null, ghost: null, activePass: null, probeMs: null }
export { TOKYO } from './places/places'

export type Sheet = 'satellites' | 'places' | 'passes'

/** A request to center the map on a point; `seq` makes repeated requests distinct. */
export interface FlyTo extends Location {
  seq: number
}

interface State extends PlacesState {
  selection: Selection
  focus: Focus | null
  flyTo: FlyTo | null
  filters: PassFilters
  span: TrackSpan
  clock: Clock
  /** The one list open above the toolbar, if any. */
  sheet: Sheet | null
  helpOpen: boolean
  /** The radar's reach drawn beside the selected satellite's track. */
  reachVisible: boolean
  globe: boolean
}

interface Actions {
  select: (noradId: number | null) => void
  /** Select and bring into view, at `timeMs` if given. */
  selectFromList: (noradId: number, timeMs?: number) => void
  showPass: (pass: Pass) => void
  goToPass: (pass: Pass, realMs?: number) => void
  /** Move the track probe by `deltaMs`, starting from `fromMs` when there is none yet. */
  probe: (deltaMs: number, fromMs: number) => void
  /** Help first; then pass, ghost and probe; then the satellite. */
  escape: () => void
  /** `name` from the map's labels when there is one nearby; else the coordinates. */
  addPlace: (location: Location, name?: string) => void
  /** Select a place, or none; from the list the map also centers on it. */
  selectPlace: (id: string | null, fly?: boolean) => void
  movePlace: (id: string, location: Location) => void
  renamePlace: (id: string, name: string) => void
  removePlace: (id: string) => void
  setFilters: (filters: PassFilters) => void
  toggleOnlySelected: () => void
  setSpan: (span: TrackSpan) => void
  setClock: (clock: Clock) => void
  togglePlay: (realMs?: number) => void
  goLive: (realMs?: number) => void
  toggleSheet: (sheet: Sheet) => void
  closeSheet: () => void
  setHelpOpen: (open: boolean) => void
  toggleReach: () => void
  toggleGlobe: () => void
}

const initial = (places: PlacesState): State => ({
  ...places,
  selection: NOTHING,
  focus: null,
  flyTo: null,
  filters: DEFAULT_FILTERS,
  span: DEFAULT_SPAN,
  clock: liveClock(Date.now()),
  sheet: 'satellites',
  helpOpen: false,
  reachVisible: true,
  globe: true,
})

export const useApp = create<State & Actions>((set, get) => ({
  ...initial(loadPlaces()),

  select: (noradId) => set({ selection: { ...NOTHING, noradId } }),
  selectFromList: (noradId, timeMs) =>
    set((s) => ({ selection: { ...NOTHING, noradId }, focus: { noradId, seq: (s.focus?.seq ?? 0) + 1, timeMs } })),
  showPass: (pass) =>
    set((s) => ({
      selection: {
        noradId: pass.noradId,
        ghost: { noradId: pass.noradId, timeMs: pass.peakMs },
        activePass: pass,
        probeMs: null,
      },
      focus: { noradId: pass.noradId, seq: (s.focus?.seq ?? 0) + 1, timeMs: pass.peakMs },
    })),
  goToPass: (pass, realMs = Date.now()) =>
    set((s) => ({
      clock: withRate(scrubbedTo(s.clock, pass.peakMs, realMs), 0, realMs),
      selection: { noradId: pass.noradId, ghost: null, activePass: pass, probeMs: null },
      focus: { noradId: pass.noradId, seq: (s.focus?.seq ?? 0) + 1, timeMs: pass.peakMs },
    })),
  probe: (deltaMs, fromMs) =>
    set((s) =>
      s.selection.noradId === null
        ? {}
        : { selection: { ...s.selection, probeMs: (s.selection.probeMs ?? fromMs) + deltaMs } },
    ),
  escape: () => {
    const { helpOpen, selection } = get()
    if (helpOpen) set({ helpOpen: false })
    else if (selection.activePass || selection.ghost || selection.probeMs !== null)
      set({ selection: { ...NOTHING, noradId: selection.noradId } })
    else set({ selection: NOTHING })
  },
  addPlace: (location, name) => set((s) => ({ places: [...s.places, newPlace(location, name)] })),
  selectPlace: (id, fly = false) =>
    set((s) => {
      const place = s.places.find((p) => p.id === id)
      return {
        placeId: place ? place.id : null,
        flyTo: fly && place ? { lat: place.lat, lon: place.lon, seq: (s.flyTo?.seq ?? 0) + 1 } : s.flyTo,
      }
    }),
  movePlace: (id, location) =>
    set((s) => ({ places: s.places.map((p) => (p.id === id ? { ...p, lat: location.lat, lon: location.lon } : p)) })),
  renamePlace: (id, name) => set((s) => ({ places: s.places.map((p) => (p.id === id ? { ...p, name } : p)) })),
  removePlace: (id) =>
    set((s) => ({ places: s.places.filter((p) => p.id !== id), placeId: s.placeId === id ? null : s.placeId })),
  setFilters: (filters) => set({ filters }),
  toggleOnlySelected: () => set((s) => ({ filters: { ...s.filters, onlySelected: !s.filters.onlySelected } })),
  setSpan: (span) => set({ span }),
  setClock: (clock) => set({ clock }),
  togglePlay: (realMs = Date.now()) => set((s) => ({ clock: withRate(s.clock, s.clock.rate > 0 ? 0 : 1, realMs) })),
  goLive: (realMs = Date.now()) => set({ clock: liveClock(realMs) }),
  toggleSheet: (sheet) => set((s) => ({ sheet: s.sheet === sheet ? null : sheet })),
  closeSheet: () => set({ sheet: null }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  toggleReach: () => set((s) => ({ reachVisible: !s.reachVisible })),
  toggleGlobe: () => set((s) => ({ globe: !s.globe })),
}))

useApp.subscribe((s, previous) => {
  if (s.places !== previous.places || s.placeId !== previous.placeId)
    savePlaces({ places: s.places, placeId: s.placeId })
})

/** The place passes are computed for, if one is selected. */
export const selectedPlace = (s: PlacesState): Place | null => s.places.find((p) => p.id === s.placeId) ?? null

/** Back to the seed state; for tests. */
export const resetApp = () => useApp.setState(initial(SEED))
