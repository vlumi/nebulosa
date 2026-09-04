import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { Hover } from './map/layers'
import { loadElements, newestEpoch, type Omm } from './orbit/elements'
import { positionAt, satelliteFrom } from './orbit/orbit'
import { type Pass } from './orbit/passes'
import { usePasses } from './orbit/usePasses'
import { Disclosure } from './panels/Disclosure'
import { Help } from './panels/Help'
import { PassList } from './panels/PassList'
import { SatelliteList } from './panels/SatelliteList'
import { useNarrow } from './panels/useNarrow'
import { formatAge, formatLocation } from './shared/format'
import { belongsToFocusedControl, releaseFocusAfterPointerClick, stepIndex } from './shortcuts'
import styles from './App.module.css'
import panel from './panels/panel.module.css'
import { useApp } from './store'
import { startFrameLoop, useFrame, useMinute } from './time/frame'
import { TimeBar } from './time/TimeBar'

type Loaded = { elements: Omm[] } | { error: string } | null

const PROBE_STEP_MS = 30_000
const PROBE_BIG_STEP_MS = 5 * 60_000

// MapLibre and deck.gl are most of the bundle; the shell and the lists paint before they arrive.
const LazyMapView = lazy(() => import('./map/MapView').then((m) => ({ default: m.MapView })))

function App() {
  const [loaded, setLoaded] = useState<Loaded>(null)
  const app = useApp()
  const narrow = useNarrow()
  const minute = useMinute()
  const now = useMemo(() => new Date(minute * 60_000), [minute])

  useEffect(() => startFrameLoop(), [])

  useEffect(() => {
    loadElements()
      .then((elements) => setLoaded({ elements }))
      .catch((e: unknown) => setLoaded({ error: e instanceof Error ? e.message : String(e) }))
  }, [])

  const elements = useMemo(() => (loaded && 'elements' in loaded ? loaded.elements : []), [loaded])
  const satellites = useMemo(() => elements.map(satelliteFrom), [elements])
  const byId = (noradId: number | null) => satellites.find((s) => s.omm.NORAD_CAT_ID === noradId)

  // Passes are listed from real time, so scrubbing the clock never changes the list under the reader.
  const allPasses = usePasses(elements, app.location, minute * 60_000, app.filters.horizonHours)
  const selectedSatellite = byId(app.selection.noradId)
  const passes = allPasses.filter(
    (p) =>
      p.maxElevationDeg >= app.filters.minElevationDeg &&
      (!selectedSatellite || !app.filters.onlySelected || p.noradId === app.selection.noradId),
  )
  const familyOf = (noradId: number) => byId(noradId)?.family ?? 'mid-inclination'

  // The handler reads the store directly; it re-registers only when the lists it steps through change.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (belongsToFocusedControl(e) || e.metaKey || e.ctrlKey || e.altKey) return
      const s = useApp.getState()
      const satelliteIndex = satellites.findIndex((sat) => sat.omm.NORAD_CAT_ID === s.selection.noradId)
      const passIndex = passes.findIndex(
        (p) => p.noradId === s.selection.activePass?.noradId && p.peakMs === s.selection.activePass?.peakMs,
      )
      switch (e.key) {
        case '?':
        case '/':
          s.setHelpOpen(!s.helpOpen)
          break
        case 'Escape':
          s.escape()
          break
        case 'ArrowDown':
        case 'ArrowUp': {
          const delta = e.key === 'ArrowDown' ? 1 : -1
          if (e.shiftKey) {
            const i = stepIndex(passIndex, delta, passes.length)
            if (i >= 0) s.showPass(passes[i])
          } else {
            const i = stepIndex(satelliteIndex, delta, satellites.length)
            if (i >= 0) s.selectFromList(satellites[i].omm.NORAD_CAT_ID)
          }
          break
        }
        case 'ArrowRight':
        case 'ArrowLeft':
          s.probe(
            (e.shiftKey ? PROBE_BIG_STEP_MS : PROBE_STEP_MS) * (e.key === 'ArrowRight' ? 1 : -1),
            useFrame.getState().timeMs,
          )
          break
        case 'Enter':
          if (s.selection.activePass) s.goToPass(s.selection.activePass)
          break
        case ' ':
          s.togglePlay()
          break
        case 'l':
        case 'L':
          s.goLive()
          break
        case 's':
        case 'S':
          s.toggleSatellites(!(s.satellitesOpen ?? !narrow), narrow)
          break
        case 'p':
        case 'P':
          s.togglePasses(!(s.passesOpen ?? !narrow), narrow)
          break
        case 'o':
        case 'O':
          if (s.selection.noradId !== null) s.toggleOnlySelected()
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', releaseFocusAfterPointerClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', releaseFocusAfterPointerClick)
    }
  }, [satellites, passes, narrow])

  return (
    <>
      <header>
        <h1>nebulosa</h1>
        <p>Ground tracks of the StriX SAR constellation</p>
      </header>
      <main>
        <Suspense fallback={<div className="map" />}>
          <LiveMap satellites={satellites} selectedSatellite={selectedSatellite} />
        </Suspense>
        <div className={styles.dock}>
          <aside
            className={`${panel.panel} ${styles.satellites}`}
            data-open={(app.satellitesOpen ?? !narrow) ? '' : undefined}
            aria-label="Constellation"
          >
            <Disclosure
              open={app.satellitesOpen ?? !narrow}
              onToggle={(open) => app.toggleSatellites(open, narrow)}
              summary={
                <>
                  Satellites
                  {satellites.length > 0 && (
                    <span className="muted">
                      {' '}
                      · {satellites.length} · elements {formatAge(newestEpoch(elements), now)} old
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
                  selected={app.selection.noradId}
                  onSelect={(id) => (id === null ? app.select(null) : app.selectFromList(id))}
                  span={app.span}
                  onSpanChange={app.setSpan}
                />
              )}
            </Disclosure>
          </aside>
          {satellites.length > 0 && (
            <aside
              className={`${panel.panel} ${styles.passes}`}
              data-open={(app.passesOpen ?? !narrow) ? '' : undefined}
              aria-label="Passes"
            >
              <Disclosure
                open={app.passesOpen ?? !narrow}
                onToggle={(open) => app.togglePasses(open, narrow)}
                summary={
                  <>
                    Passes over {formatLocation(app.location)}
                    <span className="muted"> · {passes.length}</span>
                  </>
                }
              >
                <PassList
                  location={app.location}
                  passes={passes}
                  filters={app.filters}
                  onFiltersChange={app.setFilters}
                  selectedName={selectedSatellite?.omm.OBJECT_NAME}
                  familyOf={familyOf}
                  onShow={app.showPass}
                  onGoTo={(pass: Pass) => app.goToPass(pass)}
                  activePass={app.selection.activePass}
                  now={now}
                />
              </Disclosure>
            </aside>
          )}
        </div>
        <LiveTimeBar />
        <Help open={app.helpOpen} onToggle={app.setHelpOpen} />
      </main>
      <footer>
        Unofficial demo, not affiliated with Synspective. Orbital data: CelesTrak. Map: OpenFreeMap, © OpenStreetMap.
      </footer>
    </>
  )
}

/** The map follows the displayed time every frame; nothing above it re-renders for that. */
function LiveMap({
  satellites,
  selectedSatellite,
}: {
  satellites: ReturnType<typeof satelliteFrom>[]
  selectedSatellite: ReturnType<typeof satelliteFrom> | undefined
}) {
  const timeMs = useFrame((f) => f.timeMs)
  const time = useMemo(() => new Date(timeMs), [timeMs])
  const { selection, focus, location, span, select, setLocation } = useApp()
  const probe: Hover | null = useMemo(() => {
    if (selection.probeMs === null || !selectedSatellite) return null
    const p = positionAt(selectedSatellite, new Date(selection.probeMs))
    return p && { noradId: selectedSatellite.omm.NORAD_CAT_ID, lonLat: [p.lon, p.lat], timeMs: selection.probeMs }
  }, [selection.probeMs, selectedSatellite])
  return (
    <LazyMapView
      satellites={satellites}
      now={time}
      selected={selection.noradId}
      onSelect={select}
      focus={focus}
      location={location}
      onLocationChange={setLocation}
      ghost={selection.ghost}
      probe={probe}
      span={span}
    />
  )
}

function LiveTimeBar() {
  const nowMs = useFrame((f) => f.nowMs)
  const now = useMemo(() => new Date(nowMs), [nowMs])
  const { clock, setClock } = useApp()
  return <TimeBar clock={clock} now={now} onChange={setClock} />
}

export default App
