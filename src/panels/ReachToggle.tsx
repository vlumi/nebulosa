import { useStrings } from '../i18n/useStrings'
import { STEERING } from '../orbit/swath'
import { MapToggle } from './MapToggle'

interface Props {
  on: boolean
  onToggle: () => void
}

/** Shows or hides the radar's reach beside the selected satellite's track. */
export function ReachToggle({ on, onToggle }: Props) {
  const s = useStrings()
  return (
    <MapToggle on={on} onToggle={onToggle} label={s.toggles.reachTitle(STEERING.minDeg, STEERING.maxDeg)}>
      {s.toggles.reach}
    </MapToggle>
  )
}
