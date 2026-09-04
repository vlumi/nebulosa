import { epochOf } from './elements'
import { strix1, strix9 } from './test/fixtures'
import { buildLayers, FAMILY_COLORS, hoverAt, trackData } from './layers'
import { satelliteFrom } from './orbit'

test('builds tracks, positions and labels for every satellite, colored by family', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const at = epochOf(strix1)
  const layers = buildLayers(sats, trackData(sats, at), at)
  expect(layers.map((l) => l.id)).toEqual(['night', 'tracks', 'positions', 'labels'])

  const [, tracks, positions, labels] = layers
  const trackRows = tracks.props.data as { noradId: number; family: string; half: string; age: number; path: unknown[] }[]
  expect(new Set(trackRows.map((d) => d.family))).toEqual(new Set(['sun-synchronous', 'mid-inclination']))
  const strix1Rows = trackRows.filter((d) => d.noradId === strix1.NORAD_CAT_ID)
  expect(strix1Rows.filter((d) => d.half === 'future')).toHaveLength(1)
  expect(strix1Rows.filter((d) => d.half === 'past').length).toBeGreaterThan(5)
  const ages = strix1Rows.filter((d) => d.half === 'past').map((d) => d.age)
  expect(ages[0]).toBeGreaterThan(ages[ages.length - 1])
  expect(ages[ages.length - 1]).toBe(0)
  const { getColor } = tracks.props as unknown as { getColor: (d: unknown) => number[] }
  expect(getColor(strix1Rows[0])[3]).toBeLessThan(getColor(strix1Rows[strix1Rows.length - 1])[3])

  const positionData = positions.props.data as { name: string; family: string }[]
  expect(positionData.map((d) => d.name)).toEqual(['STRIX-1', 'STRIX-9'])
  const { getFillColor: fill } = positions.props as unknown as { getFillColor: (d: unknown) => number[] }
  expect(fill(positionData[0])).toEqual([...FAMILY_COLORS['sun-synchronous'], 255])
  expect(fill(positionData[1])).toEqual([...FAMILY_COLORS['mid-inclination'], 255])
  expect(labels.props.data).toBe(positionData)
})

test('dims everything but the selected satellite and makes layers pickable', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const at = epochOf(strix1)
  const [, tracks, positions, labels] = buildLayers(sats, trackData(sats, at), at, strix9.NORAD_CAT_ID)
  expect([tracks, positions, labels].every((l) => l.props.pickable)).toBe(true)

  const trackRows = tracks.props.data as { noradId: number; half: string }[]
  const { getColor, getWidth } = tracks.props as unknown as {
    getColor: (d: unknown) => number[]
    getWidth: (d: unknown) => number
  }
  const future = (id: number) => trackRows.find((d) => d.noradId === id && d.half === 'future')!
  const oldest = (id: number) => trackRows.find((d) => d.noradId === id && d.half === 'past')!
  expect(getColor(future(strix9.NORAD_CAT_ID))[3]).toBe(255)
  expect(getColor(oldest(strix9.NORAD_CAT_ID))[3]).toBeLessThan(255)
  expect(getColor(future(strix1.NORAD_CAT_ID))[3]).toBe(50)
  expect(getWidth(future(strix9.NORAD_CAT_ID))).toBeGreaterThan(getWidth(future(strix1.NORAD_CAT_ID)))
  expect(getWidth(oldest(strix9.NORAD_CAT_ID))).toBe(getWidth(future(strix9.NORAD_CAT_ID)))
})

test('hovering a track adds a marker and a label with the time at that point', () => {
  const sats = [strix1].map(satelliteFrom)
  const at = epochOf(strix1)
  const [track] = trackData(sats, at)
  const target = track.samples[10]
  const hover = hoverAt(track, target.lonLat)
  expect(hover).toEqual({ noradId: strix1.NORAD_CAT_ID, lonLat: target.lonLat, timeMs: target.timeMs })

  const layers = buildLayers(sats, [track], at, null, hover)
  expect(layers.map((l) => l.id)).toEqual(['night', 'tracks', 'positions', 'labels', 'hover-marker', 'hover-label'])
  const { getText } = layers[5].props as unknown as { getText: () => string }
  expect(getText()).toMatch(/^STRIX-1 · \d\d:\d\d:\d\d UTC · −1 h 2\d min$/)
})
