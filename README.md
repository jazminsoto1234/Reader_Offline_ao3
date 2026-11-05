# Lector local — Entrega 2

Lector EPUB y PDF en React + TypeScript + Vite. Abre archivos del dispositivo sin backend ni cuentas. Interfaz inspirada en AO3: rojo `#900`, blanco y grises, índice desplegable sin barra lateral y navegación arriba y abajo. Las notas son siempre visibles, centradas y más estrechas que el fic, con una línea bajo el encabezado. Proyecto independiente de AO3.

La interfaz está en inglés, incluidos títulos, botones, ajustes y avisos. El contenido y los títulos originales de las obras conservan su idioma; no se traducen automáticamente.

Para facilitar la traducción del navegador, cambiar de capítulo recarga el documento y recupera el archivo y el destino guardados. Los saltos dentro de un capítulo no recargan. El texto procesado de nuevos archivos también se guarda localmente para evitar extraer todo el EPUB o PDF en cada cambio; cerrar la obra elimina esa copia junto con el archivo. Si el almacenamiento está bloqueado, se mantiene la navegación en memoria. La traducción depende del navegador y de su opción «Traducir siempre» para el idioma de la obra; la aplicación no puede activarla. La traducción real de Chrome/Android requiere comprobación manual y no está cubierta por Playwright.

## Ejecutar en Windows

Requiere Node.js 22.13 o posterior. Desde esta carpeta:

Para abrir el lector con recarga automática, con las dependencias ya instaladas:

```powershell
npm.cmd start
```

Abre la dirección `Local` que muestra la terminal (normalmente http://127.0.0.1:5173). Usa `npm.cmd` en PowerShell para evitar el bloqueo de `npm.ps1`; no hace falta cambiar la política de ejecución.

Para instalar dependencias y revisar el build de producción:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run preview -- --port 4176
```

Abrir <http://127.0.0.1:4176>. Pulsar **Abrir EPUB o PDF** y seleccionar `tests/fixtures/demo.pdf` o `tests/fixtures/demo-epub3.epub`. Son textos sintéticos propios redistribuibles. No abrir index.html con doble clic.

Desarrollo con recarga automática: `npm.cmd run dev`. El prebuild/predev prepara los CMaps y fuentes estándar locales de PDF.js desde las dependencias instaladas. No hay CDN. El build y la preview conservan la CSP restrictiva; solo el desarrollo la retira para permitir HMR.

## MVP en Vercel y página 404

`vercel.json` prepara el sitio estático con `npm run build` y salida `dist`. Las rutas que no correspondan a un archivo existente muestran `404.html` con estado HTTP 404, sin redirigir al inicio. La página está en inglés, comparte el CSS del lector y ofrece **Back to home**; volver al inicio recupera la lectura guardada. También funciona en desarrollo y preview. La página 404 no necesita JavaScript.

No configurar una regla global que envíe todas las URL a `index.html`: este MVP solo tiene el inicio y la página de error. Los errores de importación siguen mostrando un aviso dentro del lector. Esta configuración aún debe comprobarse en el despliegue real de Vercel.

Referencia del alojamiento: [página 404 personalizada en Vercel](https://vercel.com/kb/guide/custom-404-page).

## Leer y personalizar

- **Índice de capítulos** selecciona una sección o un destino dentro de ella. **Anterior / Siguiente** aparecen arriba y abajo. En EPUB siguen el spine lineal; un prefacio o portada puede formar parte de la secuencia. En PDF se infieren capítulos por encabezados y, cuando faltan, por marcadores de capítulos reconocibles; sin señal se ofrece lectura continua.
- **Ir abajo / Volver arriba** saltan dentro de la sección actual.
- **Preface** y **Afterword** se omiten del índice, la navegación y el contenido mostrado. Los avisos del archivo aparecen como una notificación flotante durante tres segundos al abrirlo; se pueden cerrar antes con ×.
- En PDF, los datos iniciales y el resumen aparecen como **Datos de la obra**, accesibles desde la cabecera y el índice, sin aumentar el total de capítulos. Los títulos partidos en líneas del mismo tamaño se reúnen en un encabezado uniforme.
- Las notas identificadas se presentan abiertas, con menos ancho que el texto. No tienen controles para ocultarlas. Se mantienen enlaces internos y retornos cuando están disponibles.
- **Ajustes de lectura** controla tamaño (16–24 px), interlineado, ancho y tema claro/sepia/oscuro. **Restablecer ajustes** vuelve a los valores originales.
- El último **EPUB o PDF** se guarda en el navegador. Al recargar o volver a abrir la misma dirección se recupera automáticamente, junto con el capítulo y el párrafo visible. No hace falta seleccionarlo otra vez. El archivo se procesa de nuevo al recuperarlo; los documentos grandes pueden tardar.
- **Abrir otro archivo** conserva la lectura anterior si cancelas el selector, cancelas la importación o el archivo nuevo falla. Un EPUB o PDF válido reemplaza al archivo guardado; se conserva una sola obra a la vez. **Close work** elimina la copia local y su progreso.

La fuente se solicita en este orden exacto: Lucida Grande, Lucida Sans Unicode, GNU Unifont, Verdana, Helvetica, sans-serif. El dispositivo elige la primera instalada; no se descargan fuentes para la interfaz.

## PDF: qué se conserva

PDF.js 6.5.438 extrae texto local con worker. Se reconstruyen líneas/párrafos con coordenadas; se conservan cursivas/negritas cuando el adaptador puede reconocerlas y se recuperan enlaces externos seguros y destinos internos aproximados a página. La salida es HTML seleccionable, no páginas dibujadas en canvas.

Un PDF no tiene la semántica de un EPUB: párrafos, capítulos y notas son aproximados. Las notas se reconocen por encabezados, cambios de sangría y tamaño de letra. Los avisos «See the end of the chapter for notes» y «See the end of the chapter for more notes» cierran su bloque inmediatamente: el texto que sigue pertenece al fic. Los adornos aislados como ☙❀❧ y * * * se conservan en un párrafo propio centrado. Sin señales suficientes, otras variantes de notas aún pueden requerir ajustes. La continuidad entre páginas puede separarse. Columnas, tablas complejas y texto rotado no se reconstruyen de manera fiable. Se indican páginas sin texto e imágenes omitidas. Sin capa textual se informa que no hay OCR; se rechazan PDF con contraseña sin pedirla ni guardarla.

## Privacidad y seguridad

El último EPUB o PDF se conserva como archivo original en IndexedDB (`lector-reading`, almacén `files`). El texto reconstruido queda en memoria y se vuelve a extraer por la ruta habitual de importación y saneado al recuperar el archivo. No hay analítica, endpoints de subida ni service worker.

localStorage contiene `lector.preferences.v1` (tamaño, interlineado, ancho y tema) y `lector.reading-progress.v1` (identificador de la copia, capítulo, destino y posición del párrafo). Los PDF guardados con la clave anterior `lector.pdf-progress.v1` se recuperan y su progreso se migra automáticamente. El progreso se guarda tras 150 ms sin desplazamiento, inmediatamente al cambiar de capítulo y al ocultar o abandonar la página. Los valores recuperados se validan y el destino debe existir en el documento. Si el navegador bloquea almacenamiento o no queda espacio, se informa y se permite continuar leyendo temporalmente.

El guardado pertenece al navegador, perfil y dirección utilizados (incluido el puerto). Borrar datos del sitio elimina la lectura; el modo privado puede borrarla al cerrar. No se solicita almacenamiento permanente ni se prepara la aplicación para abrirse sin conexión. Con el servidor local encendido, el lector funciona sin internet.

EPUB se descomprime en un worker terminable y se sanea con DOMPurify. PDF usa PDF.js actualizado, sin visor, scripting de documentos ni formularios; se escapa el texto y se pasa por la misma frontera de saneado. Se eliminan CSS y recursos activos de la obra. No se muestran imágenes de los documentos. HTTP/HTTPS/mailto requieren clic y abren una pestaña con protección de opener. La CSP de producción restringe recursos a la propia app. Los CMaps/fuentes estándar de PDF.js son recursos del frontend.

Si activas la traducción del navegador, su proveedor puede recibir el texto. También sales del ámbito local al visitar un enlace externo. La traducción real todavía no está certificada: la comprobación manual de Chrome se detuvo al no poder verificar la herramienta su URL; Android físico sigue pendiente.

## Límites provisionales

| Formato | Presupuesto |
| --- | --- |
| EPUB | 20 MiB por archivo; 32 MiB descomprimidos; 2 MiB por entrada textual; 1000 entradas; 300 secciones; 20 s de extracción |
| PDF | 100 MiB por archivo; 10 000 páginas; 50 millones de caracteres; 100 000 caracteres y 20 000 fragmentos por página; 100 000 operadores por página; 10 000 capítulos; 30 minutos de procesamiento |

Son medidas preventivas, no capacidades garantizadas en un teléfono. El límite de operadores PDF se comprueba una vez que PDF.js devuelve la lista; no es un límite de memoria del worker. Cancelar termina el worker. Las secciones saneadas quedan en memoria, y solo una se monta en pantalla.

EPUB compatible con los fixtures: EPUB 2/NCX y EPUB 3/nav textual UTF-8, spine obligatorio. Sin TOC se genera índice. No se admiten DRM, cifrado ni maquetación fija. La muestra AO3 real probada es PDF; todavía no hay validación con EPUB AO3 reales.

## Verificar

```powershell
npm.cmd run fixtures
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

Playwright requiere Chrome instalado y el puerto 4181 libre. Prueba contra el build con CSP. Si está disponible, abre también la muestra privada `validacion/A_stubborn_affliction_of.pdf`; sin ella omite únicamente ese caso. Ni la muestra ni su contenido se publican. Las capturas sintéticas se generan en test-results/.

Ver [validación E2](doc/validation-e2.md), [decisiones E2](doc/decisiones-e2.md) y el [registro histórico E1](doc/validation-e1.md). La carpeta validacion/ conserva el laboratorio anterior y no forma parte del build: su versión antigua de PDF.js no es la usada por esta aplicación.
