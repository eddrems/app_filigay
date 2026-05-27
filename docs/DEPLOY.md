# Deploy — Escuela ZAO

## Por qué salía "modo demo"

1. **`js/config.js` no estaba en Git** (estaba en `.gitignore`) → en producción faltaba el archivo.
2. **Sesión demo en el navegador** (`sessionStorage`) → seguía activa aunque Supabase ya estuviera bien.

Ya está corregido: `config.js` se versiona y la app prioriza Supabase cuando está configurado.

---

## Publicar (sitio estático)

Sube todo el repo excepto `node_modules/`.

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
