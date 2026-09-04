import { belongsToFocusedControl, stepIndex } from './shortcuts'

test('stepping through a list clamps at the ends and enters from either side', () => {
  expect(stepIndex(-1, 1, 3)).toBe(0)
  expect(stepIndex(-1, -1, 3)).toBe(2)
  expect(stepIndex(1, 1, 3)).toBe(2)
  expect(stepIndex(2, 1, 3)).toBe(2)
  expect(stepIndex(0, -1, 3)).toBe(0)
  expect(stepIndex(0, 1, 0)).toBe(-1)
})

test('keys in form fields, and Enter or Space on a button, are left alone', () => {
  const event = (tag: string, key: string) =>
    ({
      key,
      target: Object.assign(document.createElement(tag), { isContentEditable: false }),
    }) as unknown as KeyboardEvent
  expect(belongsToFocusedControl(event('select', 'ArrowDown'))).toBe(true)
  expect(belongsToFocusedControl(event('input', ' '))).toBe(true)
  expect(belongsToFocusedControl(event('button', 'Enter'))).toBe(true)
  expect(belongsToFocusedControl(event('button', 'ArrowDown'))).toBe(false)
  expect(belongsToFocusedControl(event('div', ' '))).toBe(false)
})
