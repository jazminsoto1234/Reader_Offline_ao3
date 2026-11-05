import { test, expect } from '@playwright/test';

test('cambiar de capítulo renueva el documento para el traductor y conserva el destino', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo-epub3.epub');
  await expect(page.locator('article')).toContainText('La casa esperaba junto al mar');
  const markDocument = () => page.evaluate(() => { (window as any).previousChapterDocument = true; });
  const expectNewDocument = async () => {
    expect(await page.evaluate(() => (window as any).previousChapterDocument)).toBeUndefined();
  };
  await markDocument();
  // Los destinos dentro del mismo capítulo conservan el documento y el foco.
  await page.getByLabel('Chapter index').selectOption('1');
  await expect(page.locator('article h3').filter({ hasText: 'Una segunda escena' })).toBeFocused();
  expect(await page.evaluate(() => (window as any).previousChapterDocument)).toBe(true);
  await page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('article')).toContainText('Sobre la mesa había una carta');
  await expectNewDocument();
  // La recarga recupera el texto ya procesado, sin volver a extraer el EPUB.
  expect(page.workers()).toHaveLength(0);
  await markDocument();
  await page.getByRole('navigation', { name: 'Top navigation' }).getByRole('button', { name: 'Previous' }).click();
  await expect(page.locator('article')).toContainText('La casa esperaba junto al mar');
  await expectNewDocument();
  await markDocument();
  await page.getByLabel('Chapter index').selectOption({ label: 'Capítulo 2: Las cartas' });
  await expect(page.locator('article')).toContainText('Sobre la mesa había una carta');
  await expectNewDocument();
  await markDocument();
  await page.getByLabel('Chapter index').selectOption('1');
  await expect(page.locator('article h3').filter({ hasText: 'Una segunda escena' })).toBeFocused();
  await expectNewDocument();
});
test('importación, navegación, notas, reemplazo y privacidad', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4181/')) external.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Local Reader · EPUB & PDF');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo-epub3.epub');
  await expect(page.getByRole('heading', { name: 'La casa de las mareas', exact: true })).toBeVisible();
  await expect(page.locator('article .author-notes')).toHaveCount(2);
  await expect(page.locator('article details, article summary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ocultar notas' })).toHaveCount(0);
  expect(await page.locator('article').evaluate(article => article.querySelector('.author-notes')!.getBoundingClientRect().width < article.getBoundingClientRect().width)).toBe(true);
  await page.getByLabel('Chapter index').selectOption('1');
  await expect(page.locator('article h3').filter({ hasText: 'Una segunda escena' })).toBeFocused();
  await page.getByRole('link', { name: 'Leer nota al pie' }).click();
  await expect(page.getByText('Nota al pie de prueba.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al texto' }).click();
  await page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Capítulo 2: Las cartas', exact: true }).first()).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/no-es-epub.epub');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'La casa de las mareas', exact: true })).toBeVisible();
  expect(await page.evaluate(() => ({ keys: Object.keys(localStorage), session: sessionStorage.length, pwned: (window as any).PWNED }))).toEqual({ keys: ['lector.reading-progress.v1'], session: 0, pwned: undefined });
  expect(external).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Capítulo 2: Las cartas', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).PWNED)).toBeUndefined();
});
test('móvil, límites, recuperación y captura', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const name of ['vacio', 'seccion-excesiva', 'maquetacion-fija']) {
    await page.locator('input[type=file]').setInputFiles(`tests/fixtures/${name}.epub`);
    await expect(page.getByRole('alert')).toBeVisible();
  }
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo-epub2.epub');
  await expect(page.getByRole('heading', { name: 'La casa de las mareas', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Go to bottom' }).click();
  await expect(page.getByRole('button', { name: 'Back to top' })).toBeInViewport();
  await page.getByRole('button', { name: 'Back to top' }).click();
  await page.screenshot({ path: 'test-results/lector-movil.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/lector-escritorio.png', fullPage: true });
});
