import { Map as MapLibre, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { Feature, MultiLineString } from 'geojson'
import type { Lang } from '../i18n/strings'
import { useStrings } from '../i18n/useStrings'
import { splitAtAntimeridian, trackSamples, type Satellite } from '../orbit/orbit'
import { stateAt } from '../orbit/readout'
import { compassPoint, formatOffset, hhmmss } from '../shared/format'
import { BASEMAPS, PALETTES, type Theme } from '../shared/theme'
import { useFrame } from '../time/frame'
import { labelLanguage } from './labels'
import { NIGHT_LAYER, nightFeature, nightPaint, REACH_LAYER, REACH_OPACITY, reachFeature, reachFill } from './surface'
import styles from './SatelliteView.module.css'

interface Props {
  satellite: Satellite
  theme: Theme
  lang: Lang
  /** Whether the reach band is drawn, as on the main map. */
  reach: boolean
  onBack: () => void
}

const TRACK_LAYER = 'own-track'
/**
 * Seen along the ground, tiles rasterized up to their own edge leave hairline seams between them; a small buffer lets
 * each fill overrun its edge, and MapLibre's stencil clips the overlap. Small, so the wrapped copies of a fill at the
 * antimeridian overlap in no more than a sliver.
 */
const SEAM_BUFFER = 8
/** Half an orbit each way is what the seat can see before the horizon; the fills stay small. */
const SPAN = { pastOrbits: 0.5, futureOrbits: 0.5 }
/** Looking further up than the start shows more sky than globe and MapLibre's globe gets odd there, so the start is the ceiling. */
const PITCH = { min: 0, max: 60, start: 60 }
const FOV = 60
const TILE_MAX_ZOOM = 6

/** Where Mercator ends: a look-at point past this latitude is clamped by MapLibre and the camera comes apart. */
const LOOK_AT_MAX_LAT = 84

/**
 * The camera at the satellite, looking along `bearing` at `pitch` or, over the poles, as close to it as keeps the
 * look-at point on the map: MapLibre defines the camera by the ground point it looks at, in Mercator coordinates.
 * The pitch that puts that point exactly on the limit is found by bisection, so the dip is continuous; stepping
 * it would snap the view between two headings frame by frame, since meridians converge fast up there.
 */
function cameraAt(m: MapLibre, at: { lon: number; lat: number; altKm: number }, bearing: number, pitch: number) {
  const options = (p: number) =>
    m.calculateCameraOptionsFromCameraLngLatAltRotation([at.lon, at.lat], at.altKm * 1000, bearing, p)
  const onMap = (o: ReturnType<typeof options>) => Math.abs((o.center as { lat: number }).lat) <= LOOK_AT_MAX_LAT
  const wanted = options(pitch)
  if (onMap(wanted)) return wanted
  let low = 0
  let high = pitch
  for (let i = 0; i < 16; i++) {
    const mid = (low + high) / 2
    if (onMap(options(mid))) low = mid
    else high = mid
  }
  return options(low)
}

function trackFeature(satellite: Satellite, date: Date): Feature<MultiLineString> {
  const pieces = splitAtAntimeridian(trackSamples(satellite, date, 30, SPAN).map((s) => s.lonLat))
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: pieces } }
}

/**
 * The view from the satellite's seat: its own MapLibre globe with the camera at the satellite's position and
 * height, looking along its heading until dragged, with the night, the reach band and the own track as fills.
 */
export function SatelliteView({ satellite, theme, lang, reach, onBack }: Props) {
  const t = useStrings()
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre>(null)
  const look = useRef({ yaw: 0, pitch: PITCH.start })
  const reachShown = useRef(reach)
  reachShown.current = reach
  const [hud, setHud] = useState<{ timeMs: number; nowMs: number; altKm: number; headingDeg: number } | null>(null)

  useEffect(() => {
    if (!container.current) return
    const m = new MapLibre({
      container: container.current,
      interactive: false,
      maxPitch: PITCH.max,
      attributionControl: { compact: true },
      canvasContextAttributes: { antialias: true },
    })
    map.current = m
    const palette = PALETTES[theme]
    let lastMinute = -1
    let ready = false
    const place = (timeMs: number) => {
      if (!ready) return
      const state = stateAt(satellite, new Date(timeMs))
      if (!state) return
      const { yaw } = look.current
      try {
        m.jumpTo(cameraAt(m, state, state.headingDeg + yaw, look.current.pitch))
      } catch {
        return
      }
      return state
    }
    const surfaces = (timeMs: number) => {
      const minute = Math.floor(timeMs / 60_000)
      if (minute === lastMinute || !m.getSource(NIGHT_LAYER)) return
      lastMinute = minute
      const date = new Date(minute * 60_000)
      const samples = trackSamples(satellite, date, 30, SPAN)
      ;(m.getSource(NIGHT_LAYER) as GeoJSONSource).setData(nightFeature(date))
      ;(m.getSource(REACH_LAYER) as GeoJSONSource).setData(reachFeature(samples))
      ;(m.getSource(TRACK_LAYER) as GeoJSONSource).setData(trackFeature(satellite, date))
    }
    m.on('style.load', () => {
      m.setProjection({ type: 'globe' })
      m.setVerticalFieldOfView(FOV)
      labelLanguage(m, lang)
      const { timeMs } = useFrame.getState()
      const date = new Date(timeMs)
      m.addSource(NIGHT_LAYER, { type: 'geojson', data: nightFeature(date), buffer: SEAM_BUFFER, tolerance: 0 })
      m.addSource(REACH_LAYER, {
        type: 'geojson',
        data: reachFeature(trackSamples(satellite, date, 30, SPAN)),
        buffer: SEAM_BUFFER,
        tolerance: 0,
      })
      m.addSource(TRACK_LAYER, { type: 'geojson', data: trackFeature(satellite, date) })
      m.addLayer({ id: NIGHT_LAYER, type: 'fill', source: NIGHT_LAYER, paint: nightPaint(theme) })
      m.addLayer({
        id: REACH_LAYER,
        type: 'fill',
        source: REACH_LAYER,
        layout: { visibility: reachShown.current ? 'visible' : 'none' },
        paint: {
          'fill-color': reachFill(satellite.family, theme),
          'fill-opacity': REACH_OPACITY * 1.6,
          'fill-antialias': false,
        },
      })
      m.addLayer({
        id: TRACK_LAYER,
        type: 'line',
        source: TRACK_LAYER,
        paint: { 'line-color': `rgb(${palette.family[satellite.family].join(' ')})`, 'line-width': 2 },
      })
      lastMinute = Math.floor(timeMs / 60_000)
      ready = true
      place(timeMs)
    })
    let shownSecond = -1
    // Coarser tiles than the height would pick, so fewer stream past the camera at speed. On the source, not the
    // map: a map zoom cap would hold the camera up at nadir, where the helper needs a higher zoom than at the horizon.
    m.setStyle(BASEMAPS[theme], {
      transformStyle: (_previous: StyleSpecification | undefined, next: StyleSpecification) => ({
        ...next,
        sources: Object.fromEntries(
          Object.entries(next.sources).map(([id, source]) => [
            id,
            source.type === 'vector' ? { ...source, maxzoom: TILE_MAX_ZOOM } : source,
          ]),
        ),
      }),
    })
    const unsubscribe = useFrame.subscribe((f) => {
      const state = place(f.timeMs)
      surfaces(f.timeMs)
      // Once a real second: at 600× a simulated second would mean hundreds of renders.
      const second = Math.floor(f.nowMs / 1000)
      if (state && second !== shownSecond) {
        shownSecond = second
        setHud({ timeMs: f.timeMs, nowMs: f.nowMs, altKm: state.altKm, headingDeg: state.headingDeg })
      }
    })
    return () => {
      unsubscribe()
      m.remove()
      map.current = null
    }
    // The map is built once per satellite and theme; the language and the look are applied to it in place.
  }, [satellite, theme])

  useEffect(() => {
    if (map.current?.isStyleLoaded()) labelLanguage(map.current, lang)
  }, [lang])

  useEffect(() => {
    if (map.current?.getLayer(REACH_LAYER))
      map.current.setLayoutProperty(REACH_LAYER, 'visibility', reach ? 'visible' : 'none')
  }, [reach])

  // A finger or the mouse turns the view; the field of view is fixed, since zooming from a seat read as odd.
  const last = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    last.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!last.current) return
    const scale = FOV / 400
    // The ground follows the pointer both ways: dragging right turns the view left, as dragging down tilts it up.
    look.current.yaw -= (e.clientX - last.current.x) * scale
    look.current.pitch = Math.max(
      PITCH.min,
      Math.min(PITCH.max, look.current.pitch + (e.clientY - last.current.y) * scale),
    )
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = () => {
    last.current = null
  }

  return (
    <div
      className={styles.view}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={container} className={styles.map} />
      <button type="button" className={styles.back} aria-label={t.ride.back} title={t.ride.back} onClick={onBack}>
        ←
      </button>
      {hud && (
        <div className={styles.hud} aria-live="off">
          <strong>{satellite.omm.OBJECT_NAME}</strong>
          <span>
            {hhmmss(hud.timeMs)} UTC · {formatOffset(hud.timeMs, hud.nowMs, t)}
          </span>
          <span className="muted">
            {t.satellites.height} {Math.round(hud.altKm)} km · {t.satellites.heading} {compassPoint(hud.headingDeg, t)}{' '}
            {Math.round(hud.headingDeg)}°
          </span>
        </div>
      )}
      <p className={`${styles.hint} muted`}>{t.ride.look}</p>
    </div>
  )
}
