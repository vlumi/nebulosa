import { computePasses, type PassRequest } from './passes'

self.onmessage = (event: MessageEvent<PassRequest>) => {
  self.postMessage({ id: event.data.id, passes: computePasses(event.data) })
}
