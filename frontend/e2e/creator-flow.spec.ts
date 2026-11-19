import { expect, test, type Page } from '@playwright/test';

/**
 * The creator journey the plan calls the main flow: register -> generate -> download.
 * `banner-pengumuman-layanan-publik` supports both modes, so the run needs no reference photo.
 */
const TEMPLATE = 'banner-pengumuman-layanan-publik';

/**
 * Every template asks for its own slot values (title, body, contact — the fields the poster prints), so
 * the spec must not hard-code one template's labels. It walks the visible slot fields and fills whatever
 * is empty, honouring each field's own maxlength.
 */
async function fillTemplateSlots(page: Page): Promise<void> {
  const fields = page.locator('[data-field^="slot_values."]');
  const total = await fields.count();

  for (let i = 0; i < total; i += 1) {
    const field = fields.nth(i);
    if (!(await field.isVisible()) || (await field.isDisabled())) continue;

    const tag = await field.evaluate((el) => el.tagName.toLowerCase());
    if (tag === 'select') {
      if (!(await field.inputValue())) {
        const firstValue = await field.evaluate((el) => {
          const options = Array.from((el as HTMLSelectElement).options).filter((o) => o.value !== '');
          return options[0]?.value ?? '';
        });
        if (firstValue) await field.selectOption(firstValue);
      }
      continue;
    }

    if (await field.inputValue()) continue;

    const placeholder = (await field.getAttribute('placeholder')) ?? '';
    if (placeholder.includes('#2563EB')) {
      await field.fill('#2563EB');
      continue;
    }

    const max = Number((await field.getAttribute('maxlength')) ?? 0);
    const text = 'Layanan posyandu desa Sukamenak, gratis untuk warga, setiap Rabu pagi di balai desa.';
    await field.fill(max > 0 ? text.slice(0, max) : text);
  }
}

test('a new creator registers, generates a poster and downloads it', async ({ page }) => {
  const email = `e2e-${Date.now()}@test.local`;

  await page.goto('/register');
  await page.getByPlaceholder('Nama Anda').fill('E2E Kreator');
  await page.getByPlaceholder('nama@email.com').fill(email);
  await page.getByPlaceholder('Minimal 8 karakter').fill('E2e-kreator-pass-1');
  await page.getByRole('button', { name: 'Daftar Sekarang' }).click();

  await expect(page).toHaveURL(/\/creator\//, { timeout: 30_000 });

  await page.goto(`/creator/studio?template=${TEMPLATE}&mode=t2i`);
  await expect(page.locator('[data-field^="slot_values."]').first()).toBeVisible({ timeout: 30_000 });
  // The deep link has to win over the template default (i2i); without that the form demands a photo and
  // the submit never happens. Covered by a unit test too, checked here end to end.
  await expect(page.getByRole('radio', { name: /Teks ke Gambar/ })).toHaveAttribute('aria-checked', 'true');
  await fillTemplateSlots(page);
  await page.locator('#studio-remarks').fill('Pengumuman layanan posyandu, suasana cerah, warna biru muda.');

  const submit = page.getByRole('button', { name: 'Buat Poster Instan' });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();

  const download = page.getByRole('button', { name: /Unduh Gambar HD/ });
  await expect(download).toBeEnabled({ timeout: 120_000 });

  const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
  expect(file.suggestedFilename()).toMatch(/\.(png|jpe?g|webp)$/i);
  expect(await file.path()).toBeTruthy();
});
