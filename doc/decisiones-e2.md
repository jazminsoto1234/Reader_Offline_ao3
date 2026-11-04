# Decisiones de implementación — Entrega 2

> Para las correcciones posteriores de clasificación de notas, separadores y límite de 10 000 páginas, ver [registro de mejoras](mejoras-pdf-limites-notas-separadores.md).

Fecha: 4 de noviembre de 2026.

## Notas abiertas y más estrechas

La indicación y captura de la usuaria sustituyen la decisión de E1 de hacer notas plegables. El saneador genera section/h3, no details/summary. Las notas quedan abiertas, centradas, al 84 % del ancho del fic en escritorio; en móvil conservan un margen adicional de 1 rem por lado. Tienen fondo transparente, sin recuadro y con una línea bajo el título. Se eliminaron Ocultar/Mostrar notas. Se conserva la pila tipográfica solicitada.

## PDF

Se retomaron las heurísticas del laboratorio, con módulos TypeScript separados: pdf-parser.ts carga y limita PDF.js; pdf-reconstruction.ts normaliza la lectura. El laboratorio permanece como referencia histórica.

Se instaló inicialmente 5.6.205, la versión del experimento. La auditoría detectó GHSA-hq66-cqwq-w95j y se sustituyó antes de validar por **PDF.js 6.5.438**, licencia Apache-2.0. La instalación final reportó cero vulnerabilidades. Se adaptaron PDFWorker.create y los booleanos italic/bold de FontFaceObject: el nombre de fuente de la versión 5 ya no está disponible. Las fuentes se esperan mediante callback de commonObjs, porque getOperatorList puede terminar antes de que estén resueltas en Chrome. Es una API interna aislada y fijada: cada actualización requiere repetir la prueba de énfasis. Si falla, se conserva el texto y se avisa.

getDocument recibe bytes locales sin URL de obra. Motor y worker se cargan bajo demanda. Los CMaps y fuentes estándar se copian desde la dependencia a public/pdfjs mediante prebuild/predev, sin CDN. No se monta visor, formularios, JavaScript ni adjuntos ejecutables. El worker pertenece a la importación: cancelar, agotar el tiempo o recibir una petición de contraseña lo termina y rechaza la tarea. La interfaz ignora resultados anteriores y conserva la sesión previa al fallar un reemplazo. Al completar se destruye el documento y su worker.

## Reconstrucción

Se agrupan fragmentos en líneas y párrafos por coordenadas, espacio vertical, tamaño, sangría y señales de diálogo. Solo se eliminan márgenes repetidos en al menos tres páginas y el 70 % del documento, con letra pequeña. Se supone una columna; no se resuelven columnas, tablas complejas ni texto rotado.

Encabezados Chapter/Capítulo y número definen capítulos; si faltan, se usan marcadores de capítulos reconocibles con destino válido. Otros marcadores válidos quedan como destinos secundarios. Sin señal se mantiene lectura continua. Prefacio y material final pueden aparecer como secciones. Los enlaces internos apuntan aproximadamente a página, en su sección de destino.

Summary/Resumen y Notes/Notas generan bloques estrechos. Las notas iniciales se cierran cuando la sangría vuelve al margen del cuerpo; las finales llegan al final de su sección. Esto puede fallar si el PDF no distingue notas y fic. No se garantiza reconstrucción exacta ni unión de párrafos entre páginas. Una página sin texto se indica; un documento completamente sin texto informa que necesita OCR, fuera de alcance.

## Ajustes y traducción

Tamaño, interlineado, ancho y tema son las únicas preferencias persistentes. Se validan y se escribe un objeto nuevo en lector.preferences.v1, sin serializar ReadingSession. Si se bloquea el almacenamiento, funcionan en memoria. El idioma elegido para la obra es temporal. Hay instrucciones para el menú Traducir de Chrome, sin simular traducción propia ni exigir recargas.

El artículo usa HTML semántico con lang y translate=yes. Se inserta en una sola frontera sin descendientes React, evitando reconciliar fragmentos del fic que modifique un traductor. Es una decisión arquitectónica, **no una validación de traducción**. La comprobación nativa de Chrome se detuvo antes de activar el traductor porque la herramienta no pudo verificar su URL con confianza. No se repitió el control tras la detención. La matriz de traducción escritorio/Android queda pendiente.

## Fuentes

- [PDF.js: ejemplos oficiales](https://mozilla.github.io/pdf.js/examples/).
- [PDFDocumentLoadingTask y destroy](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentLoadingTask.html).
- Tipos y código de PDF.js 6.5.438 instalados en node_modules/pdfjs-dist para la adaptación de API.
- [Aviso de seguridad corregido](https://github.com/advisories/GHSA-hq66-cqwq-w95j).
