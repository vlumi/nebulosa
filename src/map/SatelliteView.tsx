import { Map as MapLibre, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
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
  onBack: () => void
}

const TRACK_LAYER = 'own-track'
/** Half an orbit each way is what the seat can see before the horizon; the fills stay small. */
const SPAN = { pastOrbits: 0.5, futureOrbits: 0.5 }
/** Looking further up than the start shows more sky than globe and MapLibre's globe gets odd there, so the start is the ceiling. */
const PITCH = { min: 0, max: 60, start: 60 }
const FOV = { min: 20, max: 110, start: 60 }

/** Where Mercator ends: a look-at point past this latitude is clamped by MapLibre and the camera comes apart. */
const LOOK_AT_MAX_LAT = 84
const PITCH_STEP = 2

/**
 * The camera at the satellite, looking along `bearing` at `pitch` or, over the poles, as close to it as keeps the
 * look-at point on the map: MapLibre defines the camera by the ground point it looks at, in Mercator coordinates.
 * An explicit roll is passed because left out, the helper returns the key as undefined and the jump makes NaN of it.
 */
function cameraAt(m: MapLibre, at: { lon: number; lat: number; altKm: number }, bearing: number, pitch: number) {
  for (let p = pitch; ; p = Math.max(0, p - PITCH_STEP)) {
    const options = m.calculateCameraOptionsFromCameraLngLatAltRotation(
      [at.lon, at.lat],
      at.altKm * 1000,
      bearing,
      p,
      0,
    )
    const lat = (options.center as { lat: number }).lat
    if (Math.abs(lat) <= LOOK_AT_MAX_LAT || p === 0) return options
  }
}

function trackFeature(satellite: Satellite, date: Date): Feature<MultiLineString> {
  const pieces = splitAtAntimeridian(trackSamples(satellite, date, 30, SPAN).map((s) => s.lonLat))
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: pieces } }
}

/**
 * The view from the satellite's seat: its own MapLibre globe with the camera at the satellite's position and
 * height, looking along its heading until dragged, with the night, the reach band and the own track as fills.
 */
export function SatelliteView({ satellite, theme, lang, onBack }: Props) {
  const t = useStrings()
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre>(null)
  const look = useRef({ yaw: 0, pitch: PITCH.start, fov: FOV.start })
  const [hud, setHud] = useState<{ timeMs: number; nowMs: number; altKm: number; headingDeg: number } | null>(null)

  useEffect(() => {
    if (!container.current) return
    const m = new MapLibre({
      container: container.current,
      style: BASEMAPS[theme],
      interactive: false,
      maxPitch: PITCH.max,
      // Coarser tiles than the height would pick: fewer to fetch as the ground streams past, and detail is not the point.
      maxZoom: 6,
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
      m.setVerticalFieldOfView(look.current.fov)
      labelLanguage(m, lang)
      const { timeMs } = useFrame.getState()
      const date = new Date(timeMs)
      m.addSource(NIGHT_LAYER, { type: 'geojson', data: nightFeature(date), buffer: 0, tolerance: 0 })
      m.addSource(REACH_LAYER, {
        type: 'geojson',
        data: reachFeature(trackSamples(satellite, date, 30, SPAN)),
        buffer: 0,
        tolerance: 0,
      })
      m.addSource(TRACK_LAYER, { type: 'geojson', data: trackFeature(satellite, date) })
      m.addLayer({ id: NIGHT_LAYER, type: 'fill', source: NIGHT_LAYER, paint: nightPaint(theme) })
      m.addLayer({
        id: REACH_LAYER,
        type: 'fill',
        source: REACH_LAYER,
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

  const drag = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    const scale = look.current.fov / 400
    look.current.yaw += dx * scale
    look.current.pitch = Math.max(PITCH.min, Math.min(PITCH.max, look.current.pitch + dy * scale))
  }
  const onPointerUp = () => {
    drag.current = null
  }
  const onWheel = (e: WheelEvent) => {
    look.current.fov = Math.max(FOV.min, Math.min(FOV.max, look.current.fov + e.deltaY * 0.05))
    map.current?.setVerticalFieldOfView(look.current.fov)
  }

  return (
    <div
      className={styles.view}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
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
