import { useEffect, useMemo, useState } from 'react'
import { formatAge, loadElements, newestEpoch, type Omm } from './elements'
import { FAMILY_COLORS } from './layers'
import { MapView } from './MapView'
import { satelliteFrom, type Satellite } from './orbit'

type Loaded = { elements: Omm[] } | { error: string } | null

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function App() {
  const [loaded, setLoaded] = useState<Loaded>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const now = useNow(1000)

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
        <MapView satellites={satellites} now={now} selected={selected} onSelect={setSelected} />
        <aside className="panel">
          {loaded === null && <p>Loading orbital elements…</p>}
          {loaded && 'error' in loaded && <p role="alert">{loaded.error}</p>}
          {satellites.length > 0 && (
            <Constellation satellites={satellites} now={now} selected={selected} onSelect={setSelected} />
          )}
        </aside>
      </main>
      <footer>
        Unofficial demo, not affiliated with Synspective. Orbital data: CelesTrak. Map: OpenFreeMap, © OpenStreetMap.
      </footer>
    </>
  )
}

interface ConstellationProps {
  satellites: Satellite[]
  now: Date
  selected: number | null
  onSelect: (noradId: number | null) => void
}

function Constellation({ satellites, now, selected, onSelect }: ConstellationProps) {
  const epoch = newestEpoch(satellites.map((s) => s.omm))
  return (
    <>
      <ul>
        {satellites.map((s) => {
          const id = s.omm.NORAD_CAT_ID
          const isSelected = id === selected
          return (
            <li key={id} className={selected !== null && !isSelected ? 'dimmed' : undefined}>
              <button type="button" aria-pressed={isSelected} onClick={() => onSelect(isSelected ? null : id)}>
                <span className="swatch" style={{ background: `rgb(${FAMILY_COLORS[s.family].join(' ')})` }} />
                {s.omm.OBJECT_NAME} <span className="muted">#{id} · {s.omm.INCLINATION.toFixed(1)}°</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="muted">
        {satellites.length} satellites · elements from {epoch.toISOString().slice(0, 16).replace('T', ' ')} UTC ·{' '}
        {formatAge(epoch, now)} old
      </p>
    </>
  )
}

export default App
