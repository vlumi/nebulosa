import { MapboxOverlay } from '@deck.gl/mapbox'
import { Map as MapLibre, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef } from 'react'
import { buildLayers, type SatelliteDatum } from './layers'
import type { Satellite } from './orbit'

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
      onClick: (info) => select.current((info.object as SatelliteDatum | undefined)?.noradId ?? null),
      getCursor: ({ isHovering, isDragging }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'),
    })
    map.addControl(overlay.current)
    return () => {
      overlay.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    overlay.current?.setProps({ layers: buildLayers(satellites, now, selected) })
  }, [satellites, now, selected])

  return <div ref={container} className="map" />
}
