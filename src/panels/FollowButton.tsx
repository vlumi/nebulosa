import { useStrings } from '../i18n/useStrings'
import styles from './FollowButton.module.css'

interface Props {
  name: string
  on: boolean
  onToggle: () => void
}

/** A round button on the map while a satellite is selected: keep it centered, or let the map go. */
export function FollowButton({ name, on, onToggle }: Props) {
  const s = useStrings()
  return (
    <button
      type="button"
      className={styles.follow}
      aria-pressed={on}
      aria-label={s.follow.follow(name)}
      title={on ? s.follow.following(name) : s.follow.follow(name)}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </button>
  )
}
