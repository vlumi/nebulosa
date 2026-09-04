import { useEffect, useState } from 'react'
import { formatAge, loadElements, newestEpoch, type Omm } from './elements'

type Loaded = { elements: Omm[] } | { error: string } | null

function App() {
  const [loaded, setLoaded] = useState<Loaded>(null)

  useEffect(() => {
    loadElements()
      .then((elements) => setLoaded({ elements }))
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
        {loaded && 'elements' in loaded && <Constellation elements={loaded.elements} />}
      </main>
      <footer>
        Unofficial demo, not affiliated with Synspective. Orbital data: CelesTrak.
      </footer>
    </>
  )
}

function Constellation({ elements }: { elements: Omm[] }) {
  const epoch = newestEpoch(elements)
  return (
    <section>
      <ul>
        {elements.map((e) => (
          <li key={e.NORAD_CAT_ID}>
            {e.OBJECT_NAME} <span className="muted">#{e.NORAD_CAT_ID}</span>
          </li>
        ))}
      </ul>
      <p className="muted">
        {elements.length} satellites · elements from {epoch.toISOString().slice(0, 16).replace('T', ' ')} UTC ·{' '}
        {formatAge(epoch, new Date())} old
      </p>
    </section>
  )
}

export default App
