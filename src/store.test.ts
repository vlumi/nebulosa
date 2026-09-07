import { NOTHING, resetApp, useApp } from './store'
import type { Pass } from './orbit/passes'

const pass: Pass = {
  noradId: 65971,
  name: 'STRIX-5',
  startMs: 1000,
  peakMs: 5000,
  endMs: 9000,
  maxElevationDeg: 40,
  peakAzimuthDeg: 90,
  offNadirDeg: 45,
}

beforeEach(resetApp)

test('showing a pass selects, ghosts and marks it; going to it also pauses the clock at the peak', () => {
  useApp.getState().showPass(pass)
  let s = useApp.getState()
  expect(s.selection).toEqual({
    noradId: 65971,
    ghost: { noradId: 65971, timeMs: 5000 },
    activePass: pass,
    probeMs: null,
  })
  expect(s.camera).toEqual({ kind: 'satellite', noradId: 65971, seq: 1, timeMs: 5000 })
  expect(s.clock.rate).toBe(1)

  useApp.getState().goToPass(pass, 100_000)
  s = useApp.getState()
  expect(s.clock).toEqual({ anchorReal: 100_000, anchorSim: 5000, rate: 1, paused: true })
  expect(s.selection.ghost).toBeNull()
  expect(s.camera?.seq).toBe(2)
})

test('escape peels back one layer at a time: help, then pass and probe, then the place, then the satellite', () => {
  const { showPass, probe, setHelpOpen, escape } = useApp.getState()
  showPass(pass)
  probe(30_000, 0)
  setHelpOpen(true)
  escape()
  expect(useApp.getState().helpOpen).toBe(false)
  expect(useApp.getState().selection.activePass).toBe(pass)
  escape()
  expect(useApp.getState().selection).toEqual({ ...NOTHING, noradId: 65971 })
  expect(useApp.getState().placeId).toBe('tokyo')
  escape()
  expect(useApp.getState().placeId).toBeNull()
  expect(useApp.getState().selection).toEqual({ ...NOTHING, noradId: 65971 })
  escape()
  expect(useApp.getState().selection).toEqual(NOTHING)
})

test('the probe needs a selected satellite and walks from the given start', () => {
  const { probe, select } = useApp.getState()
  probe(30_000, 1_000_000)
  expect(useApp.getState().selection.probeMs).toBeNull()
  select(65971)
  probe(30_000, 1_000_000)
  probe(30_000, 999)
  expect(useApp.getState().selection.probeMs).toBe(1_060_000)
})

test('one sheet at a time: toggling another replaces it, toggling the same closes it', () => {
  const { toggleSheet, closeSheet } = useApp.getState()
  expect(useApp.getState().sheet).toBe('satellites')
  toggleSheet('passes')
  expect(useApp.getState().sheet).toBe('passes')
  toggleSheet('passes')
  expect(useApp.getState().sheet).toBeNull()
  toggleSheet('satellites')
  closeSheet()
  expect(useApp.getState().sheet).toBeNull()
})

test('play toggles between paused and real speed; live resets the clock', () => {
  const { togglePlay, goLive } = useApp.getState()
  togglePlay(1000)
  expect(useApp.getState().clock.paused).toBe(true)
  togglePlay(2000)
  expect(useApp.getState().clock.paused).toBe(false)
  goLive(3000)
  expect(useApp.getState().clock).toEqual({ anchorReal: 3000, anchorSim: 3000, rate: 1, paused: false })
})

test('the reach layer is on until toggled off', () => {
  expect(useApp.getState().reachVisible).toBe(true)
  useApp.getState().toggleReach()
  expect(useApp.getState().reachVisible).toBe(false)
})

test('the globe is on until toggled off', () => {
  expect(useApp.getState().globe).toBe(true)
  useApp.getState().toggleGlobe()
  expect(useApp.getState().globe).toBe(false)
})

test('places: add, select from the list with a flight, move, rename, remove', () => {
  const s = () => useApp.getState()
  expect(s().placeId).toBe('tokyo')
  s().addPlace({ lat: 60.17, lon: 24.94 })
  const added = s().places[1]
  expect(added.name).toBe('60.17°N 24.94°E')
  expect(s().placeId).toBe('tokyo')
  s().selectPlace(added.id, true)
  expect(s().placeId).toBe(added.id)
  expect(s().camera).toEqual({ kind: 'point', lat: 60.17, lon: 24.94, seq: 1 })
  s().movePlace(added.id, { lat: 61, lon: 25 })
  s().renamePlace(added.id, 'Helsinki')
  expect(s().places[1]).toEqual({ ...added, lat: 61, lon: 25, name: 'Helsinki' })
  s().selectPlace(null)
  expect(s().placeId).toBeNull()
  s().selectPlace('tokyo')
  s().removePlace('tokyo')
  expect(s().placeId).toBeNull()
  expect(s().places.map((p) => p.name)).toEqual(['Helsinki'])
})

test('a place moves one step up or down its list and stops at the ends', () => {
  const { addPlace, reorderPlace } = useApp.getState()
  addPlace({ lat: 60.17, lon: 24.94 }, 'Helsinki')
  addPlace({ lat: 48.86, lon: 2.35 }, 'Paris')
  const names = () => useApp.getState().places.map((p) => p.name)
  const paris = useApp.getState().places[2].id
  reorderPlace(paris, -1)
  expect(names()).toEqual(['Tokyo', 'Paris', 'Helsinki'])
  reorderPlace(paris, -1)
  reorderPlace(paris, -1)
  expect(names()).toEqual(['Paris', 'Tokyo', 'Helsinki'])
  reorderPlace('tokyo', 1)
  expect(names()).toEqual(['Paris', 'Helsinki', 'Tokyo'])
  reorderPlace('tokyo', 1)
  expect(names()).toEqual(['Paris', 'Helsinki', 'Tokyo'])
})

test('follow is a mode, on by default: toggled or set, and kept across selections', () => {
  const { toggleFollow, setFollow, select } = useApp.getState()
  expect(useApp.getState().follow).toBe(true)
  toggleFollow()
  expect(useApp.getState().follow).toBe(false)
  select(null)
  expect(useApp.getState().follow).toBe(false)
  setFollow(true)
  expect(useApp.getState().follow).toBe(true)
})

test('the probe can be put at a moment or cleared, with a satellite selected', () => {
  const { setProbe, select } = useApp.getState()
  setProbe(5000)
  expect(useApp.getState().selection.probeMs).toBeNull()
  select(65971)
  setProbe(5000)
  expect(useApp.getState().selection.probeMs).toBe(5000)
  setProbe(null)
  expect(useApp.getState().selection.probeMs).toBeNull()
})

test('clearing the pass keeps the satellite', () => {
  const { showPass, clearPass } = useApp.getState()
  showPass(pass)
  clearPass()
  expect(useApp.getState().selection).toEqual({ ...NOTHING, noradId: 65971 })
})

test('the theme choice is set explicitly and starts at system', () => {
  expect(useApp.getState().themeChoice).toBe('system')
  useApp.getState().setThemeChoice('light')
  expect(useApp.getState().themeChoice).toBe('light')
})

test('re-selecting the selected satellite keeps its pass, ghost and probe; another satellite starts over', () => {
  const { showPass, probe, select } = useApp.getState()
  showPass(pass)
  probe(30_000, 0)
  const before = useApp.getState().selection
  select(65971)
  expect(useApp.getState().selection).toBe(before)
  select(53815)
  expect(useApp.getState().selection).toEqual({ ...NOTHING, noradId: 53815 })
})

test('setting follow to what it already is changes nothing', () => {
  const before = useApp.getState()
  useApp.getState().setFollow(true)
  expect(useApp.getState()).toBe(before)
})

test('showing or going to a pass lets go of following, so the flight to the ghost happens', () => {
  const { showPass, goToPass, setFollow } = useApp.getState()
  expect(useApp.getState().follow).toBe(true)
  showPass(pass)
  expect(useApp.getState().follow).toBe(false)
  setFollow(true)
  goToPass(pass, 100_000)
  expect(useApp.getState().follow).toBe(false)
})

test('locating adds one located place, selected and flown to; locating again moves that same place and keeps its name', () => {
  const s = () => useApp.getState()
  s().locatePlace({ lat: 35.5, lon: 139.6 }, 'My location')
  const located = s().places[1]
  expect(located).toMatchObject({ id: 'located', name: 'My location', lat: 35.5, lon: 139.6, located: true })
  expect(s().placeId).toBe('located')
  expect(s().camera).toEqual({ kind: 'point', lat: 35.5, lon: 139.6, seq: 1 })
  s().renamePlace('located', 'Home')
  s().movePlace('located', { lat: 0, lon: 0 })
  expect(s().places[1]).toMatchObject({ lat: 35.5, lon: 139.6 })
  s().locatePlace({ lat: 60.17, lon: 24.94 }, 'My location')
  expect(s().places).toHaveLength(2)
  expect(s().places[1]).toMatchObject({ id: 'located', name: 'Home', lat: 60.17, lon: 24.94 })
  expect(s().camera).toEqual({ kind: 'point', lat: 60.17, lon: 24.94, seq: 2 })
})
