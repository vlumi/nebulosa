import { MapLibreOverlay } from '@deck.gl/maplibre'
import { Map as MapLibre, NavigationControl, setWorkerUrl, type GeoJSONSource, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildLayers, hoverAt, trackData, type Ghost, type Hover, type SatelliteDatum, type TrackDatum } from './layers'
import type { LonLat } from '../orbit/orbit'
import { BASEMAPS, PALETTES, type Theme } from '../shared/theme'
import {
  EMPTY,
  NIGHT_LAYER,
  nightPaint,
  nightFeature,
  REACH_LAYER,
  REACH_OPACITY,
  reachFeature,
  reachFill,
} from './surface'
import { DEFAULT_SPAN, positionAt, type Satellite, type TrackSpan } from '../orbit/orbit'
import type { Location } from '../orbit/passes'
import type { Place } from '../places/places'
import type { CameraRequest } from '../store'
import { fitZoom, GLOBE_MAX_ZOOM } from './fit'
import { nearestLabel } from './labels'
import { usePins } from './usePins'
import { useLatest } from '../shared/useLatest'
import { useThrottled } from '../shared/useThrottled'

/** luma's canvas context behind the overlay's deck, reached only to resize the framebuffer it keeps for the canvas. */
interface InterleavedDeck {
  device?: {
    getDefaultCanvasContext?: () => { getCurrentFramebuffer?: () => { resize?: (size: [number, number]) => void } }
  }
}
const LONG_PRESS_MS = 600
// MapLibre 6 resolves its worker relative to its own script URL, which a bundled app does not provide.
setWorkerUrl(maplibreWorkerUrl)

/**
 * A request to bring a satellite into view at `timeMs` (default: the displayed time);
 * `seq` makes repeated requests for the same one distinct.
 */
interface Props {
  satellites: Satellite[]
  now: Date
  selected: number | null
  onSelect: (noradId: number | null) => void
  /** One camera move, to a satellite or a point; see the store. */
  camera?: CameraRequest | null
  places: Place[]
  placeId: string | null
  onPlaceSelect: (id: string) => void
  onPlaceMove: (id: string, location: Location) => void
  /** Pins cannot be dragged while locked. */
  pinsLocked?: boolean
  /** A double click, or a long press on a touch screen; `name` is the nearest place label the basemap shows there, if
   * any. */
  onPlaceAdd: (location: Location, name?: string) => void
  ghost?: Ghost | null
  /** A point to show as if hovered, driven from the keyboard; the pointer wins while it is over a track. */
  probe?: Hover | null
  span?: TrackSpan
  /** Draw the radar's reach beside the selected satellite's track. */
  reach?: boolean
  globe?: boolean
  /** Keep the selected satellite centered; a drag on the map hands control back and reports it. */
  follow?: boolean
  onFollowBreak?: () => void
  theme?: Theme
  /** Height of the bars floating over the map's foot; the camera centers and the fit is taken above them. */
  bottomInset?: number
}

export function MapView({
  satellites,
  now,
  selected,
  onSelect,
  camera = null,
  places,
  placeId,
  onPlaceSelect,
  onPlaceMove,
  pinsLocked = false,
  onPlaceAdd,
  ghost = null,
  probe = null,
  span = DEFAULT_SPAN,
  reach = false,
  globe = false,
  follow = false,
  onFollowBreak,
  theme = 'dark',
  bottomInset = 0,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre>(null)
  const markers = useRef(new globalThis.Map<string, Marker>())
  const overlay = useRef<MapLibreOverlay>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  // Labels are placed per camera on the globe, so a move re-renders even while the clock stands still.
  const [viewVersion, setViewVersion] = useState(0)

  // The map and overlay are created once; their callbacks read the latest props through these.
  const placeAdd = useLatest(onPlaceAdd)
  const select = useLatest(onSelect)
  const currentTime = useLatest(now)
  const followBreak = useLatest(onFollowBreak)
  const following = useLatest(follow)
  // A recenter while a pointer is down cancels the drag MapLibre is about to start, so following pauses from
  // pointer down to pointer up; the store hears of the break only once the drag has begun.
  const pointerDown = useRef(false)
  // Set the moment a gesture lets go, before the store hears of it: one more recenter would cancel the gesture.
  const letGo = useRef(false)
  const wasFollowing = useRef(follow)
  // The follow's own recenter fires a move too; the layers are being rebuilt for this frame anyway.
  const recentering = useRef(false)

  // A track shifted by under a minute is indistinguishable, and while scrubbing or fast-forwarding
  // a few tenths of a second of staleness is invisible; positions still move every frame.
  const trackMinute = useThrottled(Math.floor(now.getTime() / 60_000), 150)
  const tracks = useMemo(
    () => trackData(satellites, new Date(trackMinute * 60_000), span),
    [satellites, trackMinute, span],
  )
  const currentTracks = useLatest(tracks)
  // The terminator moves a quarter degree a minute; rebuilding sixty strips per frame would be waste.
  const nightData = useMemo(() => nightFeature(new Date(trackMinute * 60_000)), [trackMinute])
  const reachTrack = reach && selected !== null ? tracks.find((t) => t.noradId === selected) : undefined
  const reachData = useMemo(() => (reachTrack ? reachFeature(reachTrack.samples) : EMPTY), [reachTrack])
  const reachColor = reachFill(reachTrack?.family ?? 'sun-synchronous', theme)
  const surfaces = useLatest({ nightData, reachData, reachColor, nightPaint: nightPaint(theme) })

  const projection = useLatest(globe)
  const inset = useLatest(bottomInset)
  const initialTheme = useRef(theme)
  const styleReady = useRef(false)
  const applyProjection = useCallback(() => {
    const m = map.current
    if (!m || !styleReady.current) return
    const wanted = projection.current && m.getZoom() < GLOBE_MAX_ZOOM ? 'globe' : 'mercator'
    if (m.getProjection()?.type !== wanted) m.setProjection({ type: wanted })
  }, [projection])

  useEffect(() => {
    map.current = new MapLibre({
      container: container.current!,
      style: BASEMAPS[initialTheme.current],
      // MapLibre's own lines are antialiased in the shader and it leaves multisampling off; deck.gl's paths and
      // discs share the context in interleaved mode and would render with jagged edges without it.
      canvasContextAttributes: { antialias: true },
      center: [139.7, 35.7],
      zoom: fitZoom(
        container.current!.clientWidth,
        container.current!.clientHeight - inset.current,
        projection.current,
      ),
      doubleClickZoom: false,
    })
    const addAt = (e: { point: { x: number; y: number }; lngLat: { lat: number; lng: number } }) =>
      placeAdd.current({ lat: e.lngLat.lat, lon: e.lngLat.lng }, nearestLabel(map.current, e.point))
    map.current.on('dblclick', addAt)
    let press: ReturnType<typeof setTimeout> | undefined
    map.current.on('touchstart', (e) => {
      clearTimeout(press)
      if (e.originalEvent.touches.length !== 1) return
      const at = { point: e.point, lngLat: e.lngLat }
      press = setTimeout(() => addAt(at), LONG_PRESS_MS)
    })
    for (const end of ['touchmove', 'touchend', 'touchcancel'] as const) map.current.on(end, () => clearTimeout(press))
    map.current.on('style.load', () => {
      const m = map.current
      if (!m) return
      styleReady.current = true
      applyProjection()
      // No tile buffer: a fill that touches the antimeridian is wrapped into world copies, and with a buffer
      // the copies overlap there in a band twice as dark as the rest. No simplification either: the reach is a
      // run of small quads, and moving their vertices makes neighbours overlap or part in a ladder pattern.
      m.addSource(NIGHT_LAYER, { type: 'geojson', data: surfaces.current.nightData, buffer: 0, tolerance: 0 })
      m.addSource(REACH_LAYER, { type: 'geojson', data: surfaces.current.reachData, buffer: 0, tolerance: 0 })
      m.addLayer({ id: NIGHT_LAYER, type: 'fill', source: NIGHT_LAYER, paint: surfaces.current.nightPaint })
      m.addLayer({
        id: REACH_LAYER,
        type: 'fill',
        source: REACH_LAYER,
        paint: { 'fill-color': surfaces.current.reachColor, 'fill-opacity': REACH_OPACITY, 'fill-antialias': false },
      })
    })
    map.current.on('zoom', applyProjection)
    map.current.on('move', () => {
      if (!recentering.current) setViewVersion((v) => v + 1)
    })
    for (const event of ['mousedown', 'touchstart'] as const) map.current.on(event, () => (pointerDown.current = true))
    for (const event of ['mouseup', 'touchend', 'dragend'] as const)
      map.current.on(event, () => (pointerDown.current = false))
    // Any gesture of the reader's own lets go: a pan, a wheel or pinch zoom, a rotation, a tilt. The zoom
    // buttons keep the center and carry no original event, so they keep following. The wheel is caught as
    // the wheel event: it only queues the zoom for the next frame, and a recenter before that frame would
    // discard the queue, so the zoom would never start.
    const release = () => {
      if (!following.current) return
      letGo.current = true
      followBreak.current?.()
    }
    map.current.on('wheel', release)
    for (const event of ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart'] as const)
      map.current.on(event, (e) => {
        if (e.originalEvent) release()
      })
    // deck draws with its own depth and culling settings, and MapLibre caches GL state, so after each frame
    // MapLibre is told to re-apply everything; otherwise its far-side tiles can come through as dark wedges.
    map.current.on('render', () => {
      ;(
        map.current as unknown as { painter?: { context?: { setDirty?: () => void } } } | null
      )?.painter?.context?.setDirty?.()
      for (const marker of markers.current.values()) {
        const element = marker.getElement()
        element.style.pointerEvents = element.style.opacity === '0' ? 'none' : ''
      }
    })
    // luma.gl (9.4.0) keeps a framebuffer object for the canvas, and its height sets the y-flip of every
    // viewport drawn into it. luma's deferred resize refreshes that object only when luma itself has to change
    // the canvas size; MapLibre has already resized the canvas by then, so the object keeps the old height and
    // the overlay draws offset by exactly the resize. Everything else follows on its own: deck re-measures
    // through luma's ResizeObserver, and MapLibre's move event drops the module's cached viewport.
    // Reported as visgl/luma.gl#3177, fix in visgl/luma.gl#3178 (CanvasSurface tracks the configured size). Once
    // the lockfile's @luma.gl/core carries it, delete this handler, the InterleavedDeck type and their test.
    map.current.on('resize', () => {
      const canvas = map.current?.getCanvas()
      const deck = (overlay.current as unknown as { _deck?: InterleavedDeck } | null)?._deck
      if (!canvas || !deck) return
      deck.device?.getDefaultCanvasContext?.().getCurrentFramebuffer?.()?.resize?.([canvas.width, canvas.height])
    })
    map.current.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
    overlay.current = new MapLibreOverlay({
      interleaved: true,
      layers: [],
      pickingRadius: 8,
      onClick: (info) => select.current((info.object as SatelliteDatum | undefined)?.noradId ?? null),
      onHover: (info) => {
        const over = info.object as SatelliteDatum | undefined
        const track = !over
          ? undefined
          : info.layer?.id === 'ghost-track'
            ? (over as TrackDatum)
            : info.layer?.id === 'tracks'
              ? currentTracks.current.find((t) => t.noradId === over.noradId)
              : undefined
        // deck's picked coordinate is wrong on the MapLibre module's globe; MapLibre's own unproject is right in
        // both projections.
        const point = track && map.current && info.x !== undefined ? map.current.unproject([info.x, info.y]) : null
        setHover(track && point ? hoverAt(track, [point.lng, point.lat]) : null)
      },
      getCursor: ({ isHovering, isDragging }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'),
    })
    map.current.addControl(overlay.current)
    const pins = markers.current
    return () => {
      clearTimeout(press)
      overlay.current = null
      pins.clear()
      map.current?.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  usePins(map, markers, { places, placeId, pinsLocked, theme, onSelect: onPlaceSelect, onMove: onPlaceMove })

  useEffect(() => {
    map.current?.setPadding({ top: 0, left: 0, right: 0, bottom: bottomInset })
  }, [bottomInset])

  // A new basemap for a new theme: the style.load handler above re-adds the surfaces with the theme's paints.
  useEffect(() => {
    if (theme === initialTheme.current) return
    initialTheme.current = theme
    map.current?.setStyle(BASEMAPS[theme])
  }, [theme])

  // The projection is part of the style; before the style has loaded, the load handler above applies it.
  useEffect(applyProjection, [globe, applyProjection])

  useEffect(() => {
    if (follow && !wasFollowing.current) letGo.current = false
    wasFollowing.current = follow
    if (!follow || letGo.current || pointerDown.current || selected === null) return
    const sat = satellites.find((s) => s.omm.NORAD_CAT_ID === selected)
    const p = sat && positionAt(sat, now)
    if (!p) return
    recentering.current = true
    map.current?.jumpTo({ center: [p.lon, p.lat] })
    recentering.current = false
  }, [follow, selected, satellites, now])

  // Each camera request flies once. A flight to a satellite is skipped while following, which already centers on
  // it, and turning following off later must not replay it, or the drag that turned it off is thrown back.
  const flown = useRef<number>(undefined)
  useEffect(() => {
    if (!camera || camera.seq === flown.current) return
    flown.current = camera.seq
    if (camera.kind === 'point') {
      map.current?.easeTo({ center: [camera.lon, camera.lat], duration: 600 })
      return
    }
    if (following.current) return
    const sat = satellites.find((s) => s.omm.NORAD_CAT_ID === camera.noradId)
    const at = camera.timeMs === undefined ? currentTime.current : new Date(camera.timeMs)
    const p = sat && positionAt(sat, at)
    if (p) map.current?.easeTo({ center: [p.lon, p.lat], duration: 600 })
  }, [camera, following, satellites, currentTime])

  // Until the style has loaded the sources do not exist; the load handler above then takes the latest data.
  useEffect(() => {
    ;(map.current?.getSource(NIGHT_LAYER) as GeoJSONSource | undefined)?.setData(nightData)
  }, [nightData])
  useEffect(() => {
    ;(map.current?.getSource(REACH_LAYER) as GeoJSONSource | undefined)?.setData(reachData)
    if (map.current?.getLayer(REACH_LAYER)) map.current.setPaintProperty(REACH_LAYER, 'fill-color', reachColor)
  }, [reachData, reachColor])

  // Whether a point faces the camera: MapLibre projects a far-side point to the pixel in front of it, so the round
  // trip through its unproject comes back somewhere else. Public API only, and right for any pitch.
  const onNearSide = (lonLat: LonLat): boolean => {
    const m = map.current
    if (!m) return true
    const back = m.unproject(m.project(lonLat))
    const dLon = Math.abs(((back.lng - lonLat[0] + 540) % 360) - 180)
    return dLon < 1 && Math.abs(back.lat - lonLat[1]) < 1
  }

  useEffect(() => {
    overlay.current?.setProps({
      layers: buildLayers(satellites, tracks, now, {
        selected,
        hover: hover ?? probe,
        ghost,
        globe,
        onNearSide: globe ? onNearSide : undefined,
        palette: PALETTES[theme],
      }),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satellites, tracks, now, selected, hover, probe, ghost, globe, viewVersion, theme])

  return <div ref={container} className="map" />
}
