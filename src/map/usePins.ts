import { Marker, type Map as MapLibre } from 'maplibre-gl'
import { useEffect, type RefObject } from 'react'
import type { Location } from '../orbit/passes'
import type { Place } from '../places/places'
import { PALETTES, type Theme } from '../shared/theme'
import { useLatest } from '../shared/useLatest'

interface Options {
  places: Place[]
  placeId: string | null
  pinsLocked: boolean
  theme: Theme
  onSelect: (id: string) => void
  onMove: (id: string, location: Location) => void
}

/** One draggable pin per place, the selected one in the accent color; pins come and go with the list. */
export function usePins(
  map: RefObject<MapLibre | null>,
  markers: RefObject<Map<string, Marker>>,
  { places, placeId, pinsLocked, theme, onSelect, onMove }: Options,
): void {
  const select = useLatest(onSelect)
  const move = useLatest(onMove)
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
      const color = place.id === placeId ? PALETTES[theme].pinSelected : PALETTES[theme].pin
      let marker = markers.current.get(place.id)
      if (!marker || marker.getElement().dataset.color !== color) {
        marker?.remove()
        // MapLibre only dims a pin behind the globe; here it vanishes, and the map view's render hook also stops it
        // taking the pointer, or a hidden pin could be grabbed and dragged onto the near side.
        marker = new Marker({ draggable: !pinsLocked, color, opacityWhenCovered: '0' })
          .setLngLat([place.lon, place.lat])
          .addTo(m)
        marker.getElement().dataset.color = color
        marker.getElement().addEventListener('click', (e) => {
          e.stopPropagation()
          select.current(place.id)
        })
        marker.on('dragend', () => {
          const { lng, lat } = marker!.getLngLat()
          move.current(place.id, { lat, lon: lng })
        })
        markers.current.set(place.id, marker)
      } else {
        marker.setLngLat([place.lon, place.lat])
        marker.setDraggable(!pinsLocked)
      }
    }
  }, [map, markers, places, placeId, pinsLocked, theme, select, move])
}
