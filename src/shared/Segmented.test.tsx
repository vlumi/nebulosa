import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import { Segmented } from './Segmented'

function Speed({ onChange }: { onChange: (rate: number) => void }) {
  const [rate, setRate] = useState(10)
  const change = (next: number) => {
    setRate(next)
    onChange(next)
  }
  return <Segmented label="Speed" options={[1, 10, 60]} value={rate} onChange={change} format={(n) => `${n}×`} />
}

test('clicking picks a value; arrows step through the group and wrap around', async () => {
  const onChange = vi.fn()
  render(<Speed onChange={onChange} />)

  expect(screen.getByRole('radio', { name: '10×' })).toBeChecked()
  expect(screen.getByRole('radio', { name: '1×' })).not.toBeChecked()

  await userEvent.click(screen.getByRole('radio', { name: '60×' }))
  expect(onChange).toHaveBeenLastCalledWith(60)
  expect(screen.getByRole('radio', { name: '60×' })).toBeChecked()

  screen.getByRole('radio', { name: '60×' }).focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(onChange).toHaveBeenLastCalledWith(1)
  expect(screen.getByRole('radio', { name: '1×' })).toHaveFocus()
  await userEvent.keyboard('{ArrowLeft}')
  expect(onChange).toHaveBeenLastCalledWith(60)
})
