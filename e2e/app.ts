import { expect, test as base, type Page } from '@playwright/test'
import { strix1, strix9 } from '../src/test/fixtures'

export const EPOCH = Date.parse(`${strix1.EPOCH}Z`)

/** Requests the basemap makes for tiles, glyphs and sprites are answered empty: the style still loads, nothing is fetched from afar. */
const EMPTY_ASSETS = /\/(planet|natural_earth|fonts|sprites)\//

/** The app with a fixed clock, the fixture's two satellites, and any page error made into a test failure. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, provide) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await provide(errors)
    expect(errors).toEqual([])
  },
  page: async ({ page }, provide) => {
    await page.clock.setFixedTime(EPOCH)
    await page.route('**/data/elements.json', (route) => route.fulfill({ json: [strix1, strix9] }))
    await page.route(EMPTY_ASSETS, (route) => route.fulfill({ status: 204 }))
    await provide(page)
  },
})

export { expect }

export async function open(page: Page, path = '/') {
  await page.goto(path)
  await expect(page.getByRole('button', { name: /^Satellites/ })).toBeVisible()
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()
}

export const sheet = (page: Page, name: string) => page.getByRole('complementary', { name })
