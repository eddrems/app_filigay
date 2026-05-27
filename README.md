# Escuela ZAO — Filigay

Portal escolar con **HTML**, **Alpine.js**, **Tailwind CSS** (CDN) y **Supabase**.

## Estructura

```
├── index.html              # Login
├── admin.html              # Panel administración
├── docente.html            # Portal docente
├── estudiante.html         # Portal estudiante
├── actualizar-perfil.html  # Actualización obligatoria de perfil
├── css/zao.css             # Estilos base + utilidades
├── js/
│   ├── tailwind.config.js  # Design system (tokens Stitch)
│   ├── roles.js            # Roles y credenciales demo
│   ├── session.js          # Sesión demo / Supabase
│   ├── auth.js             # Auth Supabase
│   ├── guard.js            # Protección de rutas
│   ├── layout.js           # Layout Alpine (nav, header)
│   ├── login.js
│   └── profile-update.js
└── package.json
```

## Inicio rápido

```bash
npm run dev
# http://localhost:3000
```

### Modo demo (sin Supabase)

Usa los botones de credenciales en el login:

| Rol        | Email               | Clave    |
|------------|---------------------|----------|
| Admin      | admin@zao.edu       | admin123 |
| Docente    | maestro@zao.edu     | prof123  |
| Estudiante | estudiante@zao.edu  | alum123  |

### Con Supabase

Guía completa: **[docs/SUPABASE.md](docs/SUPABASE.md)**

Resumen:

```bash
cp js/config.example.js js/config.js
# Pegar URL y anon key del dashboard → SQL Editor → ejecutar supabase/schema.sql
# Crear usuarios en Authentication → ejecutar supabase/seed-usuarios-prueba.sql
```

## Design system

Tokens en `js/tailwind.config.js` (colores Material, tipografía Inter, espaciado 8px). Ver maqueta original en `DESIGN.md` de Stitch.

## Stack

| Tecnología | Uso |
|------------|-----|
| HTML       | Una página por rol/vista |
| Alpine.js  | Login, layout, tabs, navegación móvil |
| Tailwind   | Play CDN, sin compilación |
| Supabase   | Auth y datos (opcional en demo) |
