import { expect, test, type Page } from '@playwright/test';

const roleRoutes = [
  {
    route: '/fabrika-giris/patron',
    title: 'Patron girişi',
    identifierLabel: 'Giriş anahtarı',
    codeLabel: 'Doğrulama kodu',
  },
  {
    route: '/fabrika-giris/calisan',
    title: 'Çalışan girişi',
    identifierLabel: 'Kullanıcı adı',
    codeLabel: 'Giriş kodu',
  },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test.describe('Fabrika patron ve çalışan erişim yüzeyleri', () => {
  test('hesap türleri klavye ile seçilebilir ve ekrana sığar', async ({ page }) => {
    await page.goto('/fabrika-giris');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Hesap türünüzü seçin' })
    ).toBeVisible();
    const ownerLink = page.getByRole('link', { name: /Patron girişi/ });
    const employeeLink = page.getByRole('link', { name: /Çalışan girişi/ });
    await expect(ownerLink).toHaveAttribute('href', '/fabrika-giris/patron');
    await expect(employeeLink).toHaveAttribute('href', '/fabrika-giris/calisan');

    await ownerLink.focus();
    await expect(ownerLink).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(employeeLink).toBeFocused();
    await expectNoHorizontalOverflow(page);
  });

  for (const role of roleRoutes) {
    test(`${role.title} formu erişilebilir, responsive ve doğru rotadadır`, async ({
      page,
    }) => {
      await page.goto(role.route);

      await expect(page).toHaveURL(new RegExp(`${role.route}$`));
      await expect(
        page.getByRole('heading', { level: 1, name: role.title })
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Hesap türüne dön' })
      ).toHaveAttribute('href', '/fabrika-giris');

      const identifier = page.getByLabel(role.identifierLabel);
      const code = page.getByLabel(role.codeLabel);
      const submit = page.getByRole('button', { name: 'Güvenli giriş yap' });
      await expect(identifier).toHaveAttribute('required', '');
      await expect(code).toHaveAttribute('required', '');
      await expect(submit).toBeEnabled();

      await identifier.focus();
      await expect(identifier).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(code).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(submit).toBeFocused();
      await expectNoHorizontalOverflow(page);
    });
  }
});
