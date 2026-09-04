import { MapboxOverlay } from '@deck.gl/mapbox'
import { Map as MapLibre, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildLayers, hoverAt, trackData, type Ghost, type Hover, type SatelliteDatum, type TrackDatum } from './layers'
import { DEFAULT_SPAN, positionAt, type Satellite, type TrackSpan } from './orbit'
import type { Location } from './passes'
import { useLatest } from './useLatest'
import { useThrottled } from './useThrottled'

const BASEMAP = 'https://tiles.openfreemap.org/styles/fiord'

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
  span?: TrackSpan
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
  span = DEFAULT_SPAN,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre>(null)
  const marker = useRef<Marker>(null)
  const overlay = useRef<MapboxOverlay>(null)
  const [hover, setHover] = useState<Hover | null>(null)

  // The map and overlay are created once; their callbacks read the latest props through these.
  const locationChange = useLatest(onLocationChange)
  const select = useLatest(onSelect)
  const currentTime = useLatest(now)

  // A track shifted by under a minute is indistinguishable, and while scrubbing or fast-forwarding
  // a few tenths of a second of staleness is invisible; positions still move every frame.
  const trackMinute = useThrottled(Math.floor(now.getTime() / 60_000), 150)
  const tracks = useMemo(() => trackData(satellites, new Date(trackMinute * 60_000), span), [satellites, trackMinute, span])
  const currentTracks = useLatest(tracks)

  useEffect(() => {
    map.current = new MapLibre({
      container: container.current!,
      style: BASEMAP,
      center: [139.7, 35.7],
      zoom: 1.5,
    })
    map.current.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    overlay.current = new MapboxOverlay({
      interleaved: false,
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
    marker.current = new Marker({ draggable: true, color: '#eedd66' }).setLngLat([location.lon, location.lat]).addTo(map.current)
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

  useEffect(() => {
    if (!focus) return
    const sat = satellites.find((s) => s.omm.NORAD_CAT_ID === focus.noradId)
    const at = focus.timeMs === undefined ? currentTime.current : new Date(focus.timeMs)
    const p = sat && positionAt(sat, at)
    if (p) map.current?.easeTo({ center: [p.lon, p.lat], duration: 600 })
  }, [focus, satellites, currentTime])

  useEffect(() => {
    overlay.current?.setProps({ layers: buildLayers(satellites, tracks, now, selected, hover, ghost, span) })
  }, [satellites, tracks, now, selected, hover, ghost, span])

  return <div ref={container} className="map" />
}
