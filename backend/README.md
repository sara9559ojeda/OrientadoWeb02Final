# Backend — Videojuego 3D Multinivel

API REST desarrollada con Express.js, MongoDB y JWT para el videojuego interactivo 3D.

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Servidor | Express.js + Node.js |
| Base de datos | MongoDB + Mongoose |
| Autenticación | JWT + bcryptjs |
| Seguridad | helmet, CORS por lista de orígenes, rate limit, express-validator |
| Infraestructura | Docker Compose (local) · Render + MongoDB Atlas (producción) |

## Instalación

### Con Docker (recomendado en local)

```bash
# 1. Levantar contenedores
docker-compose up -d

# 2. Poblar base de datos
docker exec backend-express npm run seed:all
```

### Sin Docker

```bash
npm install
npm run seed:all   # niveles + bloques (base multimedia_db)
npm run dev
```

Crear archivo `.env` en la raíz de `backend/` (hay una plantilla en `.env.example`):

```env
PORT=3000
MONGODB_URI=mongodb://admin:admin123@localhost:27017/multimedia_db?authSource=admin
JWT_SECRET=un_secreto_largo_y_aleatorio
JWT_EXPIRES_IN=24h
```

## Variables de entorno

| Variable | Desarrollo | Producción (`NODE_ENV=production`) |
|----------|-----------|-------------------------------------|
| `MONGODB_URI` | Opcional (si falta se usa `DATABASE_URL`/`DATABASE_NAME`…) | **Obligatoria** |
| `JWT_SECRET` | Opcional (usa un secreto de desarrollo con aviso) | **Obligatoria**, ≥ 16 caracteres y distinta del valor de ejemplo del `.env.example` |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` por defecto | Dominio(s) del frontend separados por comas, sin `/` final (si falta se avisa por consola y el navegador será rechazado) |
| `PORT` | 3000 | Lo asigna Render; el servidor escucha en `0.0.0.0:$PORT` |
| `JWT_EXPIRES_IN` | `24h` | `24h` |

En producción, si falta `JWT_SECRET` o `MONGODB_URI`, o el secreto es inseguro, el proceso **termina con código 1 y un mensaje claro** (`❌ Configuración inválida: …`) antes de abrir el puerto.

## Arranque y estado de la base de datos

El servidor **escucha primero** y conecta a MongoDB en segundo plano con reintentos (2 s, 4 s, … hasta 30 s entre intentos). Así Render detecta el puerto aunque Atlas tarde en responder.

- `GET /api/health` responde **siempre 200** de inmediato:
  ```json
  { "status": "OK", "message": "Servidor funcionando correctamente", "db": "connected" }
  ```
  `db` vale `"connecting"` mientras Mongo no esté conectado (arranque en frío, reintentos o caída posterior) y `"connected"` cuando ya lo está. El frontend solo da el backend por disponible cuando `db === "connected"`.
- Mientras `db` no sea `connected`, **el resto de `/api/*` responde `503`**:
  ```json
  { "success": false, "message": "Base de datos no disponible todavía, inténtalo de nuevo en unos segundos" }
  ```
  Si Mongo se cae con el servidor en marcha, el driver reconecta solo y la API vuelve a responder sin reiniciar.
- El preflight CORS (`OPTIONS`) lo responde el middleware `cors` antes de esta comprobación, y el 503 no consume cupo de rate limit (el limitador va después).

## Endpoints disponibles

### Estado
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/health | Estado del servidor y campo `db` (`connecting` / `connected`) |

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/register | Registro de usuario (`email`, `password` 6–72 caracteres, `name` opcional ≤ 50) |
| POST | /api/auth/login | Login — retorna token JWT |
| GET | /api/auth/me | Perfil del usuario autenticado (`Authorization: Bearer <token>`) |

Respuestas de `register` (201) y `login` (200): `{ message, token, user: { id, email, name } }`.
Errores: validación `400 { errors: [{ msg, path, … }] }`; email repetido `400 { message }`; credenciales malas `401 { message: "Credenciales inválidas" }`.

### Niveles
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/levels | Todos los niveles activos → `{ success, data: [...], count }` |
| GET | /api/levels/:id | Configuración de un nivel → `{ success, data }` (404 si no existe, 400 si `:id` no es número) |
| GET | /api/levels/:id/coins-count | Cantidad de monedas → `{ success, levelNumber, coinsCount }` |

### Puntuaciones
| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | /api/scores | Guardar puntuación (`totalPoints` entero ≥ 0; `pointsByLevel.level1..3` y `gameTime` opcionales, **`null` se acepta como "no enviado"**) | ✅ |
| GET | /api/scores | Ranking global (`?limit=` 1–100, por defecto 10) | |
| GET | /api/scores/me | Mis puntuaciones | ✅ |
| GET | /api/scores/best | Mi mejor puntuación | ✅ |

### Bloques
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/blocks | Todos los bloques (array JSON plano). Filtros opcionales `?level=<entero>` y `?role=<texto>`; valores no válidos → `400` |
| GET | /api/blocks/:levelId | Bloques de un nivel → `{ success, level, count, data }` |

## Seguridad

- Contraseñas encriptadas con bcrypt (10 rondas)
- Tokens JWT (HS256) con expiración de 24 horas; secreto obligatorio y validado en producción
- Rutas protegidas mediante middleware de autenticación
- `helmet` (cabeceras de seguridad) y CORS restringido a `CORS_ORIGINS`
- **Rate limit**: 100 peticiones cada 15 minutos por IP, contador compartido entre `POST /api/auth/login` y `POST /api/auth/register`. Al superarlo responde `429 { message: "Demasiados intentos, inténtalo de nuevo en unos minutos" }` con cabeceras `RateLimit` y `Retry-After`. Se aplica tras la comprobación de BD (un 503 no gasta cupo). Usa `trust proxy = 1` para leer la IP real tras el proxy de Render.
- Body JSON limitado a **10 kb** (`413` si se supera; `400 { message: "JSON no válido" }` si está mal formado)
- Validación de entrada: `email`/`password` solo aceptan texto (se rechazan objetos tipo `{"$ne": null}`) y los parámetros de consulta de `/api/blocks` se validan (no admiten operadores de MongoDB)
- Los errores 500 no exponen detalles internos en producción

## Verificación

Los endpoints se probaron de extremo a extremo contra un MongoDB real (contenedor `mongo:7`) con `NODE_ENV=production`; ver [PRUEBAS_ENDPOINTS.md](PRUEBAS_ENDPOINTS.md).
