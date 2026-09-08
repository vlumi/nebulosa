import type { Strings } from '../i18n/strings'

export const REPO_URL = 'https://github.com/vlumi/nebulosa'
export const COPYRIGHT = '© 2026 Ville Misaki · MIT'

/** The footer's line as one string of HTML, for the map's attribution where the footer itself is hidden. */
export const attributionLine = (s: Strings) =>
  `${s.footer} <a href="${REPO_URL}" target="_blank" rel="noopener">${s.source}</a> · ${COPYRIGHT}`
