# Requisitos del producto — Lector web de fanfics inspirado en AO3

**Versión:** 1.0 — 2026-11-02  
**Estado:** especificación previa a la Entrega 1  
**Producto:** lector web público, ligero y centrado en lectura; biblioteca personal privada en una fase posterior.

## 1. Visión y decisiones confirmadas

Permitir que cualquier lector seleccione un archivo EPUB o PDF de su dispositivo y lo lea como texto HTML adaptable con una experiencia familiar a AO3, sin que el archivo se envíe al servidor. Una única cuenta personal autorizada podrá, en una entrega posterior, guardar su biblioteca y progreso en Supabase.

**Principios no negociables:**
1. **Privacidad por defecto:** visitantes anónimos; los archivos públicos solo se procesan en el navegador y no se almacenan en la nube.
2. **Lectura primero:** apariencia familiar a AO3, capítulos, legibilidad en móvil y escritorio; sin copiar identidad oficial o logotipos.
3. **Ligereza:** importar procesadores bajo demanda, renderizar un capítulo por vez y evitar dependencias innecesarias.
4. **Persistencia selectiva:** la nube es exclusivamente para la cuenta autorizada de la propietaria; no para la comunidad.
5. **Traducción sin API pagada:** crear HTML semántico traducible por el navegador; su compatibilidad debe validarse y no puede prometerse en todos los clientes.

## 2. Perfiles y permisos

| Perfil | Acceso | Archivos | Identidad |
|---|---|---|---|
| Visitante | Importar y leer temporalmente EPUB/PDF | Permanecen en memoria local mientras se usa el lector; no hay subida | Anónimo |
| Propietaria autorizada | Todo lo anterior + biblioteca personal, subida/descarga, progreso sincronizado | Supabase Storage privado, opcional caché local | Supabase Auth y autorización verificada mediante RLS |

No habrá publicaciones de fanfics ni catálogos públicos, comentarios, perfiles comunitarios o búsqueda de contenido entre usuarios.

## 3. Alcance por entregas

| Entrega | Incluye | Excluye |
|---|---|---|
| **E1: lector EPUB** | SPA responsive, importación EPUB local, extracción de capítulos, representación HTML sanitizado, navegación y estados de error | PDF, backend, cuentas, almacenamiento remoto, sincronización |
| **E2: PDF + traducción** | PDF.js, extracción de texto PDF no escaneado, heurísticas de párrafos/capítulos, validación de traducción Chrome, ajustes de lectura | OCR, traducción vía API, garantizar traducción en cualquier navegador |
| **E3: biblioteca privada** | Supabase Auth, metadatos PostgreSQL, archivo original en bucket privado, progreso, RLS y permisos exclusivos de propietaria | Cuentas comunitarias, subida pública, repositorio de obras público |
| **E4: PWA + lanzamiento** | Caché del shell, instalación, rendimiento, accesibilidad, documentación, CI y publicación en Cloudflare Pages | Descarga offline garantizada de cualquier archivo de terceros o traducción offline |

> **Orden opcional de validación:** antes de E1, una prueba HTML independiente del framework para comprobar cómo Chrome traduce texto y qué ocurre al navegar entre capítulos.

## 4. Requisitos funcionales

| ID | Requisito | Prioridad | Entrega | Criterio verificable |
|---|---|---|---|---|
| RF-01 | Selección local de un archivo EPUB | P0 | E1 | Un archivo EPUB válido se abre sin solicitud de red para subirlo. |
| RF-02 | Validación de formato, tamaño y errores | P0 | E1 | Archivos inválidos muestran mensaje claro sin bloquear la interfaz. |
| RF-03 | Extraer metadatos disponibles | P1 | E1 | Se muestran título/autor si existen; si faltan, usar nombres genéricos. |
| RF-04 | Obtener orden y contenido de capítulos EPUB | P0 | E1 | La navegación respeta el spine/orden de lectura; hay fallback si no se identifican capítulos. |
| RF-05 | Mostrar texto HTML adaptable | P0 | E1 | La lectura usa párrafos y encabezados legibles, no capturas ni páginas fijas. |
| RF-06 | Navegación anterior/siguiente e índice | P0 | E1 | Se puede cambiar de sección sin perder el archivo cargado. |
| RF-07 | Sanitizar HTML importado | P0 | E1 | Scripts, manejadores `on*` y URLs peligrosas no se ejecutan. |
| RF-08 | Selección local de PDF textual | P0 | E2 | Extrae y presenta texto de PDF digital; PDF escaneado informa limitación. |
| RF-09 | Reconstrucción razonable PDF | P1 | E2 | Une líneas en párrafos sin prometer una estructura perfecta. |
| RF-10 | Compatibilidad experimental con traducir página en Chrome | P0 | E2 | Se documentan pruebas en Chrome Android/desktop, incluyendo navegación de capítulos. |
| RF-11 | Preferencias de lectura temporales/locales | P1 | E2 | Tamaño fuente/espaciado/tema funcionan; localStorage solo guarda preferencias, nunca obras. |
| RF-12 | Acceso privado de propietaria | P0 | E3 | Un visitante y un usuario no autorizado no leen registros ni objetos privados. |
| RF-13 | Guardar/restaurar archivo privado | P0 | E3 | La propietaria sube y recupera EPUB/PDF desde Storage privado. |
| RF-14 | Sincronizar progreso personal | P1 | E3 | Después de cerrar sesión/dispositivo, recupera capítulo y posición razonable. |
| RF-15 | Instalación PWA y caché del shell | P1 | E4 | Página instalable en navegadores compatibles; recursos estáticos disponibles offline tras visita. |
| RF-16 | Sin transmisión de contenido comunitario | P0 | Todas | No existen endpoints de upload público; verificación en DevTools/Network. |

**P0** indispensable; **P1** deseable en su entrega. El tamaño máximo permitido por archivo y el presupuesto de memoria se establecerán tras pruebas con dispositivos reales.

## 5. Requisitos no funcionales

- **Privacidad:** no transmitir archivos de visitantes a Supabase, Cloudflare Functions, analítica ni servicios terceros. No guardar contenido del visitante en IndexedDB/localStorage/cache del service worker.
- **Seguridad:** sanitización de HTML, recursos externos bloqueados o controlados, CSP razonable, evitar `dangerouslySetInnerHTML` sin sanitizador, RLS y Storage policies en E3; nunca incluir `service_role` en cliente.
- **Rendimiento:** dividir imports de PDF.js/EPUB; procesar bajo demanda, mostrar progreso; evitar montar todos los capítulos simultáneamente. Objetivo orientativo: shell inicial usable en red móvil razonable; medir en beta antes de fijar SLO.
- **Accesibilidad:** semántica HTML, orden del foco, navegación teclado, contraste, tamaño táctil, soporte zoom y tecnologías asistivas.
- **Compatibilidad inicial:** últimas versiones estables de Chrome Android y Chrome escritorio; Firefox/Safari con degradación clara de traducción.
- **Resiliencia:** archivo malformado no bloquea el resto de la app. Recuperación visible y opción de importar otro archivo.
- **Costos:** diseño para planes gratuitos, sin garantía de gratuidad perpetua; costos y cuotas vigentes se verifican al desplegar.

## 6. Experiencia de lectura mínima

- Inicio: botón **Abrir archivo**, explicación explícita “el archivo se procesa en tu dispositivo y no se sube”.
- Lector: título, autor (si existe), índice de capítulos/secciones, anterior/siguiente, contenido HTML continuo, ancho de lectura acotado, buenas pausas tipográficas.
- Diseño inspirado en la **familiaridad de lectura** de AO3, sin su logotipo, marca ni apariencia que confunda sobre afiliación.
- Al salir, cerrar pestaña o recargar, se pierde el archivo visitante. Se comunica de forma explícita; no se promete conservar la posición.

## 7. Fuera de alcance

- OCR de PDF escaneado, traducción vía servicios propios, guardado público de archivos, indexación de obras, compartir fanfics, comunidad social, recomendaciones con IA, anotaciones colaborativas y cuentas para lectores públicos.

## 8. Riesgos, hipótesis y validación

| Riesgo | Respuesta | Evidencia necesaria |
|---|---|---|
| EPUB de AO3 con secciones que no coinciden con capítulos | Respetar spine y TOC; fallback a secciones | EPUBs de prueba reales |
| PDF con saltos y encabezados repetidos | Heurísticas acotadas y mensajes claros | PDF textual corto y largo |
| PDF escaneado | Mensaje de no compatibilidad; sin OCR en MVP | PDF de imágenes |
| Chrome no traduce contenido actualizado por React | Prototipo de rutas de capítulo/recarga; probar en Android | Matriz manual por navegador |
| EPUB con HTML hostil o recursos remotos | Sanitizador, reglas de URL, CSP | Pruebas con EPUB malicioso de laboratorio |
| Supabase Free se pausa o cambia cuota | Función de exportación/copia de seguridad personal | Revisar planes al llegar a E3 |

## 9. Definición de terminado para E1

- [ ] Proyecto Vite + React + TypeScript ejecuta build y tests básicos.
- [ ] Un EPUB digital válido se abre localmente, sin backend.
- [ ] TOC/spine navegable y pantalla legible en móvil y escritorio.
- [ ] HTML sanitizado: ningún script importado se ejecuta.
- [ ] Manejo de archivo inválido, vacío o sin TOC.
- [ ] No hay llamadas de subida ni código que persista contenidos públicos.
- [ ] README describe instalación, privacidad y limitaciones.
- [ ] Se documentan resultados de pruebas reales, no solo supuestos.

## 10. Decisiones pendientes antes de cerrar E1

- Elegir **biblioteca EPUB/parser** tras un spike comparativo corto (seguridad, tamaño, TOC, extracción de HTML).
- Confirmar archivos de prueba reales y permiso para usarlos en desarrollo.
- Definir umbral de tamaño/memoria según pruebas de un teléfono de gama media.
- Decidir si el capítulo ocupa ruta de navegador (`/read/:session/:chapter`) o estado interno; la decisión final dependerá de las pruebas de traducción.
