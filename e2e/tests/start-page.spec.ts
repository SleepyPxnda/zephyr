import { expect, test } from '@playwright/test'

test.describe('start page', () => {
  test('renders the empty start page in the light Zephyr theme', async ({ page }) => {
    const external: string[] = []
    page.on('request', (r) => {
      if (!r.url().startsWith('http://localhost')) external.push(r.url())
    })

    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')

    const wordmark = page.getByTestId('wordmark')
    await expect(wordmark).toHaveText('zephyr')
    await expect(wordmark).toHaveCSS('font-family', /Nunito/)
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(248, 247, 252)')
    await expect(page.locator('body')).toHaveCSS('font-family', /Inter/)
    expect(await page.evaluate(() => document.fonts.check('16px "Nunito Variable"'))).toBe(true)
    // Fonts are self-hosted: no request may leave the app's origin.
    expect(external).toEqual([])
  })

  test('switches to the dark theme with the system preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(28, 27, 38)')
  })
})
