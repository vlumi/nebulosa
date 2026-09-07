import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Hover } from './map/layers'
import { loadElements, type Omm } from './orbit/elements'
import { positionAt, satelliteFrom } from './orbit/orbit'
import { nextPassOf, type Pass } from './orbit/passes'
import { inReach } from './orbit/swath'
import { usePasses } from './orbit/usePasses'
import { FollowButton } from './panels/FollowButton'
import { Help } from './panels/Help'
import { FlatMapIcon, GlobeIcon, MoonIcon, SunIcon } from './panels/Icons'
import { LanguageSelect } from './panels/LanguageSelect'
import { PassList } from './panels/PassList'
import { PlaceList } from './panels/PlaceList'
import { MapToggle } from './panels/MapToggle'
import { ReachToggle } from './panels/ReachToggle'
import { SatelliteView } from './map/SatelliteView'
import { SatelliteList } from './panels/SatelliteList'
import { Toolbar } from './panels/Toolbar'
import { useNarrow } from './panels/useNarrow'
import { placeName } from './i18n/placeName'
import { useStrings } from './i18n/useStrings'
import { resolveTheme, type Theme } from './shared/theme'
import { useSystemDark } from './shared/useSystemDark'
import { dispatchShortcut, releaseFocusAfterPointerClick } from './shortcuts'
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
  const s = useStrings()
  useEffect(() => {
    document.documentElement.lang = app.lang
  }, [app.lang])
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

  useEffect(() => startFrameLoop(() => useApp.getState().clock), [])

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
  // The readout speaks of the displayed moment, so its next pass is the first still to end then, not now.
  const displayedMinute = useFrame((f) => Math.floor(f.timeMs / 60_000))
  const nextPass = useMemo(
    () => (selectedId === null ? null : nextPassOf(allPasses, selectedId, displayedMinute * 60_000)),
    [allPasses, selectedId, displayedMinute],
  )

  // The keys act on the store directly; the listener re-registers only when the lists they step through change.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dispatchShortcut(e, { satellites, passes, theme, displayedMs: () => useFrame.getState().timeMs }))
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
      <MapToggle on={app.globe} onToggle={app.toggleGlobe} label={s.toggles.globe}>
        {app.globe ? <GlobeIcon /> : <FlatMapIcon />}
      </MapToggle>
      <MapToggle
        on={theme === 'light'}
        onToggle={() => app.setThemeChoice(theme === 'light' ? 'dark' : 'light')}
        label={s.toggles.theme}
      >
        {theme === 'light' ? <SunIcon /> : <MoonIcon />}
      </MapToggle>
      <ReachToggle on={app.reachVisible} onToggle={app.toggleReach} />
      <LanguageSelect lang={app.lang} onChange={app.setLang} />
    </>
  )

  return (
    <>
      <header>
        <h1>nebulosa</h1>
        <p>{s.subtitle}</p>
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
        {app.ride && selectedSatellite && (
          <SatelliteView
            satellite={selectedSatellite}
            theme={theme}
            lang={app.lang}
            reach={app.reachVisible}
            onBack={() => app.setRide(false)}
          />
        )}
        <div className={styles.shell}>
          {app.sheet === 'satellites' && (
            <Sheet label={s.sheet.constellation} sheet="satellites" onClose={app.closeSheet}>
              {loaded === null && <p>{s.loading}</p>}
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
                  onRide={() => {
                    app.setRide(true)
                    closeOnPhone()
                  }}
                  nextPass={nextPass}
                  placeName={place ? placeName(place, s) : undefined}
                  passes={allPasses.filter((p) => p.noradId === app.selection.noradId)}
                />
              )}
            </Sheet>
          )}
          {app.sheet === 'places' && (
            <Sheet label={s.sheet.places} sheet="places" onClose={app.closeSheet}>
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
                onLocate={(location, name) => {
                  app.locatePlace(location, name)
                  closeOnPhone()
                }}
              />
            </Sheet>
          )}
          {app.sheet === 'passes' && satellites.length > 0 && !place && (
            <Sheet label={s.sheet.passes} sheet="passes" onClose={app.closeSheet}>
              <p className="muted">{s.pickPlace}</p>
            </Sheet>
          )}
          {app.sheet === 'passes' && satellites.length > 0 && place && (
            <Sheet label={s.sheet.passes} sheet="passes" onClose={app.closeSheet}>
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
            places={{ count: app.places.length, selected: place ? placeName(place, s) : undefined }}
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
      <footer>{s.footer}</footer>
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
  const closeLabel = useStrings().close(label)
  // Closing unmounts the button that had focus; the pill that owns the sheet is where a keyboard user came from.
  const close = () => {
    onClose()
    document.querySelector<HTMLElement>(`[data-sheet="${sheet}"]`)?.focus()
  }
  return (
    <aside id="sheet" className={`${panel.panel} ${styles.sheet}`} aria-label={label}>
      <button type="button" className={styles.close} aria-label={closeLabel} onClick={close}>
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
    camera,
    places,
    placeId,
    pinsLocked,
    span,
    reachVisible,
    globe,
    follow,
    lang,
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
      camera={camera}
      places={places}
      placeId={placeId}
      onPlaceSelect={selectPlace}
      onPlaceMove={movePlace}
      pinsLocked={pinsLocked}
      onPlaceAdd={addPlace}
      ghost={selection.ghost}
      probe={probe}
      span={span}
      reach={reachVisible}
      globe={globe}
      follow={follow && selection.noradId !== null}
      onFollowBreak={() => setFollow(false)}
      theme={theme}
      lang={lang}
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
