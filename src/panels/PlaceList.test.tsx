import { act, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { TOKYO } from '../places/places'
import { PlaceList } from './PlaceList'

const helsinki = { id: 'hki', name: 'Helsinki', lat: 60.17, lon: 24.94 }

test('lists places with the selected one pressed; selecting, unselecting, renaming and removing are actions', async () => {
  const onSelect = vi.fn()
  const onRename = vi.fn()
  const onRemove = vi.fn()
  const onLockChange = vi.fn()
  render(
    <PlaceList
      places={[TOKYO, helsinki]}
      placeId="tokyo"
      onSelect={onSelect}
      onRename={onRename}
      onRemove={onRemove}
      pinsLocked={false}
      onLocate={vi.fn()}
      onLockChange={onLockChange}
    />,
  )
  await userEvent.click(screen.getByRole('checkbox', { name: 'Lock pins' }))
  expect(onLockChange).toHaveBeenCalledWith(true)
  expect(screen.getByRole('button', { name: /^Tokyo/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /^Helsinki 60.17°N 24.94°E/ })).toHaveAttribute('aria-pressed', 'false')

  await userEvent.click(screen.getByRole('button', { name: /^Helsinki/ }))
  expect(onSelect).toHaveBeenLastCalledWith('hki')
  await userEvent.click(screen.getByRole('button', { name: /^Tokyo/ }))
  expect(onSelect).toHaveBeenLastCalledWith(null)

  await userEvent.click(screen.getByRole('button', { name: 'Rename Helsinki' }))
  const input = screen.getByRole('textbox', { name: 'Place name' })
  await userEvent.clear(input)
  await userEvent.type(input, 'Home{Enter}')
  expect(onRename).toHaveBeenCalledWith('hki', 'Home')

  await userEvent.click(screen.getByRole('button', { name: 'Remove Tokyo' }))
  expect(onRemove).toHaveBeenCalledWith('tokyo')
})

test('Escape cancels a rename and focus returns to the pencil', async () => {
  render(
    <PlaceList
      places={[TOKYO, helsinki]}
      placeId="tokyo"
      onSelect={vi.fn()}
      onRename={vi.fn()}
      onRemove={vi.fn()}
      pinsLocked={false}
      onLocate={vi.fn()}
      onLockChange={vi.fn()}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Rename Helsinki' }))
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename Helsinki' }))
})

test('the location button asks the browser once and hands over the position with a name; a refusal is said', async () => {
  const onLocate = vi.fn()
  const getCurrentPosition = vi.fn()
  vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } })
  render(
    <PlaceList
      places={[TOKYO]}
      placeId={null}
      onSelect={vi.fn()}
      onRename={vi.fn()}
      onRemove={vi.fn()}
      pinsLocked={false}
      onLockChange={vi.fn()}
      onLocate={onLocate}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Use my location' }))
  expect(screen.getByRole('button', { name: 'Locating…' })).toBeDisabled()
  const [onPosition, onError] = getCurrentPosition.mock.calls[0] as [
    (p: { coords: { latitude: number; longitude: number } }) => void,
    (e: { code: number; PERMISSION_DENIED: number }) => void,
  ]
  act(() => onPosition({ coords: { latitude: 35.5, longitude: 139.6 } }))
  expect(onLocate).toHaveBeenCalledWith({ lat: 35.5, lon: 139.6 }, 'My location')
  expect(screen.getByRole('button', { name: 'Use my location' })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: 'Use my location' }))
  act(() => (getCurrentPosition.mock.calls[1] as [unknown, typeof onError])[1]({ code: 1, PERMISSION_DENIED: 1 }))
  expect(screen.getByText('The browser was not allowed to share the location.')).toBeInTheDocument()
  vi.unstubAllGlobals()
})

test('once the located place exists its row carries the refresh and the add row is gone; removing it brings the row back', () => {
  const located = { id: 'located', name: 'My location', lat: 35.5, lon: 139.6, located: true as const }
  const view = (places: (typeof TOKYO)[]) => (
    <PlaceList
      places={places}
      placeId={null}
      onSelect={vi.fn()}
      onRename={vi.fn()}
      onRemove={vi.fn()}
      pinsLocked={false}
      onLockChange={vi.fn()}
      onLocate={vi.fn()}
    />
  )
  const { rerender } = render(view([TOKYO, located]))
  expect(screen.getByRole('button', { name: 'Update my location' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Use my location' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Remove My location' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Rename My location' })).toBeNull()
  rerender(view([TOKYO]))
  expect(screen.getByRole('button', { name: 'Use my location' })).toBeInTheDocument()
})
