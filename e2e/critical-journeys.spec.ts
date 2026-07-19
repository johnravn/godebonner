import { expect, test } from '@playwright/test'

test.describe('critical journeys', () => {
  test('admin can sign in and open register coupon window', async ({ page }) => {
    await page.goto('/?open=login')
    await page.getByRole('button', { name: /^Start$/i }).click()
    await page.keyboard.press('Escape')

    await page.locator('#signin-email').click()
    await page.keyboard.type('admin@test.local', { delay: 20 })
    await page.locator('#signin-password').click()
    await page.keyboard.type('password123', { delay: 20 })
    await page.getByRole('button', { name: /^Sign in$/ }).click()

    await expect(
      page.getByText(/Du er logget inn som administrator/i),
    ).toBeVisible({ timeout: 30_000 })

    await expect(
      page.getByRole('button', { name: /Kontrollpanel|Registrer kupong/i }).first(),
    ).toBeVisible({ timeout: 20_000 })

    await page.goto('/?open=register')
    await expect(page.locator('#register-coupon-search')).toBeVisible({
      timeout: 20_000,
    })
    await page.locator('#register-coupon-search').click()
    await page.keyboard.type('Paid', { delay: 30 })
    await page.getByRole('button', { name: /^Søk$/ }).click()
    await expect(page.getByText(/Paid Member/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('non-admin stays without admin tools after login', async ({ page }) => {
    await page.goto('/?open=login')
    await page.locator('#signin-email').click()
    await page.keyboard.type('member@test.local', { delay: 20 })
    await page.locator('#signin-password').click()
    await page.keyboard.type('password123', { delay: 20 })
    await page.getByRole('button', { name: /^Sign in$/ }).click()

    await expect(page.getByText(/venter på godkjenning/i)).toBeVisible({
      timeout: 20_000,
    })
  })

  test('live meny window loads seeded menu', async ({ page }) => {
    await page.goto('/?open=meny')
    await expect(page.getByText(/Test meny|Kaffe|Meny/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('public coupon lookup for seeded paid and unknown phones', async ({
    page,
  }) => {
    await page.goto('/?open=coupons')
    // Force a client interaction before using the React95 form.
    await page.getByRole('button', { name: /^Start$/i }).click()
    await page.keyboard.press('Escape')

    await expect(
      page.locator('form').filter({ has: page.locator('#phone') }),
    ).toBeVisible()
    const phone = page.getByRole('textbox', { name: /telefonnummer/i })

    await phone.click()
    await page.keyboard.type('91234567', { delay: 30 })
    await expect(phone).toHaveValue('91234567')
    await phone.press('Enter')

    await expect(page.getByText(/Hei, Paid!/i)).toBeVisible({ timeout: 15_000 })

    await phone.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('91111111', { delay: 30 })
    await phone.press('Enter')
    await expect(page.getByText(/fant ingen medlem/i)).toBeVisible({
      timeout: 15_000,
    })
  })
})
