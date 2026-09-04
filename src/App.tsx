import { useEffect, useMemo, useState } from 'react'
import { liveClock, scrubbedTo, simTime, withRate } from './time/clock'
import { Disclosure } from './panels/Disclosure'
import { type Ghost } from './map/layers'
import { MapView, type Focus } from './map/MapView'
import { DEFAULT_SPAN, satelliteFrom, type TrackSpan } from './orbit/orbit'
import { SatelliteList } from './panels/SatelliteList'
import { PassList } from './panels/PassList'
import { loadElements, newestEpoch, type Omm } from './orbit/elements'
import { formatAge, formatLocation } from './shared/format'
import { upcomingPasses, type Location, type Pass } from './orbit/passes'
import { TimeBar } from './time/TimeBar'
import { useNarrow } from './panels/useNarrow'
import { useNow } from './time/useNow'
import { useSmoothedTime } from './time/useSmoothedTime'

type Loaded = { elements: Omm[] } | { error: string } | null

const TOKYO: Location = { lat: 35.68, lon: 139.69 }

function App() {
  const [loaded, setLoaded] = useState<Loaded>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [location, setLocation] = useState<Location>(TOKYO)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const [activePass, setActivePass] = useState<Pass | null>(null)
  const [horizonHours, setHorizonHours] = useState(24)
  const [minElevationDeg, setMinElevationDeg] = useState(0)
  const [onlySelected, setOnlySelected] = useState(true)
  const [span, setSpan] = useState<TrackSpan>(DEFAULT_SPAN)
  const [clock, setClock] = useState(() => liveClock(Date.now()))
  const now = useNow()
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
  const time = useSmoothedTime(simTime(clock, now.getTime()))

  useEffect(() => {
    loadElements()
      .then((elements) => setLoaded({ elements }))
      .catch((e: unknown) => setLoaded({ error: e instanceof Error ? e.message : String(e) }))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(null)
        setGhost(null)
        setActivePass(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const select = (noradId: number | null) => {
    setSelected(noradId)
    setGhost(null)
    setActivePass(null)
  }

  const selectFromList = (noradId: number | null, timeMs?: number) => {
    select(noradId)
    if (noradId !== null) setFocus({ noradId, seq: (focus?.seq ?? 0) + 1, timeMs })
  }

  const satellites = useMemo(() => (loaded && 'elements' in loaded ? loaded.elements.map(satelliteFrom) : []), [loaded])
  const byId = (noradId: number | null) => satellites.find((s) => s.omm.NORAD_CAT_ID === noradId)

  // Passes are listed from real time, so scrubbing the clock never changes the list under the reader.
  const passMinute = Math.floor(now.getTime() / 60_000)
  const allPasses = useMemo(
    () => upcomingPasses(satellites, location, new Date(passMinute * 60_000), horizonHours),
    [satellites, location, passMinute, horizonHours],
  )
  const selectedSatellite = byId(selected)
  const passes = allPasses.filter(
    (p) => p.maxElevationDeg >= minElevationDeg && (!selectedSatellite || !onlySelected || p.noradId === selected),
  )
  const familyOf = (noradId: number) => byId(noradId)?.family ?? 'mid-inclination'

  const showPass = (pass: Pass) => {
    selectFromList(pass.noradId, pass.peakMs)
    setGhost({ noradId: pass.noradId, timeMs: pass.peakMs })
    setActivePass(pass)
  }

  const goToPass = (pass: Pass) => {
    const realMs = Date.now()
    setClock(withRate(scrubbedTo(clock, pass.peakMs, realMs), 0, realMs))
    selectFromList(pass.noradId, pass.peakMs)
    setActivePass(pass)
  }

  return (
    <>
      <header>
        <h1>nebulosa</h1>
        <p>Ground tracks of the StriX SAR constellation</p>
      </header>
      <main>
        <MapView
          satellites={satellites}
          now={time}
          selected={selected}
          onSelect={select}
          focus={focus}
          location={location}
          onLocationChange={setLocation}
          ghost={ghost}
          span={span}
        />
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
                  selected={selected}
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
                  horizonHours={horizonHours}
                  onHorizonChange={setHorizonHours}
                  minElevationDeg={minElevationDeg}
                  onMinElevationChange={setMinElevationDeg}
                  selectedName={selectedSatellite?.omm.OBJECT_NAME}
                  onlySelected={onlySelected}
                  onOnlySelectedChange={setOnlySelected}
                  familyOf={familyOf}
                  onShow={showPass}
                  onGoTo={goToPass}
                  activePass={activePass}
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
