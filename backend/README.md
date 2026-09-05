# Backend — Videojuego 3D Multinivel

API REST desarrollada con Express.js, MongoDB y JWT para el videojuego interactivo 3D.

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Servidor | Express.js + Node.js |
| Base de datos | MongoDB + Mongoose |
| Autenticación | JWT + bcryptjs |
| Infraestructura | Docker Compose |

## Instalación

### Con Docker (recomendado)

```bash
# 1. Levantar contenedores
docker-compose up -d

# 2. Poblar base de datos
docker exec backend-express npm run seed:levels
docker exec backend-express npm run seed:blocks
```

### Sin Docker

```bash
npm install
npm run dev
```

Crear archivo `.env` en la raíz:

```env
PORT=3000
MONGODB_URI=mongodb://admin:admin123@localhost:27017/multimedia_db?authSource=admin
JWT_SECRET=tu_secreto_jwt
JWT_EXPIRES_IN=24h
```

## Endpoints disponibles

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/register | Registro de usuario |
| POST | /api/auth/login | Login — retorna token JWT |
| GET | /api/auth/me | Perfil del usuario autenticado |

### Niveles
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/levels | Todos los niveles activos |
| GET | /api/levels/:id | Configuración de un nivel |
| GET | /api/levels/:id/coins-count | Cantidad de monedas del nivel |

### Puntuaciones
| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | /api/scores | Guardar puntuación | ✅ |
| GET | /api/scores | Ranking global | |
| GET | /api/scores/me | Mis puntuaciones | ✅ |
| GET | /api/scores/best | Mi mejor puntuación | ✅ |

### Bloques
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/blocks | Todos los bloques |
| GET | /api/blocks/:levelId | Bloques de un nivel |

## Seguridad

- Contraseñas encriptadas con bcrypt (10 rondas)
- Tokens JWT con expiración de 24 horas
- Rutas protegidas mediante middleware de autenticación