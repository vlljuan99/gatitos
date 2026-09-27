# Bigotes 🐾

Web de **Bigotes, asociación para la ayuda al gato callejero** en Almendralejo
(Badajoz): protección, cuidado y orientación ciudadana. Pensada primero para el móvil: mona, cuqui y hecha para que la gente
se enamore de un gatito y lo adopte.

## Qué tiene

**Web pública**

- **Portada** con contadores (rescatados, adoptados este año, buscan hogar),
  gatitos destacados y cómo es la adopción.
- **Catálogo** con filtros (edad, sexo, si convive con niños, gatos o perros).
- **Ficha de cada gatito**: galería de fotos y vídeos, carácter, convivencia,
  salud, necesidades especiales, su historia y botón para compartir por
  WhatsApp. Cada ficha tiene
  su propia vista previa (foto y nombre) al compartir el enlace.
- **Modo match**: tarjetas que se deslizan con el dedo. Solo hay «Me encanta»
  y «Siguiente», nada de «no me gusta». Se puede deshacer, filtrar y, al primer
  «Me encanta», sale la pantalla de «¡Os habéis gustado!».
- **Favoritos** sin registrarse (se guardan en el navegador).
- **Solicitud de adopción** por pasos, con el gatito ya elegido si vienes de
  su ficha. Solo se admite Extremadura (Badajoz y Cáceres).
- **Cómo trabajamos**, requisitos, cuota y preguntas frecuentes.
- **Finales felices** con los gatitos adoptados.
- **Colabora**: formulario de voluntariado y zona de donaciones (Bizum,
  transferencia, Teaming, PayPal) que sale como «Muy pronto» hasta que se
  rellenen los datos.
- **Contacto**, aviso legal, privacidad y cookies (sin banner: la web no usa
  cookies de terceros ni analítica, y las tipografías se sirven desde aquí).

**Panel del equipo** (`/admin`), también pensado para el móvil

- Dos papeles con nombre gatuno: **bigotes mayores** (administración) y
  **cuidabigotes**. Las cuidabigotes llevan el día a día; los bigotes mayores
  además gestionan el equipo, los datos legales y pueden borrar. Las altas de
  los dos papeles se hacen desde el panel (**Equipo → Añadir a alguien**), con
  una contraseña temporal para pasar por WhatsApp.
- **Nuevo gatito en un minuto**: asistente que empieza por las fotos y los
  vídeos (desde la galería o la cámara). Las fotos se reducen en el propio
  móvil, se convierten a WebP y se les quita la ubicación GPS antes de
  publicarse.
- **Imagen para redes**: al publicar un gatito (y cuando se quiera desde su
  ficha) se crea en el móvil una imagen lista para Instagram o WhatsApp
  (publicación 4:5 o historia 9:16) con sus fotos en polaroid, su nombre, sus
  datos y el contacto de la asociación, más un texto para acompañarla.
- **Nada se pierde al recargar**: los formularios (solicitud, contacto,
  voluntariado, alta y edición de gatitos, textos, notas…) guardan lo escrito
  en el navegador hasta que se envían. El alta de un gatito recuerda también
  el paso y las fotos y vídeos elegidos.
- **Vídeos**: hasta 6 por gatito, de un minuto como mucho. El servidor los
  prepara en segundo plano con ffmpeg (MP4 que se ve en cualquier móvil, sin
  ubicación GPS ni otros metadatos) y aparecen en la web cuando están listos.
- Cambio de estado con un toque (disponible, reservado, adoptado…). Al marcar
  «Adoptado» el gatito pasa solo a Finales felices.
- **Solicitudes** por etapas (nueva → entrevista → visita → aprobada →
  adoptado / descartada), con notas internas y botones para llamar, WhatsApp o
  email.
- Bandejas de **mensajes** y **voluntariado**.
- **Textos de la web** editables sin tocar código (portada, cómo trabajamos,
  requisitos, preguntas, contacto, donaciones, datos legales).
- **Resumen** con lo pendiente, los gatitos más queridos en el match y los que
  necesitan un empujón.

## Stack

El mismo que el resto de proyectos del VPS:

- **Cliente**: React 19 + Vite + Tailwind CSS 4 + Framer Motion + React Router.
- **Servidor**: Node.js 22 + Express 5 + better-sqlite3 (SQLite en WAL) + sharp
  para las fotos y ffmpeg para los vídeos. Sesión con cookie httpOnly (JWT) y
  contraseñas con bcrypt.
- **Producción**: un contenedor Docker detrás del Caddy compartido. Ver
  [deploy/README.md](deploy/README.md).

## Desarrollo

```bash
npm run install:all   # dependencias de raíz, servidor y cliente
npm run seed:demo     # gatitos de demostración y dos cuentas de prueba
npm run dev           # servidor en :4000 y Vite en :5173
```

Cuentas de prueba (solo fuera de producción): `admin@bigotes.local` (bigote
mayor) y `cuidabigotes@bigotes.local`, contraseña `bigotes-demo`.

Para subir vídeos en local hace falta tener `ffmpeg` instalado (sin él, el
panel lo avisa y todo lo demás funciona igual; sus pruebas se saltan).

```bash
npm test              # pruebas del servidor y del cliente
npm run build         # build del cliente
npm run test:e2e      # pruebas de extremo a extremo en un móvil (Playwright)
```

## Estructura

```
client/src/
  pages/        Páginas públicas (portada, catálogo, ficha, match, adoptar…)
  admin/        Panel del equipo (se descarga aparte)
  components/   Piezas de la interfaz (tarjetas, hojas, formularios…)
  lib/          Lógica sin interfaz: API, favoritos, edad, baraja del match…
server/src/
  app.js        Express: seguridad, API, fotos y la SPA con su Open Graph
  db.js         SQLite y migraciones (fuente de verdad del modelo de datos)
  content.js    Textos editables con sus valores por defecto
  routes/       API pública y del panel
server/scripts/ seed-demo, create-user, generate-brand
brand/          Logo original de la asociación (el vectorizado está en client/public)
deploy/         Compose, Caddy y scripts del servidor
e2e/            Pruebas de extremo a extremo
```
