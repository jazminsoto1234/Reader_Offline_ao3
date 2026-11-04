# Revisión y plan técnico de la primera entrega

Fecha: 3 de noviembre de 2026. Estado: plan propuesto; no es evidencia de implementación.

## 1. Diagnóstico

Se revisaron `requirements.md`, `architecture.md`, `file-format-analysis.md` y `user-flows.md`. La carpeta contiene únicamente esos cuatro documentos: no hay aplicación, manifiesto de dependencias, pruebas ni muestras EPUB/PDF. Tampoco es actualmente un repositorio Git.

La propuesta tiene sentido: un lector estático que procesa EPUB en el navegador permite validar la experiencia principal sin introducir cuentas, servidor ni almacenamiento remoto. Vite + React + TypeScript y una separación pequeña entre importador, seguridad y lector son suficientes. Conviene mantener PDF, Supabase y PWA fuera de E1.

La documentación está alineada en el objetivo, pero describe una arquitectura prevista, no un producto ya validado. No se han comprobado compatibilidad con EPUB reales de AO3, comportamiento en Android, consumo de memoria ni traducción. E1 comienza desde cero.

## 2. Vacíos y ajustes necesarios

| Prioridad | Hallazgo | Resolución propuesta |
|---|---|---|
| Bloqueante | No hay muestras ni elección de parser | Crear fixtures sintéticos y realizar un spike antes de comprometer una biblioteca. Validar también EPUB reales obtenidos legítimamente, sin publicarlos en el repositorio. |
| Bloqueante | Se plantea recargar para recuperar traducción, pero el archivo solo vive en memoria | E1 usa navegación sin recarga. Una URL no reconstruye el documento. Si se recarga, se pide seleccionar el archivo otra vez. La traducción no puede depender de una recarga transparente mientras se mantenga esa política de privacidad. |
| Bloqueante | `Chapter[]` mezcla secciones del spine y capítulos del índice | Modelar por separado secciones de lectura y entradas del TOC, con destino a archivo y fragmento. No asumir un archivo por capítulo. |
| Bloqueante | Sanitizar HTML no define por completo qué puede cargar el navegador | Definir una allowlist, eliminar CSS importado y atributos de recursos, controlar enlaces y añadir CSP antes de probar contenido hostil. |
| Alta | No hay política concreta para imágenes, DRM, EPUB de maquetación fija o contenido no textual | E1 prioriza EPUB reflowable con XHTML textual, sin DRM. Omitir imágenes con una indicación accesible. Rechazar explícitamente maquetación fija y contenido cifrado necesario para leer, sin confundirlo con archivo corrupto. |
| Alta | Cancelación, sustitución de archivo y errores están descritos sin ciclo de vida | Definir estados, cancelación real del trabajo costoso y protección frente a resultados de importaciones anteriores. |
| Alta | Límites y rendimiento no tienen criterios ejecutables | Fijar presupuestos provisionales en el spike y comprobarlos con mediciones. No aceptar archivos sin límite mientras se espera el benchmark. |
| Alta | Accesibilidad y pruebas importantes aparecen demasiado tarde en la hoja de ruta | Teclado, foco, zoom, seguridad y pruebas del flujo principal forman parte de E1; E4 amplía cobertura. |
| Media | «Sin subida» puede interpretarse como «ningún tercero procesa el texto» | La app no envía obras. Si se activa traducción del navegador, su tratamiento de datos depende de ese proveedor; no prometer procesamiento exclusivamente local para esa función. Abrir un enlace externo también implica salir del lector. |
| Media | El despliegue aparece solo en E4 | E1 entrega build reproducible y preview de revisión. La publicación pública y PWA pueden seguir en E4. |

El idioma del contenido también debe conservarse: la interfaz puede estar en español mientras el artículo usa el idioma del EPUB si está disponible. Esto ayuda a tecnologías asistivas y permite investigar traducción sin falsear el idioma de la obra.

## 3. Alcance cerrado de E1

**Resultado:** seleccionar un EPUB textual local, leerlo como HTML adaptable, navegar por sus secciones e índice y abrir otro archivo, con errores recuperables y sin transmitir ni persistir la obra.

Incluye título y autor con fallbacks, conservación de párrafos/énfasis/listas/separadores/notas textuales, navegación a anclas internas, mensajes de limitación, limpieza de recursos y uso con teclado y móvil.

No incluye PDF, traducción garantizada, controles de personalización, imágenes embebidas, restauración tras recarga, biblioteca, cuentas, backend, PWA ni catálogo. La tipografía básica legible sí se incluye. No mostrar botones de funcionalidades futuras que no funcionen.

La compatibilidad prometida será la de los casos efectivamente probados, no «cualquier EPUB». Se propone EPUB 2/3 textual mediante NCX/nav, sujeto al spike y a fixtures de ambas variantes.

## 4. Plan de ejecución por pasos

### Paso 1 — Cerrar decisiones y preparar muestras

1. Registrar el alcance anterior y resolver las contradicciones de los cuatro documentos, con referencias a las decisiones nuevas.
2. Preparar EPUB sintéticos: una sección; varias secciones; sin TOC pero con spine válido; varios destinos del TOC dentro del mismo XHTML; notas entre secciones; metadatos ausentes; nombres/rutas con espacios y caracteres codificados.
3. Preparar casos negativos: archivo vacío, ZIP que no es EPUB, OPF inválido, referencia faltante, XHTML hostil y límites de descompresión. Los casos de estrés deben ser pequeños y controlados, sin arriesgar el equipo.
4. Añadir un caso EPUB 2 con NCX y uno EPUB 3 con nav. Obtener al menos un EPUB AO3 corto y otro multicapítulo para verificación privada.
5. Acordar la política de imágenes omitidas, enlaces externos explícitos y formatos no soportados.

**Salida:** matriz de fixtures, expectativas por caso y decisiones registradas. Si faltan muestras reales, el desarrollo continúa con sintéticos, pero la compatibilidad AO3 queda pendiente y se declara en la entrega.

### Paso 2 — Spike del parser y prueba corta de traducción

Comparar como máximo dos caminos: una biblioteca EPUB que exponga contenido sin exigir su visor, y un adaptador limitado basado en ZIP + XML. `epub.js` es candidato a evaluar; `zip.js` es candidato para el acceso al contenedor, no un parser EPUB completo.

Evaluar con los mismos fixtures: OPF/metadatos, spine, NCX/nav, fragmentos, extracción sin iframe, ausencia de solicitudes externas, cancelación, límites efectivos de extracción, tamaño de bundle y trabajo de mantenimiento. Elegir la alternativa que cumpla el alcance con menos código propio. No escribir un motor EPUB general.

La extracción debe poder limitar bytes producidos durante la descompresión y detenerse, no confiar únicamente en los tamaños declarados por el ZIP. Si una biblioteca no permite aplicar esos controles, documentar la limitación y elegir otra estrategia antes de abrir archivos arbitrarios.

Hacer una prueba mínima de HTML/React con dos secciones en Chrome escritorio y Android. Registrar traducción inicial, cambio de sección y posibles interferencias con React. No bloquear E1 por falta de traducción; sí descartar decisiones arquitectónicas que requieran perder el archivo para navegar.

**Salida:** decisión de parser con versión y licencia verificadas al instalar, mediciones iniciales y límites numéricos provisionales: bytes comprimidos, bytes extraídos por entrada y total, cantidad de entradas/secciones y tiempo máximo. Los valores se fijan con el dispositivo disponible; no se presentan aún como capacidad garantizada.

### Paso 3 — Base ejecutable mínima

Crear Vite + React + TypeScript + CSS Modules, scripts de desarrollo/build/typecheck y herramientas de prueba. Incluir lockfile y versión de Node documentada compatible con las dependencias elegidas. Inicializar Git y exclusiones para dependencias, builds, secretos y muestras privadas.

Estructura inicial sugerida:

```text
src/
  app/App.tsx
  domain/reading-session.ts
  features/importer/epub-parser.ts
  features/importer/import-controller.ts
  features/reader/Reader.tsx
  features/reader/reader.module.css
  shared/security/sanitize-content.ts
tests/fixtures/
docs/validation-e1.md
```

Crear módulos a medida que se usan. No crear todavía repositorios, cliente Supabase, adapters PDF ni framework de rutas si no es necesario.

**Salida:** pantalla inicial responsive; build y comprobación de tipos correctos.

### Paso 4 — Importación y sesión efímera

Implementar validación estructural del EPUB: contenedor, `container.xml`, package/OPF, manifest y spine utilizable. No confiar solo en extensión o MIME del selector. Resolver rutas relativas dentro del ZIP y rechazar referencias fuera del contenedor. Manejar XML inválido y namespaces de forma explícita.

Separar en el modelo:

- `ReadingSession`: identidad efímera, metadatos, idioma y recursos en memoria.
- `Section`: identificador, ruta canónica dentro del EPUB y orden de lectura.
- `TocEntry`: etiqueta, sección de destino, fragmento opcional e hijos.
- `ChapterSource` o equivalente pequeño: obtener contenido de una sección y liberar la sesión. Preferir extracción bajo demanda si el spike demuestra que evita retener todos los XHTML.

El spine define el recorrido y el TOC los destinos. Sin TOC, generar entradas por sección. Un spine ausente o inutilizable es un error de estructura; no inventar el orden usando los archivos del ZIP. Resolver de forma deliberada entradas `linear="no"`: disponibles para notas/enlaces, sin convertirlas automáticamente en la secuencia principal.

Aplicar límites antes y durante extracción. Extraer trabajo pesado fuera del hilo principal cuando la biblioteca lo permita; si se requiere un worker propio, aislar allí descompresión/procesamiento compatible y mantener el saneado DOM donde corresponda. Cancelar debe interrumpir o terminar el trabajo costoso, no solo ocultar el indicador.

**Salida:** importación recuperable, errores tipados y pruebas de orden, rutas, límites y cancelación.

### Paso 5 — Frontera de seguridad y navegación de contenido

Usar DOMPurify con una allowlist explícita orientada a texto. Conservar párrafos, encabezados, énfasis, listas, citas y separadores. Eliminar scripts, eventos, formularios, iframes, objetos, SVG/MathML fuera de alcance, `style`, hojas CSS, `base`, metadatos activos y atributos que cargan recursos (`src`, `srcset`, etc.). No confiar en que la configuración por defecto elimine CSS o toda conexión remota.

Convertir enlaces internos a destinos controlados por la app y prefijar/mapear IDs para no interferir con la interfaz. Mantener notas textuales y su retorno cuando exista enlace. Permitir enlaces externos solo de protocolos aprobados, activados por el usuario y con atributos seguros. Bloquear protocolos ejecutables y recursos remotos automáticos.

Normalizar y reescribir antes del saneado final; no reconstruir HTML inseguro después. Concentrar la inserción de HTML en un único componente. Añadir una CSP restrictiva en la preview/build y verificarla con el worker elegido; no copiar excepciones de desarrollo a producción.

**Salida:** fixtures hostiles no ejecutan código ni originan solicitudes externas automáticas; el texto y las notas siguen siendo legibles.

### Paso 6 — Lector y estados de interfaz

Implementar inicio, procesamiento, lectura y error con transiciones explícitas. Mostrar «Abrir EPUB», privacidad y aviso de pérdida al recargar. No mostrar progreso porcentual ficticio; usar fases o indicador indeterminado si el parser no ofrece progreso real.

En el lector: título/autor, contador de sección, índice, anterior/siguiente arriba o abajo según diseño, y acción para abrir otro archivo. Respetar límites de navegación. Al cambiar de sección, mover el foco al encabezado y el scroll al inicio; al seguir una nota, ir al fragmento correcto. No confundir una sección con un capítulo editorial cuando no se conoce esa relación.

Si se cancela el selector de archivos, conservar la lectura actual. Si una importación de reemplazo falla, conservar la sesión anterior y permitir reintentar. Ignorar resultados tardíos de tareas canceladas. Al reemplazar o cerrar, liberar workers, referencias y object URLs si se usaron. Recargar o entrar sin sesión vuelve al inicio con explicación; no persistir nombre, metadatos, contenido ni posición.

Aplicar ancho de lectura acotado, tipografía cómoda, estilos propios, menú accesible, foco visible y reflujo con zoom. Solo se monta una sección por vez. Para un XHTML individual enorme, aplicar el límite declarado y explicar el rechazo; dividirlo automáticamente no es obligatorio en E1.

**Salida:** recorrido completo usable en escritorio y móvil, con teclado y sin funcionalidades simuladas.

### Paso 7 — Verificación integrada

| Área | Prueba y resultado necesario |
|---|---|
| Flujo principal | Importar fixture, navegar índice/anterior/siguiente, seguir nota y reemplazar archivo. Orden correcto y texto presente. |
| Recuperación | Archivo inválido, cancelación y error de reemplazo permiten continuar; tareas anteriores no pisan la sesión vigente. |
| Seguridad | Scripts/eventos/protocolos peligrosos bloqueados y recursos remotos sin carga automática, comprobado en navegador real. |
| Privacidad | Inspección de red y almacenamiento: no se transmite ni persiste contenido/metadatos; recarga elimina la sesión. Distinguir descargas del frontend de tráfico causado por el documento. |
| Formatos | EPUB 2/3, TOC ausente, TOC con fragmentos, metadatos ausentes y casos incompatibles cumplen su expectativa. |
| Accesibilidad | Teclado, foco, nombres accesibles, contraste, zoom al 200 % y viewport móvil sin desplazamiento horizontal de la lectura. |
| Rendimiento | Medir tiempo hasta primera sección, fluidez, cancelación y comportamiento cerca del límite en Chrome escritorio y un Android identificado. Registrar método y memoria solo donde pueda medirse con fiabilidad. |
| Empaquetado | Build, typecheck y pruebas automatizadas pasan; la preview del build funciona con su CSP y workers. |

Automatizar lo importante: parser, política de saneado y uno o pocos recorridos de navegador que comprueben integración y solicitudes de red. Usar, por ejemplo, Vitest y Playwright si encajan con el proyecto. La comprobación Android es manual en dispositivo real; la emulación de viewport no la sustituye.

**Salida:** `docs/validation-e1.md` con fecha, versiones, dispositivo, casos, resultados y limitaciones. No marcar pendientes como aprobados.

### Paso 8 — Paquete de primera entrega

Entregar código, lockfile, fixtures redistribuibles, README con instalación/ejecución/build, política de privacidad, formatos soportados y límites medidos. Adjuntar decisiones del parser y navegación, evidencia de pruebas y lista priorizada de pendientes para E2.

Proporcionar una preview reproducible del build para revisión. Un enlace público no es requisito de E1 según el alcance actual; si se incorpora, configurar CSP y rutas en ese entorno y verificar de nuevo el flujo principal. No añadir PWA ni service worker para obtener una preview.

**Salida:** la usuaria puede ejecutar la app siguiendo el README y completar el recorrido de lectura con los archivos de prueba.

## 5. Orden y condición de cierre

Secuencia: decisiones y fixtures → spike → base ejecutable → importador → frontera de seguridad → lector → validación → paquete. Las pruebas del parser y seguridad se escriben junto con esos módulos; el paso de validación integra y verifica el conjunto.

Los mayores factores de incertidumbre son la biblioteca EPUB, los enlaces internos/notas y el rendimiento móvil. Conviene estimar fechas después del spike, sin dar por resueltas estas tareas. Si aparece sobrecosto, recortar decoración y funciones opcionales; no eliminar validación, privacidad, seguridad ni recuperación de errores.

E1 se cierra cuando:

- [ ] Se han elegido parser y límites, con evidencia reproducible.
- [ ] Un EPUB AO3 corto y otro multicapítulo se leen y navegan correctamente, o se declara explícitamente que la validación AO3 está pendiente y la entrega es preliminar.
- [ ] Los fixtures de estructura, notas, errores y contenido hostil pasan.
- [ ] No se transmiten ni persisten obras de visitantes.
- [ ] La interfaz funciona en Chrome escritorio y Android real, con teclado y zoom comprobados donde corresponda.
- [ ] Build, tipos y pruebas pasan; README y registro de validación permiten revisar el resultado.

## 6. Fuentes técnicas consultadas

Estas fuentes apoyan las decisiones de formato y seguridad; no sustituyen el spike ni constituyen una evaluación de las bibliotecas en este proyecto.

- [EPUB 3.3 — W3C](https://www.w3.org/TR/epub-33/): estructura, orden de lectura, navegación y maquetación.
- [DOMPurify — documentación oficial](https://github.com/cure53/DOMPurify): configuración de saneado y precauciones al modificar el contenido saneado.
- [DOMPurify — modelo de amenazas](https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model): límites de protección, incluido CSS.
- [zip.js — documentación oficial](https://gildas-lormeau.github.io/zip.js/): candidato para extracción ZIP, streams y workers; sus controles concretos se verifican en el spike.
