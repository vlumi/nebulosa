import { writeFile } from 'node:fs/promises'

const SOURCE = 'https://celestrak.org/NORAD/elements/gp.php?NAME=STRIX&FORMAT=TLE'
const OUTPUT = 'data/tles.json'

const response = await fetch(SOURCE)
if (!response.ok) throw new Error(`CelesTrak responded ${response.status}`)

const lines = (await response.text()).split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean)
if (lines.length === 0 || lines.length % 3 !== 0) throw new Error(`Unexpected TLE payload: ${lines.length} lines`)

const satellites = []
for (let i = 0; i < lines.length; i += 3) {
  const [name, line1, line2] = lines.slice(i, i + 3)
  satellites.push({ name, noradId: Number(line1.slice(2, 7)), line1, line2 })
}
satellites.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

await writeFile(OUTPUT, JSON.stringify(satellites, null, 2) + '\n')
console.log(`${satellites.length} satellites → ${OUTPUT}`)
