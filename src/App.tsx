import { useEffect, useMemo, useState } from 'react'
import { liveClock, scrubbedTo, simTime, withRate } from './clock'
import { type Ghost } from './layers'
import { MapView, type Focus } from './MapView'
import { satelliteFrom } from './orbit'
import { Panel } from './Panel'
import { PassList } from './PassList'
import { formatAge, loadElements, newestEpoch, type Omm } from './elements'
import { formatLocation, upcomingPasses, type Location, type Pass } from './passes'
import { TimeBar } from './TimeBar'
import { useNarrow } from './useNarrow'
import { useNow } from './useNow'
import { useSmoothedTime } from './useSmoothedTime'

type Loaded = { elements: Omm[] } | { error: string } | null

const TOKYO: Location = { lat: 35.68, lon: 139.69 }

function App() {
  const [loaded, setLoaded] = useState<Loaded>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [location, setLocation] = useState<Location>(TOKYO)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const [horizonHours, setHorizonHours] = useState(24)
  const [onlySelected, setOnlySelected] = useState(true)
  const [clock, setClock] = useState(() => liveClock(Date.now()))
  const now = useNow()
  const narrow = useNarrow()
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
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const select = (noradId: number | null) => {
    setSelected(noradId)
    setGhost(null)
  }

  const selectFromList = (noradId: number | null, timeMs?: number) => {
    select(noradId)
    if (noradId !== null) setFocus({ noradId, seq: (focus?.seq ?? 0) + 1, timeMs })
  }

  const satellites = useMemo(
    () => (loaded && 'elements' in loaded ? loaded.elements.map(satelliteFrom) : []),
    [loaded],
  )

  // Passes are listed from real time, so scrubbing the clock never changes the list under the reader.
  const passMinute = Math.floor(now.getTime() / 60_000)
  const allPasses = useMemo(
    () => upcomingPasses(satellites, location, new Date(passMinute * 60_000), horizonHours),
    [satellites, location, passMinute, horizonHours],
  )
  const selectedSatellite = satellites.find((s) => s.omm.NORAD_CAT_ID === selected)
  const passes = selectedSatellite && onlySelected ? allPasses.filter((p) => p.noradId === selected) : allPasses
  const familyOf = (noradId: number) => satellites.find((s) => s.omm.NORAD_CAT_ID === noradId)?.family ?? 'mid-inclination'

  const showPass = (pass: Pass) => {
    selectFromList(pass.noradId, pass.peakMs)
    setGhost({ noradId: pass.noradId, timeMs: pass.peakMs })
  }

  const goToPass = (pass: Pass) => {
    const realMs = Date.now()
    setClock(withRate(scrubbedTo(clock, pass.peakMs, realMs), 0, realMs))
    selectFromList(pass.noradId, pass.peakMs)
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
        />
        <div className="dock">
        <aside className="panel" aria-label="Constellation">
          <details open={!narrow}>
            <summary>
              Satellites
              {satellites.length > 0 && (
                <span className="muted">
                  {' '}
                  · {satellites.length} · elements {formatAge(newestEpoch(satellites.map((s) => s.omm)), now)} old
                </span>
              )}
            </summary>
            {loaded === null && <p>Loading orbital elements…</p>}
            {loaded && 'error' in loaded && <p role="alert">{loaded.error}</p>}
            {satellites.length > 0 && (
              <Panel satellites={satellites} now={now} selected={selected} onSelect={selectFromList} />
            )}
          </details>
        </aside>
        {satellites.length > 0 && (
          <aside className="passes" aria-label="Passes">
            <details open={!narrow}>
              <summary>
                Passes over {formatLocation(location)}
                <span className="muted"> · {passes.length} in {horizonHours} h</span>
              </summary>
              <PassList
                location={location}
                passes={passes}
                horizonHours={horizonHours}
                onHorizonChange={setHorizonHours}
                selectedName={selectedSatellite?.omm.OBJECT_NAME}
                onlySelected={onlySelected}
                onOnlySelectedChange={setOnlySelected}
                familyOf={familyOf}
                onShow={showPass}
                onGoTo={goToPass}
                now={now}
              />
            </details>
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
