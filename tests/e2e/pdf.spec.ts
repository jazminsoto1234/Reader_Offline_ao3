import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

test('Preface y Afterword no aparecen en índice, navegación ni contenido', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/editorial.epub');
  await expect(page.getByRole('heading', { name: 'Capítulo 1: La llegada', exact: true })).toBeVisible();
  const labels = await page.getByLabel('Chapter index').locator('option').allTextContents();
  expect(labels.some(label => /^(Preface|Afterword)$/i.test(label.trim()))).toBe(false);
  const navigation = page.getByRole('navigation', { name: 'Top navigation' });
  await expect(navigation).toContainText('1 / 2');
  await expect(navigation.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await navigation.getByRole('button', { name: 'Next' }).click();
  await expect(navigation).toContainText('2 / 2');
  await expect(navigation.getByRole('button', { name: 'Next' })).toBeDisabled();
  await expect(page.locator('article')).not.toContainText('Hidden');
});

test('los avisos flotan, desaparecen a los tres segundos y no vuelven al cambiar capítulo', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.pdf');
  const toast = page.getByRole('status', { name: 'About this file' });
  await expect(toast).toBeVisible();
  expect(await toast.evaluate(node => getComputedStyle(node).position)).toBe('fixed');
  expect(await toast.evaluate(node => node.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await page.clock.fastForward(3100);
  await expect(toast).toHaveCount(0);
  await page.getByLabel('Chapter index').selectOption({ label: 'Chapter 1: The arrival' });
  await expect(toast).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.pdf');
  await expect(toast).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss notice' }).click();
  await expect(toast).toHaveCount(0);
});

test('PDF textual: capítulos, notas estrechas, énfasis y recursos locales', async ({ page }) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4181/')) external.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.pdf');
  await expect(page.getByRole('heading', { name: 'The house by the sea', exact: true })).toBeVisible();
  await page.getByLabel('Chapter index').selectOption({ label: 'Chapter 1: The arrival' });
  await expect(page.locator('article em')).toContainText('She had come home');
  await expect(page.locator('article .author-notes')).toHaveCount(1);
  await expect(page.locator('article .author-notes')).not.toContainText('The house waited');
  await expect(page.locator('article')).toContainText('<script>window.PDF_PWNED=true</script>');
  expect(await page.evaluate(() => (window as any).PDF_PWNED)).toBeUndefined();
  await page.getByRole('navigation', { name: 'Bottom navigation' }).getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('article .author-notes')).toContainText('final author note');
  expect(external).toEqual([]); expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/pdf-notas-escritorio.png', fullPage: true });
});

test('ajustes y EPUB persisten y la ayuda de traducción no aparece', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo-epub3.epub');
  await page.getByRole('button', { name: 'Reading settings' }).click();
  await page.getByLabel('Font size').selectOption('20');
  await page.getByLabel('Line spacing').selectOption('wide');
  await page.getByLabel('Text width').selectOption('narrow');
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  expect(await page.locator('.app-shell').evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(32, 32, 32)');
  await page.screenshot({ path: 'test-results/tema-oscuro-movil.png', fullPage: true });
  await page.getByLabel('Theme', { exact: true }).selectOption('sepia');
  expect(await page.locator('article').evaluate(node => ({ size: getComputedStyle(node).fontSize, line: getComputedStyle(node).lineHeight }))).toEqual({ size: '20px', line: '40px' });
  await expect(page.getByRole('button', { name: 'Cómo traducir' })).toHaveCount(0);
  await expect(page.locator('#ayuda-traduccion')).toHaveCount(0);
  await expect(page.locator('article')).toHaveAttribute('lang', 'es');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/ajustes-movil.png', fullPage: true });
  const saved = await page.evaluate(() => ({ ...localStorage }));
  expect(saved['lector.preferences.v1']).toBe(JSON.stringify({ size: '20', spacing: 'wide', width: 'narrow', theme: 'sepia' }));
  expect(saved['lector.reading-progress.v1']).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'La casa de las mareas', exact: true })).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'sepia');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/continuo.pdf');
  await expect(page.getByRole('heading', { name: 'Continuous reading', level: 1, exact: true })).toBeVisible();
  expect(await page.locator('article').evaluate(node => getComputedStyle(node).fontSize)).toBe('20px');
});

test('PDF sin texto y corrupto son recuperables; cancelar conserva la sesión', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo-epub3.epub');
  await expect(page.getByRole('heading', { name: 'La casa de las mareas', exact: true })).toBeVisible();
  for (const filename of ['sin-texto.pdf', 'corrupto.pdf']) {
    await page.locator('input[type=file]').setInputFiles(`tests/fixtures/${filename}`);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'La casa de las mareas', exact: true })).toBeVisible();
  }
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/pdf.worker.min-*.mjs', async route => { await gate; await route.continue().catch(() => {}); });
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/demo.pdf');
  await page.getByRole('button', { name: 'Cancel import' }).click();
  release();
  await page.unroute('**/pdf.worker.min-*.mjs');
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'La casa de las mareas', exact: true })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/continuo.pdf');
  await expect(page.getByRole('heading', { name: 'Continuous reading', level: 1, exact: true })).toBeVisible();
});

test('muestra PDF privada de AO3 disponible en el proyecto', async ({ page }) => {
  test.skip(!existsSync('validacion/A_stubborn_affliction_of.pdf'), 'Muestra privada no disponible');
  test.setTimeout(60000);
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4181/')) external.push(request.url()); });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('validacion/A_stubborn_affliction_of.pdf');
  await expect(page.getByRole('button', { name: 'Close work' })).toBeVisible({ timeout: 45000 });
  await expect(page.locator('article')).not.toContainText('Enlace de la página');
  const labels = await page.getByLabel('Chapter index').locator('option').allTextContents();
  expect(labels.some(label => /Chapter 1/i.test(label))).toBe(true);
  expect(labels.some(label => /Chapter 2/i.test(label))).toBe(true);
  await page.getByLabel('Chapter index').selectOption({ label: labels.find(label => /Chapter 1/i.test(label))! });
  const firstStoryParagraph = page.locator('article p').filter({ hasText: /^The common room/ }).first();
  await expect(firstStoryParagraph).toBeVisible();
  expect(await firstStoryParagraph.evaluate(node => node.closest('.author-notes') === null)).toBe(true);
  await expect(page.locator('article .scene-separator').first()).toHaveText('☙❀❧');
  expect(await page.locator('article .scene-separator').first().evaluate(node => getComputedStyle(node).textAlign)).toBe('center');
  await page.getByLabel('Chapter index').selectOption({ label: labels.find(label => /Chapter 2/i.test(label))! });
  await expect(page.locator('article')).not.toBeEmpty();
  const noteRatio = await page.locator('article').evaluate(article => Array.from(article.querySelectorAll('.author-notes')).reduce((sum, note) => sum + (note.textContent?.length || 0), 0) / (article.textContent?.length || 1));
  expect(noteRatio).toBeLessThan(.5);
  expect(external).toEqual([]);
});

test('admite 401 páginas y rechaza más de 10 000 sin perder la sesión', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/401-paginas.pdf');
  await expect(page.getByRole('heading', { name: 'Over four hundred pages', exact: true })).toBeVisible({ timeout: 45000 });
  await expect(page.locator('article')).toContainText('Page 401:');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/10001-paginas.pdf');
  await expect(page.getByRole('alert')).toContainText('10 000');
  await expect(page.getByRole('heading', { name: 'Over four hundred pages', exact: true })).toBeVisible();
});

test('notas de referencia y separador centrado en escritorio y móvil', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/enlace-notas.pdf');
  await expect(page.getByRole('heading', { name: 'Notes boundary regression', exact: true })).toBeVisible();
  const story = page.locator('article p').filter({ hasText: /^The common room/ });
  expect(await story.evaluate(node => node.closest('.author-notes') === null)).toBe(true);
  await expect(page.locator('article .author-notes')).toContainText('See the end');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const centered = await page.locator('article .scene-separator').evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      const text = range.getBoundingClientRect(), article = node.closest('article')!.getBoundingClientRect();
      return Math.abs((text.left + text.right) / 2 - (article.left + article.right) / 2) < 2;
    });
    expect(centered).toBe(true);
    await page.screenshot({ path: `test-results/notas-separador-${width}.png`, fullPage: true });
  }
});

test('datos sin conteo, título unido y notas con more notes fuera del fic', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/titulo-notas.pdf');
  await expect(page.getByRole('heading', { name: 'Work details', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Top navigation' })).toContainText('Work details');
  await page.getByRole('navigation', { name: 'Top navigation' }).getByRole('button', { name: 'Next' }).click();
  const heading = page.getByRole('heading', { name: 'Chapter 1: A title that continues on the following line', exact: true });
  await expect(heading).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Top navigation' })).toContainText('1 / 2');
  await expect(page.locator('article')).not.toContainText('on the following line');
  await expect(page.locator('article .author-notes')).toContainText('A brief author note');
  await expect(page.locator('article .author-notes')).not.toContainText('The fiction');
  const fiction = page.locator('article p').filter({ hasText: /^The fiction/ });
  expect(await fiction.evaluate(node => node.closest('.author-notes') === null)).toBe(true);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.locator('article .author-notes').evaluate(node => ({ note: node.getBoundingClientRect().width, body: node.closest('article')!.getBoundingClientRect().width }));
    expect(geometry.note).toBeLessThan(geometry.body);
    expect(await heading.evaluate(node => node.childElementCount)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/titulo-notas-${width}.png`, fullPage: true });
  }
  await page.getByRole('navigation', { name: 'Top navigation' }).getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('navigation', { name: 'Top navigation' })).toContainText('2 / 2');
  await page.getByRole('button', { name: 'Work details', exact: true }).click();
  await expect(page.locator('article')).toContainText('A synthetic summary');
});
