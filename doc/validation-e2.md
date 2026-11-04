# Validación de la entrega 2

> Actualización posterior: [mejoras de límites, notas y separadores](mejoras-pdf-limites-notas-separadores.md). Los límites iniciales de 400 páginas de este registro histórico se sustituyen por 10 000; la nueva validación suma 23 pruebas de lógica y 8 recorridos Chrome.

Fecha: 4 de noviembre de 2026, America/Lima.

**Estado:** PDF y ajustes implementados y comprobados en Chrome escritorio; traducción real y Android físico pendientes. No se declara cerrada la certificación completa de E2.

## Entorno

Windows, Node.js 26.13.0, npm 11.20.0; Chrome 156.0.8078.80 con Playwright 1.56.1. Viewports de escritorio 1280/1440 px y móvil 390 × 844; la emulación no es Android. PDF.js 6.5.438, React 19.2.0, DOMPurify 3.4.17, Vite 7.3.7, Vitest 4.1.12. Versiones fijadas en lockfile.

## Resultado

| Comprobación | Resultado observado |
| --- | --- |
| Tipos y build | Correctos |
| Pruebas de lógica | 20 aprobadas en 4 archivos |
| Recorridos en Chrome | 6 aprobados; última ejecución 12,2 s |
| Dependencias de la app | Instalación final: 0 vulnerabilidades reportadas |
| Notas | Siempre visibles; sin details/summary ni botones de ocultar; más estrechas que el fic |
| Capturas sintéticas | Revisadas: EPUB móvil, notas PDF escritorio, ajustes sepia móvil y tema oscuro |
| Muestra privada PDF AO3 | Importada; capítulos 1 y 2 detectados; navegación a capítulo 2 correcta |

Las pruebas de Vitest requieren ejecución fuera del aislamiento usado por Codex en este equipo: el sandbox impide renombrar su caché temporal con EPERM. La ejecución autorizada fuera del aislamiento aprobó. Las primeras pruebas de navegador detectaron una carrera de carga de fuentes y una selección exacta ambigua del tema; se corrigieron antes de la ejecución final. No se contabilizan esos intentos fallidos como aprobaciones.

## Casos comprobados

1. **EPUB:** regresión del flujo E1: apertura, índice con fragmentos, siguiente/anterior, nota auxiliar con retorno, reemplazo inválido conservando sesión y pérdida de obra al recargar. Se sustituyó la comprobación de plegado por bloques visibles de menor ancho.
2. **PDF sintético de tres páginas:** prefacio, capítulos 1 y 2, notas iniciales y finales separadas por sangría, cursiva, texto que parece script mostrado literalmente y no ejecutado. Sin errores JavaScript ni solicitudes externas. Motor y worker PDF funcionan con la CSP del build.
3. **PDF continuo:** documento de una página sin capítulos; se presenta como lectura continua.
4. **Sin texto:** PDF vectorial sin texto extraíble; rechazo con aviso de OCR no disponible. No es una muestra escaneada real: comprueba el mismo caso de ausencia de capa textual, pero no valida todos los escáneres.
5. **PDF corrupto:** firma PDF con contenido inválido; error recuperable sin borrar la obra anterior.
6. **Cancelación:** se retuvo de forma controlada la descarga del worker PDF en el test, se canceló la importación y se comprobó que la sesión EPUB anterior siguiera disponible; una importación PDF posterior completó. Las pruebas de controlador EPUB siguen comprobando terminate al abortar y al agotar tiempo.
7. **Preferencias:** tamaño de 20 px e interlineado de 40 px comprobados con estilos calculados; tema oscuro con fondo esperado, tema sepia, ancho estrecho y ausencia de desbordamiento a 390 px. Solo se guarda el objeto permitido en lector.preferences.v1; al recargar se pierde la obra y se conservan los ajustes. Prueba de validación descarta valores desconocidos y propiedades con texto ajeno.
8. **Traducción preparada:** ayuda accesible y cambio de idioma original aplicando lang al artículo. Esto no equivale a traducirlo ni a mantener una traducción entre capítulos.
9. **Muestra real privada:** validacion/A_stubborn_affliction_of.pdf, ya facilitada en el proyecto. El flujo integrado con PDF.js 6 detectó los dos capítulos, abrió el segundo y no solicitó recursos externos. Las notas no abarcan la mayoría del texto del capítulo 2. No se hizo cotejo exhaustivo de toda la obra, cursivas y cada nota; no se copiaron contenidos a los fixtures ni se tomaron capturas de esa obra.

Los tests de reconstrucción también verifican párrafos, escapado de HTML, fallback por marcadores, destinos internos entre secciones y rechazo de esquemas peligrosos. La muestra real se omite explícitamente si no está disponible en otro equipo.

## Evidencia visual

Se genera al ejecutar E2E en test-results/: lector-movil.png, lector-escritorio.png, pdf-notas-escritorio.png, ajustes-movil.png y tema-oscuro-movil.png. Son textos sintéticos. Las notas quedan con título, línea inferior y margen mayor que el cuerpo del fic, sin fondo gris ni recuadro. No hay barra lateral de capítulos.

## Traducción y accesibilidad pendientes

Se intentó iniciar una comprobación nativa de Chrome con texto sintético. La herramienta de control de aplicaciones se detuvo al no poder identificar la URL con confianza; se suspendieron sus acciones. No se activó el traductor, no se envió la muestra al servicio y no se verificó traducción inicial ni tras cambiar de capítulo. La ayuda del producto expresa esta dependencia y evita pedir recarga.

| Prueba | Estado |
| --- | --- |
| HTML semántico con idioma y guía | Comprobado automáticamente |
| Chrome escritorio: traducir capítulo 1 y pasar a capítulo 2 | Pendiente manual |
| Chrome escritorio: volver atrás y abrir otro archivo tras traducir | Pendiente manual |
| Chrome Android físico: traducción y navegación | Pendiente |
| Android físico: importación, cancelación, memoria y límites | Pendiente |
| Zoom real 200 %, teclado exhaustivo y lector de pantalla | Pendiente; no sustituido por emulación móvil |

## Límites y rendimiento

20 MiB por archivo PDF; máximo 400 páginas, 2 millones de caracteres, 100 000 caracteres/20 000 fragmentos por página, 100 000 operadores por página y 300 capítulos; límite temporal de 120 s. Son presupuestos preventivos sin benchmark de teléfono. La extracción textual tiene contador por fragmentos recibidos. El límite de operadores se revisa después de recibir su lista; no garantiza un límite estricto de memoria de descompresión interna de PDF.js.

Build aproximado: principal 241 kB (78 kB gzip), módulo PDF diferido 461 kB (140 kB gzip), worker PDF 1,27 MB sin gzip; motor EPUB sigue diferido. Los CMaps/fuentes estándar se distribuyen localmente como assets. Los tiempos E2E incluyen automatización y no se presentan como tiempo de primera lectura ni benchmark. Solo se monta una sección, pero el HTML saneado completo permanece en memoria.

## Pendientes conocidos

- Traducción real y dispositivos físicos según la matriz.
- Cotejo más amplio del PDF real y otras exportaciones; EPUB AO3 reales aún pendientes.
- Notas PDF ambiguas cuando no cambia sangría, tablas, columnas, texto rotado y unión de párrafos entre páginas.
- Fixtures de contraseña y estrés para todos los límites numéricos; no se declara probada cada variante adversarial.
- Biblioteca privada, cuentas y sincronización se mantienen para E3; PWA y publicación para E4.
