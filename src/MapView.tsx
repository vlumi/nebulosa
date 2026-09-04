import { MapboxOverlay } from '@deck.gl/mapbox'
import { Map as MapLibre, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import { buildLayers } from './layers'
import type { Satellite } from './orbit'

const BASEMAP = 'https://tiles.openfreemap.org/styles/dark'

export function MapView({ satellites, now }: { satellites: Satellite[]; now: Date }) {
  const container = useRef<HTMLDivElement>(null)
  const overlay = useRef<MapboxOverlay>(null)

  useEffect(() => {
    const map = new MapLibre({
      container: container.current!,
      style: BASEMAP,
      center: [139.7, 35.7],
      zoom: 1.5,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    overlay.current = new MapboxOverlay({ interleaved: false, layers: [] })
    map.addControl(overlay.current)
    return () => {
      overlay.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    overlay.current?.setProps({ layers: buildLayers(satellites, now) })
  }, [satellites, now])

  return <div ref={container} className="map" />
}
