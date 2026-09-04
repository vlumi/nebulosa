import { render, screen } from '@testing-library/react'
import App from './App'

const tles = [
  {
    name: 'STRIX-1',
    noradId: 53815,
    line1: '1 53815U 22113A   26246.86169031  .00017698  00000+0  40157-3 0  9995',
    line2: '2 53815  97.4412 310.4456 0002115 330.5549  29.5579 15.43118866219565',
  },
  {
    name: 'STRIX-4',
    noradId: 60352,
    line1: '1 60352U 24137A   26246.89078035  .00011795  00000+0  34834-3 0  9990',
    line2: '2 60352  43.0142 196.4639 0015842 104.9364 255.3246 15.34829273116107',
  },
]

afterEach(() => vi.unstubAllGlobals())

test('lists the constellation from /data/tles.json with the epoch age', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(tles))))
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('nebulosa')
  expect(await screen.findByText('STRIX-1')).toBeInTheDocument()
  expect(screen.getByText('STRIX-4')).toBeInTheDocument()
  expect(screen.getByText(/2 satellites · elements from 2026-09-03 21:22 UTC/)).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/data/tles.json')
})

test('reports a failed load', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveTextContent('503')
})
