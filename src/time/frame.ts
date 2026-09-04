import { create } from 'zustand'
import { useApp } from '../store'
import { simTime } from './clock'
import { approach } from './smoothing'

interface Frame {
  /** Real wall-clock time, updated every animation frame. */
  nowMs: number
  /** The displayed simulated time: follows the clock and eases across jumps instead of cutting. */
  timeMs: number
}

/**
 * Per-frame times in their own store, so only the components that draw them re-render each frame.
 * Selectors that round (`useMinute`) re-render their subscribers once a minute.
 */
export const useFrame = create<Frame>(() => ({
  nowMs: Date.now(),
  timeMs: simTime(useApp.getState().clock, Date.now()),
}))

export const useMinute = () => useFrame((f) => Math.floor(f.nowMs / 60_000))

/** Runs the single animation-frame loop; returns the stop function. */
export function startFrameLoop(): () => void {
  let displayed = useFrame.getState().timeMs
  let last = performance.now()
  let frame = requestAnimationFrame(function tick(t) {
    const nowMs = Date.now()
    displayed = approach(displayed, simTime(useApp.getState().clock, nowMs), t - last)
    last = t
    useFrame.setState({ nowMs, timeMs: displayed })
    frame = requestAnimationFrame(tick)
  })
  return () => cancelAnimationFrame(frame)
}
