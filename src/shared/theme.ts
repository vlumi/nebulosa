import type { OrbitFamily } from '../orbit/orbit'
import type { Rgb, Rgba } from './palette'

export type Theme = 'light' | 'dark'
/** What the reader chose; `system` follows the operating system's preference. */
export type ThemeChoice = Theme | 'system'

export const BASEMAPS: Record<Theme, string> = {
  dark: 'https://tiles.openfreemap.org/styles/fiord',
  light: 'https://tiles.openfreemap.org/styles/positron',
}

/**
 * The colors deck.gl and MapLibre need as numbers or strings; the CSS tokens in index.css are the same values,
 * kept in step by hand, since a WebGL layer cannot read a custom property.
 */
export interface Palette {
  bg: Rgb
  /** The polar discs: a hole where the basemap has no data, a neutral gray that neither theme nor the night uses. */
  cap: Rgb
  text: Rgb
  panel: Rgba
  pin: string
  pinSelected: string
  night: { color: string; opacity: number }
  family: Record<OrbitFamily, Rgb>
  /** Track alpha ahead of the satellite and at the oldest end of the flown half, per emphasis; the flown half fades
   * between them. A dark line over a pale ground stays legible at a much lower alpha than a light one over a dark
   * ground, so the light theme fades further for the head and tail to tell apart. */
  track: Record<'selected' | 'normal' | 'dimmed', { ahead: number; oldest: number }>
}

export const PALETTES: Record<Theme, Palette> = {
  dark: {
    bg: [11, 13, 20],
    cap: [88, 92, 100],
    text: [214, 217, 224],
    panel: [11, 13, 20, 220],
    pin: '#8a90a0',
    pinSelected: '#eedd66',
    night: { color: 'rgb(0 4 20)', opacity: 90 / 255 },
    family: { 'sun-synchronous': [238, 221, 102], 'mid-inclination': [102, 204, 238] },
    track: {
      selected: { ahead: 255, oldest: 130 },
      normal: { ahead: 200, oldest: 40 },
      dimmed: { ahead: 40, oldest: 12 },
    },
  },
  light: {
    bg: [244, 245, 248],
    cap: [112, 116, 124],
    text: [28, 31, 38],
    panel: [255, 255, 255, 230],
    pin: '#5b6270',
    pinSelected: '#a86f00',
    night: { color: 'rgb(30 40 70)', opacity: 0.28 },
    family: { 'sun-synchronous': [176, 125, 0], 'mid-inclination': [0, 110, 170] },
    track: {
      selected: { ahead: 255, oldest: 50 },
      normal: { ahead: 230, oldest: 25 },
      dimmed: { ahead: 45, oldest: 8 },
    },
  },
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): Theme {
  if (choice === 'system') return systemDark ? 'dark' : 'light'
  return choice
}

const KEY = 'nebulosa.theme'

function storage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function loadThemeChoice(store = storage()): ThemeChoice {
  try {
    const raw = store?.getItem(KEY)
    return raw === 'light' || raw === 'dark' ? raw : 'system'
  } catch {
    return 'system'
  }
}

export function saveThemeChoice(choice: ThemeChoice, store = storage()): void {
  try {
    if (choice === 'system') store?.removeItem(KEY)
    else store?.setItem(KEY, choice)
  } catch {
    // Storage full or forbidden: the choice lives on for this visit only.
  }
}
