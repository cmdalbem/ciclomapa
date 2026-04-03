import { test, expect } from '@playwright/test';

test.describe('CicloMapa smoke', () => {
  const basePath = '/?e2e=1';

  test('loads shell and map container', async ({ page }) => {
    await page.goto(basePath);
    await expect(page.getByRole('heading', { name: 'CicloMapa', exact: true })).toBeVisible();
    await expect(page.getByTestId('map-container')).toBeVisible();
  });

  test('opens and closes About modal (Escape)', async ({ page }) => {
    await page.goto(basePath);
    await page.getByRole('button', { name: 'Sobre' }).click();
    const aboutDialog = page.getByRole('dialog', { name: /sobre o ciclomapa/i });
    await expect(aboutDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(aboutDialog).toBeHidden();
  });

  // LayersBar (incl. legend control) mounts only when IS_MOBILE is true at first paint
  // (`matchMedia` in constants.js). Use a narrow viewport for this test only.
  test.describe('mobile layers bar', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('opens and closes Layers legend (Escape)', async ({ page }) => {
      await page.goto(basePath);
      await page.getByRole('button', { name: /abrir legenda do mapa/i }).click();
      const legendDialog = page.getByRole('dialog', { name: /legenda do mapa/i });
      await expect(legendDialog).toBeVisible();
      await page.keyboard.press('Escape');
      // LayersLegendModal stays mounted and only animates opacity; Playwright still treats it as "visible".
      await expect(page.locator('#layers-legend-modal')).toHaveClass(/opacity-0/);
    });
  });

  test('toggles theme', async ({ page }) => {
    await page.goto(basePath);

    await page.getByRole('button', { name: 'Usar tema escuro' }).click();
    await expect(page.locator('body')).toHaveClass(/theme-dark/);

    await page.getByRole('button', { name: 'Usar tema claro' }).click();
    await expect(page.locator('body')).toHaveClass(/theme-light/);
  });

  test('opens directions panel and shows inputs', async ({ page }) => {
    await page.goto(basePath);
    await page.locator('#directionsPanelMobileButton').click();
    await expect(page.locator('#directionsPanel')).toBeVisible();
    await expect(page.getByPlaceholder('Origem')).toBeVisible();
    await expect(page.getByPlaceholder('Destino')).toBeVisible();
  });
});

