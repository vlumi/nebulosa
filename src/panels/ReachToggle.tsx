import { STEERING } from '../orbit/swath'
import styles from './ReachToggle.module.css'

interface Props {
  on: boolean
  onToggle: () => void
}

/** Shows or hides the radar's reach beside the selected satellite's track. */
export function ReachToggle({ on, onToggle }: Props) {
  return (
    <button
      type="button"
      className={styles.pill}
      aria-pressed={on}
      title={`Ground the radar can reach from the selected satellite's track: ${STEERING.minDeg}° to ${STEERING.maxDeg}° off nadir, either side`}
      onClick={onToggle}
    >
      SAR reach
    </button>
  )
}
