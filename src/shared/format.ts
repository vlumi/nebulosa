import { en, type Strings } from '../i18n/strings'

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
export function dayLabel(t: Date | number, s: Strings = en): string {
  const d = new Date(t)
  return s.units.day(s.units.weekdays[d.getUTCDay()], d.getUTCDate(), d.getUTCMonth())
}

export const utcDayIndex = (ms: number) => Math.floor(ms / 86_400_000)

export function formatAge(from: Date, to: Date, s: Strings = en): string {
  const hours = Math.floor((to.getTime() - from.getTime()) / 3_600_000)
  if (hours < 1) return s.units.underAnHour
  if (hours < 48) return s.units.hours(hours)
  return s.units.days(Math.floor(hours / 24))
}

/** "+2 h 15 min", "−45 min", or "now" for the offset of a simulated time from the real one. */
export function formatOffset(simMs: number, realMs: number, s: Strings = en): string {
  const totalMinutes = Math.round((simMs - realMs) / 60_000)
  if (totalMinutes === 0) return s.time.now
  const sign = totalMinutes < 0 ? '−' : '+'
  const abs = Math.abs(totalMinutes)
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  const parts = [hours ? s.units.hours(hours) : '', minutes ? s.units.minutes(minutes) : ''].filter(Boolean)
  return `${sign}${parts.join(' ')}`
}

export function formatLocation({ lat, lon }: { lat: number; lon: number }): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
}

/** Eight-point compass direction for an azimuth in degrees clockwise from north. */
export function compassPoint(azimuthDeg: number, s: Strings = en): string {
  return s.units.compass[Math.round((((azimuthDeg % 360) + 360) % 360) / 45) % 8]
}

/** "45 s", "23 min", "1 h 12 min" for a span ahead. */
export function formatDuration(ms: number, s: Strings = en): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  if (totalSeconds < 60) return s.units.seconds(totalSeconds)
  const totalMinutes = Math.round(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return [hours ? s.units.hours(hours) : '', minutes || !hours ? s.units.minutes(minutes) : '']
    .filter(Boolean)
    .join(' ')
}
