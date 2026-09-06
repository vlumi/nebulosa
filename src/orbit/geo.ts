import type { LonLat } from './orbit'

export const RAD = Math.PI / 180
export const DEG = 180 / Math.PI
export const EARTH_RADIUS_KM = 6378.137

/** Initial bearing from one point to another, clockwise from north in [0, 360). */
export function bearingDeg(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const φ1 = from.lat * RAD
  const φ2 = to.lat * RAD
  const Δλ = (to.lon - from.lon) * RAD
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * DEG + 360) % 360
}

/** The point `distanceKm` along the great circle that leaves `[lon, lat]` on `bearing` degrees, on a sphere. */
export function destination([lon, lat]: LonLat, bearing: number, distanceKm: number): LonLat {
  const d = distanceKm / EARTH_RADIUS_KM
  const θ = bearing * RAD
  const lat1 = lat * RAD
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(θ))
  const dLon = Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return [((lon + dLon * DEG + 540) % 360) - 180, lat2 * DEG]
}
