import type { DDCoordinates } from 'geo-coord'
import type { LonLat } from './orbit'

export const RAD = Math.PI / 180
export const DEG = 180 / Math.PI
/** WGS84 equatorial radius, the sphere the orbits and the radar geometry are reckoned on. */
export const EARTH_RADIUS_KM = 6378.137

/** The library's point from the renderer's tuple, and back. */
export const coordinates = ([lon, lat]: LonLat): DDCoordinates => ({ latitude: lat, longitude: lon })
export const lonLat = ({ latitude, longitude }: DDCoordinates): LonLat => [longitude, latitude]
