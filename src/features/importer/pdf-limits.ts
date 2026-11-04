export const PDF_LIMITS = {
  file: 100 * 1024 * 1024,
  pages: 10_000,
  chars: 50_000_000,
  pageChars: 100_000,
  items: 20_000,
  operators: 100_000,
  chapters: 10_000,
  timeout: 30 * 60_000,
};
export function validatePdfPageCount(pages: number) {
  if (!Number.isInteger(pages) || pages < 1 || pages > PDF_LIMITS.pages) throw new Error('The PDF must have between 1 and 10 000 pages.');
}
