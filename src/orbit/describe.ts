import { epochOf, type Omm } from './elements'

const MU_KM3_S2 = 398600.4418
const EARTH_RADIUS_KM = 6378.137

export interface OrbitDescription {
  launchYear: number
  inclinationDeg: number
  periodMinutes: number
  semiMajorAxisKm: number
  perigeeKm: number
  apogeeKm: number
  eccentricity: number
  epoch: Date
}

/** The orbit in human terms, derived from the mean elements (Keplerian, so approximate to a few km). */
export function describeOrbit(omm: Omm): OrbitDescription {
  const meanMotionRadS = (omm.MEAN_MOTION * 2 * Math.PI) / 86_400
  const a = Math.cbrt(MU_KM3_S2 / (meanMotionRadS * meanMotionRadS))
  const e = omm.ECCENTRICITY
  return {
    launchYear: Number(omm.OBJECT_ID.slice(0, 4)),
    inclinationDeg: omm.INCLINATION,
    periodMinutes: 1440 / omm.MEAN_MOTION,
    semiMajorAxisKm: a,
    perigeeKm: a * (1 - e) - EARTH_RADIUS_KM,
    apogeeKm: a * (1 + e) - EARTH_RADIUS_KM,
    eccentricity: e,
    epoch: epochOf(omm),
  }
}

export function formatAltitude(d: OrbitDescription): string {
  const lo = Math.round(d.perigeeKm)
  const hi = Math.round(d.apogeeKm)
  return hi - lo < 5 ? `${Math.round((lo + hi) / 2)} km` : `${lo}–${hi} km`
}
