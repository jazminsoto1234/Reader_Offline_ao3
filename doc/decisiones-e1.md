# Decisiones de implementación — E1

Fecha: 4 de noviembre de 2026. Este documento actualiza las decisiones previas de requirements, architecture y user-flows; el plan original queda como antecedente.

## Parser y cancelación

Se eligió un adaptador acotado con `@zip.js/zip.js` 2.8.10 (BSD-3-Clause, verificado en el paquete instalado), DOMParser y DOMPurify 3.4.17 (Apache-2.0 OR MPL-2.0). Se consideró epub.js como motor EPUB completo, pero no se integró ni se hizo un benchmark comparativo: el producto necesita HTML sin visor y control directo de la extracción. No se afirma equivalencia de compatibilidad con un motor completo.

El spike ejecutable de zip.js son el generador de fixtures y las pruebas integradas: ZIP EPUB2/3, extracción mediante WritableStream con contador de bytes, lectura de contenedor/OPF/spine/TOC y salida sin iframe. El bundle de worker es aproximadamente 123 kB sin gzip. Los bytes de imágenes/fuentes no se extraen. El presupuesto declarado del ZIP se comprueba incluso para entradas omitidas; el presupuesto real se comprueba en el stream textual. Cancelar y agotar el tiempo terminan el worker, además de invalidar el resultado en el controlador de interfaz.

La extracción ocurre en worker; XML, normalización y saneado se realizan en el hilo principal con el tamaño acotado. Todas las secciones textuales se retienen mientras dura la sesión. La extracción bajo demanda y el saneado incremental quedan como optimizaciones futuras; no se presentan como implementados.

Los presupuestos son provisionales: 20 MiB comprimidos, 32 MiB total declarado/extraído, 2 MiB por entrada textual, 1000 entradas, 300 secciones y 20 s de extracción. No hay benchmark Android; aumentar estos límites requiere mediciones. Los casos comprimidos de tamaño excesivo de los fixtures son pequeños (unos pocos kB), para probar el rechazo sin someter el equipo a un archivo peligroso.

## Modelo y navegación

`Section` conserva ruta y pertenencia al spine lineal; `TocEntry` conserva etiqueta, profundidad y fragmento. Las secciones auxiliares están disponibles a enlaces, sin incluirse en anterior/siguiente. No se reconstruye el orden a partir del ZIP. La navegación usa estado React sin recarga: las URLs no recuperan una obra que solo está en memoria.

El requerimiento de la usuaria del 3 de noviembre define la interfaz final: sin sidebar, índice nativo en la cabecera, anterior/siguiente arriba y abajo y saltos verticales. Se usa la pila tipográfica solicitada en todo el producto y rojo `#900`, blanco y grises. El navegador elige la primera fuente instalada. Se prefieren etiquetas «sección» cuando no se conoce la relación editorial con los capítulos.

Las notas se convierten en details/summary antes del saneado final. Se conservan IDs prefijados y vínculos de retorno. Las marcas notes/endnotes/footnotes y la estructura de metadatos de exportación AO3 permiten reconocer notas sin confundir el texto libre con una nota. No se copió código de las plantillas; se inspeccionó su estructura para escribir el adaptador.

## Seguridad y alcance

La frontera de HTML es `sanitize-content.ts`; su salida se inserta en un único artículo. Hay limpieza inicial, reescritura controlada y limpieza final. No se importan CSS ni fuentes de la obra, ni se aceptan recursos activos. La preview de producción conserva una CSP restrictiva. No hay estado persistente ni solicitudes del documento. El experimento PDF existente no forma parte del build E1.

Traducción, Android físico y EPUB reales están pendientes. La revisión de DOM y la emulación móvil no sustituyen esas pruebas. La compatibilidad verificada es la de fixtures sintéticos, incluido uno basado en la estructura de notas AO3.

## Referencias

- [zip.js: API ZipReader](https://gildas-lormeau.github.io/zip.js/api/classes/ZipReader.html) y los tipos de la versión fijada en node_modules.
- [DOMPurify: documentación oficial](https://github.com/cure53/DOMPurify).
- [EPUB 3.3](https://www.w3.org/TR/epub-33/).
- [Plantilla oficial de capítulos descargables AO3](https://github.com/otwcode/otwarchive/blob/master/app/views/downloads/_download_chapter.html.erb), [prefacio](https://github.com/otwcode/otwarchive/blob/master/app/views/downloads/_download_preface.html.erb) y [notas finales](https://github.com/otwcode/otwarchive/blob/master/app/views/downloads/_download_afterword.html.erb).
