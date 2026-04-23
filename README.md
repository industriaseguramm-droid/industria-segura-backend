# Industria Segura MM — Backend API

## Estructura

```
industria-segura-backend/
├── server.js
├── package.json
├── .env.example
├── database.sql
├── config/
│   └── supabase.js
├── middleware/
│   ├── auth.js
│   └── multer.js
├── controllers/
│   ├── auth.controller.js
│   ├── expedientes.controller.js
│   ├── archivos.controller.js
│   ├── clientes.controller.js
│   └── configuracion.controller.js
└── routes/
    ├── auth.routes.js
    ├── portal.routes.js
    ├── expedientes.routes.js
    ├── archivos.routes.js
    ├── clientes.routes.js
    └── configuracion.routes.js
```

## Instalación local

```bash
npm install
cp .env.example .env
# Edita .env con tus claves de Supabase
npm run dev
```

Verifica en: `http://localhost:3001/health`

## Deploy en Railway

1. Sube este repositorio a GitHub
2. Conecta el repo en railway.app
3. Agrega las variables de entorno del archivo `.env.example`
4. Railway despliega automáticamente

## Variables de entorno requeridas

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL de tu proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave anon de Supabase |
| `SUPABASE_SERVICE_KEY` | Clave service_role de Supabase |
| `JWT_SECRET` | Frase secreta para firmar tokens |
| `PORT` | Puerto del servidor (Railway lo asigna solo) |
| `NODE_ENV` | `production` en Railway |
| `FRONTEND_URL` | URL de tu portal en Vercel |

## Endpoints principales

### Portal del cliente (públicos)
- `GET  /api/portal/:token` — Obtener expediente
- `PUT  /api/portal/:token/datos` — Guardar sección del formulario
- `PUT  /api/portal/:token/finalizar` — Finalizar envío
- `POST /api/portal/:token/archivo` — Subir foto o documento

### Autenticación
- `POST /api/auth/login` — Iniciar sesión
- `GET  /api/auth/me` — Mi perfil

### Expedientes (requieren JWT)
- `GET  /api/expedientes` — Listar
- `POST /api/expedientes` — Crear
- `GET  /api/expedientes/:id` — Detalle
- `PUT  /api/expedientes/:id/estatus` — Cambiar estatus
- `POST /api/expedientes/:id/observacion` — Agregar observación

### Archivos (requieren JWT)
- `POST /api/archivos/subir/:expedienteId` — Subir desde panel interno
- `GET  /api/archivos/:expedienteId` — Listar archivos
- `DELETE /api/archivos/:archivoId` — Eliminar
- `PUT /api/archivos/:archivoId/final` — Marcar como versión final

## Credenciales iniciales

- Email: `abel@industriasegura.mx`
- Contraseña: `IndustriaSegura2025!`

Cambia la contraseña después del primer login.
