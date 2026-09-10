export const REPO_URL = 'https://github.com/vlumi/nebulosa'
export const COPYRIGHT = '© 2026 Ville Misaki · MIT'

export type Credit = [name: string, url: string]

export const DATA_CREDITS: Credit[] = [['CelesTrak', 'https://celestrak.org/']]

export const MAP_CREDITS: Credit[] = [
  ['OpenFreeMap', 'https://openfreemap.org/'],
  ['© OpenMapTiles', 'https://openmaptiles.org/'],
  ['© OpenStreetMap contributors', 'https://www.openstreetmap.org/copyright'],
]

/** The libraries the site is built on. */
export const LIBRARIES: Credit[] = [
  ['MapLibre GL', 'https://maplibre.org/'],
  ['deck.gl', 'https://deck.gl/'],
  ['satellite.js', 'https://github.com/shashwatak/satellite-js'],
  ['geo-coord', 'https://github.com/vlumi/geo-coord'],
  ['React', 'https://react.dev/'],
]
