import { create } from 'zustand'
import type { Ghost } from './map/layers'
import type { Focus } from './map/MapView'
import { DEFAULT_SPAN, type TrackSpan } from './orbit/orbit'
import { DEFAULT_FILTERS, type Location, type Pass, type PassFilters } from './orbit/passes'
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
export const TOKYO: Location = { lat: 35.68, lon: 139.69 }

export type Sheet = 'satellites' | 'passes'

interface State {
  selection: Selection
  focus: Focus | null
  location: Location
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
  setLocation: (location: Location) => void
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

const initial = (): State => ({
  selection: NOTHING,
  focus: null,
  location: TOKYO,
  filters: DEFAULT_FILTERS,
  span: DEFAULT_SPAN,
  clock: liveClock(Date.now()),
  sheet: 'satellites',
  helpOpen: false,
  reachVisible: true,
  globe: true,
})

export const useApp = create<State & Actions>((set, get) => ({
  ...initial(),

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
  setLocation: (location) => set({ location }),
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

/** Back to the initial state; for tests. */
export const resetApp = () => useApp.setState(initial())
