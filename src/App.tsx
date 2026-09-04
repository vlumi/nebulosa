import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { liveClock, scrubbedTo, withRate } from './time/clock'
import { Disclosure } from './panels/Disclosure'
import type { Ghost } from './map/layers'
import type { Focus } from './map/MapView'
import { DEFAULT_SPAN, satelliteFrom, type TrackSpan } from './orbit/orbit'
import { SatelliteList } from './panels/SatelliteList'
import { PassList } from './panels/PassList'
import { loadElements, newestEpoch, type Omm } from './orbit/elements'
import { formatAge, formatLocation } from './shared/format'
import { DEFAULT_FILTERS, type Location, type Pass, type PassFilters } from './orbit/passes'
import { usePasses } from './orbit/usePasses'
import { TimeBar } from './time/TimeBar'
import { useNarrow } from './panels/useNarrow'
import { useClockTime } from './time/useClockTime'

type Loaded = { elements: Omm[] } | { error: string } | null

const TOKYO: Location = { lat: 35.68, lon: 139.69 }

interface Selection {
  noradId: number | null
  ghost: Ghost | null
  activePass: Pass | null
}

const NOTHING: Selection = { noradId: null, ghost: null, activePass: null }

// MapLibre and deck.gl are most of the bundle; the shell and the lists paint before they arrive.
const MapView = lazy(() => import('./map/MapView').then((m) => ({ default: m.MapView })))

function App() {
  const [loaded, setLoaded] = useState<Loaded>(null)
  // What the reader is looking at: a satellite, and possibly a pass of it with its ghost on the map.
  const [selection, setSelection] = useState<Selection>(NOTHING)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [location, setLocation] = useState<Location>(TOKYO)
  const [filters, setFilters] = useState<PassFilters>(DEFAULT_FILTERS)
  const [span, setSpan] = useState<TrackSpan>(DEFAULT_SPAN)
  const [clock, setClock] = useState(() => liveClock(Date.now()))
  const { now, time } = useClockTime(clock)
  const narrow = useNarrow()
  // Open by default on desktop, closed on phones, until the reader toggles a panel.
  // On a phone only one panel is open at a time, so the column fits the screen.
  const [panelOpen, setPanelOpen] = useState<boolean | null>(null)
  const [passesOpen, setPassesOpen] = useState<boolean | null>(null)
  const togglePanel = (open: boolean) => {
    setPanelOpen(open)
    if (open && narrow) setPassesOpen(false)
  }
  const togglePasses = (open: boolean) => {
    setPassesOpen(open)
    if (open && narrow) setPanelOpen(false)
  }
  useEffect(() => {
    loadElements()
      .then((elements) => setLoaded({ elements }))
      .catch((e: unknown) => setLoaded({ error: e instanceof Error ? e.message : String(e) }))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelection(NOTHING)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const select = (noradId: number | null) => setSelection({ ...NOTHING, noradId })

  const selectFromList = (noradId: number | null, timeMs?: number) => {
    select(noradId)
    if (noradId !== null) setFocus({ noradId, seq: (focus?.seq ?? 0) + 1, timeMs })
  }

  const elements = useMemo(() => (loaded && 'elements' in loaded ? loaded.elements : []), [loaded])
  const satellites = useMemo(() => elements.map(satelliteFrom), [elements])
  const byId = (noradId: number | null) => satellites.find((s) => s.omm.NORAD_CAT_ID === noradId)

  // Passes are listed from real time, so scrubbing the clock never changes the list under the reader.
  const passMinute = Math.floor(now.getTime() / 60_000)
  const allPasses = usePasses(elements, location, passMinute * 60_000, filters.horizonHours)
  const selectedSatellite = byId(selection.noradId)
  const passes = allPasses.filter(
    (p) =>
      p.maxElevationDeg >= filters.minElevationDeg &&
      (!selectedSatellite || !filters.onlySelected || p.noradId === selection.noradId),
  )
  const familyOf = (noradId: number) => byId(noradId)?.family ?? 'mid-inclination'

  const showPass = (pass: Pass) => {
    selectFromList(pass.noradId, pass.peakMs)
    setSelection({ noradId: pass.noradId, ghost: { noradId: pass.noradId, timeMs: pass.peakMs }, activePass: pass })
  }

  const goToPass = (pass: Pass) => {
    const realMs = Date.now()
    setClock(withRate(scrubbedTo(clock, pass.peakMs, realMs), 0, realMs))
    selectFromList(pass.noradId, pass.peakMs)
    setSelection({ noradId: pass.noradId, ghost: null, activePass: pass })
  }

  return (
    <>
      <header>
        <h1>nebulosa</h1>
        <p>Ground tracks of the StriX SAR constellation</p>
      </header>
      <main>
        <Suspense fallback={<div className="map" />}>
          <MapView
            satellites={satellites}
            now={time}
            selected={selection.noradId}
            onSelect={select}
            focus={focus}
            location={location}
            onLocationChange={setLocation}
            ghost={selection.ghost}
            span={span}
          />
        </Suspense>
        <div className="dock">
          <aside className="satellites" aria-label="Constellation">
            <Disclosure
              open={panelOpen ?? !narrow}
              onToggle={togglePanel}
              summary={
                <>
                  Satellites
                  {satellites.length > 0 && (
                    <span className="muted">
                      {' '}
                      · {satellites.length} · elements {formatAge(newestEpoch(satellites.map((s) => s.omm)), now)} old
                    </span>
                  )}
                </>
              }
            >
              {loaded === null && <p>Loading orbital elements…</p>}
              {loaded && 'error' in loaded && <p role="alert">{loaded.error}</p>}
              {satellites.length > 0 && (
                <SatelliteList
                  satellites={satellites}
                  now={now}
                  selected={selection.noradId}
                  onSelect={selectFromList}
                  span={span}
                  onSpanChange={setSpan}
                />
              )}
            </Disclosure>
          </aside>
          {satellites.length > 0 && (
            <aside className="passes" aria-label="Passes">
              <Disclosure
                open={passesOpen ?? !narrow}
                onToggle={togglePasses}
                summary={
                  <>
                    Passes over {formatLocation(location)}
                    <span className="muted"> · {passes.length}</span>
                  </>
                }
              >
                <PassList
                  location={location}
                  passes={passes}
                  filters={filters}
                  onFiltersChange={setFilters}
                  selectedName={selectedSatellite?.omm.OBJECT_NAME}
                  familyOf={familyOf}
                  onShow={showPass}
                  onGoTo={goToPass}
                  activePass={selection.activePass}
                  now={now}
                />
              </Disclosure>
            </aside>
          )}
        </div>
        <TimeBar clock={clock} now={now} onChange={setClock} />
      </main>
      <footer>
        Unofficial demo, not affiliated with Synspective. Orbital data: CelesTrak. Map: OpenFreeMap, © OpenStreetMap.
      </footer>
    </>
  )
}

export default App
