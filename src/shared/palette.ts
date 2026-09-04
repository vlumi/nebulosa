import type { OrbitFamily } from '../orbit/orbit'

export type Rgb = [number, number, number]
export type Rgba = [number, number, number, number]

export const FAMILY_COLORS: Record<OrbitFamily, Rgb> = {
  'sun-synchronous': [238, 221, 102],
  'mid-inclination': [102, 204, 238],
}

/** CSS colour for a family swatch. */
export const familyCss = (family: OrbitFamily) => `rgb(${FAMILY_COLORS[family].join(' ')})`
