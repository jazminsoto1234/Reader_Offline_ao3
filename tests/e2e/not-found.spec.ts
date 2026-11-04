import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`una ruta inexistente muestra el 404 y permite volver al inicio a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const response = await page.goto('/missing/deep-page?example=1');
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle('Page not found · Local Reader');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'This page is missing.' })).toBeVisible();
    const home = page.getByRole('link', { name: 'Back to home' });
    await expect(home).toHaveAttribute('href', '/');
    await expect(home).toBeInViewport();
    expect(await page.locator('.site-header').evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(153, 0, 0)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/404-${width}.png`, fullPage: true });
    await home.click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: 'Open EPUB or PDF', exact: true })).toBeVisible();
    const head = await page.request.head('/another-missing-page');
    expect(head.status()).toBe(404);
    expect((await head.body()).length).toBe(0);
  });
}

test('volver desde el 404 recupera el EPUB guardado y su capítulo', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo-epub3.epub');
  await expect(page.locator('article')).toContainText('La casa esperaba junto al mar');
  await page.getByLabel('Chapter index').selectOption({ label: 'Capítulo 2: Las cartas' });
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page.getByLabel('Chapter index').locator('option:checked')).toHaveText('Capítulo 2: Las cartas');
  await expect(page.locator('article')).toContainText('Sobre la mesa había una carta');
});
