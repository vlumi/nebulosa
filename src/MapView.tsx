import { MapboxOverlay } from '@deck.gl/mapbox'
import { Map as MapLibre, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildLayers, hoverAt, trackData, type Hover, type SatelliteDatum, type TrackDatum } from './layers'
import { positionAt, type Satellite } from './orbit'
import { useThrottled } from './useThrottled'

const BASEMAP = 'https://tiles.openfreemap.org/styles/fiord'

// MapLibre 6 resolves its worker relative to its own script URL, which a bundled app does not provide.
setWorkerUrl(maplibreWorkerUrl)

/** A request to bring a satellite into view; `seq` makes repeated requests for the same one distinct. */
export interface Focus {
  noradId: number
  seq: number
}

interface Props {
  satellites: Satellite[]
  now: Date
  selected: number | null
  onSelect: (noradId: number | null) => void
  focus?: Focus | null
}

export function MapView({ satellites, now, selected, onSelect, focus = null }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre>(null)
  const overlay = useRef<MapboxOverlay>(null)
  const select = useRef(onSelect)
  useEffect(() => {
    select.current = onSelect
  }, [onSelect])
  const [hover, setHover] = useState<Hover | null>(null)
  const currentTracks = useRef<TrackDatum[]>([])

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
        const over = info.layer?.id === 'tracks' ? (info.object as SatelliteDatum | undefined) : undefined
        const track = over && currentTracks.current.find((t) => t.noradId === over.noradId)
        setHover(track && info.coordinate ? hoverAt(track, info.coordinate as [number, number]) : null)
      },
      getCursor: ({ isHovering, isDragging }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'),
    })
    map.current.addControl(overlay.current)
    return () => {
      overlay.current = null
      map.current?.remove()
      map.current = null
    }
  }, [])

  const currentTime = useRef(now)
  useEffect(() => {
    currentTime.current = now
  }, [now])

  useEffect(() => {
    if (!focus) return
    const sat = satellites.find((s) => s.omm.NORAD_CAT_ID === focus.noradId)
    const p = sat && positionAt(sat, currentTime.current)
    if (p) map.current?.easeTo({ center: [p.lon, p.lat], duration: 600 })
  }, [focus, satellites])

  // A track shifted by under a minute is indistinguishable, and while scrubbing or fast-forwarding
  // a few tenths of a second of staleness is invisible; positions still move every frame.
  const trackMinute = useThrottled(Math.floor(now.getTime() / 60_000), 150)
  const tracks = useMemo(() => trackData(satellites, new Date(trackMinute * 60_000)), [satellites, trackMinute])

  useEffect(() => {
    currentTracks.current = tracks
  }, [tracks])

  useEffect(() => {
    overlay.current?.setProps({ layers: buildLayers(satellites, tracks, now, selected, hover) })
  }, [satellites, tracks, now, selected, hover])

  return <div ref={container} className="map" />
}
