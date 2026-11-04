# Registro de validación — Entrega 1

> Registro histórico. La entrega 2 sustituye las notas plegables por notas abiertas más estrechas y añade PDF y preferencias. Estado actual: [validation-e2.md](validation-e2.md).

Fecha: 4 de noviembre de 2026 (America/Lima).

**Estado: implementación preliminar funcional; pendiente certificación con EPUB reales AO3 y Android físico.** No se consideran aprobados esos puntos del plan original.

## Entorno y versiones

- Windows, Node.js 26.13.0, npm 11.20.0.
- Chrome instalado 156.0.8078.80, controlado con Playwright 1.56.1.
- React 19.2.0, TypeScript 5.9.3, Vite 7.3.7, Vitest 4.1.12.
- zip.js 2.8.10 y DOMPurify 3.4.17. Versiones fijadas en package-lock.json.
- Viewports 390 × 844 y 1440 × 1000; son ventanas del Chrome de escritorio, no dispositivos Android.

## Resultados reproducidos

| Comprobación | Resultado |
| --- | --- |
| `npm.cmd run typecheck` | Correcto |
| `npm.cmd run build` | Correcto; salida estática en dist/ |
| `npm.cmd test` | 14 pruebas aprobadas, 2 archivos |
| `npm.cmd run test:e2e` | 2 recorridos aprobados contra el build con CSP; 8,9 s en la última ejecución |
| Auditoría npm tras actualizar versiones vulnerables | 0 vulnerabilidades reportadas al instalar las versiones finales |
| Capturas escritorio y móvil | Generadas y revisadas visualmente; se corrigió el encabezado de capítulo duplicado y la selección inicial del índice |

La ejecución de Vitest actualizada encontró un EPERM al renombrar una caché temporal dentro del aislamiento de Windows; la repetición fuera del aislamiento aprobó. La primera ejecución E2E dejó ocupado un puerto; se terminó y la configuración final usa 4181. No fueron errores de importación EPUB. Las pruebas finales son las de las versiones actualizadas.

## Cobertura automatizada

**Parser y seguridad:** EPUB 2/NCX, EPUB 3/nav, orden de spine, linear=no, rutas con espacios codificados, TOC con dos destinos en el mismo XHTML, fallback sin TOC, metadatos ausentes, referencia faltante, OPF inválido, ZIP sin estructura EPUB, maquetación fija, rechazo de rutas fuera del contenedor, eliminación de scripts/eventos/CSS/recursos activos, prefijado de IDs y enlaces externos seguros. Se conservan cursivas, párrafos y notas. Una prueba adicional sigue la estructura publicada del exportador AO3 para notas iniciales/finales, dejando el resumen y el fic fuera de los bloques plegables.

**Cancelación:** pruebas del controlador con worker instrumentado verifican que abortar y agotar los 20 s llaman a terminate y rechazan la operación; un archivo vacío no crea worker. No equivalen a un benchmark de cancelación con libros extensos en Android.

**Navegador:** selección local real mediante input file, ejecución del worker de producción, navegación por índice y botones, foco en fragmentos/encabezados, notas entre secciones y retorno al texto, plegado de notas, extremos deshabilitados, archivo de reemplazo inválido conservando sesión anterior, pérdida de sesión al recargar, salto abajo/arriba y recuperación después de vacío/sección excesiva/maquetación fija. No hubo solicitudes externas del documento en el recorrido monitorizado; localStorage y sessionStorage permanecieron vacíos y el script hostil no se ejecutó.

**Móvil emulado:** lectura sin desbordamiento horizontal a 390 px; capturas completas en test-results/lector-movil.png y test-results/lector-escritorio.png. La revisión confirma índice arriba, ausencia de sidebar, controles en ambos extremos y notas con fondo gris y borde propio. No se declara validada la accesibilidad completa: faltan lector de pantalla y zoom real 200 %.

## Fixtures

Todos se generan con texto sintético propio mediante `npm.cmd run fixtures`. No se distribuyen obras de terceros.

| Archivo en tests/fixtures/ | Expectativa |
| --- | --- |
| demo-epub3.epub | Dos secciones lineales, tres destinos TOC, notas auxiliares, HTML hostil sin ejecutar |
| demo-epub2.epub | Dos secciones con NCX |
| ao3-estructura.epub | Notas con estructura de metadatos del exportador AO3 |
| sin-indice.epub | Índice generado a partir del spine |
| sin-metadatos.epub | Título y autoría genéricos |
| referencia-ausente.epub | Error estructural |
| maquetacion-fija.epub | Formato no soportado explícito |
| opf-invalido.epub | Error XML |
| no-es-epub.epub | Rechazo de ZIP ajeno a EPUB |
| vacio.epub | Error recuperable antes de crear worker |
| seccion-excesiva.epub | Rechazo por entrada textual mayor de 2 MiB |

El último fixture ocupa aproximadamente 5 kB comprimido y prueba el presupuesto de extracción declarado sin exigir un archivo de estrés grande. No se han manipulado cabeceras ZIP para una prueba adversarial de tamaños declarados falsos: el contador del stream existe, pero esa variante queda pendiente de fixture específico.

## Rendimiento y límites de esta evidencia

Build final aproximado: JavaScript principal 236 kB (76 kB gzip), importador diferido 4,7 kB, worker 123 kB sin gzip y CSS 5,4 kB. El sanitizador está en el principal porque el lector comparte utilidades de navegación con el módulo de saneado. El ZIP se carga al importar. No se afirma un presupuesto de memoria ni tiempo hasta primera lectura en dispositivo móvil; los tiempos de las pruebas incluyen automatización y no son un benchmark de producto.

Los límites de 20/32/2 MiB, 1000 entradas y 300 secciones son preventivos y provisionales. La extracción se realiza en worker, pero el saneado y el parsing XML ocurren en el hilo principal. Se mantienen las secciones saneadas en memoria y solo se monta una. Un XHTML no se divide automáticamente en capítulos.

## Pendientes priorizados

1. Leer privadamente un EPUB AO3 corto y otro multicapítulo, cotejando las notas y los enlaces con el original. El PDF existente no cubre esta validación.
2. Probar apertura, cancelación, foco/teclado, zoom 200 %, lector de pantalla y consumo/fluidez cerca del límite; repetir en Android físico identificado.
3. Validar traducción real de Chrome al cargar y cambiar de sección, sin prometer que se conserve ni recurrir a recargas que pierdan el archivo.
4. Ampliar fixtures: archivo único, DRM, ZIP con tamaños falsos, exceso de entradas/total/secciones y traducciones adicionales de las etiquetas de notas AO3.
5. E2: integrar PDF y preferencias de lectura según el alcance acordado; conservar el laboratorio PDF como referencia experimental.
