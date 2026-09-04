import { useEffect, useMemo, useState } from 'react'
import { liveClock, scrubbedTo, simTime, withRate } from './clock'
import { loadElements, type Omm } from './elements'
import { MapView, type Focus } from './MapView'
import { satelliteFrom } from './orbit'
import { Panel } from './Panel'
import { PassList } from './PassList'
import { upcomingPasses, type Location, type Pass } from './passes'
import { TimeBar } from './TimeBar'
import { useNow } from './useNow'
import { useSmoothedTime } from './useSmoothedTime'

type Loaded = { elements: Omm[] } | { error: string } | null

const TOKYO: Location = { lat: 35.68, lon: 139.69 }

function App() {
  const [loaded, setLoaded] = useState<Loaded>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [location, setLocation] = useState<Location>(TOKYO)
  const [clock, setClock] = useState(() => liveClock(Date.now()))
  const now = useNow()
  const time = useSmoothedTime(simTime(clock, now.getTime()))

  useEffect(() => {
    loadElements()
      .then((elements) => setLoaded({ elements }))
      .catch((e: unknown) => setLoaded({ error: e instanceof Error ? e.message : String(e) }))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selectFromList = (noradId: number | null, timeMs?: number) => {
    setSelected(noradId)
    if (noradId !== null) setFocus({ noradId, seq: (focus?.seq ?? 0) + 1, timeMs })
  }

  const satellites = useMemo(
    () => (loaded && 'elements' in loaded ? loaded.elements.map(satelliteFrom) : []),
    [loaded],
  )

  // Passes are looked up from the displayed minute; a minute of drift is far below their resolution.
  const passMinute = Math.floor(time.getTime() / 60_000)
  const passes = useMemo(
    () => upcomingPasses(satellites, location, new Date(passMinute * 60_000), 24),
    [satellites, location, passMinute],
  )
  const familyOf = (noradId: number) => satellites.find((s) => s.omm.NORAD_CAT_ID === noradId)?.family ?? 'mid-inclination'

  const showPass = (pass: Pass) => {
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
          onSelect={setSelected}
          focus={focus}
          location={location}
          onLocationChange={setLocation}
        />
        <aside className="panel" aria-label="Constellation">
          {loaded === null && <p>Loading orbital elements…</p>}
          {loaded && 'error' in loaded && <p role="alert">{loaded.error}</p>}
          {satellites.length > 0 && (
            <Panel satellites={satellites} now={now} selected={selected} onSelect={selectFromList} />
          )}
        </aside>
        {satellites.length > 0 && (
          <aside className="passes" aria-label="Passes">
            <PassList location={location} passes={passes} familyOf={familyOf} onPick={showPass} />
          </aside>
        )}
        <TimeBar clock={clock} now={now} onChange={setClock} />
      </main>
      <footer>
        Unofficial demo, not affiliated with Synspective. Orbital data: CelesTrak. Map: OpenFreeMap, © OpenStreetMap.
      </footer>
    </>
  )
}

export default App
