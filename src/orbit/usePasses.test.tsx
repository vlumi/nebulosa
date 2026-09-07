import { act, renderHook } from '@testing-library/react'
import { computePasses, type Pass, type PassRequest } from './passes'
import { usePasses } from './usePasses'
import { strix1 } from '../test/fixtures'
import { epochOf } from './elements'

/** A stand-in for the browser's Worker: records what is posted and lets a test answer as the worker would. */
class FakeWorker {
  static instances: FakeWorker[] = []
  posted: PassRequest[] = []
  listeners = new Set<(event: MessageEvent) => void>()
  terminated = false
  constructor() {
    FakeWorker.instances.push(this)
  }
  postMessage(request: PassRequest) {
    this.posted.push(request)
  }
  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener)
  }
  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener)
  }
  terminate() {
    this.terminated = true
  }
  reply(id: number, passes: Pass[]) {
    for (const listener of this.listeners) listener({ data: { id, passes } } as MessageEvent)
  }
}

const tokyo = { lat: 35.68, lon: 139.69 }
const helsinki = { lat: 60.17, lon: 24.94 }
const pass = (noradId: number) => ({ noradId, name: `#${noradId}`, startMs: 1, peakMs: 2, endMs: 3 }) as Pass

beforeEach(() => {
  FakeWorker.instances = []
  vi.stubGlobal('Worker', FakeWorker)
})
afterEach(() => vi.unstubAllGlobals())

test('the hook posts each request to one worker, shows the answer that matches, and drops a stale one', () => {
  const elements = [strix1]
  const { result, rerender, unmount } = renderHook(
    ({ location, hours }: { location: typeof tokyo | null; hours: number }) =>
      usePasses(elements, location, 1_000, hours),
    { initialProps: { location: tokyo as typeof tokyo | null, hours: 24 } },
  )
  expect(FakeWorker.instances).toHaveLength(1)
  const worker = FakeWorker.instances[0]
  expect(worker.posted).toEqual([{ id: 1, elements, location: tokyo, fromMs: 1_000, hours: 24 }])
  expect(result.current).toEqual([])

  rerender({ location: tokyo, hours: 48 })
  expect(worker.posted.map((r) => [r.id, r.hours])).toEqual([
    [1, 24],
    [2, 48],
  ])
  act(() => worker.reply(1, [pass(1)]))
  expect(result.current).toEqual([])
  act(() => worker.reply(2, [pass(2)]))
  expect(result.current).toEqual([pass(2)])

  rerender({ location: helsinki, hours: 48 })
  expect(result.current).toEqual([])
  act(() => worker.reply(3, [pass(3)]))
  expect(result.current).toEqual([pass(3)])

  rerender({ location: null, hours: 48 })
  expect(result.current).toEqual([])
  expect(worker.posted).toHaveLength(3)

  unmount()
  expect(worker.terminated).toBe(true)
})

test('the worker answers a request with the same id and the computed passes', async () => {
  const posted = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
  await import('./passes.worker')
  const request: PassRequest = {
    id: 7,
    elements: [strix1],
    location: tokyo,
    fromMs: epochOf(strix1).getTime(),
    hours: 24,
  }
  window.onmessage!({ data: request } as MessageEvent)
  expect(posted).toHaveBeenCalledWith({ id: 7, passes: computePasses(request) })
  posted.mockRestore()
  window.onmessage = null
})
