import { MapLibreOverlay } from '@deck.gl/maplibre'
import { Map as MapLibre, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildLayers, hoverAt, trackData, type Ghost, type Hover, type SatelliteDatum, type TrackDatum } from './layers'
import {
  EMPTY,
  NIGHT_LAYER,
  NIGHT_PAINT,
  nightFeature,
  REACH_LAYER,
  REACH_OPACITY,
  reachFeature,
  reachFill,
} from './surface'
import { DEFAULT_SPAN, positionAt, type Satellite, type TrackSpan } from '../orbit/orbit'
import type { Location } from '../orbit/passes'
import { useLatest } from '../shared/useLatest'
import { useThrottled } from '../shared/useThrottled'

const BASEMAP = 'https://tiles.openfreemap.org/styles/fiord'
/** Past this zoom the globe renders flat: curvature is invisible there, and the deck.gl beta clips its globe view away. */
const GLOBE_MAX_ZOOM = 5.5

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
  location: Location
  onLocationChange: (location: Location) => void
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
  location,
  onLocationChange,
  ghost = null,
  probe = null,
  span = DEFAULT_SPAN,
  reach = false,
  globe = false,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre>(null)
  const marker = useRef<Marker>(null)
  const overlay = useRef<MapLibreOverlay>(null)
  const [hover, setHover] = useState<Hover | null>(null)

  // The map and overlay are created once; their callbacks read the latest props through these.
  const locationChange = useLatest(onLocationChange)
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

  const nightData = useMemo(() => nightFeature(new Date(trackMinute * 60_000)), [trackMinute])
  const reachTrack = reach && selected !== null ? tracks.find((t) => t.noradId === selected) : undefined
  const reachData = useMemo(() => (reachTrack ? reachFeature(reachTrack.samples) : EMPTY), [reachTrack])
  const reachColor = reachFill(reachTrack?.family ?? 'sun-synchronous')
  const surfaces = useLatest({ nightData, reachData, reachColor })
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
      zoom: 1.5,
    })
    map.current.on('style.load', () => {
      const m = map.current
      if (!m) return
      styleReady.current = true
      applyProjection()
      m.addSource(NIGHT_LAYER, { type: 'geojson', data: surfaces.current.nightData })
      m.addSource(REACH_LAYER, { type: 'geojson', data: surfaces.current.reachData })
      m.addLayer({ id: NIGHT_LAYER, type: 'fill', source: NIGHT_LAYER, paint: NIGHT_PAINT })
      m.addLayer({
        id: REACH_LAYER,
        type: 'fill',
        source: REACH_LAYER,
        paint: { 'fill-color': surfaces.current.reachColor, 'fill-opacity': REACH_OPACITY },
      })
    })
    map.current.on('zoom', applyProjection)
    map.current.addControl(new NavigationControl({ showCompass: false }), 'top-right')
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
    marker.current = new Marker({ draggable: true, color: '#eedd66' })
      .setLngLat([location.lon, location.lat])
      .addTo(map.current)
    marker.current.on('dragend', () => {
      const { lng, lat } = marker.current!.getLngLat()
      locationChange.current({ lat, lon: lng })
    })
    return () => {
      overlay.current = null
      marker.current = null
      map.current?.remove()
      map.current = null
    }
    // The marker takes its initial position from props; later moves come through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    marker.current?.setLngLat([location.lon, location.lat])
  }, [location])

  // Until the style has loaded the sources do not exist; the load handler above then takes the latest data.
  useEffect(() => {
    ;(map.current?.getSource(NIGHT_LAYER) as GeoJSONSource | undefined)?.setData(nightData)
  }, [nightData])
  useEffect(() => {
    ;(map.current?.getSource(REACH_LAYER) as GeoJSONSource | undefined)?.setData(reachData)
    if (map.current?.getLayer(REACH_LAYER)) map.current.setPaintProperty(REACH_LAYER, 'fill-color', reachColor)
  }, [reachData, reachColor])

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
    overlay.current?.setProps({
      layers: buildLayers(satellites, tracks, now, selected, hover ?? probe, ghost, span, globe),
    })
  }, [satellites, tracks, now, selected, hover, probe, ghost, span, globe])

  return <div ref={container} className="map" />
}
