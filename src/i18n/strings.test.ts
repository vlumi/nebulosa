import { en, ja, loadLang, saveLang, STRINGS } from './strings'

function shape(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return [`${path}[${value.length}]`]
  if (typeof value === 'object' && value !== null)
    return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k))
  return [`${path}:${typeof value}`]
}

test('both languages have the same keys, the same kinds of values and the same table lengths', () => {
  expect(shape(ja)).toEqual(shape(en))
  expect(Object.keys(STRINGS)).toEqual(['en', 'ja'])
})

test('the language comes from storage, else from the browser, else English', () => {
  const m = new Map<string, string>()
  const store = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } as Storage
  expect(loadLang(store, 'ja-JP')).toBe('ja')
  expect(loadLang(store, 'fi-FI')).toBe('en')
  saveLang('ja', store)
  expect(loadLang(store, 'en-US')).toBe('ja')
})
