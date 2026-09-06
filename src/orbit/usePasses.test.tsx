import { renderHook } from '@testing-library/react'
import { epochOf } from './elements'
import { usePasses } from './usePasses'
import { strix1 } from '../test/fixtures'

const elements = [strix1]
const tokyo = { lat: 35.68, lon: 139.69 }
const helsinki = { lat: 60.17, lon: 24.94 }

test('a new place shows no list until its own passes are computed, and a renamed place recomputes nothing', () => {
  const fromMs = epochOf(strix1).getTime()
  type Props = { place: { lat: number; lon: number; id: string; name: string } | null }
  const { result, rerender } = renderHook(({ place }: Props) => usePasses(elements, place, fromMs, 24), {
    initialProps: { place: { ...tokyo, id: 'tokyo', name: 'Tokyo' } } as Props,
  })
  const overTokyo = result.current
  expect(overTokyo.length).toBeGreaterThan(0)

  rerender({ place: { ...tokyo, id: 'tokyo', name: 'Home' } })
  expect(result.current).toBe(overTokyo)

  rerender({ place: { ...helsinki, id: 'hki', name: 'Helsinki' } })
  expect(result.current).not.toBe(overTokyo)
  expect(result.current.every((p) => !overTokyo.includes(p))).toBe(true)

  rerender({ place: null })
  expect(result.current).toEqual([])
})
