import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Connect, Plugin } from 'vite';

function customNotFound(): Plugin {
  const middleware = (load: () => Promise<string>): Connect.NextHandleFunction => (request, response, next) => {
    // Vite transforma el HTML existente después de los hooks del servidor.
    const pathname = request.url?.split('?')[0];
    if (pathname === '/index.html' || pathname === '/404.html') { next(); return; }
    if (request.method !== 'GET' && request.method !== 'HEAD') { next(); return; }
    void load().then(html => {
      response.statusCode = 404;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(request.method === 'HEAD' ? undefined : html);
    }).catch(next);
  };
  return {
    name: 'custom-not-found',
    configureServer(server) {
      return () => server.middlewares.use(middleware(async () => server.transformIndexHtml('/404.html', await readFile(resolve(server.config.root, '404.html'), 'utf8'))));
    },
    configurePreviewServer(server) {
      return () => server.middlewares.use(middleware(() => readFile(resolve(server.config.root, server.config.build.outDir, '404.html'), 'utf8')));
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  build: { rollupOptions: { input: { main: 'index.html', notFound: '404.html' } } },
  plugins: [react(), customNotFound(), {
    name: 'development-csp', apply: 'serve',
    transformIndexHtml: html => html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/, ''),
  }],
  worker: { format: 'es' },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
});
