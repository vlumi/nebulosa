import { loadThemeChoice, resolveTheme, saveThemeChoice } from './theme'

function memory(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  } as Storage
}

test('system follows the preference; an explicit choice does not', () => {
  expect(resolveTheme('system', true)).toBe('dark')
  expect(resolveTheme('system', false)).toBe('light')
  expect(resolveTheme('light', true)).toBe('light')
  expect(resolveTheme('dark', false)).toBe('dark')
})

test('the choice round-trips through storage, and system means nothing stored', () => {
  const store = memory()
  expect(loadThemeChoice(store)).toBe('system')
  saveThemeChoice('light', store)
  expect(loadThemeChoice(store)).toBe('light')
  saveThemeChoice('system', store)
  expect(loadThemeChoice(store)).toBe('system')
  store.setItem('nebulosa.theme', 'sepia')
  expect(loadThemeChoice(store)).toBe('system')
})
