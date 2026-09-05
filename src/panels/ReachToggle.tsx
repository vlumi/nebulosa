import { STEERING } from '../orbit/swath'
import { MapToggle } from './MapToggle'

interface Props {
  on: boolean
  onToggle: () => void
}

/** Shows or hides the radar's reach beside the selected satellite's track. */
export function ReachToggle({ on, onToggle }: Props) {
  return (
    <MapToggle
      on={on}
      onToggle={onToggle}
      title={`Ground the radar can reach from the selected satellite's track: ${STEERING.minDeg}° to ${STEERING.maxDeg}° off nadir, either side`}
    >
      SAR reach
    </MapToggle>
  )
}
