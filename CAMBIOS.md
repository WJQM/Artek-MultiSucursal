# Registro de cambios

## Documentos a color o en blanco y negro (noviembre 2026)
- En Configuración › Colores hay un apartado nuevo, "Documentos impresos": Blanco y negro (como siempre, ahorra tinta) o A color.
- A color, la banda de arriba usa el color Oscuro con una línea del Principal; el código, "Precio", los títulos de las secciones, "Incluye" y las viñetas usan el Principal. Vale para fichas, órdenes, comprobantes, cotizaciones, certificados, extracto y etiquetas QR, y cambia solo al cambiar el estilo del sistema.
- Se guarda junto a los colores (`brand.colors`, campo `print`); los documentos leen las variables `--doc-*` de globals.css.
- Imprimir QR múltiples: el selector "Etiquetas QR / Fichas en media hoja" ahora queda alineado con el resto de la página.


## "Incluye" con viñetas en las fichas (noviembre 2026)
- En la ficha de venta (hoja completa y media hoja) "Incluye" ahora va en un recuadro, igual que las especificaciones, con cada accesorio en su viñeta y en 3 columnas.
- La media hoja muestra hasta 9 accesorios (si hay más, dice "y N más"); antes era una sola línea que se cortaba.


## Menú lateral con los colores elegidos (noviembre 2026)
- En el menú lateral ahora siguen Configuración › Colores: "Sistema de gestión", los grupos (Recepción, Catálogo…), "Sucursal activa", la línea y la etiqueta de rol de la tarjeta del usuario, "Exportar", "Mi cuenta" e "Instalar app". Antes quedaban en celeste fijo.
- Con los colores originales se ve igual que antes. "Importar" sigue en azul a propósito.


## Colores de la página en Configuración (noviembre 2026)
- Nuevo apartado Configuración › Colores: 6 estilos listos (Original, Azul, Verde, Morado, Vino, Gris), dos colores a elección (Principal: botones y enlaces; Oscuro: menú, barra de arriba y portada), vista previa del sistema y del portal, y "Volver a los originales".
- Si un color es muy claro para letras blancas, se usa un tono más oscuro y la pantalla lo avisa (contraste mínimo 4.5 para el Principal y 9 para el Oscuro).
- Los colores se guardan en KeyValue (`brand.colors`); el servidor calcula los tonos (`src/shared/brand-colors.ts`) y los escribe en la página, junto con el color de la barra del celular y de la app instalada. Con los originales no se escribe nada.
- El fondo del menú lateral, los fondos claros de los botones elegidos, el título del inicio de sesión y el brillo del seguimiento ahora también siguen los colores elegidos. Los documentos impresos siguen en negro.


## Colores de la marca en variables (noviembre 2026)
- Los colores de la marca (turquesa y azul oscuro) que estaban escritos a mano en unas 50 pantallas ahora salen de variables en `globals.css`: `--accent` y sus tonos (`--accent-light`, `--accent-dim`, `--accent-bright`, `--accent-ink`, `--accent-bg`, `--accent-bg-hover`, `--accent-on-dark`, `--accent-rgb`, `--accent-bright-rgb`) y `--brand-dark` / `--brand-dark-deep` para el menú y las portadas.
- No cambia nada visible (comparado pantalla por pantalla). Prepara el apartado Configuración › Colores.
- Siguen fijos a propósito: colores de estados y categorías, el logo, los documentos impresos (negros) y la lista de compra.


## Fichas distintas en la misma hoja (noviembre 2026)
- "Imprimir QR múltiples" tiene un selector nuevo: Etiquetas QR (como antes) o Fichas en media hoja. Con fichas se eligen equipos y consolas mezclados; la pestaña "Elegidas" las muestra en orden (con su número de hoja) para quitar alguna.
- La barra cuenta las hojas ("3 fichas · salen 2 hojas") y abre `/qr-batch/fichas`: dos fichas distintas por carta horizontal, en el orden elegido, con línea de corte y salto de página; si son impares, la última mitad queda en blanco.
- Los datos de cada ficha salen de un solo lugar (`src/frontend/lib/fichas.tsx`), que también usan las fichas individuales de equipos y consolas. Nueva pieza `DocPair` (dos mitades distintas) en DocKit.
- Sin foto, el ícono de la ficha en media hoja se ve más grande.


## Letras guardadas en el sistema (noviembre 2026)
- Plus Jakarta Sans (variable 200–800) y Playfair Display (600 cursiva, título de Novedades) se guardan en `src/frontend/fonts/` (licencia SIL OFL 1.1, ver LICENCIAS.md).
- El build ya no descarga letras de Google Fonts: antes, si fallaba esa conexión, el build se caía (también en el servidor con `actualizar.sh`).
- Al abrir el sistema tampoco se piden letras a Google (se quitó el `@import` de Google en `globals.css` y la copia repetida de `layout.tsx`): una sola descarga, desde el propio servidor. Se ven igual que antes.


## Fichas en media hoja carta (noviembre 2026)
- Fichas de equipos (EQ) y consolas (CN): nuevo modo "Media hoja" junto a "Ficha" y "Solo QR". Imprime la misma ficha dos veces en una carta horizontal, con línea para cortar (14 × 21,6 cm cada una).
- Cada mitad lleva la banda negra con el código, foto, nombre, disponibilidad, precio grande, QR para WhatsApp, hasta 6 especificaciones en recuadros, lo que incluye y el pie; ocupa todo el alto de la media hoja.
- El modo queda en la dirección (`?mode=media`).


## Configuración por apartados (noviembre 2026)
- Configuración abre con 6 tarjetas: Empresa, Portal de clientes, Garantía y condiciones, Avisos y mensajes, Respaldos y nube, e Integraciones. Cada una muestra su estado ("Listo", "Falta enlace", "Sin celular", "Activo"…).
- Al tocar una se ve solo ese apartado, con botón para volver; la dirección cambia (`?s=empresa`…) y "Atrás" del navegador vuelve a las tarjetas.
- Empresa: logo, datos y vista previa. Portal: foto de portada (subir, cambiar o quitar) y enlace público. Garantía: días y términos impresos. Los tres guardan con su botón Guardar.
- Avisos (dueño, resumen del día, correo, Telegram), Respaldos (respaldos, nube R2, monitor) e Integraciones (pagos QR, IA, IMEI, reseñas de Google) se guardan al instante, como antes.


## Portal renovado: novedades, portada con foto, catálogo más limpio y sucursal con mapa grande (noviembre 2026)
- Portada: a la derecha, carrusel "Novedades" con lo último agregado con foto en todo el catálogo (productos, repuestos, programas, videojuegos, consolas y equipos; máx. 10) (`PortalNewCarousel.tsx`). Título "Novedades" centrado, con serifa en cursiva entre dos líneas finas (Playfair Display servida por el propio sistema con next/font); el contador "1 de 5" va junto a los puntos. Cada foto dice su sección ("Producto · Baterías", "Programa · Office"…). Pasa solo cada 5 s (al tocar una flecha o un punto vuelve a contar desde cero), se detiene con el mouse, tiene flechas y puntos, y al tocar abre la ficha o el producto en el catálogo. Lo que se agrega aparece solo (el portal se recarga cada 15 s). Mientras carga o si no hay conexión con el servidor, la portada muestra el esqueleto de carga del carrusel y el catálogo esqueletos de tarjetas (se reintenta solo cada 15 s); sin ninguna novedad con foto, no se muestra nada a la derecha.
- El código de la orden se escribe bajo el título, en un cuadro vacío (sin texto de ejemplo).
- Catálogo: las categorías salen una sola vez (se quitó la franja repetida). 4 filas por página en vez de 7 (también en Programas), para que no llene toda la pantalla. Tarjetas de productos y repuestos de la misma altura, disponibilidad en texto ("27 en stock", "Últimas 3") en vez de la etiqueta oscura, la sucursal solo si hay más de una y el botón Consultar discreto.
- Revisión en celular, tablet y PC: botones del carrusel de 40 px y puntos con área de toque más grande, teléfonos de sucursales más fáciles de tocar, y el carrusel en tablet vertical limitado a 520 px para que no quede gigante.
- Sucursal: fondo claro; con una sola sucursal, el mapa va grande al lado de dirección, teléfono, horario y botones.
- Pantallas anchas (1700 px o más): el portal se ensancha y a la derecha del catálogo va una columna (`PortalSide.tsx`) con las sucursales (cada una con su mapa, abierto ahora, horario, Cómo llegar y WhatsApp), reseñas y Cómo trabajamos; se queda en su lugar (no acompaña al bajar); esas secciones ya no se repiten abajo. En pantallas más chicas y en celular siguen al final como antes. El enlace "Sucursales" lleva a la columna cuando está visible.
- Foto de portada del portal (se elige en Configuración, v127): una foto de fondo para la parte de arriba del portal (KeyValue `portal.cover`, solo direcciones `/uploads/…`). Con foto, la foto cubre todo sin repetirse y se oscurece hacia la izquierda (en línea, sin depender de la hoja de estilos) con una sombra suave en las letras para que el texto blanco se lea; sin foto queda el fondo azul oscuro.


## Catálogo: especificaciones en recuadros (noviembre 2026)
- En la ventana de detalle de Equipos, cada especificación va en su propio recuadro (etiqueta con ícono arriba y el dato en negro) en vez de texto suelto con un color distinto por dato.
- Consolas usa el mismo recuadro en lugar de fondos de colores distintos; en celular siguen en una columna.


## Fichas de equipos y consolas en una sola hoja carta (noviembre 2026)
- La ficha (EQ/CN) ya no se pasa a una segunda hoja: foto más baja, especificaciones en tres columnas y recuadros más justos (igual en pantalla y en papel; en celular sigue en una columna). La foto queda fija dentro de su recuadro y siempre se ve completa.
- Seguro al imprimir: si aun así no cabe (notas muy largas), la hoja se achica sola lo justo para entrar en una carta y vuelve a su tamaño al terminar.


## Extracto general sin errores de memoria (noviembre 2026)
- "Imprimir extracto" abre una ventana que cuenta cuántos equipos y hojas saldrán (Filtros de la pantalla, Este mes, Mes pasado, Últimos 7 días, Solo en taller). Más de 2.000 equipos ya no se imprimen: el navegador se quedaba sin memoria ("Out of Memory"); se pide un rango más corto o el Excel.
- La hoja se abre en una página propia, `/extracto/imprimir?desde=…&hasta=…` (antes era una pestaña about:blank que no se podía recargar), con el diseño de banda negra y nombre de archivo al guardar como PDF.
- Avisos claros si falta la sesión, no hay permiso, falla la conexión (con Reintentar) o son demasiados equipos.
- "Descargar Excel" baja las órdenes del período elegido (sin fechas: los últimos 3 años).
- `/api/repairs?count=1` solo cuenta, sin descargar la lista. El extracto por cliente avisa si el navegador bloquea la ventana.


## Documentos en blanco y negro con membrete de banda negra (noviembre 2026)
- Recepción, comprobante de entrega (doble copia y hoja completa), cotización, nota de venta, fichas de equipos/consolas y etiquetas QR: solo negro para impresoras de tóner. Banda negra arriba con el nombre del negocio y el número; cada sección en un recuadro de línea negra fina con su título; tablas con líneas finas y el total a la derecha.
- La recepción ya no lleva firmas (quedan en el comprobante de entrega); los accesorios van con viñetas en dos columnas.
- Sin íconos decorativos ni mayúsculas espaciadas; el logo solo sale si el negocio subió una imagen (en gris).
- Certificado de licencia en negro y sin el sello dorado.
- Reporte mensual, extracto, inventario, catálogo y lista de compra con la misma banda negra; estados y montos en negro, barras en grises.


## Esqueletos de carga en todo el sistema (noviembre 2026)
- En vez del texto "Cargando...", las pantallas muestran cajas grises con la forma de lo que va a aparecer (`src/frontend/components/Skeletons.tsx`, estilos `sk-*` en `globals.css`).
- Pantalla completa (menú lateral o barra en celular) en 16 pantallas internas; tarjetas y gráfico en Estadísticas, Caja chica y el resumen del día; lista en Usuarios, Sucursales, Servicios, Rendimiento, Reportes técnicos, Mi cuenta, cita y apartado; hoja en comprobantes, cotizaciones y fichas para imprimir.
- Avisan "Cargando…" a los lectores de pantalla y quedan quietos con "reducir movimiento".


## Formularios de entrada sin textos de ejemplo (noviembre 2026)
- Login del personal, Super Admin, recuperación de contraseña y pasos de verificación: sin textos grises de ejemplo ("nombre@correo.com", "71234567", "Tu nombre completo"…); la etiqueta de cada cuadro basta.
- Contraseña nueva: la regla va debajo del cuadro ("Mínimo 8 caracteres, con letras y números."), igual a la que exige el servidor.
- Celular: el cuadro muestra "+591" fijo a la izquierda (`src/frontend/components/PhoneInput.tsx`); se sigue guardando el número de 8 dígitos.
- Se mantienen las guías de los códigos de verificación ("••••••", "XXXX-XXXX").


## Pantallas de entrada con un mismo diseño (noviembre 2026)
- El login del personal y el del Super Admin usan el mismo diseño (`src/frontend/components/AuthLayout.tsx`): panel oscuro con la marca y el formulario centrado.
- Super Admin: sin degradado, cuadrícula ni anillo; título "Administración general del sistema", botón turquesa y enlace "Ingreso del personal" junto a la nota de área restringida.
- Formulario más cómodo: cuadros de 48 px y letra de 16 px (el celular no hace zoom); en celular, franja oscura arriba con logo y título.
- Personal: se quitó el enlace repetido al registro (queda la pestaña "Registrarse"). Íconos en dos tonos.


## Íconos Phosphor en dos tonos (noviembre 2026)
- Todo el sistema usa íconos Phosphor en estilo "dos tonos" (relleno suave del mismo color) en vez de Lucide.
- Un solo archivo, `src/frontend/components/icons.tsx`, guarda la equivalencia de los 139 íconos; las pantallas los usan con los mismos nombres de antes. Para cambiar un ícono o el estilo se edita solo ese archivo.
- Se quitó `lucide-react` y se agregó `@phosphor-icons/react` (2.1.10, versión /ssr, sirve en servidor y navegador).


## Un solo botón de WhatsApp (noviembre 2026)
- Portal y seguimiento: queda solo el botón flotante "Escríbenos" (siempre en el mismo lugar y permite elegir sucursal cuando hay varias).
- Se quitó el botón "Escríbenos" de la barra superior del portal y el botón "WhatsApp" del cuadro de la sucursal en el seguimiento; "Cómo llegar" ocupa todo el ancho.
- Se mantienen el botón "Consultar" de cada producto y el WhatsApp de cada sucursal en la sección Sucursales.


## Datos con tipo y lint en cero (noviembre 2026)
- Los 92 `any` que quedaban ahora tienen su tipo: rutas de órdenes, seguimiento, certificados, cotizaciones, búsqueda, caja, traspasos e inventario (con los tipos de Prisma), verificación de sesión, y pantallas de portal, escáner, seguimiento, certificados, caja, usuarios, traspasos, nueva orden, QR por lotes, inicio de sesión en dos pasos, reseñas, menú lateral e instalación de la app.
- `npm run lint`: 0 problemas (antes 281).
- **Corrección:** en Editar orden, dejar vacío el equipo o el problema hacía fallar el guardado; ahora se conserva el valor anterior y se guarda el resto.
- Búsqueda: una cuenta (no superadmin) sin sucursal asignada no ve resultados, en vez de terminar en error.


## Limpieza del código (noviembre 2026)
- `npm run lint`: de 281 problemas (124 errores, 157 avisos) a 92 errores, todos de datos sin tipo (`any`); 0 avisos.
- Código sin usar fuera: respaldo e importación viejos del panel, estados y funciones sueltas; 14 pantallas ya no piden `/api/settings` sin usarlo.
- La carga inicial va debajo de su función en sucursales, usuarios, traspasos, caja, QR por lotes, estadísticas y menú lateral.
- Efectos: `router` agregado donde faltaba; las recargas a propósito y la lectura de sesión al abrir llevan una nota que lo explica.
- Regla `no-img-element` apagada con su motivo (fotos subidas de tamaño variable); texto alternativo en 3 fotos.
- Cotización y comprobante impresos: la hora se toma una vez al abrir la hoja.


## Paleta corta de colores (noviembre 2026)
- 24 colores con nombre en `globals.css`: verde (`--ok`), rojo (`--danger`), ámbar (`--warn`) y azul (`--info`), cada uno con versión fuerte (`-bright`), fondo (`-bg`) y borde (`-line`); además `--text-faint`, `--border-strong` y `--border-soft`.
- 95 tonos casi iguales se juntaron: unos 790 colores de los estilos usan ahora estas variables y 137 quedan como código con el tono unificado (los que llevan transparencia o van en hojas impresas en otra ventana).
- Tonos distintos: de 207 a 157. Se mantienen los colores de marcas y del catálogo, avatares, confeti, menú lateral y encabezado del seguimiento.
- Revisión de diseño: unos 19/20.


## Formularios con nombre y fotos con carga diferida (noviembre 2026)
- 85 campos sin nombre ahora lo tienen (buscadores, filtros, sucursales, usuarios, caja, citas, lista de compra, reserva del portal, configuración). Los lectores de pantalla los anuncian y el navegador autocompleta mejor.
- En la configuración de nube y correo, tocar el nombre del campo activa el cuadro (13 campos).
- Carga diferida en 15 fotos de listas (equipos, consolas, programas, videojuegos, inventario, extracto, estadísticas, chat, historial de reparación, usuarios, traspasos, QR por lotes). Logos, QR, vistas previas y hojas para imprimir cargan de inmediato.
- Nada cambia a la vista. Revisión de diseño: unos 18/20.


## Sin morados y estados con un solo color (noviembre 2026)
- **Estados de las órdenes con el mismo color en todas las pantallas:** Pendiente ámbar, Diagnosticado azul verdoso, Esperando repuestos naranja, En progreso azul, Completado verde y Entregado gris (panel, seguimiento, estadísticas, asignaciones, clientes, extracto, chat y hojas impresas).
- **Morados reemplazados:** los botones "Nuevo…" de Servicios, Programas, Consolas y Ventas usan el turquesa de la marca; las notas de venta y las ventas pasan a azul; programas, laptops, el técnico elegido, la propuesta de la IA y la verificación en dos pasos usan tonos de la marca.
- El botón "Imprimir QR" ya no tiene degradado.
- Se mantienen los colores por marca o categoría del catálogo, los avatares del chat y de los técnicos, y el confeti.


## Orden interno de colores y librerías (noviembre 2026)
- 511 colores escritos a mano en 69 archivos ahora usan las variables del sistema (`--accent`, `--accent-dim`, `--accent-light`, `--text-primary`, `--text-secondary`, `--text-muted`, `--bg-tertiary`, `--bg-primary`). Se ven igual; cambiar un tono ahora se hace en un solo lugar (`globals.css`).
- Se quitaron dos librerías sin uso: `framer-motion` y `sileo` (los avisos usan su propio código en `src/frontend/lib/toast.ts`). La instalación tiene 5 paquetes menos.
- Revisión de diseño: de 13/20 a unos 16/20 (medido en el código). Pendiente: etiquetas de formularios, carga diferida de imágenes y los tonos morados.


## Portal y pantallas del cliente sin aspecto genérico (noviembre 2026)
- **Reservar cita, enlace de cita y de apartado:** estados, sucursal y "Cómo llegar" con íconos de línea; enlace inválido con ícono de enlace roto.
- **Certificado público:** barra superior con íconos de imprimir y cerrar.
- **Formulario de reseña:** calificaciones sin caritas ("Excelente", "Muy bien"…); las estrellas ★ se mantienen.
- Verificación en dos pasos, aviso de garantía, aviso de WhatsApp, "Oculto en portal", vista previa de contacto y apartados por vencer sin emojis.
- Reporte mensual impreso: la columna de estado ya no muestra emoji.
- Se quitaron íconos guardados en el código que no se mostraban (seguimiento, portal, hoja de reportes, comprobante).
- Los mensajes de WhatsApp, los íconos de servicios guardados en la base y las estrellas ★ se dejan igual.
- Método: unslop by @heydamir (CC BY 4.0).


## Menú lateral y pantallas del personal sin aspecto genérico (noviembre 2026)
- **Menú lateral:** cada sección con un ícono de línea en vez de emoji; también "Mi cuenta" e "Instalar app".
- **Citas, Escáner QR, Certificados, Reseñas, Clientes, Sin recoger, Mi cuenta, Exportar e Imprimir QR múltiples:** títulos limpios, íconos de línea y etiquetas sin MAYÚSCULAS.
- Chat, historial de estados y bitácora de reparación sin emojis; Reportes técnicos usa los mismos íconos que la bitácora.
- Se quitaron emojis guardados en el código que ya no se mostraban (Mis asignaciones, tarjetas del Panel).
- Método: unslop by @heydamir (CC BY 4.0).


## Reportes y estadísticas sin aspecto genérico (noviembre 2026)
- **Panel de estadísticas:** tarjetas de ingresos con solo nombre y monto, técnicos numerados #1, #2, #3, secciones con íconos de línea y etiquetas sin MAYÚSCULAS.
- **Extracto general:** sin emojis en título, tarjetas, filtros y tabla; estados como etiquetas de color.
- Hojas impresas del extracto y de la lista de compra sin emojis; sin logo, el recuadro muestra la inicial de la empresa.
- Rendimiento por técnico con ★ para la calificación. Reportes técnicos, Lista de compra y Movimientos de stock sin emojis.
- Método: unslop by @heydamir (CC BY 4.0).


## Impresiones sin aspecto genérico (noviembre 2026)
- **Recepción, Comprobante de entrega, Cotización y Nota de venta** (hoja completa y doble copia) con íconos de línea en vez de emojis en cada sección.
- Datos de contacto de las hojas (teléfono, dirección, sucursal) sin emojis.
- **Fichas de equipo y consola:** cada especificación con su ícono; sin foto se ve un dibujo gris del equipo.
- **Catálogo de equipos, inventario impreso, etiquetas QR y reporte mensual** con íconos de línea; los técnicos del reporte se numeran #1, #2, #3.
- Etiquetas sin MAYÚSCULAS y sin el círculo decorativo del encabezado. Corregido "[object Object]" en el título de la nota de venta.
- Método: unslop by @heydamir (CC BY 4.0).


## Configuración y administración sin aspecto genérico (noviembre 2026)
- **Servicios:** el ícono elegido para cada servicio se muestra como ícono de línea (se guarda igual que antes, sin migrar nada). Nueva orden y Editar orden muestran el ícono propio de cada servicio.
- **Usuarios, Sucursales y Transferencia** sin emojis: títulos limpios, botones con íconos de línea, horario con visto o círculo tachado, pestañas con el ícono de su tipo.
- **Configuración de la empresa y Tareas automáticas** (respaldos, WhatsApp del dueño, nube, correo, cobro QR, Telegram, IA, IMEI, reseñas) con íconos de línea.
- Mi cuenta: avisos en el celular, Telegram e instalar la app sin emojis.
- Método: unslop by @heydamir (CC BY 4.0).


## Caja sin aspecto genérico (noviembre 2026)
- **Caja chica, Nuevo movimiento, Cierre de caja y Resumen del día** sin emojis: títulos y botones con íconos de línea.
- Cada movimiento muestra un ícono según su categoría (repuestos, servicios, sueldos, ventas, ajuste, otros); Ingreso y Egreso con flechas.
- Tarjetas Hoy / Este mes / Filtro actual sin recuadro de color. En el Resumen del día se quitó la etiqueta repetida en MAYÚSCULAS.
- El mensaje que se envía al dueño por WhatsApp no cambia.
- Método: unslop by @heydamir (CC BY 4.0).


## Ventas y apartados sin aspecto genérico (noviembre 2026)
- **Cotizaciones, Notas de venta y Apartados** sin emojis: títulos limpios, íconos de línea en filas, detalle, botones y secciones para elegir artículos.
- Cada artículo muestra un ícono según su tipo (producto, equipo, consola, servicio, programa, videojuego u otro).
- Recuadros de las secciones en gris neutro; nombres de artículos y formas de pago en texto limpio.
- "Mostrar al cliente" (cobro con QR) con ícono de pantalla completa. Etiquetas sin MAYÚSCULAS y letra un poco menos gruesa.
- Método: unslop by @heydamir (CC BY 4.0).


## Inventario sin aspecto genérico (noviembre 2026)
- **Inventario, Equipos, Consolas, Programas y Videojuegos** sin emojis: títulos limpios, botones e íconos de línea, formularios con el mismo estilo de los de orden.
- Tarjetas de totales sin recuadro de color: solo nombre y número; "Stock bajo" se pinta en ámbar solo cuando hay productos bajos.
- Datos técnicos de las tarjetas (procesador, RAM, disco, color, idioma…) en etiquetas grises simples.
- Disponible / Vendido / Reservada con punto de color; plataformas y listas desplegables en texto.
- Los íconos de línea se muestran al lado del texto (antes, en algunos botones, quedaban encima).
- Método: unslop by @heydamir (CC BY 4.0).


## Formularios de orden sin aspecto genérico (noviembre 2026)
- **Nueva orden, Editar orden, Entregar equipo y "Registrar y avanzar"** usan íconos de línea en lugar de emojis: secciones, tipo de equipo, estados, accesorios, servicios, programas, juegos, fotos y botones.
- Recuadros de íconos en gris neutro (sin fondos de colores) y sin círculos decorativos en el encabezado oscuro.
- Prioridad Normal / Alta / Urgente con un punto de color. El resumen de la orden y las pestañas quedan en texto limpio.
- Campo IMEI sin emojis en los avisos (se mantienen ✓ y ✗). Letras un poco menos gruesas en los formularios.
- Método: unslop by @heydamir (CC BY 4.0).


## Portal sin aspecto genérico (noviembre 2026)
- **Íconos de línea** en lugar de emojis en todo el portal: pestañas del catálogo, tarjetas, detalles de equipos, consolas y programas, sucursales, apartar, "Avisarme", escáner de QR y "Cómo funciona". Íconos en color neutro, sin fondos de colores.
- Estados de equipos y consolas con un punto de color.
- Se quitó la etiqueta "Servicio técnico" sobre el título y los círculos decorativos de las franjas oscuras.
- Al pasar el mouse las tarjetas cambian solo el borde y la sombra, sin saltar ni girar. La sombra del botón flotante de WhatsApp es neutra.
- Etiquetas en texto normal (sin MAYÚSCULAS) y pesos de letra más livianos. Las estrellas de las reseñas se mantienen.
- Método: unslop by @heydamir (CC BY 4.0).


## Panel, Mis asignaciones y Seguimiento sin aspecto genérico (noviembre 2026)
- **Íconos de línea** (lucide) en lugar de emojis, en un solo estilo y con el color del texto: barra superior, campana, buscador, tarjetas, tabla, detalle, Bitácora técnica y Seguimiento. Pieza común nueva `UiIcons`.
- **Estados** con un punto de color, y en el seguimiento cada etapa con su propio ícono.
- **Títulos** con el nombre de la pantalla ("Panel · sucursal", "Mis asignaciones") en vez del saludo.
- **Tarjetas de resumen** con nombre y número sin ícono; solo "Listas para entregar" y los avisos llevan color.
- **Letra:** sin MAYÚSCULAS espaciadas en etiquetas y con pesos más livianos.
- El **código de orden** se ve como una pequeña etiqueta impresa en la tabla, el celular y el seguimiento.
- Se quitó el círculo decorativo de las franjas oscuras, y la etapa actual del seguimiento ya no late.
- Método: unslop by @heydamir (CC BY 4.0). Los formularios de orden quedan para una fase siguiente.


## Barra superior oscura y Mis asignaciones igual al panel (noviembre 2026)
- **Barra superior en computadora:** azul oscuro, como en el celular, en todas las pantallas internas y en el Panel. Buscador, hora y campana adaptados a ese color.
- **Mis asignaciones:** misma tabla del Panel para ver las órdenes sin desplegar, con tarjeta corta en celular. También usa las mismas tarjetas de resumen, buscador, filtros y título.
- La columna "Siguiente" conserva el botón rápido del técnico para avanzar la orden.
- **Panel:** escribir o usar Espacio y Enter dentro de una orden abierta ya no cierra la fila.


## Mis asignaciones con el mismo detalle del panel (noviembre 2026)
- El detalle de la orden del técnico usa el diseño del panel: fotos, Cliente y Equipo de igual altura, Detalles estirado hasta el Seguimiento, y Accesorios junto a la Bitácora.
- Se agregó "Técnico asignado" en Cliente. Las acciones siguen siendo las del técnico: avanzar, WhatsApp y Chat.
- Al abrir una orden se oculta la línea de avance de la fila, porque el progreso ya se ve en Seguimiento.
- En celular, "Pasar a…" ocupa toda la fila (también en el panel) para que su texto no se salga.


## Ajustes de fotos, efectos táctiles y estructura (noviembre 2026)
- **Panel:** las miniaturas de las órdenes se cargan cuando están por aparecer, para gastar menos datos.
- **Celular:** los efectos de pasar el mouse ya no se quedan marcados al tocar, y tocar un aviso no detiene su tiempo.
- **Portal, reserva y seguimiento:** marcan su contenido principal; "Reservar cita" es el título principal de su página.
- **Seguimiento:** las etiquetas de etapas crecen a 11 px desde 390 px y a 10,5 px desde 370 px, solo donde caben.


## Formularios, ventanas y confirmaciones más claros (noviembre 2026)
- **Confirmaciones propias:** los mensajes del navegador se reemplazaron por ventanas y avisos con el diseño del sistema. Los botones dicen qué hacen ("Eliminar", "Sí, cancelar", "Volver").
- **Ventanas:** comportamiento común: el foco entra al abrir, Tab no se sale y vuelve al botón de origen al cerrar. Escape cierra también las que no lo hacían.
- **Etiquetas conectadas:** 47 etiquetas activan su campo al tocarlas y los lectores de pantalla saben qué pide cada uno.
- **Teclado:** tarjetas, fotos e íconos con acción se activan con Enter o Espacio; las opciones de impresión son botones reales.


## Correcciones de lectura, uso en celular y animaciones (noviembre 2026)
- **Sin líneas de color:** se quitaron de los avisos, el menú lateral y la búsqueda general; las tarjetas activas del panel llevan borde completo.
- **Zoom permitido en el celular.** Los campos usan 16 px también en tablets táctiles, para que la pantalla no se acerque al escribir.
- **Mejor contraste:** categorías, textos de ayuda, estrellas, "Pocas unidades" y botones de WhatsApp (verde más oscuro).
- **Celular:** los efectos de mouse ya no se quedan pegados al tocar, sin destello gris y con respuesta propia al presionar. "Consultar", paginación, botones de sucursal y flecha de volver miden 44 px; las categorías, 40 px. La ventana de reserva usa el alto visible real.
- **Animaciones:** cada botón anima solo lo que cambia, las pantallas entran más rápido, los contadores rebotan menos y los avisos se pueden interrumpir sin saltos. Con "reducir movimiento" las animaciones infinitas se detienen.
- El lint ya no revisa las skills instaladas en `.claude`.


## Animaciones en el seguimiento del cliente (noviembre 2026)
- Dibujo animado propio para cada etapa: reloj de arena, lupa, caja, engranajes, check de listo y celular entregado (`lottie-web`, formato liviano, descargado aparte).
- La línea de etapas se llena sola y avanza cuando cambia el estado; el aviso entra con la campana en movimiento.
- Confeti al quedar listo, una sola vez por orden en cada dispositivo.
- Los dibujos se pausan si la pestaña está oculta o ya no se ven. Con "reducir movimiento", o si la animación no carga, queda el ícono de siempre.


## Seguimiento del cliente con el estado primero (noviembre 2026)
- **Arriba:** el estado de la orden en grande y una sola línea con las 6 etapas. Cuando el equipo está listo, la franja se pone verde.
- **Tres datos a la vista:** costo, fecha de recibido y qué sigue (o dónde recoger, o la fecha de entrega).
- **Dos columnas de igual altura:** Tu equipo, Bueno saber y Mientras esperas a la izquierda; sucursal con mapa, horario y botones a la derecha. El mapa y el recuadro del problema se estiran para que no queden huecos.
- Informe técnico, notas de entrega y reseña van debajo a todo el ancho; en celular el informe aparece antes que la sucursal.
- El informe técnico ya no tiene borde ni línea verde.


## Panel principal: lista en tabla y detalle más profesional (noviembre 2026)
- **Lista de órdenes como tabla compacta:** una fila por orden con foto (o ícono), código y equipo, cliente, técnico, estado, último cambio y monto; se ven el doble de órdenes por pantalla. Las estancadas ya no tienen el borde rojo con brillo: dicen "⚠️ N días" en la columna "Últ. cambio". En el celular cada orden sigue como tarjeta corta.
- **Detalle de la orden (se abre dentro de la lista, como antes):** fotos arriba; Cliente y Equipo con Detalles debajo a la izquierda, y Seguimiento (círculo + etapas con ✓, la actual en ámbar) a la derecha. Detalles se estira hasta la altura del Seguimiento, así no queda espacio en blanco. Abajo Accesorios y Bitácora con la misma altura.
- Encabezados azul oscuro finos (borde de 1 px en vez del borde grueso), datos sin cajitas dentro de cajitas y botones parejos: solo "Pasar a …" y WhatsApp con color, el resto en blanco y eliminar a la derecha.
- Tablet: Seguimiento con el círculo a la izquierda y las etapas a la derecha. Celular: una columna, sin el círculo, botones de 2 en 2.


## Diseño responsivo revisado en PC, laptop, tablet y celular (noviembre 2026)
- Se revisaron 41 pantallas y documentos en 12 anchos (1920, 1440, 1366, 1280, 1180, 1024, 900, 768, 600, 480, 375 y 320 px), buscando textos que se salen de su tarjeta o quedan cortados.
- **Estadísticas:** los montos grandes ("Bs. 12.478.437,00") se salían de las tarjetas en laptops de 1366–1440 px. Ahora el ícono y el nombre van arriba y el monto se ajusta solo al ancho de la tarjeta.
- **Portal:** los botones de categoría se encogían y cortaban el texto en celular y tablet.
- **Recepción y doble copia de cotización (768 px):** el monto del costo se cortaba; ahora baja de línea si no entra.
- **Celulares chicos (320–380 px):** botones de Usuarios de 2 en 2, accesos rápidos del panel en una columna, botón "Recordar a todos por WhatsApp" en dos líneas, guía de códigos del Escáner y pestañas del comprobante ajustadas.


## Sin líneas de color en listas y detalles (noviembre 2026)
- Se quitó la línea de color a la izquierda en: Citas, Apartados, Reseñas, Reportes técnicos, la bitácora técnica, el campo IMEI, el detalle de la orden (panel y Mis asignaciones), los selectores de Transferir y el selector de sucursal del menú. El color ya se ve en la etiqueta de estado, las estrellas, el ícono o el título.
- Notas de la cotización, "Problema reportado" y el aviso "tomar la orden" del seguimiento: fondo suave con borde completo en vez de la línea.
- Se borraron las clases `stat-card-*` (línea arriba) que ya no se usaban.

## Sin líneas de color en las tarjetas de resumen (noviembre 2026)
- **Estadísticas** (ingresos, desglose, ticket promedio y visitas del portal) y **Caja chica** (Hoy, Este mes, Filtro actual): se quitó la línea de color a la izquierda o arriba de cada tarjeta (se curvaba en las esquinas). Ahora el color va en un cuadrito con el ícono y la tarjeta tiene un borde gris parejo. Clase común nueva `ic-chip`.
- **Documentos:** las tarjetas de los reportes y extractos ya no tienen la línea de color arriba (el número sigue en color), y los recuadros de notas del comprobante tienen un borde fino completo en vez de la línea a la izquierda.

## Certificado de licencia con diseño clásico (noviembre 2026)
- Un solo diseño para la vista previa de Certificados y para la página que abre el QR (antes eran dos distintos). Pieza nueva `CertificateSheet`.
- Doble filete azul fino (sin las esquinas sueltas), título "Certificado" con serifa y línea dorada, nombre del cliente grande, licencias en tarjetas con la clave oculta, código / fecha / técnico / sucursal en una fila, QR para verificar, sello dorado con el nombre del taller y línea de firma. Se quitaron la marca de agua "AUTÉNTICO" y el sello de colores. Hoja carta.

## Lista de compra con diseño nuevo (noviembre 2026)
- Franja azul con el logo, "🛒 LISTA DE COMPRA", la fecha y el proveedor; tarjetas (productos, unidades a pedir, debajo del mínimo) y tabla con una casilla ✓ para marcar lo que ya se compró, el stock en rojo si está debajo del mínimo, la cantidad a pedir y una columna libre para anotar el precio. Se sigue imprimiendo sola en carta.

## Catálogo de equipos con diseño nuevo (noviembre 2026)
- Franja azul con "💻 CATÁLOGO DE EQUIPOS" y la cantidad de equipos; tarjetas (equipos y disponibles, laptops, escritorio, valor total y promedio); tabla con encabezado azul oscuro, código en verde agua, CPU · RAM · disco en una columna, estado en color y fila de total.
- Los filtros usados (tipo, estado, búsqueda) se anotan bajo el título. Carta horizontal; en el celular siguen las tarjetas.

## Extracto de inventario con diseño nuevo (noviembre 2026)
- Inventario, productos y repuestos con la franja azul ("📦 INVENTARIO" o "🔩 REPUESTOS"), tarjetas de resumen, tabla con encabezado azul oscuro, estado BAJO / OK en color y fila de total. El resumen por categoría usa el mismo estilo.
- Los montos ahora llevan separador de miles (antes "Bs. 6723018", ahora "Bs. 6.723.018").
- Hoja carta horizontal. En el celular siguen las tarjetas.

## Extractos de órdenes con diseño nuevo (noviembre 2026)
- **Extracto de cliente:** franja azul con el logo y la etiqueta "EXTRACTO DE CLIENTE", ficha del cliente con su total y cuántos equipos tiene en el taller, y tabla con estados en color, costo y total.
- **Extracto general:** franja azul con el rango de fechas, tarjetas (equipos, en taller, entregados, clientes) y la tabla con el mismo estilo. Hoja carta horizontal.
- Arreglo: el título de la barra superior estaba en gris claro sobre blanco y no se leía. Además, los nombres, problemas y celulares ahora se escapan antes de escribirse en la hoja (un nombre con "<" podía romper el documento).

## Reporte mensual con diseño nuevo (noviembre 2026)
- Mismo estilo que la cotización y la nota de venta: franja azul oscuro con el logo y la sucursal, etiqueta ámbar "REPORTE MENSUAL" y el mes en grande.
- Tarjetas de resumen con una línea de color y un dato extra (cobrado, vendido). Ingresos del mes en una franja verde con una barra que separa reparaciones y ventas.
- Órdenes por estado como barra de colores con leyenda; técnicos con 🥇🥈🥉 y una barra del ingreso de cada uno.
- Tablas con encabezado azul oscuro, códigos en verde agua, estados con color y una fila de total al final. Hoja carta, se imprime sola como antes; en el celular las filas siguen como tarjetas.
- Pieza común nueva `ReportSheet` (`src/frontend/components/ReportSheet.tsx`) para los reportes y extractos.

## Enlaces de texto más fáciles de tocar (noviembre 2026)
- "¿Olvidaste tu contraseña?" y "Consulta tu equipo" (login), "← Login del personal" (/setup), "Cómo llegar" (seguimiento), "Ver en el mapa" (Sucursales), "Encenderlos" (Apartados) e "Ir al portal" (cita y apartado) tienen una zona para tocar de unos 40 px de alto (antes 16–20 px). Se ven igual: el espacio extra es invisible (clase `tap-zone`).

## Botones de 40 px para el dedo en el celular (noviembre 2026)
- **Usuarios:** los botones ✏️ 🔄 ⛔ 🔑 🛡️ 🚪 🗑️ (antes de 26 px) van en una rejilla de 3 columnas, de 40 px de alto y con su nombre (Editar, Transferir, Suspender, Clave, App, Sesiones, Eliminar).
- **Equipos, Consolas, Programas, Videojuegos e Inventario:** en las tarjetas de 2 columnas, los botones (Editar, Portal, 🏷️, 🗑️…) van de 2 en 2 y miden 40 px de alto (antes 4 en fila de 31 px, solo con ícono). Los botones − y + del stock pasan de 30 a 40 px.
- Las casillas de marcar (por ejemplo en Exportar) pasan de 13 a 20 px.
- En computadora no cambia nada.

## Letra mínima de 12 px en el celular (noviembre 2026)
- Los títulos de las tarjetas de resumen ("Total equipos", "Categorías", "Disponibles"…) pasan de 10 a 12 px en el celular y ya no se cortan con "…". Afecta Equipos, Consolas, Programas, Videojuegos, Cotizaciones, Extracto y las demás pantallas con tarjetas de resumen.
- Portal en el celular: categoría, stock y demás datos de las tarjetas pasan de 11 a 12 px.
- Usuarios: el correo pasa de 11 a 12 px. La paginación ("Pág 1 de 25") también.

## Resúmenes de 2 en 2 en el celular (noviembre 2026)
- **Caja chica:** el título queda solo en su línea y debajo van los botones ("Nuevo movimiento" a todo el ancho, "Cierre de caja" y "Resumen del día" lado a lado). Las tarjetas Hoy y Este mes van de 2 en 2 y Filtro actual a todo el ancho.
- **Estadísticas:** los totales (ingresos y visitas del portal) van de 2 en 2. Arreglo: en el celular, las cifras grandes del desglose (reparaciones / ventas) se salían de su tarjeta; ahora esas tarjetas van una debajo de otra. La gráfica de los últimos 6 meses se desliza dentro de su tarjeta.
- En computadora no cambia nada.

## Reseñas con "Ver más" (noviembre 2026)
- La lista muestra las 10 reseñas más recientes y un botón "Ver 10 más" (con "10 de 300"). Antes salían todas de una vez (en el celular, unos 41.000 px de alto). Al cambiar el período o los filtros vuelve a 10. El promedio y la distribución no cambian.

## Caja chica por páginas (noviembre 2026)
- Los movimientos se ven de 20 en 20 con la paginación del Panel (‹ Pág 1 de 25 ›). Antes se mostraban los últimos 500 de una vez (en el celular, unas 60 pantallas). Al cambiar el filtro vuelve a la página 1.
- El botón 🗑️ de cada movimiento pasa de 30 a 40 px.

## Reporte mensual en el celular (noviembre 2026)
- En el celular, el resumen va de 2 en 2 y cada orden, entrega, cotización o venta se ve como tarjeta: código y monto arriba, y debajo fecha, cliente, equipo, técnico y estado. Antes eran tablas que había que deslizar de lado.
- Barra superior en azul oscuro con el botón ámbar, como los demás documentos.
- Al imprimir sale la misma hoja carta; solo la letra más chica sube de 9 px a 10 px.

## Inventario y catálogo de equipos en el celular (noviembre 2026)
- La lista para imprimir de inventario, productos y repuestos, y la del catálogo de equipos, se ven en el celular como **tarjetas** (nombre, precio, categoría o código, stock con aviso **BAJO**, estado y especificaciones). Antes era una tabla de 8–11 columnas que no entraba en la pantalla.
- Barra superior en azul oscuro con el botón ámbar "Imprimir", igual que los demás documentos.
- Al imprimir sale la misma tabla en carta horizontal; solo la letra más chica sube de 8–9 px a 10 px.

## Documentos: ajustes en el celular (noviembre 2026)
- Los códigos (OT, CE, COT, NV…) ya no se parten en dos líneas (antes el comprobante público mostraba "CE-" / "25760").
- Seguimiento: las etapas usan letra de 11 px (antes 9.5 px; 10.5 px en celulares muy angostos) y la primera y la última ya no se cortan en el borde.
- Cotización vencida: ya no muestra "Paga con QR"; en su lugar avisa que los precios pueden haber cambiado y ofrece pedir una actualizada por WhatsApp.
- El detalle de cotizaciones y notas de venta en el celular dice "4 productos · 10 unidades" (antes "10 artículos", que contaba unidades).

## QR hechos por el propio sistema (noviembre 2026)
- Los QR de todos los documentos (OT, CE, COT, NV, CL, fichas, etiquetas y seguimiento) ahora los genera el sistema en `/api/qr` (librería `qrcode`), en vez de `api.qrserver.com`. Aparecen al instante, funcionan sin internet, se imprimen nítidos (SVG) y los enlaces de los clientes ya no pasan por un servicio externo. El diseño no cambia.

## Código ordenado en backend y frontend (noviembre 2026)
- Carpetas nuevas: `src/backend` (servidor), `src/frontend/components` y `src/frontend/lib` (pantallas y navegador) y `src/shared` (lo que usan los dos). Antes todo estaba en `src/lib` y `src/components`.
- Las rutas de `src/app` se agruparon en `(backend)` (API, archivos subidos, manifiestos) y `(frontend)` (pantallas). **Las direcciones no cambian**: `/dashboard`, `/portal`, `/api/…` y los QR impresos siguen igual.
- Nada cambia en pantalla ni en el funcionamiento. Al actualizar descomprimiendo un ZIP encima, `limpiar-obsoletos.mjs` borra las carpetas viejas para que no choquen.

## Limpieza de código (noviembre 2026)
- Errores del revisor de código (lint): de **243 a 133**; avisos de 206 a 166. Nada cambia en pantalla.
- Errores atrapados (`catch`) sin `any`: nuevas ayudas `errMsg` / `errOf` en `src/lib/errors.ts`.
- Filtros de consultas con tipos de Prisma en vez de `any` (inventario, consolas, caja, cotizaciones, certificados, estadísticas, reportes…). Tipo `SessionUser` para el usuario con sesión en todas las pantallas.
- Se quitaron importaciones y funciones que no se usaban.
- **Arreglo:** *Rendimiento por técnico* daba error en sucursales con muchas órdenes (más de ~30.000 actualizadas en el período): la consulta mandaba la lista entera de órdenes a la base y pasaba su límite. Ahora se resuelve con una unión dentro de la base.

## Cotizaciones más rápidas y estadísticas más livianas (noviembre 2026)
- **Cotizaciones y Notas de Venta**: el servidor busca (código, cliente o celular), filtra (todas / cotizaciones / ventas) y manda solo la página que se ve. Los contadores de arriba y de los filtros los calcula la base de datos. Antes se descargaban todas las cotizaciones y ventas de la sucursal cada vez.
- **Estadísticas › Tráfico del portal**: las visitas y visitantes únicos (hoy, semana, mes, total) salen de una sola consulta en vez de 7; antes los visitantes únicos traían todas las visitas al servidor para contarlas. Los números son los mismos.

## Nueva orden: sin la burbuja del chat (noviembre 2026)
- En **Nueva orden** ya no aparece la burbuja flotante del chat interno: en el celular tapaba el botón para registrar la OT. En las demás pantallas sigue igual.

## Sistema más rápido con muchas órdenes (noviembre 2026)
- **Extracto** y **Asignaciones** ya no descargan todas las órdenes: el servidor busca, filtra (estado y fechas) y manda solo la página que se ve. Con 50.000 órdenes, abrir el Extracto pasó de ~40 MB y 2 s a ~4 KB y 0,06 s. Los totales de arriba y los contadores de los filtros los calcula la base de datos.
- **Imprimir extracto** (general o de un cliente) pide en ese momento solo las órdenes de los filtros actuales. El selector **Buscar cliente** busca en el servidor (los 50 con más equipos).
- **Clientes**: los totales (gastado, OTs, ventas, cotizaciones) se calculan en la base de datos y la lista viene paginada (15 por página). El historial se carga al abrir un cliente. Antes la pantalla bajaba ~7,5 MB con 8.000 clientes; ahora ~4 KB. El autocompletar de Nueva orden pide solo 5.
- Índices nuevos por **celular del cliente** (órdenes y cotizaciones) para que estas búsquedas sigan siendo rápidas.
- **Fotos del portal**: las tarjetas muestran una miniatura liviana (WebP, se genera una vez y queda guardada en `uploads/_thumbs`) y se cargan recién al acercarse a la pantalla. La foto grande sigue disponible al hacer zoom.
- Las fotos nuevas se guardan con un máximo de 2000 px por lado (una foto de celular de 3–5 MB queda en unos cientos de KB). El respaldo diario no incluye las miniaturas.
- La búsqueda del Panel también encuentra por número de celular.

## Seguimiento: el botón "Escríbenos" habla de la orden (noviembre 2026)
- En la página de seguimiento, el botón flotante de WhatsApp ahora envía "Hola Taller, consulto por mi orden OT-1 (equipo)." en vez del saludo del catálogo. En el portal sigue igual.

## Apartar productos desde el portal (noviembre 2026)
- En el portal, **Productos, Repuestos, Equipos y Consolas** tienen el botón **🛒 Apartar**: el cliente pone nombre, celular y cantidad (máx. 3) y se le guarda **24 horas** (configurable por sucursal: 6, 12, 24, 48 o 72 h). Recibe un código **AP-N**, cuenta regresiva y un WhatsApp con su enlace para verlo o cancelarlo (`/apartado/…`).
- El **stock real no se descuenta** hasta venderlo: el portal muestra solo lo disponible (stock − apartado). Si todo está apartado, el producto muestra "⏳ Apartado" y el botón **🔔 Avisarme si se libera** (lista de espera).
- **Dos clientes a la vez:** el primero que llega se lo lleva (candado de la base); el segundo recibe "Alguien acaba de apartar la última unidad". Un equipo o consola nunca puede tener dos apartados activos (índice único).
- Nueva pantalla **Recepción › 🛒 Apartados**: activos con lo que falta para vencer, **💰 Convertir en venta** (crea la nota de venta y descuenta stock), **+24 h** y **Cancelar**; pestañas de vendidos, vencidos y cancelados. ⚙️ Configurar enciende/apaga los apartados por sucursal y elige las horas.
- Al vencer, el producto se libera solo, se le avisa al cliente y al primero de la lista de espera. Máximo 2 apartados activos por celular. Avisos al personal en la campana, celular y Telegram (categoría "Productos apartados").
- Migración: `20261108_apartados` (tablas `Reservation` y `ReservationWait`).

## Logo del taller al compartir enlaces y emojis en WhatsApp (octubre 2026)
- **Vista previa con tu logo**: al compartir un documento, el portal o un seguimiento por WhatsApp/Facebook/Telegram se muestra el logo de Admin › Configuración (antes salía el triángulo de Vercel). Los documentos muestran "Nota de venta NV-1 · Taller" y el total.
- El ícono de la pestaña (/favicon.ico) también es el logo del taller.
- **Emojis**: los botones "Abrir WhatsApp" usan api.whatsapp.com/send en vez de wa.me, que dañaba algunos emojis (👋 💰 → "�") en WhatsApp de computadora.

## Cotizaciones y notas de venta por WhatsApp (octubre 2026)
- Botón **💬 WhatsApp** dentro de cada cotización o nota de venta (junto a "Correo"): celular del cliente ya puesto, **Enviar** desde el número del taller (WasenderAPI) o **Abrir WhatsApp** en tu celular con el mensaje listo. Se puede ver el mensaje antes de enviarlo.
- El mensaje lleva el detalle, el total, la validez (cotización) o el método de pago (nota de venta) y el enlace al documento. Si el documento no tenía celular, se guarda el que se usó.

## Portal: tarjetas de Programas más compactas (octubre 2026)
- En la pestaña **Programas** el logo va en un cuadrado (antes era un rectángulo alto), hay una columna más (6 por fila en tablet, 7 en pantallas grandes, 2 en celular), el nombre ocupa máximo 2 líneas y las etiquetas son más chicas. Cada tarjeta queda ~25 % más baja.

## Exportar a Excel con diseño profesional (octubre 2026)
- **Resumen tipo tablero**: franja con el nombre del taller, tarjetas de Ingresos / Costos y gastos / Ganancia, margen de ganancia, cobrado por QR y en efectivo, e ingresos por mes (o por día), por técnico y lo más vendido con barras de color.
- **Todas las hojas**: franja de título con el período, encabezado turquesa fijo, filas alternadas, estados con color, montos en "Bs." (negativos en rojo), fila TOTAL destacada y pestañas de colores.
- **Impresión**: carta horizontal ajustada al ancho, encabezado repetido en cada página y "Página N de M".

## Portal: productos agotados con sello "AGOTADO" (octubre 2026)
- Los productos y repuestos con stock 0 ya no desaparecen del portal: se muestran **al final**, con la foto en gris y un **sello rojo "AGOTADO"** al centro; el nombre en gris y el precio tachado ("Sin stock").
- Botón por WhatsApp: **Consultar** cuando hay stock y **🔔 Avisarme cuando llegue** cuando está agotado (el mensaje pide que le avisen cuando llegue).

## Arreglos de celular, pestaña "Sin recoger" y ventanas de edición (octubre 2026)
- **Nueva pestaña 📦 Sin recoger** (Recepción): la lista de equipos listos que el cliente no recogió sale del Panel, con buscador, filtros Todos / Por abandonar / Plazo vencido y 20 por página con paginación. En el Panel queda la tarjeta "Sin recoger" con "Ver lista →".
- **Celular**: ya no se enciman ni se cortan textos en el Panel (etiqueta "por abandonar", accesos rápidos en 2 columnas, filtros que bajan de línea), Inventario (pestañas, botones en 2 filas, tarjetas de resumen), y en las etiquetas sobre la foto de Inventario, Equipos, Consolas, Programas y Videojuegos.
- **Certificados**: la clave de producto se muestra en bloques de 5; en celular pasa a dos líneas en vez de cortarse.
- **Programas y Videojuegos**: sin precio en las tarjetas del sistema, en el portal y en los stickers QR.
- **QR múltiples**: 40 por página con la misma paginación de las demás pestañas ("Seleccionar todos" sigue marcando todos los de la búsqueda).
- **Ventanas de agregar/editar**: un clic afuera ya no las cierra (se perdía lo escrito); la ventana se sacude y se cierra con ✕, Cancelar o Esc. Igual en la ventana de entrega y en la lista de compra. Las ventanas que solo muestran (fotos, detalles) siguen cerrándose al tocar afuera.

## Técnico con barra superior y franja de bienvenida (octubre 2026)
- **Mis Asignaciones** ahora tiene la misma barra de arriba que las demás pestañas (buscador Ctrl+K, reloj y campana) y la **franja azul de bienvenida** del Panel: saludo, resumen (pendientes · en progreso · completadas) y botones **⏳ Por revisar** y **📷 Escanear QR**. Al tocar un aviso de la campana se abre la orden ahí mismo.
- **Campana en el celular** en todas las pestañas (barra oscura de arriba). Antes, en el celular no había campana en ninguna pantalla.
- La campana de la barra superior lleva al técnico a Mis Asignaciones (antes intentaba abrir el Panel).
- Reloj del Panel principal con los dos puntos que parpadean, igual que en las demás pestañas.
- Botón de guardar animado también en **Nueva orden** y **Certificados**.
- En el celular, los botones de la franja de bienvenida ya no cortan el texto ("📱 Entregar equipo").

## Animaciones (octubre 2026)
Cortas (menos de 1,5 s), sin librerías y se apagan solas con "reducir movimiento":
1. **Números que suben** en las métricas del panel y los accesos del portal.
2. **Etapas del seguimiento** que se encienden una tras otra; la actual late.
3. **El estado gira** al cambiar (panel y asignaciones), junto con el resaltado en tiempo real.
4. **"Abierto ahora" respira**: punto verde con pulso (portal y seguimiento).
5. **WhatsApp que saluda**: el botón entra con rebote y muestra "¿Te ayudamos?" una vez por visita. Ahora también está en el seguimiento.
6. **Botón de guardar** en todas las ventanas de agregar/editar: se encoge y gira mientras guarda y deja un ✓ verde al cerrar; si hay error vuelve a la normalidad.
7. **Opciones con "pop"** al marcarse (accesorios, tipo de equipo, técnico, prioridad, pestañas).
8. **Sello PAGADO que cae** en la nota de venta (solo en pantalla).
9. **La orden entregada se desliza** fuera de la lista antes de actualizarla.
10. **Reloj vivo**: los dos puntos de la hora parpadean.
11. **QR que se dibuja** de arriba abajo en documentos y etiquetas (solo en pantalla).
12. **Tarjetas que se levantan** al pasar el mouse (accesos del portal, métricas del panel, pasos y reseñas).

## Prueba de carga (octubre 2026)
- **Modo `--reemplazar`**: borra tus órdenes, ventas, caja, citas y catálogo actuales y crea todo en TUS sucursales con códigos desde **OT-1** (también COT-1, NV-1, CL-1, EQ-1, CN-1), como lo hace el sistema. Conserva usuarios, sucursales y Configuración. Sin `--confirmar` solo muestra qué borraría. Si una sucursal no tiene técnicos, agrega técnicos de prueba (que `--borrar` quita después).
- Script nuevo `scripts/seed-carga.ts` para llenar la base con datos falsos y ver hasta dónde aguanta: órdenes (con historial de estados, bitácora y reseñas), catálogo, cotizaciones y notas de venta, caja, certificados y avisos.
- Niveles: `--nivel=chico` (~1.000 órdenes), `medio` (~10.000, por defecto), `grande` (~50.000), `enorme` (~200.000) o `--ordenes=N`.
- **Sin celulares ni correos**: ningún cliente, técnico ni sucursal de prueba tiene número, así WhatsApp no puede enviar nada. Escribe directo en la base (no llama a la API).
- Todo queda en sucursales "🧪 Carga …" y usuarios @carga.local que no pueden iniciar sesión; `--borrar` quita todo sin tocar tus datos. No corre con NODE_ENV=production salvo `--forzar`.

## Portal en pantalla ancha (octubre 2026)
- El contenido se ensancha hasta 1440 px en pantallas grandes: los accesos del catálogo van en una sola fila (hasta 6) y el catálogo muestra 6 productos por fila.
- Franjas nuevas de borde a borde: **Cómo trabajamos** (4 pasos), **Lo que dicen nuestros clientes** (3 o 6 reseñas de 4–5 estrellas con comentario, sin nombres: "Cliente verificado · equipo · fecha") y **Nuestras sucursales** en azul con horario y 🟢 Abierto ahora, Cómo llegar, Waze y WhatsApp. Antes el enlace "Sucursales" del menú no llevaba a ninguna parte si no había mapa.
- En la franja de arriba se muestra "★ 4.8 de N reseñas" cuando hay al menos 3 reseñas y el promedio es 4 o más.
- **Botón flotante de WhatsApp** más visible: en computadora muestra el texto "Escríbenos"; en el celular sigue redondo.
- API pública nueva `/api/reviews/public` (solo estrellas, comentario, tipo de equipo y fecha).

## Seguimiento en computadora + horario de sucursal (octubre 2026)
- **Seguimiento en pantallas anchas**: la franja azul ocupa todo el ancho (estado a la izquierda, etapas a la derecha; "Entregado" ya no se corta) y debajo dos columnas: a la izquierda costo, etapas, tu equipo y "Mientras esperas" (equipos, consolas, accesorios, reservar cita); a la derecha, fija, la tarjeta de la sucursal, un QR para seguirlo en el celular y "Bueno saber". En el celular sigue en una columna.
- **Tarjeta de la sucursal** (también en el celular): dirección, teléfono, horario con **🟢 Abierto ahora / 🔴 Cerrado ahora**, mapa, "Cómo llegar" y botón de WhatsApp de esa sucursal.
- **Horario de atención** nuevo en Admin → Sucursales: lunes a viernes, sábado y domingo (abierto/cerrado y horas). Se calcula con la hora del taller (Bolivia), no la del celular del cliente. Cuando el equipo está listo, el aviso dice si ahora está abierto.
- Base de datos: columna nueva `Branch.hours` (migración `20261020_horario_sucursal`).

## Error de hidratación corregido (octubre 2026)
- Se quitó el `<script>` escrito a mano en el `<head>` del diseño principal (captura del aviso "instalar app"). React 19 avisaba "Encountered a script tag" y desalineaba la cabecera de la página ("Hydration failed"). Ahora usa `next/script` con `beforeInteractive`, que lo coloca bien y sigue corriendo antes que React.

## Documentos en el celular (octubre 2026)
- Corregido: en el celular, el encabezado de los documentos (comprobante CE, cotización, nota de venta, recepción y fichas) quedaba tapado por la barra de arriba. Venía de reglas viejas del diseño anterior.
- Las hojas de dos copias se ven una debajo de la otra en el celular, con el QR arriba y los datos en columnas parejas. Las pestañas del comprobante entran completas. La impresión no cambia.

## Seguimiento y documentos rediseñados (octubre 2026)
- **Seguimiento del cliente**: franja azul oscuro como el portal, estado grande con emoji ("¡Listo para recoger!"), etapas con emoji (⏳ 🔍 📦 🔧 ✅ 📱) y la actual resaltada. Cuando está listo aparece primero el aviso para recogerlo y el total a pagar. Tarjetas de "Tu equipo", informe del técnico, etapas y botón verde para escribir al taller por WhatsApp. Se mantienen la confirmación con los 4 dígitos del celular, la actualización automática y las reseñas.
- **Todos los documentos con el mismo estilo**, hoja **carta** y letra legible (antes había textos de 6–7 px; ahora el mínimo es 9.5 px):
  - **OT · Recepción** (2 copias, carta horizontal): franja azul con el número, QR grande "Escanea para ver el estado", cliente, equipo, problema, accesorios, términos y **líneas de firma**.
  - **CE · Entrega** (2 copias y hoja completa): en **verde**, garantía "hasta tal fecha", detalle del cobro con descuento, accesorios devueltos, nota de la entrega, conformidad y firmas.
  - **COT · Cotización** (hoja completa y 2 copias): franja azul con etiqueta ámbar, "Válida hasta", tabla con el tipo de cada concepto (Equipo, Producto, Servicio, Programa…), total grande y QR de pago.
  - **NV · Nota de venta**: misma hoja en **verde**, "Pagado con QR/efectivo" y sello **PAGADO**.
  - **CL · Certificado**: marco azul con borde dorado, licencias en tarjetas y QR para verificarlo.
  - **EQ / CN · Fichas de venta**: nombre grande, precio en ámbar, especificaciones con emoji y QR para pedirlo por WhatsApp.
  - **Etiquetas QR** (sueltas y en lote: OT, CE, COT, NV, CL, INV, EQ, CN, SW, VG): franja con el color de cada tipo, código grande y nombre.
- Los códigos no cambian (OT, CE, COT, NV, CL, EQ, CN…) y el escáner los sigue leyendo igual.
- Piezas comunes nuevas: `DocKit` (encabezados, recuadros, QR, firmas) y `ProductPrint` (fichas y etiquetas).


## Formularios nuevos: agregar y editar con el mismo estilo (octubre 2026)
- **Nueva orden** rediseñada: tarjetas por paso (cliente, equipo, problema y fotos, accesorios, servicios, técnico) y a la derecha el **resumen fijo** con el total y el botón ámbar "Registrar orden". Tipo de equipo y accesorios se marcan con un toque (📱 💻 🔌 🔋…).
- **Prioridad** de la orden (🟢 Normal, 🟠 Alta, 🔴 Urgente) al crearla y al editarla.
- **Técnicos con su carga**: cada técnico muestra cuántas órdenes activas tiene, para repartir mejor el trabajo.
- **Editar orden** con el mismo diseño: estado con botones de colores, equipo, accesorios, servicios/programas/juegos en pestañas, repuestos, técnico, costo y prioridad. El botón "Guardar cambios" queda fijo abajo.
- **Ventanas de agregar/editar** con encabezado azul oscuro, secciones con emoji y botón ámbar en: inventario y repuestos, equipos, consolas, programas, videojuegos, servicios, cotizaciones y notas de venta, usuarios (y transferir), sucursales, caja chica y citas. Certificados usa las mismas tarjetas y campos.
- Categorías, plataformas, estados y sucursales se eligen con botones en vez de listas desplegables. Si un producto tiene una categoría que ya no está en la lista, igual aparece marcada.
- Inventario: la ganancia por unidad se ve al escribir los precios. Servicios: vista previa de cómo se verá el ícono.
- Las ventanas se cierran con **Esc** o tocando fuera; en el celular ocupan toda la pantalla y el botón del chat se oculta para no tapar "Guardar".

### Correcciones
- Al editar una orden, los **videojuegos** que ya tenía no se cargaban y se borraban al guardar.
- **Caja chica**: el botón Guardar tenía un color inválido y el texto blanco no se veía.
- **Cotizaciones**: dos toques rápidos en un servicio, programa o juego creaban una línea repetida; ahora suman la cantidad.
- **Pantalla sin diseño** después de actualizar o reiniciar el servidor: el modo sin conexión (service worker) devolvía la página de inicio en lugar del archivo de estilos. Ahora solo usa la copia guardada para páginas, y se renovó su caché (`repairtrack-v5`).


## Portal en azul oscuro (octubre 2026)
- La franja del portal, el logo de la barra y el pie de página usan el mismo azul oscuro del sistema; el turquesa queda como acento.
- Botón **Ver estado** en ámbar (igual que "Nueva orden" en el sistema) para que se note la acción principal.
- Pestañas del catálogo con emoji (📦 Productos, 🔩 Repuestos…) y accesos con un solo emoji.

## Sistema con vida: azul oscuro + emojis + hora (octubre 2026)
- **Emojis de vuelta** en títulos, botones, filtros, pestañas y avisos (se repusieron en su lugar, sin perder las mejoras de contraste y tamaño de letra).
- **Menú lateral azul oscuro** con un emoji por sección; la sección activa se ve en blanco con línea turquesa.
- **Hora siempre visible**: cápsula oscura con 🕒 hora, fecha y ciudad en la barra superior de la computadora, y la hora en la barra del celular.
- **Panel principal**: franja de saludo azul oscuro con el resumen del día y botones "📱 Entregar equipo" y "➕ Nueva orden"; métricas con emoji en recuadro de color y número del mismo color (se tocan para filtrar); accesos rápidos de colores; filtros por estado con emoji.
- **Reparaciones**: el tipo de equipo (📱 💻 🖥️ 🎮 …) en un recuadro del color de su estado cuando no hay foto, y el estado en una píldora de color con emoji.
- **Catálogo** (servicios, inventario, equipos, consolas, programas, videojuegos, extracto): tarjetas de resumen con emoji en recuadro de color y número de color.
- Seguimiento del cliente con el emoji del estado; accesos del portal con emojis.

## Portal con más vida (octubre 2026)
- **Barra superior fija** con el nombre del taller, enlaces (Seguimiento, Catálogo, Sucursales, Reservar cita) y botón verde **Escríbenos** por WhatsApp (número del taller o de la primera sucursal).
- **Franja con el color de la marca**: titular grande, ciudad, garantía (toma los días de Configuración) y cantidad de sucursales.
- **El buscador de órdenes es el protagonista** (tarjeta blanca sobre el color, botón "Ver estado" y "Escanear el QR del comprobante"). En el celular aparece apenas se abre la página.
- **Accesos al catálogo** con íconos de línea (solo las secciones que tienen algo) y título "Catálogo"; pestañas como píldoras, tarjetas con precio grande.
- Pie de página oscuro con nombre, eslogan y garantía.

## Rediseño visual profesional (octubre 2026)
- **Sistema de diseño**: un solo color de acento (turquesa del taller, más oscuro para que se lea), grises con contraste AA en todas las pantallas, letra mínima de 11 px, sombras y bordes sutiles, foco visible con teclado. Componentes comunes en `globals.css`: `ui-btn`, `ui-search`, `ui-count`.
- **Fuera en toda la app**: degradados, brillos de color, desenfoques, emojis decorativos en títulos/botones/pestañas, íconos gigantes desvanecidos, bordes superiores de colores en las tarjetas de resumen. Las lupas y campanas son íconos de línea. Botones de colores con texto blanco oscurecidos hasta el contraste mínimo.
- **Panel principal**: encabezado con "Entregar equipo" y "Nueva orden", métricas en una franja (se tocan para filtrar), accesos rápidos en texto, filtros por estado sin emojis, lista de órdenes sobria (estado con punto de color, datos en una línea).
- **Portal del cliente**: cabecera limpia (sin los 9 chips de colores), buscador de órdenes con etiqueta y botón principal, precios en tinta.
- **Seguimiento del cliente**: estado claro arriba y los datos en una sola ficha (antes, una caja de color por dato).
- **Barra superior y menú**: reloj discreto (sin segundos), menú lateral con un solo color, sin rosa/azul/verde por sección.
- Login: sin los círculos de brillo del panel izquierdo.
- Corregido: aviso de React por claves repetidas en la campana del panel.
- Los documentos impresos (carta) conservan su diseño; solo cambia el color de marca y los emojis de los títulos.

## Nueva pantalla de entrega y cobro (octubre 2026)
- **Panel › Entregar equipo** rediseñado en el orden real del mostrador: 1) orden, 2) accesorios a devolver, 3) detalle del cobro, y a la derecha el **resumen fijo** con el total grande, el método de pago y el botón "Entregar y cobrar Bs. X". En el celular el total y el botón quedan fijos abajo.
- **Accesorios**: empiezan sin marcar y se marcan al devolverlos. Si falta uno, hay que escribir por qué (queda en las notas de la entrega) antes de poder entregar.
- **Total correcto**: lo que se ve es lo que se guarda. Antes, si la orden tenía un precio puesto a mano, al confirmar se recalculaba solo con servicios y repuestos (o se perdía el descuento).
- El detalle del cobro es una tabla tipo recibo; si el precio de la orden no es la suma de los conceptos, la diferencia aparece como "Mano de obra y otros".
- El descuento ahora siempre está disponible. La ganancia queda plegada ("Ganancia de esta orden") para que el cliente no la vea al mostrarle el QR.
- Accesible: casillas reales, foco visible, Esc para cerrar, textos con buen contraste, botones de 44 px o más.

## Auditoría de seguridad (octubre 2026)
- **Importar respaldo**: los usuarios importados ya no quedan con la contraseña fija `changeme123`. Reciben una aleatoria que nadie conoce, quedan **pendientes** y deben cambiarla (o usar "¿Olvidaste tu contraseña?"). Se valida rol, correo e imágenes.
- **Respaldo JSON**: ya no incluye las claves de servicios guardadas en KeyValue (SMTP, R2, Telegram, IA, IMEI, VAPID, monitor), ni las acepta al importar.
- **Admin sin celular**: ya no puede registrar un celular nuevo al iniciar sesión (quien robara la contraseña podría poner el suyo). Admin y Super Admin necesitan celular al crearlos en Usuarios.
- **App autenticadora**: cada código sirve **una sola vez** (columna `totpLastStep`, migración `20261016_totp_un_uso`).
- **Repuestos**: dos guardados a la vez de la misma orden ya no descuentan dos veces el stock (la orden se bloquea mientras se guarda). Se validan los textos y fotos de la orden.
- **Usuarios**: correos en minúsculas y sin duplicados por mayúsculas; eliminar un usuario es todo o nada; editar un usuario sin cambiar su celular ya no lo marca como "sin verificar".
- **WhatsApp manual**: un solo normalizador de celulares (`src/lib/phone.ts`); ya no se antepone +591 a números extranjeros. Los técnicos solo pueden escribir a clientes de sus órdenes.
- **Citas del portal**: dos personas no pueden reservar el mismo turno a la vez.
- **Seguimiento con 4 dígitos**: un solo contador de intentos por orden.
- **Fotos subidas**: se quita la ubicación GPS y los datos del celular.
- **IP real**: se toma de forma segura (Nginx); `deploy/nginx-repairtrack.conf` agrega `X-Real-IP` también en `/api/live`.

## Campana igual en todas las pestañas (octubre 2026)
- La campana de notificaciones de la barra superior (todas las pestañas) y la de Mis Asignaciones ahora se ven exactamente como la del Panel Principal: contador, "✓ Leídas", "🗑️ Limpiar", ícono por tipo, fecha completa y punto de no leída.

## Exportar a Excel (octubre 2026)
- **Finanzas › Exportar a Excel**: archivo `.xlsx` por período (este mes, mes pasado, este año, año pasado o fechas a elección) con una hoja por tema: **Resumen** (ingresos, costos, gastos y ganancia), **Órdenes**, **Ventas y cotizaciones**, **Caja**, **Cierres de caja**, **Inventario** (stock, costo y valor), **Movimientos de stock** y **Clientes**.
- Encabezados fijos, filtros en cada columna y fila TOTAL con fórmulas que se recalculan al filtrar. Fechas en hora de Bolivia.
- Sucursal activa; el Super Admin puede exportar todas las sucursales juntas.
- Dependencia nueva: `exceljs`.

## Rendimiento por técnico (octubre 2026)
- **Finanzas › Rendimiento técnicos** (administradores): por técnico, órdenes terminadas y en curso, tiempo promedio desde el ingreso hasta "listo" y hasta el diagnóstico, **reingresos por garantía** (en rojo si pasan del 8%), **calificación** de los clientes, lo cobrado y la **ganancia** (cobrado − costo de repuestos).
- **Dónde se demoran las órdenes**: tiempo promedio en cada estado (pendiente, diagnosticado, esperando repuestos, en progreso).
- Períodos: este mes, 30 días, 3 meses, 1 año. Tabla en computadora y tarjetas en el celular.

## Cierre de caja (octubre 2026)
- **Caja › 🔒 Cierre de caja**: el sistema calcula cuánto efectivo **debería haber** (fondo inicial del cierre anterior + entregas y ventas cobradas en efectivo + otros ingresos − gastos de caja). Lo cobrado por QR se muestra aparte, para revisarlo en el banco.
- Se cuenta **por billete y moneda** (Bs 200 a 10 ctv) o se escribe el total, y muestra al instante si **cuadra, faltan o sobran**.
- Al cerrar: cuánto se deja en caja (fondo de mañana), cuánto se retira, nota y "revisé el QR en el banco". Queda guardado con quién cerró.
- Aviso al dueño por WhatsApp y a los Super Admin por Telegram; si no cuadra, también en la campana.
- **Historial** de cierres con la diferencia acumulada del mes. Se puede cerrar un día olvidado (hasta 7 días atrás). Un día cerrado no se edita; el Super Admin puede reabrir el último.
- Tabla nueva `CashClosing` (migración `20261015_cierre_caja`).

## Stock automático y ganancia real (octubre 2026)
- **El stock lo descuenta el servidor**, en la misma operación que la venta o la orden (antes lo hacía el navegador, uno por uno: si se cortaba el internet quedaba mal y un repuesto podía descontarse dos veces al entregar).
  - Notas de venta: crear, editar, convertir cotización ↔ venta y eliminar ajustan el stock solo por la diferencia; equipos y consolas pasan a vendidos o vuelven a disponibles. Si falta stock, no se guarda nada y avisa "Stock insuficiente".
  - Órdenes: **🔩 Repuestos usados con cantidad** (＋/−) al editar y al entregar. El stock cambia solo por la diferencia con lo que la orden ya tenía. Las órdenes viejas toman sus repuestos de las notas (ya descontados), sin volver a descontar.
- **🕑 Movimientos de stock** por producto (Inventario): venta, orden, ajuste manual, traspaso, números de serie… con documento, quién y cuándo.
- **Precio de compra** en cada producto (solo lo ven los administradores; nunca el portal ni los técnicos) y ganancia por unidad.
- **Ganancia al entregar**: cobrado − costo de los repuestos, con aviso si algún repuesto no tiene precio de compra. Se guarda en la orden (`partsCost`) y en las ventas (`costTotal`).
- Migración `20261014_stock_ganancia` (InventoryItem.cost, Repair.parts/partsCost, Quotation.costTotal/costComplete, tabla StockMovement).

## Citas desde el celular (octubre 2026)
- **Portal › 📅 Reservar cita**: el cliente elige sucursal, día y hora libres y escribe sus datos (con captcha si está activo). Recibe la confirmación por **WhatsApp** con un enlace personal para **ver o cancelar** su cita (`/cita/…`), y un **recordatorio el mismo día a las 8:00**.
- **Recepción › Citas** (administradores): citas de hoy, mañana, próximos 7 días y últimos 7 días. Confirmar, cancelar (avisa al cliente por WhatsApp), "No vino" y **"Llegó: crear orden"** (abre Nueva orden con los datos llenos; la cita queda atendida con su OT). "Anotar cita" para reservas por teléfono.
- **⚙️ Horario por sucursal**: días y horas (ej. `09:00-12:00, 15:00-18:00`), cada cuántos minutos, citas por turno, hasta cuántos días adelante y anticipación mínima. Apagado por defecto.
- Límites: 6 reservas por hora por conexión y 2 citas pendientes por celular.
- Aviso al personal en la campana, el celular y Telegram (categoría nueva "Citas reservadas por clientes" en Mi cuenta).
- Tabla nueva `Appointment` (migración `20261013_citas`).

## Reseñas en Google (octubre 2026)
- **Configuración › Tareas automáticas › ⭐ Reseñas en Google**: enlace "Pedir reseñas" del Perfil de Empresa de Google de cada sucursal (solo se aceptan direcciones de Google). Muestra los clics a Google del mes y el promedio de estrellas.
- En el seguimiento, después de calificar, **todos** los clientes ven **"Dejar reseña en Google"** de su sucursal, sin importar las estrellas (Google prohíbe pedir reseñas solo a los clientes contentos).
- Opcional: **WhatsApp al día siguiente de la entrega** pidiendo la calificación (enlace personal ya verificado + enlace de Google), a la hora elegida. Una sola vez por orden y solo si el cliente no calificó; no se envía en reingresos por garantía.
- Los clics pasan por `/api/reviews/google/go` para contarlos.

## Inventario inteligente (octubre 2026)
- **Aviso de stock bajo**: cuando un producto o repuesto baja a su stock mínimo (o se agota), avisa en la campana, al celular y por Telegram a los administradores de la sucursal y a los Super Admin, con enlace directo a la lista de compra. Como mucho un aviso por producto cada 12 horas.
- **Resumen diario a las 8:00** con todo lo que hay que reponer en cada sucursal (celular y Telegram).
- Categoría nueva **"Stock bajo del inventario"** en Mi cuenta › Avisos (se puede apagar).
- **Inventario › 🛒 Lista de compra**: lo que está en el mínimo o por debajo, con cantidad sugerida (llegar al doble del mínimo, editable). Enviar el pedido al proveedor por **WhatsApp**, **imprimir en carta** o **copiar**. El proveedor (nombre y celular) se recuerda por sucursal.

## Consulta de IMEI (octubre 2026)
- **Nueva orden y Editar**: campo **IMEI / N° de serie** (opcional). Revisa al instante si el IMEI de 15 dígitos es válido (dígito de control) y no deja guardar uno mal escrito.
- **Gratis:** si ese IMEI ya vino antes al taller, avisa "🔁 Este equipo ya vino antes" con las órdenes anteriores (y cuántas en otras sucursales).
- **Opcional, pagado (imeicheck.net u otro servicio compatible):** botón **🔎 Consultar robo/bloqueo** → reporte de robo o pérdida (lista negra), bloqueo de operador e iCloud/Find My, con el detalle completo. Si sale **REPORTADO** se muestra una alerta roja. El resultado se guarda en la orden; repetir la consulta del mismo IMEI dentro de 2 horas no vuelve a cobrar. Límite de 20 consultas pagadas por persona por día.
- **Configuración › Tareas automáticas › 📱 Consulta de IMEI**: token y número de servicio (la clave nunca se envía al navegador).
- El IMEI aparece en el detalle de la orden, la orden de ingreso impresa y el comprobante de entrega; el cliente verificado lo ve en su seguimiento (el público no).
- Campos nuevos `Repair.imei`, `Repair.imeiCheck`, `Repair.imeiCheckedAt` (migración `20261012_imei`).

## IA para diagnósticos (octubre 2026)
- **Configuración › Tareas automáticas › ✨ IA para diagnósticos**: se pega la clave de API de Anthropic (console.anthropic.com) y se elige el modelo (Claude Haiku 4.5, económico, por defecto; o Claude Sonnet 5). Botón "Probar" y gasto del mes. La clave nunca se envía al navegador.
- **✨ Redactar con IA** al avanzar el estado (diagnóstico, repuesto, inicio, informe final) y en "Novedad al cliente": el técnico escribe sus notas rápidas y recibe un texto claro y amable para el cliente. Opciones: Usar este texto, Más corto, Otra versión, Descartar. Nada se guarda sin que la persona lo revise y registre.
- La IA solo usa los hechos de las notas y del equipo: no inventa fallas ni precios.
- En diagnóstico y repuestos muestra el **precio de reparaciones parecidas** ya entregadas en la sucursal (rango, valor habitual y ejemplos). Ese precio sale del historial del taller, no de la IA.
- Límite de 40 textos por persona por hora.

## Telegram como respaldo de WhatsApp (octubre 2026)
- **Configuración › Tareas automáticas › ✈️ Telegram**: se pega el token del bot creado con @BotFather (gratis); el sistema lo comprueba y muestra el nombre del bot. El token nunca se envía al navegador.
- **Mi cuenta › Vincular mi Telegram**: abre el bot, se toca "Iniciar" y queda vinculado. Botones "Enviar prueba" y "Desvincular".
- Los avisos del celular (asignaciones, órdenes nuevas, equipos listos, bitácora, chat, reseñas, sistema) llegan también por Telegram a quien lo vinculó, según las categorías elegidas en Mi cuenta, con enlace directo a la orden.
- Si el **WhatsApp al dueño falla** (resumen del día), el mensaje sale por Telegram a los Super Admin vinculados.
- Si alguien bloquea el bot, se desvincula solo.

## Todo en tamaño carta (octubre 2026)
- Reporte mensual, extracto, inventario impreso, lista y fichas de equipos y consolas, y la hoja de QR múltiples pasan de A4 a **carta** (letter).
- Al imprimir ya no sale una hoja extra en blanco por los contenedores de pantalla completa.

## Cobro con QR — nivel A (octubre 2026)
- **Configuración › Tareas automáticas › 📱 Cobro con QR**: se sube la imagen del QR de cobro de la cuenta del taller (sin monto), banco y titular.
- **Al entregar** un equipo: "¿Cómo paga el cliente?" → 💵 Efectivo o 📱 QR. Con QR se muestra el QR con el monto y el botón **Mostrar al cliente** (pantalla completa con el QR grande, el monto y la OT como concepto).
- **Notas de venta**: en el detalle se marca si se cobró en efectivo o por QR.
- **Resumen del día** (Caja y WhatsApp al dueño): separa "En efectivo" y "Por QR (banco)".
- Opcional: el QR de pago aparece en la cotización y la nota de venta (impresa y en el celular del cliente).
- Campos nuevos `Repair.paidWith` y `Quotation.paidWith` (migración `20261011_pago_qr`); lo anterior queda "sin indicar" y se cuenta como efectivo.

## Correo del sistema (octubre 2026)
- **Configuración › Tareas automáticas › ✉️ Correo del sistema**: Gmail (contraseña de aplicación), Brevo, Resend u otro servidor SMTP, con pasos guiados y "Enviarme un correo de prueba". La contraseña nunca se envía al navegador.
- **Comprobante de entrega por correo** (junto a WhatsApp al entregar): correo con la marca del taller, detalle, garantía y botón al comprobante; el correo queda guardado en la orden.
- **Cotización y nota de venta por correo** (botón ✉️ Correo en el detalle).
- **Recuperar contraseña**: el código llega por WhatsApp y también al correo de la cuenta; ya no depende solo de WhatsApp. (Si llegó solo por correo, el celular no se marca como verificado.)
- **Alertas por correo** al "Correo para alertas del sistema": respaldo fallido y copia en la nube fallida.
- Dependencia nueva: `nodemailer`.

## Copia en la nube y vigilancia del sistema (octubre 2026)
- **Configuración › Tareas automáticas › ☁️ Copia en la nube** (Cloudflare R2, o cualquier almacenamiento compatible con S3): después de cada respaldo se sube la base de datos a `respaldos/` y las fotos nuevas a `fotos/` (cada foto una sola vez). Las copias de la base de datos de más de N días (7 a 90, por defecto 30) se borran solas.
- Botones "Probar conexión" (escribe y borra un archivo de prueba) y "Subir ahora"; lista de copias en la nube con el espacio usado. La clave secreta se guarda en el servidor y nunca se envía al navegador.
- Si la subida falla, avisa en la campana, al celular y por WhatsApp al dueño (el respaldo local sigue igual).
- **🩺 Vigilancia del sistema** (Healthchecks.io): al terminar cada respaldo se envía "listo" o "falló"; y cada 5 minutos "estoy encendido". Si una señal no llega, Healthchecks avisa por correo/Telegram/WhatsApp aunque el servidor esté apagado. Botón "Enviar señal de prueba".
- Cada sección trae los pasos para crear las cuentas gratis. Para restaurar desde la nube: descargar `respaldos/db_….dump` y la carpeta `fotos/` desde el panel de Cloudflare y usar `scripts/restore-backup.sh`.
- Dependencias nuevas: `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`.

## Avisos en el celular (octubre 2026)
- **Mi cuenta → 🔔 Avisos en este celular**: cada persona los activa una vez por celular o computadora y le llegan aunque el sistema esté cerrado (Web Push, gratis, sin servicios externos).
- Avisos: orden asignada (técnico), nueva orden de la sucursal (admins), equipo listo para entregar, notas de bitácora, chat interno, reseñas y alertas del sistema (respaldo fallido, equipos por abandonar). Cada persona elige cuáles recibir; nunca recibe aviso de lo que hizo ella misma.
- Al tocar el aviso se abre la orden (Panel o Mis asignaciones según el rol) o la conversación del chat.
- Botón "Enviar aviso de prueba". En iPhone se explica que hay que agregar el sistema a la pantalla de inicio (regla de Apple, iOS 16.4+).
- Las claves del servidor se generan solas la primera vez y se guardan en la base de datos; opcionalmente se pueden fijar con `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` en el `.env`.
- Nueva tabla `PushSubscription` (migración `20261010_avisos_celular`) y dependencia `web-push`.

## Revisión completa de pantallas en celular (septiembre 2026)
Se revisaron las 34 pantallas en celular (360 px) y en PC (1440 px) con datos de ejemplo.
- **Documentos que ve el cliente** (comprobante de entrega por WhatsApp, certificado de licencia): en celular se reacomodan en una columna; antes eran más anchos que la pantalla.
- Hoja de recepción x2 (Imprimir OT), ficha técnica de equipos/consolas y reporte mensual: ya no se salen de la pantalla; la barra de botones se ajusta en vez de aplastarse.
- Barras de botones de fichas, stickers QR, cotización impresa y extractos: el título y los botones "Copiar link"/"Ver en portal" eran texto blanco sobre fondo blanco (invisibles).
- Tarjetas de resumen (Inventario, Consolas, Programas, Videojuegos, Cotizaciones, Extracto): en una fila compacta en vez de una por pantalla.
- Usuarios: el nombre ya no se corta y los botones pasan a una segunda fila.
- Transferir: las pestañas ya no parten las palabras. Certificados: formulario en una columna. Portal: botones centrados. Códigos (OT-1, COT-1) sin partirse.
- La impresión no cambia: todos los ajustes aplican solo en pantalla.

## Portal solo en español y ajustes para uso local (septiembre 2026)
- **Mi cuenta** centrada como las demás páginas; en celular los pasos de la app autenticadora muestran su número y el campo de celular no se corta.
- Celular: el título de Caja, Clientes, Certificados, Mi cuenta y Admin ya no queda pegado a la barra superior.
- `npm install` y `npm run dev` regeneran el cliente de Prisma automáticamente (evita el error "Unknown field tokenVersion").
- Se eliminó el selector de idioma ES/EN del portal; los textos quedaron fijos en español (se borraron `PortalControls.tsx`, `portal-i18n.ts` y `use-portal.ts`).
- Modo desarrollo: ahora se puede abrir desde el celular por la red WiFi local (`allowedDevOrigins`); Next 16 lo bloqueaba y la página cargaba a medias.
- `OTP_CONSOLE=1` (solo desarrollo): el PIN se muestra en la terminal en vez de enviarse por WhatsApp.
- El seed ya no carga celulares inventados (podían ser números reales de otras personas).
- README: pasos de instalación local, error P3005 y pruebas desde el celular.

## Doble verificación y recuperación de contraseña (septiembre 2026)
Detalle completo, instrucciones y pasos de despliegue en `SEGURIDAD.md` → "Doble verificación".
- Captcha Cloudflare Turnstile en login, registro, `/setup` y recuperación (opcional por `.env`).
- PIN por WhatsApp obligatorio para admins y superadmin (dispositivo nuevo); opcional para técnicos. "Recordar este dispositivo 30 días".
- App autenticadora (TOTP, RFC 6238) + 10 códigos de respaldo; QR generado en el servidor.
- Celular obligatorio y verificado al registrarse.
- "¿Olvidaste tu contraseña?" por WhatsApp (sin revelar qué correos existen); con app autenticadora también se pide su código.
- Página **Mi cuenta** y herramientas del superadmin (contraseña temporal, restablecer app, cerrar sesiones).
- Sesiones revocables al instante; si la sesión se revoca, las páginas vuelven solas al login.
- Contraseñas: mínimo 8 caracteres con letras y números.
- Script de emergencia `scripts/reset-access.ts`.

## App instalable (PWA) y diseño en celular (septiembre 2026)

**Botón "Instalar app"**
- Volvía a aparecer en cada página: solo se recordaba la "✕" (y solo en esa pestaña), y el portal/seguimiento recargan la página completa, lo que dispara de nuevo el aviso del navegador. Ahora:
  - se muestra **una vez por sesión** y se oculta solo a los 20 segundos;
  - la "✕" o rechazar la instalación lo oculta **14 días**;
  - sigue disponible en el menú lateral → **📱 Instalar app** mientras el navegador lo permita;
  - no aparece en páginas públicas ni de impresión (portal, seguimiento, constancias, cotizaciones impresas, reportes).
- El aviso del navegador podía llegar antes de que cargara React y se perdía: ahora se captura con un script temprano en `layout.tsx`.
- El React Compiler memorizaba el estado "se puede instalar" y nunca se actualizaba: ahora usa `useSyncExternalStore` (`src/lib/pwa.ts`).

**Diseño en celular**
- Contenido cortado a la derecha en Caja, Escáner y Cotizaciones: los grids de 2–3 columnas no se adaptaban (`.form-grid` no tenía reglas para celular) y los textos largos ensanchaban la página. Ahora pasan a 1 columna y ningún elemento puede ensanchar la pantalla.
- Contenido pegado al borde izquierdo en Caja, Clientes, Certificados, QR múltiples y Admin.
- Tarjetas del panel principal: el ícono se cortaba en pantallas de 360 px.
- `100vh` en celular incluye la barra del navegador → el final de las páginas quedaba oculto. Se usa el alto visible real (`dvh`).
- App instalada en iPhone: con la barra de estado translúcida el encabezado quedaba debajo del notch/hora. Se agregó `viewport-fit=cover` y márgenes de zona segura (notch, barra de gestos).
- El nombre de la empresa en el encabezado del celular era texto oscuro sobre fondo oscuro (invisible).
- Colores de la barra de estado unificados con el encabezado (`#1e2a3a`); los íconos ya no se recortan en Android (`purpose: "any"`).
- Service worker actualizado (`repairtrack-v2`) para que los celulares tomen los cambios.

**Otros**
- "Cerrar Sesión" no borraba la cookie de sesión en el servidor (las páginas internas seguían abriendo). Ahora sí.
- El aviso al importar backup decía "sobrescribirá los datos"; en realidad solo agrega lo que falta. Texto corregido.

## Corrección de bugs funcionales (septiembre 2026)

**Dinero y fechas**
- **Ingresos por fecha de entrega real.** Nuevo campo `deliveredAt` en las OT. Antes se usaba `updatedAt`: editar una nota en una OT entregada hace meses movía ese dinero a "hoy". La migración rellena las OT ya entregadas usando el historial de estados.
- **Reporte mensual:** los ingresos ahora son las OT *entregadas* en el mes (antes: las *creadas* en el mes que por casualidad ya estaban entregadas). Se agregó la tabla "Órdenes entregadas en el mes".
- **Hora de Bolivia** en caja, estadísticas y reportes (variable opcional `APP_TIMEZONE`, por defecto `America/La_Paz`). Antes, lo registrado entre las 20:00 y 24:00 caía en el día siguiente y el mes se cortaba el último día a las 20:00.
- **Caja:** los totales del filtro ahora suman *todos* los movimientos (antes solo los últimos 500).
- La semana de las estadísticas empieza el lunes.
- Fecha por defecto de certificados y nombre del backup con la fecha local correcta.

**Datos**
- Códigos consecutivos (OT, COT, NV, CL, EQ, CN): si dos personas crean a la vez, ya no falla; se reintenta con el siguiente número.
- Backup: ahora incluye equipos, consolas, videojuegos, caja, reseñas, historial de estados y categorías (versión 1.1). La importación también los restaura, y los programas conservan descripción, idioma y clasificación.
- Transferir inventario fusionándolo con otro producto ya no borra sus números de serie.
- Inventario: "stock mínimo 0" se respeta (antes se convertía en 5); editar con campos vacíos ya no da error.
- Stock bajo en estadísticas usa el mínimo configurado en cada producto (antes era siempre ≤ 5).
- Clientes: se muestra el nombre más reciente y el historial de las 10 OT/cotizaciones más recientes.

**Enlaces**
- El WhatsApp de "Entregado" apuntaba a `/certificate-view/CE-X`, que no existe. Ahora apunta a la constancia de entrega `/delivery/view/OT-X`.
- Buscador global: las cotizaciones abrían con un enlace roto (usaba el ID interno); los certificados ahora incluyen la sucursal.
- Técnicos: al elegir una OT en el buscador, "Mis Asignaciones" la abre y la resalta.
- Las fechas de entrega en la constancia usan la fecha real de entrega.

**Código**
- Se quitaron 34 llamadas `.catch()` sobre funciones de estado de React que lanzaban errores silenciosos.
- Se corrigieron estilos con propiedades duplicadas (dashboard y portal) y tipos incorrectos en el portal.
- TypeScript pasó de 96 errores a 0 y se **reactivó la verificación de tipos en el build** (`ignoreBuildErrors` eliminado): un error de tipos ahora detiene el build en vez de llegar a producción.

### Al desplegar
Además de lo indicado en `SEGURIDAD.md`: `npx prisma migrate deploy` aplica la nueva migración `20260926_add_delivered_at` (agrega la columna y rellena las OT entregadas).

### Nota
"Caja Chica" y "Estadísticas" siguen ocultas en el menú lateral (estaban comentadas en `AppSidebar.tsx` como "deshabilitado para presentación"). Ya funcionan correctamente; se pueden volver a mostrar descomentando esas dos líneas.

## Seguridad (septiembre 2026)
Ver `SEGURIDAD.md`.

## Ajustes en celular (v8)
- **Escáner → Búsqueda manual:** el botón "Buscar" se aplastaba en vertical y salía de la tarjeta. Ahora el campo se achica y el botón queda completo a su lado. Regla general: ningún campo empuja fuera al botón de al lado.
- **Usuarios:** la foto ya no se estira a lo alto de la tarjeta. Se muestra como avatar redondo (64 px en PC, 48 px en celular) con el borde del color del rol, recortado centrado hacia la cara. Sin foto, se muestran las iniciales en el mismo círculo.

## Configuración para otra empresa (v9)
Todo lo visible para el cliente sale ahora de **Admin → Configuración** o del dominio donde está instalado el sistema:
- **WhatsApp:** los mensajes automáticos (OT creada, diagnóstico, en reparación, esperando repuestos, listo, entregado) y el botón "📲 WhatsApp" del panel y de Asignaciones ya no llevan el dominio fijo `degree-project.com`. Usan el dominio de la instalación (o `APP_URL` del `.env`). El mensaje de "listo para recoger" incluye la dirección si está configurada.
- **Nuevos campos en Configuración:** ciudad (panel), días de garantía, días para equipos no reclamados y términos y condiciones (uno por línea, con vista previa). Se usan en la orden de trabajo impresa y en el comprobante de entrega.
- **Nombre de la app:** el título de la pestaña, el nombre de la app instalada en el celular y el banner "Instalar …" usan el nombre de la empresa. El ícono de la app se genera a partir del logo (si no hay logo, se usa el ícono por defecto). `manifest.json` ahora es dinámico.
- Se quitó "Sistema RepairTrackQR" del pie del reporte mensual y el nombre por defecto que aparecía un instante mientras cargaba cada pantalla.
- Migración nueva: `20260928_settings_branding`. Se agregó `sharp` a las dependencias (para el ícono).

**Para instalarlo a otra empresa:** una instalación por empresa (base de datos, `.env`, dominio y cuenta de WasenderAPI propios), luego llenar Configuración.

## Enlace público y seguimiento en vivo (v10)
- **Configuración → Enlace público:** dirección que reciben los clientes por WhatsApp y que llevan los QR impresos (OT, stickers, cotizaciones, comprobantes, fichas, QR múltiple). Se acepta con o sin `https://` y sin `/portal`. Si está vacío se usa la dirección desde donde se abre el sistema. Muestra una vista previa y avisa si la dirección actual solo funciona en la red local. Migración: `20260929_settings_public_url`.
- **Seguimiento (/track) en tiempo real:** se actualiza solo cada 30 s mientras la página está a la vista y al volver a ella. Si cambia el estado aparece un aviso ("¡Tu equipo ya está listo!") y el celular vibra. Indicador "Se actualiza solo · actualizado hace X s".

## Campana de notificaciones (v11)
- El globo rojo con el número parpadeaba sin parar (animación infinita de opacidad). Ahora queda fijo, y la campana se balancea **una sola vez** cuando llega una notificación nueva. Al abrir la página no se mueve, aunque haya notificaciones sin leer de antes. Si el sistema tiene activado "reducir movimiento", las animaciones no se repiten.

## Revisión de animaciones (v12)
Se midieron las animaciones de todas las pantallas (celular y PC) buscando animaciones que se reinician solas o que no terminan nunca.
- **Portal:** el halo de luz del fondo saltaba de lugar en cada ciclo (la animación pisaba su centrado). Ahora solo cambia de intensidad.
- **Panel:** la etiqueta "⚠️ ESTANCADA" parpadeaba sin parar en cada orden con más de 7 días. Ahora es fija, igual que el número de la campana.
- **Campana:** el número quedaba medio cortado por una regla general de los botones. Ahora se ve completo.
- **Botones:** la transición general animaba todo (ancho, posición); ahora solo colores, sombra y el efecto al presionar. Así un botón no "salta" cuando cambia su texto o número.
- **Entrada de cada página:** ahora es solo un fundido. El pequeño desplazamiento que tenía movía las ventanas emergentes mientras la página aparecía.
- Sin reinicios detectados en ninguna pantalla (se observó cada una más de 12 s, incluidas las que se actualizan cada 10-15 s). Las animaciones continuas que quedan son decorativas y suaves (fondo del login y de /setup, halos del portal, ícono de estado del seguimiento, indicadores de "cargando"). Con "reducir movimiento" activado en el sistema, se desactivan.

## Fondo del login y de /setup (v13)
- Se quitaron los puntitos que flotaban en el fondo (parecían suciedad o píxeles muertos en la pantalla).
- Los halos de luz del fondo ahora están quietos (en /setup se desplazaban por la pantalla y en el login latían).

## Velocidad: Turbopack y limpieza (v14)
- **`npm run dev` ahora usa Turbopack** (el compilador por defecto de Next 16). La primera visita a cada pantalla es 2-3 veces más rápida que con webpack (login: 10 s → antes 22 s; portal: 2,3 s → antes 7,6 s). `npm run dev:webpack` queda como respaldo.
- **Se quitó Chakra UI** (y Emotion): estaba instalado pero ninguna pantalla lo usaba; solo agregaba peso y era lo que rompía Turbopack (errores de hidratación en todas las pantallas). Se compararon capturas de 16 pantallas en celular y PC antes y después: sin cambios visuales.
- **Nuevo `npm run local`**: compila y arranca en modo producción para usar el sistema a diario en la PC. Primera visita de cada pantalla: 0,02-0,4 s.

## Actualizar descomprimiendo encima (v15)
- Al descomprimir una versión nueva encima de la carpeta, los archivos que se eliminaron quedaban y rompían la compilación (`chakra-provider.tsx`: "Cannot find module '@chakra-ui/react'"). Ahora `npm run dev`, `npm run build` y `npm run local` borran primero esos archivos obsoletos (`scripts/limpiar-obsoletos.mjs`).
- `src/middleware.ts` pasó a `src/proxy.ts` (nombre nuevo en Next 16; quita el aviso "middleware-to-proxy"). La protección de páginas funciona igual: sin sesión → login; los documentos públicos siguen abiertos.

## Sin animaciones continuas (v16)
- Seguimiento: el ícono grande del estado, el punto de "Se actualiza solo" y el punto del paso actual ya no laten.
- Portal: los halos del fondo quedan fijos. Login: el ícono sin logo ya no cambia de color.
- Solo quedan animaciones mientras algo está en curso: "Buscando orden…", la línea del escáner mientras escanea, los círculos de carga.

## Reseñas de clientes (v17)
- Nueva pantalla **Documentos → Reseñas** (`/reviews`, solo administradores): promedio con estrellas, distribución 1-5 (tocar una fila filtra), períodos 30 días / 3 meses / 1 año / todo, filtro "solo con comentario". Cada reseña muestra cliente, comentario, OT (abre el seguimiento), equipo, técnico y un botón de WhatsApp ("Contactar al cliente" en las de 1-2 estrellas).
- Cuando un cliente deja una reseña llega una notificación a la campana de los administradores de esa sucursal y del super admin (las de 1-2 estrellas con ⚠️). Al tocarla se abre la pantalla de Reseñas.
- API nueva: `GET /api/reviews/list` (administradores; cada admin ve solo su sucursal, el super admin la sucursal activa).

## Datos del cliente protegidos en el portal (v18)
- **Seguimiento público en modo protegido:** sin sesión (o desde el portal, aunque haya una sesión del personal abierta) solo se ve estado, avance, equipo, fechas y el nombre/celular enmascarados ("María F.", "•••••005"). El problema, el costo, las notas, los accesorios y las fotos quedan ocultos. Antes, como los códigos son correlativos (OT-1, OT-2…), cualquiera podía recorrerlos y leer esos datos.
- **El cliente desbloquea con los últimos 4 dígitos de su celular** ("Ver mis datos"). Recibe un pase válido 12 h solo para esa orden (no sirve como sesión ni para otras órdenes). Máximo 5 intentos fallidos por orden y 20 por IP cada 15 min.
- **Comprobante de entrega** (`/delivery/view`, `/delivery`): documento personal, se muestra después de la misma verificación.
- **Reseñas:** solo el cliente verificado puede calificar (evita reseñas falsas en órdenes ajenas).
- **Personal:** el Escáner QR y los enlaces internos siguen mostrando todo.
- Archivos: `src/lib/track-access.ts`, `src/lib/track-client.ts`, `src/components/ClientVerify.tsx`, `src/app/api/track/[code]/verify/route.ts`.

## Super Admin sin código largo (v19)
- El Super Admin ya **no necesita el código de acceso para entrar**: correo + contraseña + PIN por WhatsApp (o app autenticadora), igual que los administradores. `/setup` abre directo en "Iniciar sesión".
- El código (`SETUP_CODE`) solo se pide para **crear** un Super Admin, o si la cuenta todavía **no tiene su WhatsApp verificado** (así, quien robara la contraseña no puede registrar su propio celular en el primer ingreso). En ese caso aparece el campo del código en el mismo formulario.
- Si se reintenta el ingreso antes de 60 s, ya no aparece "Espera X s para pedir otro código" como error: el PIN enviado sigue sirviendo.
- Batería de pruebas de doble verificación en base limpia: 51/51.

## Sin código de acceso (v20)
- Se eliminó el código de acceso (`SETUP_CODE`) por completo.
- **Entrar:** Super Admin = correo + contraseña + PIN de WhatsApp al celular ya registrado (o app autenticadora).
- **Crear Super Admin:** lo hace otro Super Admin en Administración → Usuarios (el celular es obligatorio). `/setup` solo muestra "Crear primer Super Admin" cuando no existe ninguno (instalación nueva).
- **Protección:** un Super Admin sin celular ni app autenticadora no puede entrar (así nadie con la contraseña robada puede registrar su propio celular). Se le carga el celular desde Usuarios o con `scripts/reset-access.ts correo --celular 7xxxxxxx`.

## Ventanas con formulario ya no se cierran al tocar afuera (v21)
- Editar/Nueva sucursal, Nuevo/Editar usuario, Transferir usuario, Contraseña temporal (se muestra una sola vez) y Nuevo movimiento de caja: un clic fuera de la ventana ya no la cierra ni borra lo escrito. Se cierran con Cancelar / Guardar / ✕.
- Se revisaron las 24 ventanas emergentes del sistema. Las de solo ver (fotos ampliadas, detalle de cliente, historial, opciones de impresión, fichas del portal, menú lateral, buscador) siguen cerrándose al tocar afuera, porque ahí no se pierde nada.

## Logo del sistema (v22)
- Nuevo logo de RepairTrackQR: **anillo de estados** (seis tramos = Pendiente → Entregado, el último apagado = en curso) con la llave al centro. Colores del sistema.
- Se usa cuando la empresa no sube su logo en Configuración: login, /setup, menú lateral, pestaña del navegador, app instalada. Componente `src/components/AppLogo.tsx`; archivos `public/logo.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-32.png` (versión simplificada para la pestaña).

## Colores y contraste (v23)
- **Mis Asignaciones (técnico):** las tarjetas usaban un estilo antiguo para tema oscuro: los títulos "EQUIPO", "DETALLES" y "ACCESORIOS" eran blancos sobre fondo claro (invisibles) y el anillo de seguimiento no mostraba las partes pendientes. Ahora tienen el mismo diseño del Panel: cabeceras oscuras, campos blancos con borde de color, problema en rojo suave. En celular la tarjeta de seguimiento ocupa todo el ancho.
- **Revisión de contraste en las 35 pantallas** (medición automática de cada texto contra su fondo): el turquesa claro (#2dd4df) usado como letra sobre blanco casi no se leía (títulos de Configuración, Nueva OT, Certificados, Escáner, filtros activos, reloj del panel…). Se cambió por el turquesa oscuro del sistema (#149aa5) en 57 lugares; en fondos oscuros (menú lateral, /setup) se mantiene el claro.
- También: textos ámbar sobre fondo claro (Plataformas, Solicitudes pendientes, Default), botón WhatsApp del técnico, etiqueta del rol en el menú lateral, botón "Ver mis datos" deshabilitado y "Sin imagen" de las fichas.
- Quedan claros a propósito: la marca de agua "AUTÉNTICO" del certificado y la guía "✂ CORTAR" de la orden impresa.

## Ver contraseña con el ojito (v24)
- Todos los campos de contraseña (12) tienen un botón 👁 para mostrarla u ocultarla: login, registro, /setup, recuperar contraseña, cambio obligatorio, Mi cuenta (actual, nueva, repetir, confirmar para códigos de respaldo y para desactivar la app autenticadora) y Nuevo/Editar usuario. Componente `src/components/PasswordInput.tsx`, con texto para lectores de pantalla ("Mostrar/Ocultar contraseña").

## Técnico igual al panel (v25)
- Tarjetas de resumen de "Mis Asignaciones" con el mismo diseño del Panel (blancas, borde de color arriba, ícono en cuadro). Antes eran transparentes con el ícono como marca de agua.
- "Completadas" ahora cuenta también las entregadas, igual que el Panel (antes una OT entregada daba 1 en el Panel y 0 en el técnico).
- Se agregó el filtro "Entregado" y el encabezado tiene el mismo tamaño que el del Panel.

## Paginación en Mis Asignaciones (v26)
- El técnico veía todas sus órdenes en una sola lista. Ahora son 10 por página con la misma paginación del Panel (« ‹ 1 2 3 … › », "Pág X de Y"). Al cambiar de filtro o buscar vuelve a la página 1; los contadores de los filtros siguen contando todas.
- Componente reutilizable `src/components/Pagination.tsx`.

## Login separado y productos ocultos en el portal (v27)
- **El login principal ya no deja entrar al Super Admin** (desde la v20 sí podía): el principal es para administradores y técnicos, y el Super Admin entra solo por /setup. Al revés también: /setup rechaza a administradores y técnicos. En ambos casos el mensaje es el genérico "Correo o contraseña incorrectos", para no revelar qué cuentas son Super Admin.
- **Inventario: botón "Portal / Oculto"** en cada producto. Un producto oculto sigue en el inventario, en ventas y cotizaciones, pero no aparece en el portal público. Lleva la etiqueta "🙈 Oculto en portal". Migración: `20260930_inventory_portal_visibility` (todos los productos existentes quedan visibles).

## Repuestos y ocultar en todo el catálogo (v28)
- **Nueva pestaña Catálogo → Repuestos** (`/repuestos`). Los repuestos son productos del mismo inventario marcados como tipo "Repuesto": comparten stock, series, categorías, extracto y se siguen descontando al entregar una OT. En el formulario de Inventario/Repuestos hay un campo **Tipo** para pasar un producto de una pestaña a otra.
- Al actualizar, lo que estaba en una categoría que contiene "Repuesto" pasa solo a la pestaña Repuestos.
- **Portal:** pestaña "🔩 Repuestos" separada de "📦 Productos" (aparece cuando hay repuestos con stock).
- **Botón Portal / Oculto** también en Equipos (en el detalle), Consolas, Programas y Videojuegos, con la etiqueta "🙈 Oculto en portal". Lo oculto no aparece en el portal pero sigue en el sistema.
- Extracto imprimible separado para Repuestos. Migración: `20261001_repuestos_y_visibilidad`.

## Inventario único con filtro por tipo (v29)
- **Repuestos vuelve a estar dentro de Inventario.** La entrada "Repuestos" del menú se quitó; en Catálogo → Inventario hay un filtro arriba: **Todos | 📦 Productos | 🔩 Repuestos**, cada uno con su contador. Las tarjetas de estadísticas, las categorías y el buscador respetan el filtro elegido.
- En la vista "Todos" cada tarjeta muestra una etiqueta **📦 Producto** o **🔩 Repuesto**. El campo **Tipo** del formulario sigue decidiendo a cuál pertenece.
- El filtro queda en la dirección (`/inventory?tipo=part`), así que se puede guardar o compartir. La ruta antigua `/repuestos` redirige ahí.
- **Extracto:** imprime lo que estés viendo (todo el inventario, solo productos o solo repuestos).
- **Portal:** sin cambios, siguen las dos pestañas "📦 Productos" y "🔩 Repuestos".
- No requiere migración nueva.

## Portal: pestañas vacías ocultas (v30)
- En el portal, las pestañas **Productos, Repuestos, Programas, Videojuegos, Consolas y Equipos** solo aparecen si tienen algo visible (con stock / disponible y no ocultado). Lo mismo con los botones de presentación de arriba ("Programas y software", "Videojuegos", etc.).
- Si la pestaña abierta se queda vacía, el portal pasa solo a la primera que tenga contenido.
- Si todo el catálogo está vacío, queda solo "Productos" con el mensaje de que no hay artículos.

## Equipos: botón Portal/Oculto en la tarjeta (v31)
- En **Catálogo → Equipos** el botón **Portal / Oculto** está ahora en cada tarjeta, entre "Editar" y la ficha, igual que en Consolas, Programas, Videojuegos e Inventario. Se quitó del detalle del equipo.

## Cotizaciones y notas de venta completas (v32)
- **Nuevas secciones en el formulario:** 🕹️ **Consolas** (solo las disponibles; al vender pasan a "vendida"), 🔧 **Servicios** (los de Catálogo → Servicios, con cantidad) y ✍️ **Otro concepto** (descripción y precio libres: instalación de programas o juegos, mano de obra, envío…). Artículos se llama ahora "Artículos y Repuestos" y marca los repuestos con 🔩.
- Cada línea muestra su etiqueta (Equipo, Consola, Servicio, Otro) en el formulario, el detalle y el documento impreso. Los documentos antiguos se siguen viendo igual.
- **Correcciones de stock:**
  - Eliminar una **nota de venta** devuelve los artículos al stock y deja otra vez disponibles los equipos y consolas (antes se perdían).
  - Al editar una venta y **quitar** un equipo o consola, este vuelve a "disponible".
  - Si una venta se cambia de nuevo a **cotización**, se devuelve todo al stock.
  - Antes de descontar se revisa el stock de **todos** los artículos, así no queda una venta descontada a medias.
  - Al editar una venta se puede subir la cantidad hasta lo que ya estaba descontado más el stock actual.

## Permisos del técnico ajustados (v33)
Revisión completa de permisos por rol (técnico, administrador, superadmin) en pantallas y API. Administrador y superadmin ya cumplían; se cerraron estas fugas del técnico:
- **Cotizaciones y Certificados:** el técnico ya no puede abrir `/quotations` ni `/certificates` escribiendo la dirección (lo devuelve a Mis Asignaciones) y la API ya no le entrega esas listas. Si escanea el QR de una cotización, nota de venta o certificado, ve la misma versión pública que el cliente (nombre abreviado, celular oculto).
- **Buscador:** el técnico busca órdenes, equipos y consolas de su sucursal; ya no aparecen cotizaciones, ventas ni certificados. Sus órdenes abren Mis Asignaciones y las de un compañero abren su seguimiento.
- **Catálogo:** el técnico recibe lo mismo que el portal (sin los productos, programas y videojuegos ocultos). Equipos y consolas siguen completos porque el escáner los necesita.
- Se mantiene a propósito: el técnico puede ver completas las órdenes de otros técnicos de su sucursal (para cubrir a un compañero), pero solo cambia estado y notas de las suyas.

## Selector de sucursal con el diseño del portal (v34)
- La ventana **"Selecciona la Sucursal"** (cuando un código existe en varias sucursales) usaba el diseño oscuro antiguo. Ahora es clara, como el resto del portal, en el portal y en la página de seguimiento.
- Las pantallas "Buscando orden…" y "No encontrada" del seguimiento también pasan al diseño claro.
- **Privacidad:** esa ventana mostraba el nombre del cliente a cualquiera que escribiera un código. Ahora solo muestra la sucursal y el equipo (o la fecha, en cotizaciones y certificados), y el portal siempre consulta la vista pública aunque haya una sesión del sistema abierta en el navegador.

## Códigos EQ / CN repetidos entre sucursales (v35)
- Cada sucursal numera sus equipos y consolas por su cuenta, así que **EQ-1** o **CN-1** pueden existir en varias. En el **portal**, al buscar ese código se abría solo el primero; ahora aparece el selector "Selecciona la Sucursal" con el nombre y precio de cada uno, y se abre la ficha del que elijas.
- En el **escáner del sistema**, el superadmin busca equipos y consolas en todas las sucursales (antes solo en la que tenía activa) y ve el mismo selector. Admin y técnico siguen viendo solo el de su sucursal.
- Los QR impresos en las fichas usan el identificador interno, que es único, así que al escanearlos se abre directo el equipo correcto.

## Listo para producción (v36)
- **Imágenes en producción:** las fotos subidas después de compilar (usuarios, productos, logo) ahora se ven también con `npm run local` y en el servidor. Se guardan en `UPLOAD_DIR` (recomendado fuera del proyecto: `/var/lib/repairtrack/uploads`) y se sirven por `/uploads/...`.
- **Estadísticas, Caja Chica y Transferencias** vuelven al menú (Finanzas y Administración). Se corrigió el gráfico de 6 meses que se montaba sobre el título.
- **Tomar esta orden:** un técnico puede tomar una orden de su sucursal asignada a otro (o sin asignar) desde el seguimiento, por ejemplo si su compañero no vino. Queda en el historial y se avisa a los administradores y al técnico anterior. No se pueden tomar órdenes entregadas ni de otra sucursal.
- **Precio opcional en Programas y Videojuegos:** se muestra en el catálogo y en el portal, y los que tienen precio aparecen en cotizaciones y notas de venta (secciones 💿 Programas y 🎮 Videojuegos, con cantidad). Migración: `20261002_precio_programas_videojuegos`.
- **Paginación** (12 por página; 10–15 en listas) en Inventario, Equipos, Consolas, Programas, Videojuegos, Servicios, Clientes, Usuarios y Certificados. Vuelve a la página 1 al buscar o filtrar.
- **Enlace personal por WhatsApp:** los mensajes automáticos y el botón "📲 WhatsApp" envían un enlace firmado de esa orden (vale 120 días). El cliente ve su orden completa sin escribir los 4 dígitos; si el enlace se altera o vence, se le piden los dígitos como antes. El comprobante de entrega también usa su enlace.
- **Empezar limpio:** `npx tsx scripts/empezar-limpio.ts` (vista previa) y `--confirmar` borra los datos de prueba conservando el Super Admin, la Configuración y las categorías. Opciones `--mantener-usuarios` y `--borrar-imagenes`.
- **Despliegue en Hetzner:** guía paso a paso `deploy/GUIA-HETZNER.md` (dominio, HTTPS con certbot, Nginx, PM2, respaldo diario, primer uso), `deploy/actualizar.sh` (actualiza desde ZIP o git sin tocar `.env` ni imágenes, con respaldo previo), `deploy/ecosystem.config.cjs` y `deploy/nginx-repairtrack.conf`. Los scripts de respaldo y restauración ya no llevan la contraseña escrita: la leen del `.env`.
