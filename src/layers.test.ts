import { epochOf } from './elements'
import { strix1, strix9 } from './fixtures'
import { buildLayers, FAMILY_COLORS } from './layers'
import { satelliteFrom } from './orbit'

test('builds tracks, positions and labels for every satellite, colored by family', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const layers = buildLayers(sats, epochOf(strix1))
  expect(layers.map((l) => l.id)).toEqual(['tracks', 'positions', 'labels'])

  const [tracks, positions, labels] = layers
  const trackData = tracks.props.data as { family: string }[]
  expect(trackData.length).toBeGreaterThanOrEqual(2)
  expect(new Set(trackData.map((d) => d.family))).toEqual(new Set(['sun-synchronous', 'mid-inclination']))

  const positionData = positions.props.data as { name: string; family: string }[]
  expect(positionData.map((d) => d.name)).toEqual(['STRIX-1', 'STRIX-9'])
  const { getFillColor: fill } = positions.props as unknown as { getFillColor: (d: unknown) => number[] }
  expect(fill(positionData[0])).toEqual(FAMILY_COLORS['sun-synchronous'])
  expect(fill(positionData[1])).toEqual(FAMILY_COLORS['mid-inclination'])
  expect(labels.props.data).toBe(positionData)
})
