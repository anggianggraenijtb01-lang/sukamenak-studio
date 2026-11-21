import { expect, test } from '@playwright/test';
import { E2E_ADMIN } from './env';

/**
 * The plan's acceptance number for the admin: switching the production default model has to be doable
 * from the panel in under two minutes. The end-to-end database carries a second active mock model per
 * capability for exactly this, because the button only appears when another candidate exists.
 */
test('an admin switches the default model in under two minutes', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('nama@email.com').fill(E2E_ADMIN.email);
  await page.getByPlaceholder('Masukkan kata sandi').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: /Masuk ke Studio/ }).click();
  await expect(page).toHaveURL(/\/(admin|creator)\//, { timeout: 30_000 });

  await page.goto('/admin/models');
  const alternate = page.locator('[data-testid^="model-card-"]').filter({ hasText: '(cadangan)' }).first();
  await expect(alternate).toBeVisible({ timeout: 30_000 });
  const alternateName = (await alternate.locator('h3').innerText()).trim();

  const startedAt = Date.now();
  await alternate.getByRole('button', { name: 'Jadikan Default' }).click();
  await expect(page.getByText(/sekarang menjadi default/)).toBeVisible({ timeout: 120_000 });
  const elapsedMs = Date.now() - startedAt;

  // Reported, not just asserted: the number is the point of the test.
  test.info().annotations.push({ type: 'switch-default-ms', description: String(elapsedMs) });
  expect(elapsedMs).toBeLessThan(120_000);

  // Persisted, not just shown in a toast.
  await page.reload();
  const reloaded = page.locator('[data-testid^="model-card-"]').filter({ hasText: alternateName }).first();
  await expect(reloaded.getByText('DEFAULT AKTIF')).toBeVisible({ timeout: 30_000 });
});
