import { useState } from 'react'
import type { Place } from '../places/places'
import { formatLocation } from '../shared/format'
import panel from './panel.module.css'
import styles from './PlaceList.module.css'

interface Props {
  places: Place[]
  placeId: string | null
  /** Select, or unselect with null; the map centers on a place selected here. */
  onSelect: (id: string | null) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
}

export function PlaceList({ places, placeId, onSelect, onRename, onRemove }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  return (
    <>
      <p className={`${styles.header} muted`}>
        Passes are computed for the selected place. Double-click the map, or press and hold on a phone, to add one; drag
        a pin to move it.
      </p>
      <ul className={`${panel.list} ${styles.list}`}>
        {places.map((place) => {
          const isSelected = place.id === placeId
          return (
            <li key={place.id} className={styles.row}>
              {renaming === place.id ? (
                <form
                  className={styles.rename}
                  onSubmit={(e) => {
                    e.preventDefault()
                    const name = new FormData(e.currentTarget).get('name')
                    if (typeof name === 'string' && name.trim()) onRename(place.id, name.trim())
                    setRenaming(null)
                  }}
                >
                  <input name="name" defaultValue={place.name} aria-label="Place name" autoFocus />
                  <button type="submit">Save</button>
                </form>
              ) : (
                <button
                  type="button"
                  className={panel.row}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(isSelected ? null : place.id)}
                >
                  <span className={`${panel.swatch} ${styles.pin}`} data-selected={isSelected ? '' : undefined} />
                  {place.name} <span className={`${styles.coords} muted`}>{formatLocation(place)}</span>
                </button>
              )}
              <button
                type="button"
                className={styles.action}
                aria-label={`Rename ${place.name}`}
                onClick={() => setRenaming(renaming === place.id ? null : place.id)}
              >
                ✎
              </button>
              <button
                type="button"
                className={styles.action}
                aria-label={`Remove ${place.name}`}
                onClick={() => onRemove(place.id)}
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
      {places.length === 0 && <p className="muted">No places yet.</p>}
    </>
  )
}
