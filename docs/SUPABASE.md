# Integración Supabase — Escuela ZAO

Guía paso a paso para conectar el portal con tu proyecto de Supabase.

---

## Paso 1: Crear el proyecto

1. Entra a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **New project** → nombre (ej. `escuela-zao`), contraseña de base de datos, región cercana
3. Espera 1–2 minutos a que termine el aprovisionamiento

---

## Paso 2: Copiar credenciales al proyecto

1. En el dashboard: **Project Settings** (engranaje) → **API**
2. Copia:
   - **Project URL** → `url`
   - **anon public** (Publishable) → `anonKey`

3. En tu máquina:

```bash
cd app_filigay
cp js/config.example.js js/config.js
```

4. Edita `js/config.js`:

```javascript
export const supabaseConfig = {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
};
```

> `config.js` está en `.gitignore` — no lo subas a Git.

5. Reinicia el servidor y recarga el login. Ya no debería decir *"Modo demo"*.

---

## Paso 3: Ejecutar el esquema SQL (en 2 pasos)

Si ejecutas todo junto y ves *Success* pero **no aparece ninguna tabla**, el trigger en `auth.users` pudo fallar y revertir la transacción. Hazlo así:

1. **SQL Editor** → **New query** → pega y ejecuta **`supabase/01-schema-core.sql`**
   - Al final debe salir una fila: `tabla = profiles`, `columnas = 9` (aprox.)
2. Nueva query → pega y ejecuta **`supabase/02-auth-trigger.sql`**
   - Debe salir: `trigger_name = on_auth_user_created`
3. (Opcional) Ejecuta **`supabase/verify.sql`** para ver el diagnóstico completo

**Table Editor:** menú izquierdo → **public** → **profiles** → icono **Refresh**.

> No uses solo comentarios o una selección parcial del script; selecciona **todo** el archivo antes de Run.

---

## Paso 4: Configurar Authentication

1. **Authentication** → **Providers** → **Email**
   - Deja **Email** activado
2. Para desarrollo (opcional): desactiva **Confirm email**  
   Así puedes iniciar sesión sin confirmar correo.

---

## Paso 5: Seed de usuarios y perfiles (recomendado)

Ejecuta **todo** `supabase/seed-usuarios-prueba.sql` en el SQL Editor.

Ese script:

1. Crea usuarios en **`auth.users`** (contraseña con `bcrypt`)
2. Crea **`auth.identities`** (necesario para poder iniciar sesión)
3. Crea filas en **`public.profiles`**

No hace falta crearlos antes en Authentication → Users.

Credenciales:

| Email | Contraseña |
|-------|------------|
| admin@zao.edu | admin123 |
| maestro@zao.edu | prof123 |
| estudiante@zao.edu | alum123 |

Al final debes ver **3 filas** en las tres consultas de verificación.

> Solo para desarrollo. En producción es más seguro crear usuarios con la API Admin o el panel de Auth.

---

## Paso 5b: Crear usuarios desde el panel admin (opcional)

Ejecuta en SQL Editor: `supabase/04-admin-create-user.sql`

Luego, como **admin**, en `admin.html` → pestaña **Usuarios admin / docente** puedes crear cuentas con rol administrador o docente.

---

## Paso 6: Probar el login en la app

```bash
npm run dev
```

1. Abre http://localhost:3000
2. Inicia sesión con `admin@zao.edu` / `admin123`
3. Debes llegar a `admin.html`
4. Prueba `maestro@zao.edu` → `docente.html` y `estudiante@zao.edu` → `estudiante.html`

---

## Cómo funciona en el código

| Archivo | Función |
|---------|---------|
| `js/config.js` | URL y anon key |
| `js/supabase.js` | Cliente Supabase |
| `js/auth.js` | `signIn` / `signOut` / sesión JWT |
| `js/profiles.js` | Lee y actualiza tabla `profiles` |
| `js/session.js` | Une auth + perfil → rol y redirección |
| `js/guard.js` | Protege páginas por rol |

El **rol** lo define la columna `profiles.role` (fuente principal). Si falla la lectura, usa `user_metadata.role`.

---

## Actualizar perfil (primera vez)

Si `needs_profile_update = true`, el usuario va a `actualizar-perfil.html` antes del portal.

Tras guardar, se actualizan `profiles` y `auth.users` metadata.

---

## Problemas frecuentes

### "Modo demo" sigue visible
- Revisa que `js/config.js` exista y no tenga placeholders `TU_PROYECTO`
- Limpia `sessionStorage` del navegador (o ventana privada)

### Error al iniciar sesión
- Usuario creado en Auth con la misma contraseña
- Email confirmado o **Auto Confirm** activo

### `profiles` vacío tras crear usuario
- Vuelve a ejecutar `schema.sql` (trigger `on_auth_user_created`)
- O inserta manualmente:

```sql
insert into public.profiles (id, email, role, full_name)
select id, email, 'student', email from auth.users
where id not in (select id from public.profiles);
```

### RLS bloquea lectura
- El usuario solo puede leer su propio perfil (política `profiles_select_own`)
- Los admin pueden leer todos (`profiles_select_admin`)

### CORS / red
- Usa siempre `npm run dev`, no abras `index.html` con `file://`

---

## Siguiente fase (datos reales)

Cuando quieras salir del HTML estático con datos de ejemplo:

1. Tablas: `students`, `courses`, `enrollments`, `attendance`, `grades`, `payments`
2. RLS por rol (estudiante solo su fila, docente sus cursos, admin todo)
3. Sustituir filas hardcodeadas en `admin.html` / `estudiante.html` por `.from('...').select()`

Puedes pedir el diseño SQL de esas tablas cuando llegues a ese punto.
