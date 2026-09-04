import '@testing-library/jest-dom/vitest'

// No animation frames in unit tests. The frame loop would tick at 60 Hz for the whole run, and with
// the map overlay mocked by vi.fn(), every frame's layer set would be recorded until the worker ran out
// of memory. Components read the frame store's initial values instead; nothing under test needs more.
vi.stubGlobal('requestAnimationFrame', () => 0)
vi.stubGlobal('cancelAnimationFrame', () => {})
