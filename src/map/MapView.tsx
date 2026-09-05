import { MapLibreOverlay } from '@deck.gl/maplibre'
import { Map as MapLibre, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildLayers,
  hoverAt,
  trackData,
  type Ghost,
  type GlobeView,
  type Hover,
  type SatelliteDatum,
  type TrackDatum,
} from './layers'
import { DEFAULT_SPAN, positionAt, type Satellite, type TrackSpan } from '../orbit/orbit'
import type { Location } from '../orbit/passes'
import type { Place } from '../places/places'
import type { FlyTo } from '../store'
import { fitZoom, GLOBE_MAX_ZOOM, horizonDeg, measureHorizonDeg } from './fit'
import { nightCells } from '../orbit/sun'
import { useLatest } from '../shared/useLatest'
import { useThrottled } from '../shared/useThrottled'

const BASEMAP = 'https://tiles.openfreemap.org/styles/fiord'

/**
 * The private surface of the deck instance behind the overlay that a resize has to reach: deck's own size
 * for its viewports, and luma's cached canvas sizes, which it otherwise forces back onto the canvas.
 */
interface InterleavedDeck {
  width: number
  height: number
  viewManager?: { setProps: (props: { width: number; height: number }) => void }
  layerManager?: { activateViewport: (viewport: unknown) => void }
  getViewports: () => unknown[]
  /** The MapLibre module caches its viewport here and clears it only when the map moves. */
  userData: { currentViewport?: unknown }
  device?: {
    canvasContext?: CanvasSizes
    getDefaultCanvasContext?: () => CanvasSizes
  }
  _canvasContext?: CanvasSizes
}

/**
 * luma's canvas context: cached CSS and drawing-buffer sizes of the shared canvas, and the framebuffer object
 * standing for the canvas, whose own cached height sets the y-flip of every viewport drawn into it.
 */
interface CanvasSizes {
  cssWidth: number
  cssHeight: number
  setDrawingBufferSize: (width: number, height: number) => void
  getCurrentFramebuffer?: () => { resize?: (size: [number, number]) => void }
}
const LONG_PRESS_MS = 600
const PIN_SELECTED = '#eedd66'
const PIN = '#8a90a0'
/** How far, in pixels, a basemap label may be from the tap to name the place after it. */
const LABEL_RADIUS_PX = 60
const SETTLEMENTS = new Set(['city', 'town', 'village'])

/**
 * The name of the nearest settlement label the basemap is showing around `point`, else the country's,
 * else nothing: the tiles already know the names, so no service is asked and no coordinates leave the browser.
 */
function nearestLabel(map: MapLibre | null, point: { x: number; y: number }): string | undefined {
  if (!map) return undefined
  const r = LABEL_RADIUS_PX
  const features = map.queryRenderedFeatures([
    [point.x - r, point.y - r],
    [point.x + r, point.y + r],
  ])
  const named = features.filter((f) => f.sourceLayer === 'place' && typeof f.properties?.name === 'string')
  const rank = (f: (typeof named)[number]) => {
    const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates
    const p = map.project([lon, lat])
    return Math.hypot(p.x - point.x, p.y - point.y)
  }
  const pick = (test: (cls: unknown) => boolean) =>
    named.filter((f) => test(f.properties.class)).sort((a, b) => rank(a) - rank(b))[0]
  const label = pick((cls) => SETTLEMENTS.has(String(cls))) ?? pick((cls) => cls === 'country')
  return label ? String(label.properties['name:en'] ?? label.properties.name_en ?? label.properties.name) : undefined
}

// MapLibre 6 resolves its worker relative to its own script URL, which a bundled app does not provide.
setWorkerUrl(maplibreWorkerUrl)

/**
 * A request to bring a satellite into view at `timeMs` (default: the displayed time);
 * `seq` makes repeated requests for the same one distinct.
 */
export interface Focus {
  noradId: number
  seq: number
  timeMs?: number
}

interface Props {
  satellites: Satellite[]
  now: Date
  selected: number | null
  onSelect: (noradId: number | null) => void
  focus?: Focus | null
  places: Place[]
  placeId: string | null
  onPlaceSelect: (id: string) => void
  onPlaceMove: (id: string, location: Location) => void
  /** A double click, or a long press on a touch screen; `name` is the nearest place label the basemap shows there, if any. */
  onPlaceAdd: (location: Location, name?: string) => void
  flyTo?: FlyTo | null
  ghost?: Ghost | null
  /** A point to show as if hovered, driven from the keyboard; the pointer wins while it is over a track. */
  probe?: Hover | null
  span?: TrackSpan
  /** Draw the radar's reach beside the selected satellite's track. */
  reach?: boolean
  globe?: boolean
}

export function MapView({
  satellites,
  now,
  selected,
  onSelect,
  focus = null,
  places,
  placeId,
  onPlaceSelect,
  onPlaceMove,
  onPlaceAdd,
  flyTo = null,
  ghost = null,
  probe = null,
  span = DEFAULT_SPAN,
  reach = false,
  globe = false,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre>(null)
  const markers = useRef(new globalThis.Map<string, Marker>())
  const overlay = useRef<MapLibreOverlay>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  // Bumped on every map move so the far-side culling of the surfaces follows the camera even while paused.
  const [viewSeq, setViewSeq] = useState(0)

  // The map and overlay are created once; their callbacks read the latest props through these.
  const placeSelect = useLatest(onPlaceSelect)
  const placeMove = useLatest(onPlaceMove)
  const placeAdd = useLatest(onPlaceAdd)
  const select = useLatest(onSelect)
  const currentTime = useLatest(now)

  // A track shifted by under a minute is indistinguishable, and while scrubbing or fast-forwarding
  // a few tenths of a second of staleness is invisible; positions still move every frame.
  const trackMinute = useThrottled(Math.floor(now.getTime() / 60_000), 150)
  const tracks = useMemo(
    () => trackData(satellites, new Date(trackMinute * 60_000), span),
    [satellites, trackMinute, span],
  )
  const currentTracks = useLatest(tracks)
  // The terminator moves a quarter degree a minute; rebuilding sixty strips per frame would be waste.
  const night = useMemo(() => nightCells(new Date(trackMinute * 60_000)), [trackMinute])

  const projection = useLatest(globe)
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
      style: BASEMAP,
      center: [139.7, 35.7],
      zoom: fitZoom(container.current!.clientWidth, container.current!.clientHeight, projection.current),
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
    })
    map.current.on('zoom', applyProjection)
    map.current.on('move', () => setViewSeq((n) => n + 1))
    // The interleaved overlay (deck.gl 9.4 beta) registers no resize listener and would keep its first size.
    // Handing it a width and height makes deck restyle the canvas, which is MapLibre's own, and stretches
    // the map; its own re-measure reads sizes the shared canvas context does not update, and luma even forces
    // those stale sizes back onto the canvas. So every cached size is refreshed from the canvas by hand, and
    // the viewport the module caches per map move is dropped so the next frame builds a fresh one.
    map.current.on('resize', () => {
      const canvas = map.current?.getCanvas()
      const deck = (overlay.current as unknown as { _deck?: InterleavedDeck } | null)?._deck
      if (!canvas || !deck) return
      const { clientWidth: width, clientHeight: height } = canvas
      const surfaces = new Set(
        [deck.device?.canvasContext, deck.device?.getDefaultCanvasContext?.(), deck._canvasContext].filter(
          (s): s is CanvasSizes => Boolean(s),
        ),
      )
      for (const surface of surfaces) {
        surface.cssWidth = width
        surface.cssHeight = height
        surface.setDrawingBufferSize(canvas.width, canvas.height)
        surface.getCurrentFramebuffer?.()?.resize?.([canvas.width, canvas.height])
      }
      deck.userData.currentViewport = undefined
      if (deck.width === width && deck.height === height) return
      deck.width = width
      deck.height = height
      deck.viewManager?.setProps({ width, height })
      deck.layerManager?.activateViewport(deck.getViewports()[0])
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
        setHover(track && info.coordinate ? hoverAt(track, info.coordinate as [number, number]) : null)
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

  // One draggable pin per place, the selected one in the accent color; pins come and go with the list.
  useEffect(() => {
    const m = map.current
    if (!m) return
    for (const [id, marker] of markers.current) {
      if (!places.some((p) => p.id === id)) {
        marker.remove()
        markers.current.delete(id)
      }
    }
    for (const place of places) {
      const color = place.id === placeId ? PIN_SELECTED : PIN
      let marker = markers.current.get(place.id)
      if (!marker || marker.getElement().dataset.color !== color) {
        marker?.remove()
        marker = new Marker({ draggable: true, color }).setLngLat([place.lon, place.lat]).addTo(m)
        marker.getElement().dataset.color = color
        marker.getElement().addEventListener('click', (e) => {
          e.stopPropagation()
          placeSelect.current(place.id)
        })
        marker.on('dragend', () => {
          const { lng, lat } = marker!.getLngLat()
          placeMove.current(place.id, { lat, lon: lng })
        })
        markers.current.set(place.id, marker)
      } else {
        marker.setLngLat([place.lon, place.lat])
      }
    }
  }, [places, placeId, placeSelect, placeMove])

  useEffect(() => {
    if (flyTo) map.current?.easeTo({ center: [flyTo.lon, flyTo.lat], duration: 600 })
  }, [flyTo])

  // The projection is part of the style; before the style has loaded, the load handler above applies it.
  useEffect(applyProjection, [globe, applyProjection])

  useEffect(() => {
    if (!focus) return
    const sat = satellites.find((s) => s.omm.NORAD_CAT_ID === focus.noradId)
    const at = focus.timeMs === undefined ? currentTime.current : new Date(focus.timeMs)
    const p = sat && positionAt(sat, at)
    if (p) map.current?.easeTo({ center: [p.lon, p.lat], duration: 600 })
  }, [focus, satellites, currentTime])

  useEffect(() => {
    const m = map.current
    const view: GlobeView | null =
      globe && m
        ? {
            lon: m.getCenter().lng,
            lat: m.getCenter().lat,
            horizonDeg: measureHorizonDeg(m, horizonDeg(m.getZoom(), container.current?.clientHeight || 900)),
          }
        : null
    overlay.current?.setProps({
      layers: buildLayers(satellites, tracks, now, selected, hover ?? probe, ghost, span, globe, reach, night, view),
    })
    // viewSeq stands in for the map's center and zoom, read from the map itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satellites, tracks, now, selected, hover, probe, ghost, span, globe, reach, night, viewSeq])

  return <div ref={container} className="map" />
}
