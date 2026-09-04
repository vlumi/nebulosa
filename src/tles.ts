export interface Tle {
  name: string
  noradId: number
  line1: string
  line2: string
}

export async function loadTles(): Promise<Tle[]> {
  const response = await fetch('/data/tles.json')
  if (!response.ok) throw new Error(`Loading TLEs failed: ${response.status}`)
  return response.json()
}

export function tleEpoch(line1: string): Date {
  const yy = Number(line1.slice(18, 20))
  const dayOfYear = Number(line1.slice(20, 32))
  const year = yy < 57 ? 2000 + yy : 1900 + yy
  return new Date(Date.UTC(year, 0, 1) + (dayOfYear - 1) * 86_400_000)
}

export function newestEpoch(tles: Tle[]): Date {
  return new Date(Math.max(...tles.map((t) => tleEpoch(t.line1).getTime())))
}

export function formatAge(from: Date, to: Date): string {
  const hours = Math.floor((to.getTime() - from.getTime()) / 3_600_000)
  if (hours < 1) return 'under an hour'
  if (hours < 48) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}
