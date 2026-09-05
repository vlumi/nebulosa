import { useEffect, useRef, useState } from 'react'
import type { Omm } from './elements'
import { computePasses, type Location, type Pass, type PassRequest } from './passes'

interface Reply {
  id: number
  passes: Pass[]
}

/**
 * The upcoming passes, computed in a Web Worker so a pin drag or a longer horizon never stalls the
 * frame; the previous list stays on screen until the new one arrives. Where workers are unavailable
 * (tests), the same computation runs inline.
 */
export function usePasses(elements: Omm[], location: Location | null, fromMs: number, hours: number): Pass[] {
  const [passes, setPasses] = useState<Pass[]>([])
  const worker = useRef<Worker | null>(null)
  const nextId = useRef(0)

  useEffect(() => {
    if (typeof Worker === 'undefined') return
    worker.current = new Worker(new URL('./passes.worker.ts', import.meta.url), { type: 'module' })
    return () => {
      worker.current?.terminate()
      worker.current = null
    }
  }, [])

  useEffect(() => {
    if (!location) return
    const request: PassRequest = { id: ++nextId.current, elements, location, fromMs, hours }
    if (!worker.current) {
      setPasses(computePasses(request))
      return
    }
    const onMessage = (event: MessageEvent<Reply>) => {
      if (event.data.id === request.id) setPasses(event.data.passes)
    }
    worker.current.addEventListener('message', onMessage)
    worker.current.postMessage(request)
    return () => worker.current?.removeEventListener('message', onMessage)
  }, [elements, location, fromMs, hours])

  return location ? passes : []
}
