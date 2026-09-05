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

/** MapLibre's default vertical field of view puts the camera 1.5 viewport heights from the target. */
const CAMERA_HEIGHTS = 1.5

/**
 * How far from the view center, in degrees along the surface, the globe stays visible: the globe's radius on
 * screen is 512·2^z/2π pixels and the camera sits 1.5 heights beyond the surface, so the horizon is at
 * acos(r / (1.5h + r)).
 */
export function horizonDeg(zoom: number, heightPx: number): number {
  const r = (512 * 2 ** zoom) / (2 * Math.PI)
  return (Math.acos(r / (CAMERA_HEIGHTS * heightPx + r)) * 180) / Math.PI
}

/** The little of a map the horizon measurement needs. */
export interface Projector {
  getCenter: () => { lng: number; lat: number }
  project: (lngLat: [number, number]) => { x: number; y: number }
  unproject: (point: [number, number]) => { lng: number; lat: number }
  getCanvas: () => { clientWidth: number; clientHeight: number }
}

const RAD = Math.PI / 180

function greatCircleDeg(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const cosine =
    Math.sin(a.lat * RAD) * Math.sin(b.lat * RAD) +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lng - a.lng) * RAD)
  return Math.acos(Math.max(-1, Math.min(1, cosine))) / RAD
}

/**
 * How far from the view center, in degrees along the surface, the globe stays visible, measured on the map
 * itself: screen points from the center toward the farthest corner of the canvas are unprojected and
 * projected back, and the farthest one that lands where it started is on the globe. When the globe overflows
 * the canvas that corner is the farthest anything visible can be, which is all the culling needs. Falls back
 * to `fallbackDeg` when the center is off screen or nothing round-trips, as on the flat map.
 */
export function measureHorizonDeg(map: Projector, fallbackDeg: number): number {
  const center = map.getCenter()
  const origin = map.project([center.lng, center.lat])
  const { clientWidth: w, clientHeight: h } = map.getCanvas()
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return fallbackDeg
  const corner = [origin.x < w / 2 ? w : 0, origin.y < h / 2 ? h : 0]
  const onGlobe = (t: number) => {
    const point: [number, number] = [origin.x + (corner[0] - origin.x) * t, origin.y + (corner[1] - origin.y) * t]
    const lngLat = map.unproject(point)
    const back = map.project([lngLat.lng, lngLat.lat])
    return Number.isFinite(back.x) && Math.hypot(back.x - point[0], back.y - point[1]) < 1.5 ? lngLat : null
  }
  let lo = 0
  let hi = 1
  let found = onGlobe(lo)
  if (!found) return fallbackDeg
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2
    const hit = onGlobe(mid)
    if (hit) {
      found = hit
      lo = mid
    } else hi = mid
  }
  const deg = greatCircleDeg(center, found)
  return deg > 1 ? deg : fallbackDeg
}
