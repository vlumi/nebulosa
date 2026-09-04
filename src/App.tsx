import { useEffect, useState } from 'react'
import { formatAge, loadTles, newestEpoch, type Tle } from './tles'

type Loaded = { tles: Tle[] } | { error: string } | null

function App() {
  const [loaded, setLoaded] = useState<Loaded>(null)

  useEffect(() => {
    loadTles()
      .then((tles) => setLoaded({ tles }))
      .catch((e: unknown) => setLoaded({ error: e instanceof Error ? e.message : String(e) }))
  }, [])

  return (
    <>
      <header>
        <h1>nebulosa</h1>
        <p>Ground tracks of the StriX SAR constellation</p>
      </header>
      <main>
        {loaded === null && <p>Loading orbital elements…</p>}
        {loaded && 'error' in loaded && <p role="alert">{loaded.error}</p>}
        {loaded && 'tles' in loaded && <Constellation tles={loaded.tles} />}
      </main>
      <footer>
        Unofficial demo, not affiliated with Synspective. Orbital data: CelesTrak.
      </footer>
    </>
  )
}

function Constellation({ tles }: { tles: Tle[] }) {
  const epoch = newestEpoch(tles)
  return (
    <section>
      <ul>
        {tles.map((t) => (
          <li key={t.noradId}>
            {t.name} <span className="muted">#{t.noradId}</span>
          </li>
        ))}
      </ul>
      <p className="muted">
        {tles.length} satellites · elements from {epoch.toISOString().slice(0, 16).replace('T', ' ')} UTC ·{' '}
        {formatAge(epoch, new Date())} old
      </p>
    </section>
  )
}

export default App
