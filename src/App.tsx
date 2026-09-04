import { useEffect, useMemo, useState } from 'react'
import { liveClock, simTime } from './clock'
import { loadElements, type Omm } from './elements'
import { MapView } from './MapView'
import { satelliteFrom } from './orbit'
import { Panel } from './Panel'
import { TimeBar } from './TimeBar'
import { useNow } from './useNow'

type Loaded = { elements: Omm[] } | { error: string } | null

function App() {
  const [loaded, setLoaded] = useState<Loaded>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [clock, setClock] = useState(() => liveClock(Date.now()))
  const now = useNow(clock.rate > 1 ? 0 : 1000)
  const time = useMemo(() => new Date(simTime(clock, now.getTime())), [clock, now])

  useEffect(() => {
    loadElements()
      .then((elements) => setLoaded({ elements }))
      .catch((e: unknown) => setLoaded({ error: e instanceof Error ? e.message : String(e) }))
  }, [])

  const satellites = useMemo(
    () => (loaded && 'elements' in loaded ? loaded.elements.map(satelliteFrom) : []),
    [loaded],
  )

  return (
    <>
      <header>
        <h1>nebulosa</h1>
        <p>Ground tracks of the StriX SAR constellation</p>
      </header>
      <main>
        <MapView satellites={satellites} now={time} selected={selected} onSelect={setSelected} />
        <aside className="panel">
          {loaded === null && <p>Loading orbital elements…</p>}
          {loaded && 'error' in loaded && <p role="alert">{loaded.error}</p>}
          {satellites.length > 0 && <Panel satellites={satellites} now={now} selected={selected} onSelect={setSelected} />}
        </aside>
        <TimeBar clock={clock} now={now} onChange={setClock} />
      </main>
      <footer>
        Unofficial demo, not affiliated with Synspective. Orbital data: CelesTrak. Map: OpenFreeMap, © OpenStreetMap.
      </footer>
    </>
  )
}

export default App
