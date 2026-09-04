/** One satellite's mean elements as CelesTrak serves them (CCSDS OMM, JSON form). */
export type Omm = {
  OBJECT_NAME: string
  OBJECT_ID: string
  EPOCH: string
  MEAN_MOTION: number
  ECCENTRICITY: number
  INCLINATION: number
  RA_OF_ASC_NODE: number
  ARG_OF_PERICENTER: number
  MEAN_ANOMALY: number
  EPHEMERIS_TYPE: 0
  CLASSIFICATION_TYPE: 'U' | 'C'
  NORAD_CAT_ID: number
  ELEMENT_SET_NO: number
  REV_AT_EPOCH: number
  BSTAR: number
  MEAN_MOTION_DOT: number
  MEAN_MOTION_DDOT: number
}

export async function loadElements(): Promise<Omm[]> {
  const response = await fetch('/data/elements.json')
  if (!response.ok) throw new Error(`Loading orbital elements failed: ${response.status}`)
  return response.json()
}

export function epochOf(omm: Omm): Date {
  return new Date(omm.EPOCH.endsWith('Z') ? omm.EPOCH : `${omm.EPOCH}Z`)
}

export function newestEpoch(elements: Omm[]): Date {
  return new Date(Math.max(...elements.map((e) => epochOf(e).getTime())))
}

export function formatAge(from: Date, to: Date): string {
  const hours = Math.floor((to.getTime() - from.getTime()) / 3_600_000)
  if (hours < 1) return 'under an hour'
  if (hours < 48) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}
