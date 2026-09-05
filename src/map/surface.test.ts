import { epochOf } from '../orbit/elements'
import { satelliteFrom, trackSamples } from '../orbit/orbit'
import { strix1 } from '../test/fixtures'
import { nightFeature, reachFeature } from './surface'

test('the night feature is one closed ring reaching both antimeridian edges', () => {
  const ring = nightFeature(epochOf(strix1)).geometry.coordinates[0]
  expect(ring[0]).toEqual(ring[ring.length - 1])
  expect(Math.min(...ring.map(([lon]) => lon))).toBe(-180.5)
  expect(Math.max(...ring.map(([lon]) => lon))).toBe(180.5)
})

test('reach rings are closed and never jump across the antimeridian; a crossing continues past ±180°', () => {
  const sat = satelliteFrom(strix1)
  const { coordinates } = reachFeature(trackSamples(sat, epochOf(strix1))).geometry
  expect(coordinates.length).toBeGreaterThan(10)
  let crossings = 0
  for (const [ring] of coordinates) {
    expect(ring[0]).toEqual(ring[ring.length - 1])
    for (let i = 1; i < ring.length; i++) expect(Math.abs(ring[i][0] - ring[i - 1][0])).toBeLessThan(180)
    if (ring.some(([lon]) => Math.abs(lon) > 180)) crossings++
  }
  expect(crossings).toBeGreaterThan(0)
})
