# Bigotes — contexto para Claude

Web de la asociación **Bigotes** (rescate y adopción de gatitos en Almendralejo, Badajoz): web pública para que la gente se enamore de un gatito y lo adopte, más un panel para que el equipo la mantenga desde el móvil. Ver [README.md](README.md) para las funciones.

**Desplegado en el VPS Hetzner compartido** (mismo host que tilestudio/tri-dnd/teacherflow/friendlyflights, detrás del Caddy de `/opt/tilestudio`) en `https://bigotes.167-233-99-156.sslip.io`, sin dominio propio todavía. El redeploy se lanza a mano desde GitHub Actions (`Deploy to Hetzner`, `workflow_dispatch`): prueba, audita, hace backup, publica `bigotes:<commit-sha>` y vuelve a la imagen anterior si falla. El primer despliegue crea `/opt/bigotes/app.env` a partir de los secretos `BIGOTES_ADMIN_*`; necesita también `HETZNER_SSH_KEY`. Ver [deploy/README.md](deploy/README.md).

## Decisiones de producto ya confirmadas (no volver a preguntar)

- **Mobile first** en todo, también en el panel. Barra de navegación inferior en móvil; objetivos táctiles de 44-48 px como mínimo.
- **Logo oficial**: «Bigotes · Asociación para la ayuda al gato callejero · Protección, cuidado y orientación ciudadana». Original en `brand/logo-bigotes.jpg` (versión actual, sin bigotes en la B y con los del gato más largos); vectorizado en `client/public/` (`logo-texto.svg` para cabeceras, `logo-completo.svg` con el lema, `logo-cara.svg`/`favicon.svg` para iconos). Los PNG de iconos y la imagen para compartir salen de ahí con `node server/scripts/generate-brand.js`.
- **Estética mona y cuqui**, pero que dé confianza: colores del logo (carbón `cacao` y `canela`) más pasteles (menta, lavanda, mantequilla…), definidos en `client/src/index.css` con contraste AA. Tipografías Fredoka (títulos) y Nunito (texto) servidas desde la propia web.
- **Modo match sin «no me gusta»**: solo «Me encanta» y «Siguiente». No introducir nunca textos o iconos negativos (❌, «no me gusta», «descartar») en la parte pública.
- **Solo se adopta en Extremadura** (provincias de Badajoz y Cáceres). El servidor lo valida.
- **La asociación hace adopciones y voluntariado.** Las **casas de acogida** son personas voluntarias que el equipo registra en el panel (Casas de acogida) con DNI y dirección, para el acuerdo de acogida; no hay formulario público de acogida ni apadrinamientos.
- **Gatos de colonia**: se registran en el panel con el estado `colonia` («En su colonia»: atendido y devuelto a su sitio) y **nunca salen en la web** (`PUBLIC_STATUSES` en `server/src/cats.js`; toda consulta pública debe filtrar por ahí, no por `!= 'borrador'`).
- **Papeles en PDF** (`server/src/papers/`, ruta `/api/papeles`), redibujados en vectorial a partir de los originales de la asociación: ficha del gato (A4), ficha de seguimiento (A5, historial y veterinario), acuerdo de acogida (A5), parte veterinario (A5 apaisado: sin parte la clínica no atiende a cargo de la asociación y cobra aparte), contrato de adopción (A4), compromiso de confidencialidad (A4, para equipo, voluntariado y acogidas), inventario de medicación, inventario general y registro de donaciones. Se pueden sacar en cualquier momento: rellenos con lo que haya y líneas en blanco para el resto, o del todo en blanco; los A5 también dos por folio (`?hoja=a4`). Los enlaces llevan un permiso de 30 min (`?t=`) porque en la app instalada o el visor del móvil no viaja la cookie.
- **Numeración por año**: n.º de ficha `2026-001` (se asigna al dar de alta, editable), contratos `A-2026-001` (al preparar el contrato) y partes `V-2026-001` (al crear el parte). Ver `server/src/numbers.js`.
- **Datos del contrato** (DNI, fecha de nacimiento, dirección, CP, contacto alternativo) se guardan en la solicitud y se piden en el panel, nunca en el formulario público.
- Los textos de los papeles (condiciones del contrato con el compromiso de esterilizar si se entrega sin esterilizar, acuerdo de acogida, confidencialidad, protección de datos con el vocabulario del RGPD) están en `server/src/papers/` y son un punto de partida que la asociación debe revisar.
- **Donaciones**: la zona existe, pero sin datos hasta que la asociación los tenga. Cada método sale como «Muy pronto» mientras su campo esté vacío en «Textos de la web → Donaciones».
- **Roles con nombre gatuno**: **bigotes mayores** (administración, clave interna `admin`; puede haber varios) y **cuidabigotes** (gestión del día a día). Cuidabigotes: gatitos y sus papeles, solicitudes y contratos, mensajes, voluntariado, casas de acogida, inventario, donaciones y textos. Solo bigotes mayores: equipo, datos legales y borrar gatitos/solicitudes/mensajes/casas de acogida/donaciones. No hay registro público: las altas de ambos papeles se hacen desde el panel (Equipo). Etiquetas en `server/src/auth.js` (`ROLES`) y `client/src/admin/common.jsx` (`ROLE_INFO`).
- **Vídeos de gatitos**: hasta 6 por gatito, 1 minuto (se guarda el primero si dura más) y 300 MB. `server/src/videos.js` los convierte en segundo plano, de uno en uno, a MP4 H.264 ≤720p/30 fps sin metadatos (fuera la ubicación GPS) y saca una portada WebP. El original se guarda en `data/tmp/videos`, fuera de `/uploads`, y se borra al terminar. En la web solo salen los que están «listo».
- **Imagen para redes**: se dibuja en el navegador (`client/src/admin/drawShareImage.js`, canvas con Fredoka/Nunito y el logo; la hoja está en `ShareImage.jsx`) en 1080×1350 o 1080×1920, JPEG. Lleva fotos, nombre, datos (`client/src/lib/shareText.js`) y el contacto de «Textos de la web → Contacto». Se abre sola al publicar desde el alta (`?compartir`) y desde la ficha del panel.
- **Borradores de formularios** (`client/src/lib/drafts.js`, `useDraftState`): lo escrito sobrevive a recargar. Web pública en sessionStorage (datos personales, se borra al cerrar la pestaña; nunca la casilla de privacidad ni el campo trampa); panel en localStorage (7 días), con `checkBase` para no pisar cambios ajenos. Las fotos y vídeos del alta, en IndexedDB (`lib/fileDrafts.js`). Formularios nuevos: usar `useForm(..., { draft })` o `useDraftState`.
- **Favoritos sin cuenta** (localStorage). El «Me encanta» suma un contador anónimo por gatito que solo ve el equipo.
- **Privacidad**: sin cookies de terceros ni analítica (por eso no hay banner). Las fotos pierden el EXIF (ubicación GPS) al subirse. Solicitudes descartadas y mensajes archivados se borran solos a los 12 meses (`RETENTION_MONTHS`).
- **Textos por defecto** (cómo trabajamos, requisitos, FAQ, legales) son un punto de partida: la asociación debe revisarlos. Los datos legales que falten salen como «[pendiente]».
- **Fase 1 entregada.** Pendiente para fases siguientes (no implementar sin confirmarlo): «¿Has encontrado un gato?», campañas urgentes con barra de progreso, noticias/eventos, avisos por email de gatitos nuevos, estadísticas, dominio propio.

## Stack

- **Cliente**: React 19 + Vite + Tailwind CSS 4 + Framer Motion + React Router 7 (data router, páginas secundarias y el panel en carga diferida).
- **Servidor**: Node.js 22 (ESM) + Express 5 + better-sqlite3 (WAL) + sharp + zod (mensajes en español). Migraciones incrementales con `PRAGMA user_version` en `server/src/db.js`: **añadir al final del array, nunca editar una ya aplicada**.
- **Auth**: email/contraseña (bcrypt) y cookie httpOnly con JWT. `session_version` en el token invalida sesiones al cambiar contraseña, papel o desactivar.
- **Open Graph**: la SPA no sirve para las vistas previas de WhatsApp/redes, así que `server/src/og.js` rellena el `<head>` de `index.html` (entre `<!--meta-->` y `<!--/meta-->`) por ruta y por gatito.
- **Fotos**: `server/src/images.js` guarda `lg` (WebP 1600), `sm` (WebP 640) y `og` (JPEG 1200×630) en `data/uploads/gatitos/`. El panel las reduce antes en el móvil (`client/src/admin/photos.js`).
- **PDF**: PDFKit en el servidor (`server/src/papers/pdf.js` es el kit: secciones, campos con línea, casillas, fechas, firmas). Fuentes Fredoka/Nunito en TTF en `server/assets/fonts` (fontkit falla con WOFF2) y el logo se lee de `client/dist` o `client/public/logo-completo.svg`. Los datos se preparan en `papers/data.js`; las plantillas solo dibujan.
- **Migraciones que rehacen una tabla** (p. ej. para cambiar un CHECK): entrada `{ foreignKeysOff: true, sql }` en `migrations`, para que el DROP no arrastre en cascada fotos o solicitudes.
- **Vídeos**: `server/src/videos.js` (ffmpeg, cola en segundo plano que se retoma al arrancar) guarda `<clave>.mp4` y `<clave>-poster.webp` en `data/uploads/videos/`. El panel sube con progreso (`client/src/admin/videos.js`) y consulta cada 4 s mientras alguno está «procesando». ffmpeg va en la imagen Docker y se instala en CI; sin él las pruebas de vídeo se saltan.

## Convenciones

- Código con identificadores en inglés; **comentarios, mensajes de error, textos y documentación en español**.
- Los textos de la web se adaptan al sexo del gatito con `gendered()` (`client/src/lib/cats.js`): «mimosa», «Adoptada»…
- Las opciones de los formularios públicos existen en dos sitios que deben coincidir: `server/src/forms.js` (valida) y `client/src/lib/forms.js` (etiquetas).
- Igual con las categorías del inventario y las formas de pago de las donaciones: `server/src/routes/adminInventory.js` / `client/src/admin/Inventory.jsx` y `server/src/routes/adminDonations.js` / `client/src/admin/Donations.jsx`.
- Toda lectura del panel pasa por `useAdminApi`; tras cualquier cambio llamar a `refreshAfterChange()` para refrescar panel y web pública.

## Comandos

```bash
npm run install:all   # raíz + server + client
npm run seed:demo     # gatitos de demo (+ cuentas de prueba fuera de producción)
npm run dev           # servidor :4000 + Vite :5173
npm test              # node --test en server y client
npm run build         # build del cliente
npm run test:e2e      # Playwright en móvil (Pixel 7) con servidor real y datos de demo
node server/scripts/generate-brand.js   # regenerar iconos e imagen para compartir desde el logo
```
