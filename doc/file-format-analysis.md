# Análisis de formatos y plan de pruebas — EPUB y PDF

**Versión:** 1.0 — 2026-11-02  
**Estado:** protocolo de análisis con una muestra PDF real inspeccionada el 2026-11-03 y un laboratorio PDF.js en `validacion/`; ver `pdf-ao3-muestra-01.md` y `validacion/README.md`. No se han inspeccionado EPUB reales ni validado todavía el importador de la aplicación. Las observaciones generales siguen siendo hipótesis salvo evidencia indicada.

## 1. Objetivo

Determinar qué información puede extraerse de archivos EPUB y PDF descargados por lectores, y cómo transformarla en un modelo común sin destruir la estructura de lectura (párrafos, énfasis, diálogos, notas, separación de escenas y capítulos). Prioridad E1: EPUB. Prioridad E2: PDF.

## 2. Conjunto mínimo de prueba (por conseguir)

| ID | Ejemplo requerido | Qué verifica | Estado |
|---|---|---|---|
| EPUB-01 | EPUB de AO3 corto (1 capítulo) | Metadatos, spine, HTML y estilos | Pendiente |
| EPUB-02 | EPUB de AO3 con varios capítulos | TOC, orden, notas, navegación | Pendiente |
| EPUB-03 | EPUB con HTML complejo, imágenes o links | Sanitización, recursos y enlaces | Pendiente |
| PDF-01 | PDF de AO3 textual corto | Extracción de texto, cursivas, párrafos | Pendiente |
| PDF-02 | PDF textual largo/multicapítulo | Encabezados, paginación, rendimiento | Laboratorio PDF.js probado en navegador integrado: 38 páginas, 2 capítulos; fidelidad completa y Chrome pendientes; rendimiento pospuesto |
| PDF-03 | PDF escaneado (imágenes) | Diagnóstico de falta de texto | Pendiente |
| BAD-01 | EPUB/PDF corrupto o extensión falsa | Errores seguros y recuperación | Pendiente |

No distribuir muestras de fanfics sin permiso. Para tests automatizados, preferir archivos sintéticos o con licencia adecuada.

## 3. Diferencias esperadas entre formatos

| Propiedad | EPUB | PDF digital | PDF escaneado |
|---|---|---|---|
| Orden de lectura | Spine explícito, generalmente | Debe inferirse de posiciones y contenido | No hay texto extraíble sin OCR |
| Capítulos | TOC/secciones suelen existir | Posibles encabezados, no estructura confiable | No confiable |
| Estilo de párrafos | HTML/XHTML | Texto + coordenadas / estilos indirectos | Imagen |
| Énfasis/cursivas | Normalmente etiquetas HTML | Reconstrucción heurística | No disponible |
| Traducción del navegador | Tras renderizar HTML seguro | Tras convertir texto a HTML | Fuera de alcance |
| Calidad esperada | Mayor para este caso | Variable | No soportado en MVP |

## 4. Pipeline común

```mermaid
flowchart LR
  A[Archivo local] --> B{Tipo real}
  B -->|EPUB| C[EPUB parser]
  B -->|PDF| D[PDF.js]
  C --> E[Normalización + limpieza]
  D --> E
  E --> F[Sanitización de HTML]
  F --> G[Fanfic + Chapter[]]
  G --> H[Reader UI]
```

Modelo esperado:

```typescript
interface FanficDocument {
  id: string;                    // Id efímero, no ID de almacenamiento remoto
  title: string;
  author?: string;
  sourceFormat: 'epub' | 'pdf';
  chapters: ChapterDocument[];    // Puede ser una única sección
}

interface ChapterDocument {
  id: string;
  title: string;
  html: string;                   // HTML semántico sanitizado
  order: number;
}
```

**Importante:** para fanfics muy extensos, una representación perezosa por sección puede ser más eficiente que cargar `chapters[]` con todos los HTML en memoria; el contrato anterior es conceptual, no obliga a materializar todo al importar.

## 5. Investigación EPUB (E1)

1. Verificar firma/estructura ZIP y archivo `mimetype` cuando aplique; no confiar solo en extensión.
2. Leer `META-INF/container.xml`, localizar package/OPF y sus metadatos.
3. Extraer `title`, `creator`, idioma y TOC si están presentes; mantener fallbacks.
4. Leer `spine` para orden correcto de lectura; el TOC es una guía de navegación, no siempre coincide 1:1 con archivos del spine.
5. Resolver referencias relativas únicamente a recursos embebidos seguros; bloquear scripts, eventos inline, recursos remotos y URLs peligrosas.
6. Sanitizar HTML/XHTML con una lista permitida que preserve párrafos, cursivas, negritas, listas, encabezados, enlaces seguros, notas y separadores.
7. Presentar un capítulo/sección a la vez, sin ejecutar scripts ni estilos arbitrarios del libro.
8. Probar EPUBs con secciones preliminares y finales, notas y una sola sección larga.

**Posible tecnología:** evaluar una biblioteca EPUB compatible con extracción de contenidos y navegación; no asumir que `epub.js` ya satisface por sí sola todos los requisitos de sanitización o compatibilidad con traducción. Si usa iframe, verificar si Chrome puede traducir ese contenido; puede resultar preferible extraer XHTML y renderizar HTML seguro directamente.

## 6. Investigación PDF (E2)

1. Leer el PDF localmente con PDF.js y comprobar si contiene texto extraíble.
2. Extraer fragmentos y coordenadas; construir líneas con heurísticas explícitas.
3. Reconstruir párrafos por espaciado, sangrías, cambios de bloque y signos de puntuación; evitar unir diálogos o títulos de forma incorrecta.
4. Detectar y eliminar encabezados/pies **solo** cuando haya evidencia repetitiva suficiente; nunca descartarlos por coincidencias débiles.
5. Identificar capítulos por marcadores/bookmarks del PDF y, si no existen, detectar encabezados con confianza; si no hay señal, tratar como lectura continua.
6. Escapar texto y construir HTML semántico; no insertar texto sin escapar mediante `innerHTML`.
7. Medir tiempos y memoria; extracción incremental por páginas y feedback de progreso.
8. Si hay muy poco texto extraíble en un documento visual, informar: “Este PDF parece escaneado y no es compatible todavía”.

**No incluido:** OCR, reconstrucción perfecta de columnas, notas complejas, tipografía idéntica al PDF y recuperación fiable de cursivas en todos los PDF.

## 7. Matriz de evaluación (rellenar con pruebas)

Calificar cada celda como `OK`, `Parcial`, `Falla` o `No aplica` y adjuntar evidencia (capturas, logs sin contenido sensible, datos sintéticos).

| Caso | Importa | Título/autor | Capítulos/orden | Párrafos | Énfasis | Notas | Tiempo/memoria | Resultado |
|---|---|---|---|---|---|---|---|---|
| EPUB-01 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| EPUB-02 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| EPUB-03 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| PDF-01 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| PDF-02 | OK en laboratorio | OK | Parcial: 2 capítulos; marcador de cierre inválido advertido | Parcial | Parcial | Parcial | Pospuesto | HTML generado; revisión completa y traducción pendientes |
| PDF-03 | Pendiente | N/A | N/A | N/A | N/A | N/A | Pendiente | Pendiente |
| BAD-01 | Pendiente | N/A | N/A | N/A | N/A | N/A | Pendiente | Pendiente |

## 8. Prueba de traducción (spike anterior o durante E2)

**Hipótesis:** Chrome puede traducir HTML semántico visible; la actualización dinámica del DOM por React, el contenido en iframe y rutas SPA pueden impedir o degradar la traducción automática.

Pruebas controladas:
- Página HTML simple con capítulo de prueba en inglés, abierta en Chrome escritorio y Android; activar “Traducir al español”.
- Repetir con renderizado React y cambio de capítulo sin navegación.
- Repetir con cambio de ruta/recarga completa y con contenido montado bajo demanda.
- Registrar si traducción se mantiene, si se revierte al cambiar capítulo y si rompe interacción o formato.
- Validar sin iframe y, si la biblioteca EPUB elegida lo usa, con iframe.

**Criterio de decisión:** si la traducción falla al cambiar capítulos en SPA, adoptar una ruta por capítulo y una transición que permita al navegador volver a traducir; no prometer control programático de Chrome Translate.

## 9. Riesgos de seguridad y privacidad en archivos

- EPUB es un contenedor con HTML, enlaces y recursos: tratar como contenido no confiable.
- Bloquear JavaScript, eventos HTML, formularios, iframes y URLs `javascript:`; sanitizar también atributos y recursos.
- No permitir recursos externos de terceros por defecto, porque pueden filtrar la IP o hábitos de lectura.
- Proteger contra archivos comprimidos patológicos (ZIP bombs), tamaño descomprimido excesivo y consumo de memoria; definir límites mediante pruebas.
- Los documentos de visitantes **no** se guardan en localStorage, IndexedDB, service worker ni telemetría.

## 10. Salida del análisis

Antes de aprobar E1 documentar: biblioteca EPUB elegida, casos probados, comportamiento del TOC y errores, estrategia de sanitización y límites de archivo. Antes de cerrar E2 documentar: calidad de PDFs reales, límite declarado de PDFs escaneados y resultados de traducción en Chrome móvil/escritorio.
