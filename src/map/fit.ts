/** Past this zoom the globe renders flat: curvature is invisible there, and the deck.gl beta clips its globe view away. */
export const GLOBE_MAX_ZOOM = 5.5

/** Share of the shorter side the globe, or of the width the flat world, takes at the start. */
const FIT = 0.85

/** The zoom at which the whole Earth fits the container: MapLibre's globe spans 512·2^z/π pixels, the flat world 512·2^z. */
export function fitZoom(width: number, height: number, globe: boolean): number {
  const target = FIT * (globe ? Math.min(width, height) : width)
  const zoom = Math.log2((target / 512) * (globe ? Math.PI : 1))
  return Math.min(GLOBE_MAX_ZOOM - 0.5, Math.max(0.5, zoom))
}
