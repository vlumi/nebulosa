import '@testing-library/jest-dom/vitest'

// No animation frames in unit tests. The frame loop would tick at 60 Hz for the whole run, and with
// the map overlay mocked by vi.fn(), every frame's layer set would be recorded until the worker ran out
// of memory. Components read the frame store's initial values instead; nothing under test needs more.
// Plain assignments, not vi.stubGlobal: a test file's vi.unstubAllGlobals() must not bring the loop back.
globalThis.requestAnimationFrame = () => 0
globalThis.cancelAnimationFrame = () => {}

afterEach(() => {
  expect(requestAnimationFrame(() => {})).toBe(0)
})
