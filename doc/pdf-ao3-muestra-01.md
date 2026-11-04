# Inspección de una muestra PDF descargada de AO3

Fecha: 3 de noviembre de 2026.

Fuente local facilitada por la usuaria: `C:\Users\JAZMIN\Downloads\A_stubborn_affliction_of.pdf`.
El original no fue modificado ni copiado al proyecto. No se siguieron sus enlaces ni se ejecutaron acciones indicadas por su contenido.

## Alcance de la revisión

Inspección de estructura y texto de las 38 páginas con pypdf y pdfplumber; renderizado de las páginas 1, 3 y 18 con pypdfium2, e inspección visual de las páginas 1 y 3. No es una prueba de PDF.js, del futuro importador web ni de traducción. Las herramientas Python permiten caracterizar la muestra; no sustituyen las pruebas en navegador.

## Resultados observados

| Propiedad | Resultado |
|---|---|
| Tamaño original | 1.388.948 bytes, aproximadamente 1,32 MiB |
| Páginas | 38 |
| Cifrado | No |
| Tipo | PDF con texto extraíble e imágenes; no es un PDF escaneado |
| Metadatos | `/Title` y `/Author` disponibles; creador Chromium y productor Skia/PDF m102 |
| Texto extraído con pypdf | 101.002 caracteres; no equivale a número de palabras de la obra |
| Caracteres de reemplazo U+FFFD | Ninguno en las extracciones de pypdf y pdfplumber; no garantiza fidelidad completa |
| Página sin texto significativo | 37; contiene tres imágenes, por lo que no debe tratarse como página vacía |
| Tipografía | Fuentes Times New Roman regular, negrita y cursiva; también DejaVuSans |
| Anotaciones | 25: 23 acciones URI y 2 anotaciones sin acción URI |
| Diseño observado | Página de 612 × 792 puntos; cuerpo narrativo a una columna en la página revisada |

### Estructura y navegación

- Página 1: ficha AO3 con título, enlace de origen, clasificación, etiquetas, idioma y estadísticas. No es el comienzo de la narración.
- Página 2: título, autor y resumen.
- Página 3: inicio de Chapter 1 y notas iniciales.
- Página 17: final del primer capítulo y notas finales.
- Página 18: inicio de Chapter 2 y notas iniciales.
- Página 36: final del segundo capítulo, notas y enlaces relacionados con imágenes.
- Página 37: tres imágenes sin texto significativo extraíble.
- Página 38: mensaje final que remite al sitio de origen.

El outline contiene cuatro entradas: `Preface` → página 1, `Chapter 1` → página 3, `Chapter 2` → página 18 y `Afterword` → página 1. Esta última referencia no representa el cierre situado al final del documento. No ordenar ni segmentar ciegamente usando todos los marcadores. Los dos destinos de capítulo sí coinciden con encabezados observados en el texto.

### Maquetación relevante

La muestra conserva párrafos, diálogos, notas y estilos tipográficos. La extracción devuelve saltos de línea de maquetación dentro de los párrafos: no convertir cada línea en un párrafo HTML. Hay continuidad narrativa entre páginas; por ejemplo, el final de la 35 continúa en la 36. No introducir un salto de párrafo automático por cada cambio de página.

Las cursivas existen como fuentes diferenciadas. Recuperarlas en HTML dependerá de la información que exponga PDF.js y de las reglas de reconstrucción; no se considera validado por esta inspección.

## Consecuencias para la implementación PDF de E2

1. Leer metadatos y outline con PDF.js antes de intentar detectar capítulos mediante texto. Validar destinos, orden y correspondencia con encabezados; conservar un fallback si los marcadores son inconsistentes.
2. Representar preliminares, capítulos y material final sin mezclar toda la ficha AO3 con el primer párrafo narrativo. No descartar resumen ni notas.
3. Reconstruir líneas y párrafos mediante coordenadas y espaciado. Probar especialmente diálogos y continuidad entre páginas.
4. Clasificar el documento como textual por el conjunto de páginas. Una página de imágenes no convierte el PDF completo en escaneado.
5. Si E2 no representa imágenes, indicar su presencia; no omitir silenciosamente una página que contiene contenido visual.
6. Extraer enlaces como datos y aplicar la política de URLs de la aplicación. No visitarlos automáticamente.
7. Mantener la obra original fuera de los fixtures públicos. Crear equivalentes sintéticos para automatizar los casos: outline con destino erróneo, dos capítulos, notas, continuidad entre páginas y página de imágenes.

## Validaciones todavía pendientes

Actualización: se añadió un laboratorio independiente en `validacion/` con PDF.js y generación de HTML. Ver `validacion/README.md` para evidencia, límites y protocolo de revisión. La inspección Python descrita arriba corresponde a una etapa anterior; ahora existe además una prueba de extracción y navegación web. La traducción en Chrome, la fidelidad completa y las otras muestras siguen pendientes; las mediciones de rendimiento se posponen.

- Integración del experimento PDF.js en la aplicación futura; extracción y navegación básicas ya comprobadas en el laboratorio.
- Revisión completa de fidelidad de párrafos, cursivas, notas y enlaces tras convertir a HTML; revisión visual parcial y comprobaciones automáticas disponibles.
- Tiempos y memoria en Chrome Android/escritorio: pospuestos por alcance de esta prueba.
- Traducción del HTML reconstruido y comportamiento tras navegar.
- Otras muestras: PDF corto, escaneado, corrupto y variantes de exportación.

Esta muestra respalda la viabilidad de investigar el PDF de AO3, pero no demuestra compatibilidad con todos sus PDFs. E1 sigue centrada en EPUB; este archivo cubre una necesidad de evidencia para E2, no reemplaza las muestras EPUB pendientes.
