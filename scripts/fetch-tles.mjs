import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const SOURCE = 'https://celestrak.org/NORAD/elements/gp.php?NAME=STRIX&FORMAT=TLE'
const output = process.argv[2] ?? 'public/data/tles.json'

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

await mkdir(dirname(output), { recursive: true })
const partial = `${output}.tmp`
await writeFile(partial, JSON.stringify(satellites, null, 2) + '\n')
await rename(partial, output)
console.log(`${satellites.length} satellites → ${output}`)
