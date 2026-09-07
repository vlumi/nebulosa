import { create } from 'zustand'
import type { Ghost } from './map/layers'
import { DEFAULT_SPAN, type TrackSpan } from './orbit/orbit'
import { DEFAULT_FILTERS, type Location, type Pass, type PassFilters } from './orbit/passes'
import {
  loadPlaces,
  locatedPlace,
  newPlace,
  savePlaces,
  SEED,
  SEED_JA,
  type Place,
  type PlacesState,
} from './places/places'
import { loadLang, saveLang, type Lang } from './i18n/strings'
import { loadThemeChoice, saveThemeChoice, type ThemeChoice } from './shared/theme'
import { liveClock, scrubbedTo, withPaused, type Clock } from './time/clock'

/** What the reader is looking at: a satellite, and possibly a pass of it with its ghost, or a probe along its track. */
export interface Selection {
  noradId: number | null
  ghost: Ghost | null
  activePass: Pass | null
  /** A moment along the selected satellite's track being inspected from the keyboard. */
  probeMs: number | null
}

export const NOTHING: Selection = { noradId: null, ghost: null, activePass: null, probeMs: null }

export type Sheet = 'satellites' | 'places' | 'passes'

/** A request to move the camera once: to a satellite, at a moment if given, or to a point. `seq` keeps repeats distinct. */
export type CameraRequest = { seq: number } & (
  { kind: 'satellite'; noradId: number; timeMs?: number } | { kind: 'point'; lat: number; lon: number }
)

interface State extends PlacesState {
  selection: Selection
  camera: CameraRequest | null
  /** Keep the selected satellite centered as time plays. */
  follow: boolean
  themeChoice: ThemeChoice
  lang: Lang
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
  /** Select and bring into view. */
  selectFromList: (noradId: number) => void
  showPass: (pass: Pass) => void
  goToPass: (pass: Pass, realMs?: number) => void
  /** Move the track probe by `deltaMs`, starting from `fromMs` when there is none yet. */
  probe: (deltaMs: number, fromMs: number) => void
  /** Put the track probe at a moment, or clear it. */
  setProbe: (timeMs: number | null) => void
  /** Drop the shown pass, its ghost and the probe; keep the satellite. */
  clearPass: () => void
  /** Help first; then pass, ghost and probe; then the place; then the satellite. */
  escape: () => void
  /** `name` from the map's labels when there is one nearby; else the coordinates. */
  addPlace: (location: Location, name?: string) => void
  /** The one located place, added or moved to the browser's position, selected, and flown to. */
  locatePlace: (location: Location, name: string) => void
  /** Select a place, or none; from the list the map also centers on it. */
  selectPlace: (id: string | null, fly?: boolean) => void
  setPinsLocked: (locked: boolean) => void
  /** Move a place one step up or down its list. */
  reorderPlace: (id: string, delta: 1 | -1) => void
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
  setFollow: (follow: boolean) => void
  toggleFollow: () => void
  setThemeChoice: (choice: ThemeChoice) => void
  setLang: (lang: Lang) => void
}

const nextSeq = (s: { camera: CameraRequest | null }) => (s.camera?.seq ?? 0) + 1

const initial = (places: PlacesState): State => ({
  ...places,
  selection: NOTHING,
  camera: null,
  follow: true,
  themeChoice: loadThemeChoice(),
  lang: loadLang(),
  filters: DEFAULT_FILTERS,
  span: DEFAULT_SPAN,
  clock: liveClock(Date.now()),
  sheet: 'satellites',
  helpOpen: false,
  reachVisible: true,
  globe: true,
})

export const useApp = create<State & Actions>((set, get) => ({
  ...initial(loadPlaces(undefined, loadLang() === 'ja' ? SEED_JA : SEED)),

  // Selecting the satellite already selected, by its dot, label, track or dashed continuation, keeps its pass, ghost
  // and probe: only a change of satellite starts over.
  select: (noradId) => set((s) => (s.selection.noradId === noradId ? s : { selection: { ...NOTHING, noradId } })),
  selectFromList: (noradId) =>
    set((s) => ({ selection: { ...NOTHING, noradId }, camera: { kind: 'satellite', noradId, seq: nextSeq(s) } })),
  // A pass is a moment elsewhere on the track; following would hold the camera on the satellite and hide the ghost.
  showPass: (pass) =>
    set((s) => ({
      selection: {
        noradId: pass.noradId,
        ghost: { noradId: pass.noradId, timeMs: pass.peakMs },
        activePass: pass,
        probeMs: null,
      },
      camera: { kind: 'satellite', noradId: pass.noradId, timeMs: pass.peakMs, seq: nextSeq(s) },
      follow: false,
    })),
  goToPass: (pass, realMs = Date.now()) =>
    set((s) => ({
      clock: withPaused(scrubbedTo(s.clock, pass.peakMs, realMs), true, realMs),
      selection: { noradId: pass.noradId, ghost: null, activePass: pass, probeMs: null },
      camera: { kind: 'satellite', noradId: pass.noradId, timeMs: pass.peakMs, seq: nextSeq(s) },
      follow: false,
    })),
  probe: (deltaMs, fromMs) =>
    set((s) =>
      s.selection.noradId === null
        ? {}
        : { selection: { ...s.selection, probeMs: (s.selection.probeMs ?? fromMs) + deltaMs } },
    ),
  setProbe: (timeMs) =>
    set((s) => (s.selection.noradId === null ? {} : { selection: { ...s.selection, probeMs: timeMs } })),
  clearPass: () => set((s) => ({ selection: { ...NOTHING, noradId: s.selection.noradId } })),
  escape: () => {
    const { helpOpen, selection, placeId } = get()
    if (helpOpen) set({ helpOpen: false })
    else if (selection.activePass || selection.ghost || selection.probeMs !== null)
      set({ selection: { ...NOTHING, noradId: selection.noradId } })
    else if (placeId !== null) set({ placeId: null })
    else set({ selection: NOTHING })
  },
  addPlace: (location, name) => set((s) => ({ places: [...s.places, newPlace(location, name)] })),
  selectPlace: (id, fly = false) =>
    set((s) => {
      const place = s.places.find((p) => p.id === id)
      return {
        placeId: place ? place.id : null,
        camera: fly && place ? { kind: 'point', lat: place.lat, lon: place.lon, seq: nextSeq(s) } : s.camera,
      }
    }),
  locatePlace: (location, name) =>
    set((s) => {
      const existing = s.places.find((p) => p.located)
      const place = existing ? { ...existing, lat: location.lat, lon: location.lon } : locatedPlace(location, name)
      return {
        places: existing ? s.places.map((p) => (p.located ? place : p)) : [...s.places, place],
        placeId: place.id,
        camera: { kind: 'point', lat: place.lat, lon: place.lon, seq: nextSeq(s) },
      }
    }),
  movePlace: (id, location) =>
    set((s) => ({
      places: s.places.map((p) => (p.id === id && !p.located ? { ...p, lat: location.lat, lon: location.lon } : p)),
    })),
  renamePlace: (id, name) => set((s) => ({ places: s.places.map((p) => (p.id === id ? { ...p, name } : p)) })),
  setPinsLocked: (pinsLocked) => set({ pinsLocked }),
  reorderPlace: (id, delta) =>
    set((s) => {
      const from = s.places.findIndex((p) => p.id === id)
      const to = from + delta
      if (from < 0 || to < 0 || to >= s.places.length) return {}
      const places = [...s.places]
      places.splice(to, 0, ...places.splice(from, 1))
      return { places }
    }),
  removePlace: (id) =>
    set((s) => ({ places: s.places.filter((p) => p.id !== id), placeId: s.placeId === id ? null : s.placeId })),
  setFilters: (filters) => set({ filters }),
  toggleOnlySelected: () => set((s) => ({ filters: { ...s.filters, onlySelected: !s.filters.onlySelected } })),
  setSpan: (span) => set({ span }),
  setClock: (clock) => set({ clock }),
  togglePlay: (realMs = Date.now()) => set((s) => ({ clock: withPaused(s.clock, !s.clock.paused, realMs) })),
  goLive: (realMs = Date.now()) => set({ clock: liveClock(realMs) }),
  toggleSheet: (sheet) => set((s) => ({ sheet: s.sheet === sheet ? null : sheet })),
  closeSheet: () => set({ sheet: null }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  toggleReach: () => set((s) => ({ reachVisible: !s.reachVisible })),
  toggleGlobe: () => set((s) => ({ globe: !s.globe })),
  setFollow: (follow) => set((s) => (s.follow === follow ? s : { follow })),
  toggleFollow: () => set((s) => ({ follow: !s.follow })),
  setThemeChoice: (themeChoice) => set({ themeChoice }),
  setLang: (lang) => set({ lang }),
}))

useApp.subscribe((s, previous) => {
  if (s.themeChoice !== previous.themeChoice) saveThemeChoice(s.themeChoice)
  if (s.lang !== previous.lang) saveLang(s.lang)
  if (s.places !== previous.places || s.placeId !== previous.placeId || s.pinsLocked !== previous.pinsLocked)
    savePlaces({ places: s.places, placeId: s.placeId, pinsLocked: s.pinsLocked })
})

/** The place passes are computed for, if one is selected. */
export const selectedPlace = (s: PlacesState): Place | null => s.places.find((p) => p.id === s.placeId) ?? null

/** Back to the seed state; for tests. */
export const resetApp = () => useApp.setState(initial(SEED))
