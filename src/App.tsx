import { useEffect, useMemo, useState } from 'react'
import { liveClock, simTime } from './clock'
import { loadElements, type Omm } from './elements'
import { MapView, type Focus } from './MapView'
import { satelliteFrom } from './orbit'
import { Panel } from './Panel'
import { TimeBar } from './TimeBar'
import { useNow } from './useNow'
import { useSmoothedTime } from './useSmoothedTime'

type Loaded = { elements: Omm[] } | { error: string } | null

function App() {
  const [loaded, setLoaded] = useState<Loaded>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
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

  const selectFromList = (noradId: number | null) => {
    setSelected(noradId)
    if (noradId !== null) setFocus({ noradId, seq: (focus?.seq ?? 0) + 1 })
  }

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
        <MapView satellites={satellites} now={time} selected={selected} onSelect={setSelected} focus={focus} />
        <aside className="panel">
          {loaded === null && <p>Loading orbital elements…</p>}
          {loaded && 'error' in loaded && <p role="alert">{loaded.error}</p>}
          {satellites.length > 0 && (
            <Panel satellites={satellites} now={now} selected={selected} onSelect={selectFromList} />
          )}
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
