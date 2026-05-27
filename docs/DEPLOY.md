# Deploy — Escuela ZAO

## Por qué salía "modo demo"

1. **`js/config.js` no estaba en Git** (estaba en `.gitignore`) → en producción faltaba el archivo.
2. **Sesión demo en el navegador** (`sessionStorage`) → seguía activa aunque Supabase ya estuviera bien.

Ya está corregido: `config.js` se versiona y la app prioriza Supabase cuando está configurado.

---

## Publicar (sitio estático)

Sube **todo el repo** excepto `node_modules/` (incluye la carpeta `js/` completa: `init-*.js`, `alpine-core.js`, `alpine-boot.js`, etc.). Un deploy parcial deja la app en “Cargando portal…” o con errores 404 en la consola.

| Plataforma | Publish directory | Build command (opcional) |
|------------|-------------------|---------------------------|
| Netlify | `.` | `node scripts/write-config.mjs` |
| Vercel | `.` | igual |
| Cloudflare Pages | `.` | igual |

---

## Variables de entorno (recomendado en CI)

En el panel del hosting:

| Variable | Valor |
|----------|--------|
| `SUPABASE_URL` | `https://wovnblpgijncojfpqqcx.supabase.co` |
| `SUPABASE_ANON_KEY` | Tu clave **publishable / anon** |

El script `scripts/write-config.mjs` regenera `js/config.js` en cada deploy.

Si no configuras env vars, se usa el `js/config.js` del repositorio.

---

## Supabase después del deploy

**Authentication → URL Configuration**

- **Site URL:** `https://tu-dominio.netlify.app`
- **Redirect URLs:** `https://tu-dominio.netlify.app/**`

---

## Comprobar en producción

1. Abre el sitio en ventana privada.
2. No debe decir "modo demo".
3. Login con `admin@zao.edu` debe funcionar.

Si aún ves demo: borra datos del sitio en el navegador o usa incógnito.

---

## Seguridad

- Publica solo la clave **anon / publishable**.
- Nunca la **service role** (`sb_secret_…`) en el front.

---

## Safari

- Usa **HTTPS** o `npm run dev` (`http://localhost:3000`). Abrir los `.html` con `file://` suele romper módulos ES en Safari.
- Requiere **Safari 15+** (módulos ES y `import` desde CDN).
- Si la pantalla queda en blanco: **Desarrollo → Consola web** y busca errores de red en `cdn.jsdelivr.net` (bloqueadores, VPN, modo estricto).
- No uses `dist/module/index.js` de Supabase en el front: da error `Failed to resolve module specifier "@supabase/auth-js"`. En este proyecto se usa `+esm` de jsDelivr.
- El arranque va en un solo script por página (`js/init-admin.js`, `js/init-estudiante.js`, …) para evitar que Alpine inicie antes de registrar componentes.
