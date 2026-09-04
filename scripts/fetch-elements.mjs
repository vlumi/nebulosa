import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const SOURCE = 'https://celestrak.org/NORAD/elements/gp.php?NAME=STRIX&FORMAT=JSON'
const output = process.argv[2] ?? 'public/data/elements.json'

const response = await fetch(SOURCE)
if (!response.ok) throw new Error(`CelesTrak responded ${response.status}`)

const elements = await response.json()
if (!Array.isArray(elements) || elements.length === 0) throw new Error('Unexpected payload from CelesTrak')
elements.sort((a, b) => a.OBJECT_NAME.localeCompare(b.OBJECT_NAME, undefined, { numeric: true }))

await mkdir(dirname(output), { recursive: true })
const partial = `${output}.tmp`
await writeFile(partial, JSON.stringify(elements, null, 2) + '\n')
await rename(partial, output)
console.log(`${elements.length} satellites → ${output}`)
