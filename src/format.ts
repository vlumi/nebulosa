import type { Location } from './passes'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const iso = (t: Date | number) => new Date(t).toISOString()

/** "HH:MM" in UTC. */
export const hhmm = (t: Date | number) => iso(t).slice(11, 16)

/** "HH:MM:SS" in UTC. */
export const hhmmss = (t: Date | number) => iso(t).slice(11, 19)

/** "YYYY-MM-DD HH:MM" in UTC. */
export const utcMinute = (t: Date | number) => iso(t).slice(0, 16).replace('T', ' ')

/** "YYYY-MM-DD HH:MM:SS" in UTC. */
export const utcSecond = (t: Date | number) => iso(t).slice(0, 19).replace('T', ' ')

/** "YYYY-MM-DD" in UTC. */
export const utcDate = (t: Date | number) => iso(t).slice(0, 10)

/** "Sat 5 Sep", in UTC and independent of the runtime's locale data. */
export function dayLabel(t: Date | number): string {
  const d = new Date(t)
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

export const utcDayIndex = (ms: number) => Math.floor(ms / 86_400_000)

export function formatAge(from: Date, to: Date): string {
  const hours = Math.floor((to.getTime() - from.getTime()) / 3_600_000)
  if (hours < 1) return 'under an hour'
  if (hours < 48) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

/** "+2 h 15 min", "−45 min", or "now" for the offset of a simulated time from the real one. */
export function formatOffset(simMs: number, realMs: number): string {
  const totalMinutes = Math.round((simMs - realMs) / 60_000)
  if (totalMinutes === 0) return 'now'
  const sign = totalMinutes < 0 ? '−' : '+'
  const abs = Math.abs(totalMinutes)
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  const parts = [hours ? `${hours} h` : '', minutes ? `${minutes} min` : ''].filter(Boolean)
  return `${sign}${parts.join(' ')}`
}

export function formatLocation({ lat, lon }: Location): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** Eight-point compass direction for an azimuth in degrees clockwise from north. */
export function compassPoint(azimuthDeg: number): string {
  return COMPASS[Math.round((((azimuthDeg % 360) + 360) % 360) / 45) % 8]
}
