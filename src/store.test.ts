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
  expect(s.focus).toEqual({ noradId: 65971, seq: 1, timeMs: 5000 })
  expect(s.clock.rate).toBe(1)

  useApp.getState().goToPass(pass, 100_000)
  s = useApp.getState()
  expect(s.clock).toEqual({ anchorReal: 100_000, anchorSim: 5000, rate: 0 })
  expect(s.selection.ghost).toBeNull()
  expect(s.focus?.seq).toBe(2)
})

test('escape peels back one layer at a time: help, then pass and probe, then the satellite', () => {
  const { showPass, probe, setHelpOpen, escape } = useApp.getState()
  showPass(pass)
  probe(30_000, 0)
  setHelpOpen(true)
  escape()
  expect(useApp.getState().helpOpen).toBe(false)
  expect(useApp.getState().selection.activePass).toBe(pass)
  escape()
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

test('on a phone, opening one panel closes the other; on desktop both stay', () => {
  const { toggleSatellites, togglePasses } = useApp.getState()
  toggleSatellites(true, true)
  togglePasses(true, true)
  expect(useApp.getState().satellitesOpen).toBe(false)
  toggleSatellites(true, false)
  expect(useApp.getState().passesOpen).toBe(true)
})

test('play toggles between paused and real speed; live resets the clock', () => {
  const { togglePlay, goLive } = useApp.getState()
  togglePlay(1000)
  expect(useApp.getState().clock.rate).toBe(0)
  togglePlay(2000)
  expect(useApp.getState().clock.rate).toBe(1)
  goLive(3000)
  expect(useApp.getState().clock).toEqual({ anchorReal: 3000, anchorSim: 3000, rate: 1 })
})
