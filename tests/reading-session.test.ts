import { expect, it } from 'vitest';
import { omitEditorialSections, type ReadingSession } from '../src/domain/reading-session';

const session = (titles: string[]): ReadingSession => ({
  title: 'Work', author: 'Author', language: 'en',
  sections: titles.map((title, index) => ({ id: `${index}`, path: `${index}.xhtml`, title, linear: true, html: `<p>${title}</p>` })),
  toc: titles.map((label, index) => ({ label, path: `${index}.xhtml`, fragment: '', depth: 0 })),
});
it('excluye Preface y Afterword del índice, contenido y conteo sin modificar el original', () => {
  const original = session([' Preface ', 'Chapter 1', 'AFTERWORD', 'Afterworld']);
  const result = omitEditorialSections(original);
  expect(result.sections.map(section => section.title)).toEqual(['Chapter 1']);
  expect(result.toc.map(entry => entry.label)).toEqual(['Chapter 1']);
  expect(original.sections).toHaveLength(4);
});
it('omite marcadores editoriales PDF sin borrar la sección Work details', () => {
  const original = session(['Work details', 'Chapter 1: The preface to a journey']);
  original.toc.push({ label: 'Preface', path: '0.xhtml', fragment: 'page-1', depth: 1 });
  const result = omitEditorialSections(original);
  expect(result.sections).toHaveLength(2);
  expect(result.toc).toHaveLength(2);
});
it('informa si solo existen secciones excluidas', () => {
  expect(() => omitEditorialSections(session(['Preface', 'Afterword']))).toThrow('no reading chapters');
});
