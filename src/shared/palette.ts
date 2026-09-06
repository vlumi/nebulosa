import type { OrbitFamily } from '../orbit/orbit'

export type Rgb = [number, number, number]
export type Rgba = [number, number, number, number]

/** CSS color for a family swatch: a token, so it follows the theme. The numeric values live in theme.ts. */
export const familyCss = (family: OrbitFamily) => `var(--family-${family})`
