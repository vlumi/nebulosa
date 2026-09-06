import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Hover } from './map/layers'
import { loadElements, type Omm } from './orbit/elements'
import { positionAt, satelliteFrom } from './orbit/orbit'
import { type Pass } from './orbit/passes'
import { inReach } from './orbit/swath'
import { usePasses } from './orbit/usePasses'
import { FollowButton } from './panels/FollowButton'
import { Help } from './panels/Help'
import { PassList } from './panels/PassList'
import { PlaceList } from './panels/PlaceList'
import { MapToggle } from './panels/MapToggle'
import { ReachToggle } from './panels/ReachToggle'
import { SatelliteList } from './panels/SatelliteList'
import { Toolbar } from './panels/Toolbar'
import { useNarrow } from './panels/useNarrow'
import { resolveTheme, type Theme } from './shared/theme'
import { useSystemDark } from './shared/useSystemDark'
import {
  belongsToFocusedControl,
  PROBE_BIG_STEP_MS,
  PROBE_STEP_MS,
  releaseFocusAfterPointerClick,
  stepIndex,
} from './shortcuts'
import styles from './App.module.css'
import panel from './panels/panel.module.css'
import { selectedPlace, useApp, type Sheet as SheetKey } from './store'
import { startFrameLoop, useFrame, useMinute } from './time/frame'
import { TimeBar } from './time/TimeBar'

type Loaded = { elements: Omm[] } | { error: string } | null

// MapLibre and deck.gl are most of the bundle; the shell and the lists paint before they arrive.
const LazyMapView = lazy(() => import('./map/MapView').then((m) => ({ default: m.MapView })))

function App() {
  const [loaded, setLoaded] = useState<Loaded>(null)
  const app = useApp()
  const narrow = useNarrow()
  // The toolbar and the time bar float over the foot of the map; the map centers and fits above them.
  const mainRef = useRef<HTMLElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [bottomInset, setBottomInset] = useState(0)
  useEffect(() => {
    const main = mainRef.current?.getBoundingClientRect()
    const toolbar = toolbarRef.current?.getBoundingClientRect()
    if (main && toolbar) setBottomInset(Math.max(0, Math.round(main.bottom - toolbar.top)))
  }, [narrow])
  const systemDark = useSystemDark()
  const theme = resolveTheme(app.themeChoice, systemDark)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  const minute = useMinute()
  const now = useMemo(() => new Date(minute * 60_000), [minute])

  useEffect(() => startFrameLoop(), [])

  // A phone opens on the map; the sheets wait behind the toolbar.
  const closeSheet = app.closeSheet
  useEffect(() => {
    if (narrow) closeSheet()
  }, [narrow, closeSheet])
  const closeOnPhone = () => {
    if (narrow) closeSheet()
  }

  useEffect(() => {
    loadElements()
      .then((elements) => setLoaded({ elements }))
      .catch((e: unknown) => setLoaded({ error: e instanceof Error ? e.message : String(e) }))
  }, [])

  const elements = useMemo(() => (loaded && 'elements' in loaded ? loaded.elements : []), [loaded])
  const satellites = useMemo(() => elements.map(satelliteFrom), [elements])
  const byId = (noradId: number | null) => satellites.find((s) => s.omm.NORAD_CAT_ID === noradId)

  // Passes are listed from real time, so scrubbing the clock never changes the list under the reader.
  const place = selectedPlace(app)
  const allPasses = usePasses(elements, place, minute * 60_000, app.filters.horizonHours)
  const selectedSatellite = byId(app.selection.noradId)
  const { within, onlySelected } = app.filters
  const selectedId = app.selection.noradId
  const passes = useMemo(
    () =>
      allPasses.filter(
        (p) =>
          (within === 'horizon' || inReach(p.offNadirDeg)) &&
          (selectedId === null || !onlySelected || p.noradId === selectedId),
      ),
    [allPasses, within, onlySelected, selectedId],
  )
  const familyOf = (noradId: number) => byId(noradId)?.family ?? 'mid-inclination'
  const nextPass = useMemo(
    () => allPasses.find((p) => p.noradId === selectedId && p.endMs > minute * 60_000) ?? null,
    [allPasses, selectedId, minute],
  )

  // The handler reads the store directly; it re-registers only when the lists it steps through change.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (belongsToFocusedControl(e) || e.metaKey || e.ctrlKey || e.altKey) return
      const s = useApp.getState()
      const satelliteIndex = satellites.findIndex((sat) => sat.omm.NORAD_CAT_ID === s.selection.noradId)
      const passIndex = passes.findIndex(
        (p) => p.noradId === s.selection.activePass?.noradId && p.peakMs === s.selection.activePass?.peakMs,
      )
      const placeIndex = s.places.findIndex((p) => p.id === s.placeId)
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
          if (s.sheet === 'passes') {
            const i = stepIndex(passIndex, delta, passes.length)
            if (i >= 0) s.showPass(passes[i])
          } else if (s.sheet === 'places' && e.shiftKey) {
            if (s.placeId !== null) s.reorderPlace(s.placeId, delta)
          } else if (s.sheet === 'places') {
            const i = stepIndex(placeIndex, delta, s.places.length)
            if (i >= 0) s.selectPlace(s.places[i].id, true)
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
          s.toggleSheet('satellites')
          break
        case 'p':
        case 'P':
          s.toggleSheet('passes')
          break
        case 'w':
        case 'W':
          s.toggleSheet('places')
          break
        case 'o':
        case 'O':
          if (s.selection.noradId !== null) s.toggleOnlySelected()
          break
        case 'r':
        case 'R':
          s.toggleReach()
          break
        case 'g':
        case 'G':
          s.toggleGlobe()
          break
        case 'f':
        case 'F':
          if (s.selection.noradId !== null) s.toggleFollow()
          break
        case 't':
        case 'T':
          s.setThemeChoice(theme === 'light' ? 'dark' : 'light')
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
  }, [satellites, passes, theme])

  // The map toggles live in the title row, which has the room on every screen; the map corners are for the
  // compass, the follow button and the help.
  const toggles = (
    <>
      <MapToggle on={app.globe} onToggle={app.toggleGlobe} title="Globe or flat map">
        Globe
      </MapToggle>
      <MapToggle
        on={theme === 'light'}
        onToggle={() => app.setThemeChoice(theme === 'light' ? 'dark' : 'light')}
        title="Light or dark; follows the system until chosen"
      >
        Light
      </MapToggle>
      <ReachToggle on={app.reachVisible} onToggle={app.toggleReach} />
    </>
  )

  return (
    <>
      <header>
        <h1>nebulosa</h1>
        <p>Ground tracks of the StriX SAR constellation</p>
        <div className={styles.headerToggles}>{toggles}</div>
      </header>
      <main ref={mainRef}>
        <Suspense fallback={<div className="map" />}>
          <LiveMap
            satellites={satellites}
            selectedSatellite={selectedSatellite}
            theme={theme}
            bottomInset={bottomInset}
          />
        </Suspense>
        <div className={styles.shell}>
          {app.sheet === 'satellites' && (
            <Sheet label="Constellation" sheet="satellites" onClose={app.closeSheet}>
              {loaded === null && <p>Loading orbital elements…</p>}
              {loaded && 'error' in loaded && <p role="alert">{loaded.error}</p>}
              {satellites.length > 0 && (
                <SatelliteList
                  satellites={satellites}
                  now={now}
                  selected={app.selection.noradId}
                  onSelect={(id) => {
                    if (id === null) app.select(null)
                    else app.selectFromList(id)
                    closeOnPhone()
                  }}
                  span={app.span}
                  onSpanChange={app.setSpan}
                  nextPass={nextPass}
                  placeName={place?.name}
                  passes={allPasses.filter((p) => p.noradId === app.selection.noradId)}
                  probeMs={app.selection.probeMs}
                  onProbe={app.setProbe}
                />
              )}
            </Sheet>
          )}
          {app.sheet === 'places' && (
            <Sheet label="Places" sheet="places" onClose={app.closeSheet}>
              <PlaceList
                places={app.places}
                placeId={app.placeId}
                onSelect={(id) => {
                  app.selectPlace(id, true)
                  closeOnPhone()
                }}
                onRename={app.renamePlace}
                onRemove={app.removePlace}
                pinsLocked={app.pinsLocked}
                onLockChange={app.setPinsLocked}
              />
            </Sheet>
          )}
          {app.sheet === 'passes' && satellites.length > 0 && !place && (
            <Sheet label="Passes" sheet="passes" onClose={app.closeSheet}>
              <p className="muted">Pick a place to see passes over it.</p>
            </Sheet>
          )}
          {app.sheet === 'passes' && satellites.length > 0 && place && (
            <Sheet label="Passes" sheet="passes" onClose={app.closeSheet}>
              <PassList
                place={place}
                passes={passes}
                filters={app.filters}
                onFiltersChange={app.setFilters}
                selectedName={selectedSatellite?.omm.OBJECT_NAME}
                familyOf={familyOf}
                onShow={(pass) => {
                  app.showPass(pass)
                  closeOnPhone()
                }}
                onGoTo={(pass: Pass) => {
                  app.goToPass(pass)
                  closeOnPhone()
                }}
                activePass={app.selection.activePass}
                now={now}
              />
            </Sheet>
          )}
          <Toolbar
            ref={toolbarRef}
            sheet={app.sheet}
            onToggle={app.toggleSheet}
            onClearSatellite={() => app.select(null)}
            onClearPlace={() => app.selectPlace(null)}
            onClearPass={app.clearPass}
            satellites={{
              count: satellites.length,
              selected: selectedSatellite
                ? { name: selectedSatellite.omm.OBJECT_NAME, family: selectedSatellite.family }
                : undefined,
            }}
            places={{ count: app.places.length, selected: place?.name }}
            passes={
              satellites.length > 0
                ? {
                    count: passes.length,
                    active: app.selection.activePass
                      ? { name: app.selection.activePass.name, peakMs: app.selection.activePass.peakMs }
                      : undefined,
                  }
                : undefined
            }
          />
        </div>
        {selectedSatellite && (
          <FollowButton name={selectedSatellite.omm.OBJECT_NAME} on={app.follow} onToggle={app.toggleFollow} />
        )}
        <LiveTimeBar />
        <Help open={app.helpOpen} onToggle={app.setHelpOpen} />
      </main>
      <footer>
        Unofficial demo, not affiliated with Synspective. Orbital data: CelesTrak. Map: OpenFreeMap, © OpenStreetMap.
      </footer>
    </>
  )
}

/** One sheet of the shell: a panel with a × in its corner, since the pill that opened it is not an obvious way back. */
function Sheet({
  label,
  sheet,
  onClose,
  children,
}: {
  label: string
  sheet: SheetKey
  onClose: () => void
  children: ReactNode
}) {
  // Closing unmounts the button that had focus; the pill that owns the sheet is where a keyboard user came from.
  const close = () => {
    onClose()
    document.querySelector<HTMLElement>(`[data-sheet="${sheet}"]`)?.focus()
  }
  return (
    <aside id="sheet" className={`${panel.panel} ${styles.sheet}`} aria-label={label}>
      <button type="button" className={styles.close} aria-label={`Close ${label.toLowerCase()}`} onClick={close}>
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
          <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {children}
    </aside>
  )
}

/** The map follows the displayed time every frame; nothing above it re-renders for that. */
function LiveMap({
  satellites,
  selectedSatellite,
  theme,
  bottomInset,
}: {
  satellites: ReturnType<typeof satelliteFrom>[]
  selectedSatellite: ReturnType<typeof satelliteFrom> | undefined
  theme: Theme
  bottomInset: number
}) {
  const timeMs = useFrame((f) => f.timeMs)
  const time = useMemo(() => new Date(timeMs), [timeMs])
  const {
    selection,
    focus,
    places,
    placeId,
    pinsLocked,
    flyTo,
    span,
    reachVisible,
    globe,
    follow,
    setFollow,
    select,
    selectPlace,
    movePlace,
    addPlace,
  } = useApp()
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
      places={places}
      placeId={placeId}
      onPlaceSelect={selectPlace}
      onPlaceMove={movePlace}
      pinsLocked={pinsLocked}
      onPlaceAdd={addPlace}
      flyTo={flyTo}
      ghost={selection.ghost}
      probe={probe}
      span={span}
      reach={reachVisible}
      globe={globe}
      follow={follow && selection.noradId !== null}
      onFollowBreak={() => setFollow(false)}
      theme={theme}
      bottomInset={bottomInset}
    />
  )
}

/** The bar shows whole seconds, so it follows real time at one hertz; the store's clock changes still land at once. */
function LiveTimeBar() {
  const nowMs = useFrame((f) => Math.floor(f.nowMs / 1000) * 1000)
  const now = useMemo(() => new Date(nowMs), [nowMs])
  const { clock, setClock } = useApp()
  return <TimeBar clock={clock} now={now} onChange={setClock} />
}

export default App
