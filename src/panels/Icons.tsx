/** Small line icons for the title row toggles; each fills a 16 px box and takes the current color. */
const size = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }

export const GlobeIcon = () => (
  <svg {...size} aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" />
    <ellipse cx="8" cy="8" rx="2.8" ry="6.5" />
    <path d="M1.5 8h13M2.6 4.8h10.8M2.6 11.2h10.8" />
  </svg>
)

export const SunIcon = () => (
  <svg {...size} aria-hidden="true">
    <circle cx="8" cy="8" r="3.2" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.4 1.4M11.55 11.55l1.4 1.4M3.05 12.95l1.4-1.4M11.55 4.45l1.4-1.4" />
  </svg>
)

export const MoonIcon = () => (
  <svg {...size} aria-hidden="true">
    <path d="M13.5 9.8A6 6 0 1 1 6.2 2.5a4.8 4.8 0 0 0 7.3 7.3z" />
  </svg>
)
