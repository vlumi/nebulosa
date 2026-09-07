import { useEffect, useRef, useState } from 'react'
import type { Location } from '../orbit/passes'
import type { Place } from '../places/places'
import { useStrings } from '../i18n/useStrings'
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
  /** The browser's position, named in the reader's language, for the one located place. */
  onLocate: (location: Location, name: string) => void
}

type Locating = 'idle' | 'busy' | 'denied' | 'failed'

export function PlaceList({
  places,
  placeId,
  onSelect,
  onRename,
  onRemove,
  pinsLocked,
  onLockChange,
  onLocate,
}: Props) {
  const t = useStrings()
  const [locating, setLocating] = useState<Locating>('idle')
  const locate = () => {
    const geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : undefined
    if (!geolocation) return setLocating('failed')
    setLocating('busy')
    geolocation.getCurrentPosition(
      (position) => {
        setLocating('idle')
        onLocate({ lat: position.coords.latitude, lon: position.coords.longitude }, t.places.myLocation)
      },
      (error) => setLocating(error.code === error.PERMISSION_DENIED ? 'denied' : 'failed'),
      { timeout: 10_000, maximumAge: 60_000 },
    )
  }
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
      <p className={`${styles.header} muted`}>{t.places.header}</p>
      <label className={styles.lock}>
        <input type="checkbox" checked={pinsLocked} onChange={(e) => onLockChange(e.target.checked)} />{' '}
        {t.places.lockPins}
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
                  <input name="name" defaultValue={place.name} aria-label={t.places.placeName} autoFocus />
                  <button type="submit">{t.places.save}</button>
                </form>
              ) : (
                <button
                  type="button"
                  className={panel.row}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(isSelected ? null : place.id)}
                >
                  <span
                    className={`${panel.swatch} ${styles.pin}`}
                    data-selected={isSelected ? '' : undefined}
                    data-located={place.located ? '' : undefined}
                  />
                  {place.name} <span className={`${styles.coords} muted`}>{formatLocation(place)}</span>
                </button>
              )}
              {place.located && (
                <button
                  type="button"
                  className={styles.action}
                  aria-label={t.places.relocate}
                  disabled={locating === 'busy'}
                  onClick={locate}
                >
                  ↻
                </button>
              )}
              <button
                type="button"
                className={styles.action}
                aria-label={t.places.rename(place.name)}
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
                aria-label={t.places.remove(place.name)}
                onClick={() => onRemove(place.id)}
              >
                ×
              </button>
            </li>
          )
        })}
        {!places.some((p) => p.located) && (
          <li className={styles.row}>
            <button type="button" className={panel.row} disabled={locating === 'busy'} onClick={locate}>
              <span className={`${panel.swatch} ${styles.pin}`} data-located="" />
              {locating === 'busy' ? t.places.locating : t.places.useLocation}
            </button>
          </li>
        )}
      </ul>
      {locating === 'denied' && <p className="muted">{t.places.locationDenied}</p>}
      {locating === 'failed' && <p className="muted">{t.places.locationFailed}</p>}
      {places.length === 0 && <p className="muted">{t.places.none}</p>}
    </>
  )
}
