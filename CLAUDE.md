# Bigotes — contexto para Claude

Web de la asociación **Bigotes** (rescate y adopción de gatitos en Almendralejo, Badajoz): web pública para que la gente se enamore de un gatito y lo adopte, más un panel para que el equipo la mantenga desde el móvil. Ver [README.md](README.md) para las funciones.

**Desplegado en el VPS Hetzner compartido** (mismo host que tilestudio/tri-dnd/teacherflow/friendlyflights, detrás del Caddy de `/opt/tilestudio`) en `https://bigotes.167-233-99-156.sslip.io`, sin dominio propio todavía. El redeploy se lanza a mano desde GitHub Actions (`Deploy to Hetzner`, `workflow_dispatch`): prueba, audita, hace backup, publica `bigotes:<commit-sha>` y vuelve a la imagen anterior si falla. Ver [deploy/README.md](deploy/README.md).

## Decisiones de producto ya confirmadas (no volver a preguntar)

- **Mobile first** en todo, también en el panel. Barra de navegación inferior en móvil; objetivos táctiles de 44-48 px como mínimo.
- **Estética mona y cuqui**, pero que dé confianza: paleta pastel «Bigotes» definida en `client/src/index.css` (textos con contraste AA), tipografías Fredoka (títulos) y Nunito (texto) servidas desde la propia web.
- **Modo match sin «no me gusta»**: solo «Me encanta» y «Siguiente». No introducir nunca textos o iconos negativos (❌, «no me gusta», «descartar») en la parte pública.
- **Solo se adopta en Extremadura** (provincias de Badajoz y Cáceres). El servidor lo valida.
- **La asociación hace adopciones y voluntariado.** No hay casas de acogida externas ni apadrinamientos por ahora.
- **Donaciones**: la zona existe, pero sin datos hasta que la asociación los tenga. Cada método sale como «Muy pronto» mientras su campo esté vacío en «Textos de la web → Donaciones».
- **Roles**: una persona de **administración** y varias **cuidabigotes** (nombre elegido para el papel de gestión del día a día). Cuidabigotes: gatitos, solicitudes, mensajes, voluntariado y textos. Solo administración: equipo, datos legales y borrar gatitos/solicitudes/mensajes. No hay registro público.
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

## Convenciones

- Código con identificadores en inglés; **comentarios, mensajes de error, textos y documentación en español**.
- Los textos de la web se adaptan al sexo del gatito con `gendered()` (`client/src/lib/cats.js`): «mimosa», «Adoptada»…
- Las opciones de los formularios públicos existen en dos sitios que deben coincidir: `server/src/forms.js` (valida) y `client/src/lib/forms.js` (etiquetas).
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
