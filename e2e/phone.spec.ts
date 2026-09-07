import { expect, open, sheet, test } from './app'

test('on a phone the map comes first: no sheet open, choosing closes the sheet, the page never scrolls', async ({
  page,
}) => {
  await open(page)
  await expect(sheet(page, 'Constellation')).toHaveCount(0)
  await page.getByRole('button', { name: /^Satellites/ }).tap()
  const satellites = sheet(page, 'Constellation')
  await expect(satellites).toBeVisible()
  await satellites.getByRole('button', { name: /^STRIX-9 / }).tap()
  await expect(satellites).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Satellites STRIX-9/ })).toBeVisible()
  const scrolls = await page.evaluate(() => {
    const root = document.scrollingElement!
    return root.scrollHeight > root.clientHeight || root.scrollWidth > root.clientWidth
  })
  expect(scrolls).toBe(false)
})
