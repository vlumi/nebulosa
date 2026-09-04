import { MapboxOverlay } from '@deck.gl/mapbox'
import { Map as MapLibre, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildLayers, hoverAt, trackData, type Hover, type SatelliteDatum, type TrackDatum } from './layers'
import type { Satellite } from './orbit'
import { useThrottled } from './useThrottled'

const BASEMAP = 'https://tiles.openfreemap.org/styles/dark'

// MapLibre 6 resolves its worker relative to its own script URL, which a bundled app does not provide.
setWorkerUrl(maplibreWorkerUrl)

interface Props {
  satellites: Satellite[]
  now: Date
  selected: number | null
  onSelect: (noradId: number | null) => void
}

export function MapView({ satellites, now, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const overlay = useRef<MapboxOverlay>(null)
  const select = useRef(onSelect)
  useEffect(() => {
    select.current = onSelect
  }, [onSelect])
  const [hover, setHover] = useState<Hover | null>(null)
  const currentTracks = useRef<TrackDatum[]>([])

  useEffect(() => {
    const map = new MapLibre({
      container: container.current!,
      style: BASEMAP,
      center: [139.7, 35.7],
      zoom: 1.5,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
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
    map.addControl(overlay.current)
    return () => {
      overlay.current = null
      map.remove()
    }
  }, [])

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
