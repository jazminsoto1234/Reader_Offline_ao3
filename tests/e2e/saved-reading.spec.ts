import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`recupera el PDF, capítulo y párrafo tras recargar y reabrir a ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.pdf');
    await expect(page.locator('article')).toContainText('A story about returning home');
    await page.getByLabel('Chapter index').selectOption({ label: 'Chapter 1: The arrival' });
    const paragraph = page.locator('article p').filter({ hasText: /number 10\./ });
    await paragraph.evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top - 80));
    const before = await paragraph.evaluate(node => node.getBoundingClientRect().top);
    // Recarga inmediata: pagehide debe guardar incluso antes de vencer el debounce.
    await page.reload();
    await expect(page.getByLabel('Chapter index').locator('option:checked')).toHaveText('Chapter 1: The arrival');
    await expect(paragraph).toBeInViewport();
    expect(Math.abs(await paragraph.evaluate(node => node.getBoundingClientRect().top) - before)).toBeLessThan(3);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lector.reading-progress.v1')!));
    expect(saved.path).toBeTruthy();
    // Un archivo inválido no reemplaza ni el PDF guardado ni su progreso.
    await page.locator('input[type=file]').setInputFiles('tests/fixtures/corrupto.pdf');
    await expect(page.getByRole('alert')).toBeVisible();
    await page.reload();
    await expect(paragraph).toBeInViewport();
    await page.close();
    const reopened = await context.newPage();
    await reopened.setViewportSize({ width, height: 844 });
    await reopened.goto('/');
    await expect(reopened.locator('article')).toContainText('The house waited');
    const restoredParagraph = reopened.locator('article p').filter({ hasText: /number 10\./ });
    await expect(restoredParagraph).toBeInViewport();
    expect(Math.abs(await restoredParagraph.evaluate(node => node.getBoundingClientRect().top) - before)).toBeLessThan(3);
    await reopened.getByLabel('Chapter index').selectOption({ label: 'Chapter 2: The letter' });
    await expect(reopened.locator('article')).toContainText('There was a letter');
    await reopened.reload();
    await expect(reopened.locator('article')).toContainText('There was a letter');
    await expect(reopened.getByRole('navigation', { name: 'Top navigation' })).toContainText('2 / 2');
    await reopened.getByRole('button', { name: 'Close work' }).click();
    await expect.poll(() => reopened.evaluate(async () => {
      const request = indexedDB.open('lector-reading', 1);
      return new Promise(resolve => { request.onsuccess = () => {
        const db = request.result;
        const get = db.transaction('files').objectStore('files').get('current');
        get.onsuccess = () => { resolve(get.result === undefined); db.close(); };
      }; });
    })).toBe(true);
    await reopened.reload();
    await expect(reopened.getByRole('button', { name: 'Open EPUB or PDF', exact: true })).toBeVisible();
  });
}

test('el último archivo válido se restaura al cambiar entre PDF y EPUB', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.pdf');
  await expect(page.locator('article')).toContainText('A story about returning home');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/continuo.pdf');
  await expect(page.locator('article')).toContainText('A single page');
  await page.reload();
  await expect(page.locator('article')).toContainText('A single page');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo-epub3.epub');
  await expect(page.getByRole('heading', { name: 'La casa de las mareas', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'La casa de las mareas', exact: true })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/continuo.pdf');
  await expect(page.locator('article')).toContainText('A single page');
  await page.reload();
  await expect(page.locator('article')).toContainText('A single page');
});

for (const version of [2, 3]) for (const width of [1280, 390]) {
  test(`EPUB ${version}: restaura capítulo y párrafo al recargar y reabrir a ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles(`tests/fixtures/demo-epub${version}.epub`);
    await expect(page.locator('article')).toContainText('La casa esperaba junto al mar');
    await page.getByLabel('Chapter index').selectOption({ label: 'Capítulo 1: La llegada' });
    const paragraph = page.locator('article p').filter({ hasText: /^La tarde 10 / });
    await paragraph.evaluate(node => window.scrollBy(0, node.getBoundingClientRect().top - 80));
    const before = await paragraph.evaluate(node => node.getBoundingClientRect().top);
    await page.reload();
    await expect(paragraph).toBeInViewport();
    expect(Math.abs(await paragraph.evaluate(node => node.getBoundingClientRect().top) - before)).toBeLessThan(3);
    // Un EPUB inválido no reemplaza la copia guardada.
    await page.locator('input[type=file]').setInputFiles('tests/fixtures/opf-invalido.epub');
    await expect(page.getByRole('alert')).toBeVisible();
    await page.reload();
    await expect(paragraph).toBeInViewport();
    await page.close();
    const reopened = await context.newPage();
    await reopened.setViewportSize({ width, height: 844 });
    await reopened.goto('/');
    const restoredParagraph = reopened.locator('article p').filter({ hasText: /^La tarde 10 / });
    await expect(restoredParagraph).toBeInViewport();
    expect(Math.abs(await restoredParagraph.evaluate(node => node.getBoundingClientRect().top) - before)).toBeLessThan(3);
    await reopened.getByLabel('Chapter index').selectOption({ label: 'Capítulo 2: Las cartas' });
    await expect(reopened.locator('article')).toContainText('Sobre la mesa había una carta');
    await reopened.reload();
    await expect(reopened.getByLabel('Chapter index').locator('option:checked')).toHaveText('Capítulo 2: Las cartas');
    await expect(reopened.locator('article')).toContainText('Sobre la mesa había una carta');
    expect(await reopened.evaluate(() => (window as any).PWNED)).toBeUndefined();
    await expect(reopened.locator('article script, article iframe, article img')).toHaveCount(0);
    await reopened.getByRole('button', { name: 'Close work' }).click();
    await expect.poll(() => reopened.evaluate(() => localStorage.getItem('lector.reading-progress.v1'))).toBeNull();
    await reopened.reload();
    await expect(reopened.getByRole('button', { name: 'Open EPUB or PDF', exact: true })).toBeVisible();
  });
}

test('recupera un PDF guardado con la clave de progreso anterior', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.pdf');
  await expect(page.locator('article')).toContainText('A story about returning home');
  await page.getByLabel('Chapter index').selectOption({ label: 'Chapter 2: The letter' });
  // Simula el almacenamiento de la versión anterior antes de iniciar React.
  await page.addInitScript(() => {
    const progress = localStorage.getItem('lector.reading-progress.v1');
    if (progress) {
      localStorage.setItem('lector.pdf-progress.v1', progress);
      localStorage.removeItem('lector.reading-progress.v1');
    }
  });
  await page.reload();
  await expect(page.getByLabel('Chapter index').locator('option:checked')).toHaveText('Chapter 2: The letter');
  expect(await page.evaluate(() => localStorage.getItem('lector.pdf-progress.v1'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lector.reading-progress.v1')!).path)).toBeTruthy();
});

test('si el navegador bloquea IndexedDB, permite leer y avisa que no se guardará', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { throw new Error('Almacenamiento bloqueado'); } }); });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('could not restore');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.pdf');
  await expect(page.locator('article')).toContainText('A story about returning home');
  await expect(page.getByText('This file could not be saved', { exact: false })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Top navigation' }).getByRole('button', { name: 'Next' })).toBeEnabled();
  await page.evaluate(() => { (window as any).inMemoryDocument = true; });
  await page.getByRole('navigation', { name: 'Top navigation' }).getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('article')).toContainText('The house waited');
  expect(await page.evaluate(() => (window as any).inMemoryDocument)).toBe(true);
});
