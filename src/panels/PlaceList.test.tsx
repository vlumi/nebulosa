import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { TOKYO } from '../places/places'
import { PlaceList } from './PlaceList'

const helsinki = { id: 'hki', name: 'Helsinki', lat: 60.17, lon: 24.94 }

test('lists places with the selected one pressed; selecting, unselecting, renaming and removing are actions', async () => {
  const onSelect = vi.fn()
  const onRename = vi.fn()
  const onRemove = vi.fn()
  render(
    <PlaceList
      places={[TOKYO, helsinki]}
      placeId="tokyo"
      onSelect={onSelect}
      onRename={onRename}
      onRemove={onRemove}
    />,
  )
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
