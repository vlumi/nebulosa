import { useEffect, useRef, useState } from 'react'
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
  pinsLocked: boolean
  onLockChange: (locked: boolean) => void
}

export function PlaceList({ places, placeId, onSelect, onRename, onRemove, pinsLocked, onLockChange }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  // The rename form replaces the row that had focus; when it goes, focus returns to the pencil that opened it.
  const pencils = useRef(new Map<string, HTMLButtonElement>())
  const returnTo = useRef<string | null>(null)
  useEffect(() => {
    if (renaming !== null || returnTo.current === null) return
    pencils.current.get(returnTo.current)?.focus()
    returnTo.current = null
  }, [renaming])
  const stopRenaming = (id: string) => {
    returnTo.current = id
    setRenaming(null)
  }
  return (
    <>
      <p className={`${styles.header} muted`}>
        Passes are computed for the selected place. Double-click the map, or press and hold on a phone, to add one; drag
        a pin to move it.
      </p>
      <label className={styles.lock}>
        <input type="checkbox" checked={pinsLocked} onChange={(e) => onLockChange(e.target.checked)} /> Lock pins
      </label>
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
                    stopRenaming(place.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') stopRenaming(place.id)
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
                ref={(el) => {
                  if (el) pencils.current.set(place.id, el)
                  else pencils.current.delete(place.id)
                }}
                onClick={() => (renaming === place.id ? stopRenaming(place.id) : setRenaming(place.id))}
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
