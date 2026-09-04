import { epochOf } from './elements'
import { strix1, strix9 } from './test/fixtures'
import { buildLayers, FAMILY_COLORS, trackData } from './layers'
import { satelliteFrom } from './orbit'

test('builds tracks, positions and labels for every satellite, colored by family', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const at = epochOf(strix1)
  const layers = buildLayers(sats, trackData(sats, at), at)
  expect(layers.map((l) => l.id)).toEqual(['tracks', 'positions', 'labels'])

  const [tracks, positions, labels] = layers
  const trackRows = tracks.props.data as { family: string }[]
  expect(trackRows.length).toBe(2)
  expect(new Set(trackRows.map((d) => d.family))).toEqual(new Set(['sun-synchronous', 'mid-inclination']))

  const positionData = positions.props.data as { name: string; family: string }[]
  expect(positionData.map((d) => d.name)).toEqual(['STRIX-1', 'STRIX-9'])
  const { getFillColor: fill } = positions.props as unknown as { getFillColor: (d: unknown) => number[] }
  expect(fill(positionData[0])).toEqual([...FAMILY_COLORS['sun-synchronous'], 160])
  expect(fill(positionData[1])).toEqual([...FAMILY_COLORS['mid-inclination'], 160])
  expect(labels.props.data).toBe(positionData)
})

test('dims everything but the selected satellite and makes layers pickable', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const at = epochOf(strix1)
  const [tracks, positions, labels] = buildLayers(sats, trackData(sats, at), at, strix9.NORAD_CAT_ID)
  expect([tracks, positions, labels].every((l) => l.props.pickable)).toBe(true)

  const trackRows = tracks.props.data as { noradId: number }[]
  const { getColor, getWidth } = tracks.props as unknown as {
    getColor: (d: unknown) => number[]
    getWidth: (d: unknown) => number
  }
  const strix1Track = trackRows.find((d) => d.noradId === strix1.NORAD_CAT_ID)!
  const strix9Track = trackRows.find((d) => d.noradId === strix9.NORAD_CAT_ID)!
  expect(getColor(strix9Track)[3]).toBe(255)
  expect(getColor(strix1Track)[3]).toBe(50)
  expect(getWidth(strix9Track)).toBeGreaterThan(getWidth(strix1Track))
})
