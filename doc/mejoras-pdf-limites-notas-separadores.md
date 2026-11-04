# Mejoras PDF: límites, notas y separadores

Fecha: 4 de noviembre de 2026. Sustituye los límites iniciales de E2 y corrige los casos señalados por la usuaria.

## Cambios

- Máximo PDF de 10 000 páginas, inclusive; se rechaza 10 001 antes de extraerlas. Para admitir libros grandes se amplían también el archivo a 100 MiB, el texto a 50 millones de caracteres, los capítulos a 10 000 y el plazo de procesamiento a 30 minutos. Se mantienen límites por página y cancelación con terminación del worker. EPUB mantiene sus límites anteriores.
- «See the end of the chapter for notes» es un aviso con enlace a las notas finales, no el comienzo de un bloque que incluya el fic. Se cierra el bloque de notas tras ese aviso y se evita unir la línea siguiente al mismo párrafo. Se conserva su enlace interno.
- Los adornos breves aislados (☙❀❧, * * *, etc.) forman párrafos propios, centrados respecto al ancho del fic. Se detectan antes de unir líneas PDF, y se reconocen también en los párrafos EPUB. No se permite CSS arbitrario de la obra: solo la clase controlada scene-separator.

## Validación

- Build y comprobación de tipos correctos.
- 32 pruebas de lógica aprobadas.
- 11 recorridos Chrome aprobados, incluidos importación real de 401 páginas, rechazo de 10 001 conservando sesión previa, regresión de notas y medición geométrica del centro del separador a 1280 y 390 px.
- Frontera de 10 000 aceptada y 10 001 rechazada en prueba unitaria del mismo validador que usa el importador. No se hizo una extracción completa de 10 000 páginas ni un benchmark de ese tamaño; el límite configurado no promete un tiempo o consumo de memoria concreto en cada equipo.
- Muestra privada AO3: primer párrafo de Chapter 1 fuera de author-notes y adornos ☙❀❧ en párrafos centrados. No se guardan capturas ni fragmentos de la obra real en los fixtures.
- Capturas sintéticas revisadas: test-results/notas-separador-1280.png y notas-separador-390.png.

Se deben recargar la app y volver a abrir los archivos ya importados para regenerar el HTML con las reglas nuevas. Las sesiones anteriores conservan su HTML hasta reemplazarse.

## Ajuste de datos, títulos y notas

- El contenido anterior al primer capítulo se etiqueta como Datos de la obra y no entra en el contador. Sigue disponible en el índice, la secuencia de lectura y un botón en la cabecera.
- Las líneas consecutivas de un título con tamaño de encabezado coincidente se reúnen. El lector muestra todo el título con el mismo tamaño y peso, y permite el salto natural en pantallas estrechas.
- Se reconoce también «for more notes». La referencia se aísla del párrafo siguiente. La vuelta al margen del fic y el aumento del tamaño de letra son señales adicionales para cerrar notas iniciales sin referencia.
- Regresiones sintéticas cubren los tres casos, con notas más estrechas y sin desbordamiento a 1280 y 390 px. Capturas revisadas: test-results/titulo-notas-1280.png y titulo-notas-390.png. La muestra privada disponible sigue pasando; el segundo PDF mostrado por la usuaria no está disponible para una importación directa.

## Limpieza de interfaz y separadores aislados

- Se retiran el botón Cómo traducir y su panel. El idioma del artículo sigue siendo el del archivo.
- Se eliminan las listas generadas «Enlace de la página…» para anotaciones sin texto asociado. Los enlaces pertenecientes al texto se conservan.
- Cualquier línea o párrafo compuesto únicamente por signos, símbolos o adornos se aísla y centra en PDF y EPUB, sin lista de caracteres ni límite de longitud. Se incluyen signos individuales, combinaciones ornamentales y emojis. Las frases con letras y los números no se convierten en separadores. Un signo de puntuación aislado también se interpreta como separador.
- Regresión del asterisco simple con medición del centrado a 1280 y 390 px; comprobación de ausencia del panel de traducción y de enlaces generados en la muestra privada.

## Secciones editoriales y avisos temporales

- Se omiten secciones tituladas Preface, Afterword y la variante Afterworld del índice, navegación, conteo y contenido disponible. No se eliminan capítulos que contengan esas palabras dentro de un título más largo. Los marcadores PDF editoriales se ocultan sin borrar Datos de la obra.
- Los avisos del archivo aparecen en una notificación fija y adaptable, con cierre manual y desaparición automática a los seis segundos. Cambiar de capítulo no reinicia el aviso; abrir otro archivo sí.
- Regresiones con EPUB sintético que contiene ambas secciones y prueba Chrome del temporizador, el cierre manual y el ancho en móvil.
