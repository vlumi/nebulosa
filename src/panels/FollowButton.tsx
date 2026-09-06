import styles from './FollowButton.module.css'

interface Props {
  name: string
  on: boolean
  onToggle: () => void
}

/** A round button on the map while a satellite is selected: keep it centered, or let the map go. */
export function FollowButton({ name, on, onToggle }: Props) {
  return (
    <button
      type="button"
      className={styles.follow}
      aria-pressed={on}
      aria-label={`Follow ${name}`}
      title={on ? `Following ${name}; drag the map to let go` : `Follow ${name}`}
      onClick={onToggle}
    >
      ⌖
    </button>
  )
}
