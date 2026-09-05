import { epochOf } from '../orbit/elements'
import { strix1, strix9 } from '../test/fixtures'
import { FAMILY_COLORS } from '../shared/palette'
import { buildLayers, hoverAt, trackData } from './layers'
import { satelliteFrom } from '../orbit/orbit'

test('builds tracks, positions and labels for every satellite, colored by family', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const at = epochOf(strix1)
  const layers = buildLayers(sats, trackData(sats, at), at)
  expect(layers.map((l) => l.id)).toEqual(['tracks', 'positions', 'labels'])

  const [tracks, positions, labels] = layers
  const trackRows = tracks.props.data as {
    noradId: number
    family: string
    half: string
    age: number
    path: unknown[]
  }[]
  expect(new Set(trackRows.map((d) => d.family))).toEqual(new Set(['sun-synchronous', 'mid-inclination']))
  const strix1Rows = trackRows.filter((d) => d.noradId === strix1.NORAD_CAT_ID)
  expect(strix1Rows.filter((d) => d.half === 'future').length).toBeGreaterThanOrEqual(1)
  for (const { path } of trackRows as { path: [number, number][] }[]) {
    for (let i = 1; i < path.length; i++) expect(Math.abs(path[i][0] - path[i - 1][0])).toBeLessThanOrEqual(180)
  }
  expect(strix1Rows.filter((d) => d.half === 'past').length).toBeGreaterThan(5)
  const ages = strix1Rows.filter((d) => d.half === 'past').map((d) => d.age)
  expect(ages[0]).toBeGreaterThan(ages[ages.length - 1])
  expect(ages[ages.length - 1]).toBe(0)
  const { getColor } = tracks.props as unknown as { getColor: (d: unknown) => number[] }
  const alphaAt = (age: number) => getColor({ ...strix1Rows[0], age })[3]
  expect(alphaAt(0)).toBe(200)
  expect(alphaAt(0.06)).toBe(120)
  expect(alphaAt(0.12)).toBe(40)
  expect(alphaAt(1)).toBe(40)

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
  const [tracks, positions, labels] = buildLayers(sats, trackData(sats, at), at, strix9.NORAD_CAT_ID)
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
  expect(getColor(future(strix1.NORAD_CAT_ID))[3]).toBe(40)
  expect(getColor(oldest(strix9.NORAD_CAT_ID))[3]).toBeGreaterThan(3 * getColor(future(strix1.NORAD_CAT_ID))[3])
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
  expect(layers.map((l) => l.id)).toEqual(['tracks', 'positions', 'labels', 'hover-marker', 'hover-label'])
  const { getText } = layers[4].props as unknown as { getText: () => string }
  expect(getText()).toMatch(/^STRIX-1 · \d\d:\d\d:\d\d UTC · −1 h 2\d min$/)
})

test('a ghost draws a hollow marker where the satellite will be at the given time', () => {
  const sats = [strix1].map(satelliteFrom)
  const at = epochOf(strix1)
  const later = at.getTime() + 15 * 60_000
  const layers = buildLayers(sats, trackData(sats, at), at, null, null, { noradId: strix1.NORAD_CAT_ID, timeMs: later })
  expect(layers.map((l) => l.id)).toEqual(['tracks', 'positions', 'labels', 'ghost', 'ghost-label'])
  const { getText } = layers[4].props as unknown as { getText: () => string }
  expect(getText()).toBe(`STRIX-1 · ${new Date(later).toISOString().slice(11, 16)} UTC`)
})

test('a ghost beyond the drawn track gets a dashed continuation reaching it', () => {
  const sats = [strix1].map(satelliteFrom)
  const at = epochOf(strix1)
  const farAhead = at.getTime() + 3 * 3_600_000
  const layers = buildLayers(sats, trackData(sats, at), at, null, null, {
    noradId: strix1.NORAD_CAT_ID,
    timeMs: farAhead,
  })
  expect(layers.map((l) => l.id)).toEqual(['tracks', 'positions', 'labels', 'ghost-track', 'ghost', 'ghost-label'])
  expect(layers[3].props.pickable).toBe(true)
  const continuation = (layers[3].props.data as { samples: { lonLat: [number, number]; timeMs: number }[] }[])[0]
  const path = continuation.samples.map((s) => s.lonLat)
  const spanMinutes = 3 * 60 + 5 - sats[0].periodMinutes
  expect(Math.abs(path.length - spanMinutes * 2)).toBeLessThanOrEqual(2)
  expect(continuation.samples.some((s) => s.timeMs === farAhead)).toBe(true)
  const ghostPosition = (layers[4].props.data as { lonLat: [number, number] }[])[0].lonLat
  const nearest = path.reduce((best, p) =>
    Math.hypot(p[0] - ghostPosition[0], p[1] - ghostPosition[1]) <
    Math.hypot(best[0] - ghostPosition[0], best[1] - ghostPosition[1])
      ? p
      : best,
  )
  expect(Math.hypot(nearest[0] - ghostPosition[0], nearest[1] - ghostPosition[1])).toBeLessThan(0.01)
})

test('selection emphasis reaches dots and labels: bigger and brighter when selected, faded when not', () => {
  const sats = [strix1, strix9].map(satelliteFrom)
  const at = epochOf(strix1)
  const [, positions, labels] = buildLayers(sats, trackData(sats, at), at, strix9.NORAD_CAT_ID)
  const dots = positions.props.data as { noradId: number }[]
  const { getRadius, getFillColor } = positions.props as unknown as {
    getRadius: (d: unknown) => number
    getFillColor: (d: unknown) => number[]
  }
  const selected = dots.find((d) => d.noradId === strix9.NORAD_CAT_ID)!
  const other = dots.find((d) => d.noradId === strix1.NORAD_CAT_ID)!
  expect(getRadius(selected)).toBeGreaterThan(getRadius(other))
  expect(getFillColor(selected)[3]).toBe(255)
  expect(getFillColor(other)[3]).toBe(50)
  const { getColor } = labels.props as unknown as { getColor: (d: unknown) => number[] }
  expect(getColor(selected)[3]).toBe(255)
  expect(getColor(other)[3]).toBe(90)
})

test('ghost layers draw in the family colour and the dashed path follows the samples', () => {
  const sats = [strix9].map(satelliteFrom)
  const at = epochOf(strix9)
  const farAhead = at.getTime() + 3 * 3_600_000
  const layers = buildLayers(sats, trackData(sats, at), at, null, null, {
    noradId: strix9.NORAD_CAT_ID,
    timeMs: farAhead,
  })
  const ghostTrack = layers.find((l) => l.id === 'ghost-track')!
  const ghost = layers.find((l) => l.id === 'ghost')!
  const { getPath } = ghostTrack.props as unknown as { getPath: (d: unknown) => unknown[] }
  const pieces = ghostTrack.props.data as { samples: { lonLat: unknown }[] }[]
  const drawn = pieces.reduce((n, piece) => n + getPath(piece).length, 0)
  expect(drawn).toBeGreaterThanOrEqual(pieces[0].samples.length)
  expect(getPath(pieces[0])[0]).toEqual(pieces[0].samples[0].lonLat)
  const { getLineColor } = ghost.props as unknown as { getLineColor: (d: unknown) => number[] }
  expect(getLineColor((ghost.props.data as unknown[])[0])).toEqual(FAMILY_COLORS['mid-inclination'])
})
