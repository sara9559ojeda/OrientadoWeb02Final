# Sistema de Autenticación del Juego

## Descripción

Este proyecto incluye un sistema de autenticación que se conecta con el backend NestJS para validar usuarios mediante JWT. Además, incluye una "puerta trasera" (backdoor) para permitir acceso cuando no hay conexión con la base de datos.

## Características

- ✅ Login con validación JWT del backend
- ✅ Puerta trasera (backdoor) para acceso sin conexión a BD
- ✅ Persistencia de sesión mediante localStorage
- ✅ Validación de tokens expirados
- ✅ Manejo de errores de conexión

## Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con:

```env
VITE_API_URL=http://localhost:3000/api/v1
```

Si no se especifica, por defecto usa `http://localhost:3000/api/v1`.

### Puerta Trasera (Backdoor)

Las credenciales hardcodeadas son:

- **Email:** `admin@admin.com`
- **Password:** `secret`

Estas credenciales funcionan incluso cuando:
- El backend no está disponible
- No hay conexión a la base de datos
- Hay errores de red

**⚠️ Advertencia:** Estas credenciales están hardcodeadas en el frontend. Solo úsalas para desarrollo o cuando no haya conexión a la BD.

## Uso

### Login Normal

1. Ingresa tus credenciales en el formulario de login
2. El sistema intentará conectarse con el backend
3. Si las credenciales son válidas, recibirás un token JWT
4. El juego se iniciará automáticamente

### Login con Puerta Trasera

1. Ingresa las credenciales: `admin@admin.com` / `secret`
2. Si el backend no está disponible, se usará automáticamente la puerta trasera
3. Se generará un token simulado y podrás acceder al juego

## Estructura de Archivos

```
src/
├── services/
│   └── authService.js      # Servicio de autenticación
├── context/
│   └── AuthContext.jsx     # Contexto de React para autenticación
├── components/
│   ├── Login.jsx           # Componente de login
│   └── Login.css           # Estilos del login
└── App.jsx                 # Componente principal (modificado)
```

## API del Backend

El sistema espera que el backend tenga el siguiente endpoint:

- **POST** `/api/v1/auth/email/login`
  - Body: `{ email: string, password: string }`
  - Response: `{ token: string, refreshToken: string, tokenExpires: number, user: object }`

## Funcionalidades del Servicio de Autenticación

### `login(email, password)`
Intenta hacer login con el backend. Si falla y son las credenciales de backdoor, usa la puerta trasera.

### `saveToken(token)`
Guarda el token en localStorage.

### `getToken()`
Obtiene el token del localStorage.

### `removeToken()`
Elimina el token del localStorage.

### `isTokenValid(token)`
Verifica si un token JWT es válido y no ha expirado.

## Flujo de Autenticación

1. El usuario ingresa credenciales
2. Se verifica si son las credenciales de backdoor
3. Si no, se intenta conectar con el backend
4. Si hay error y son credenciales de backdoor, se usa la puerta trasera
5. Se guarda el token en localStorage
6. El juego se inicia automáticamente

## Notas de Seguridad

- ⚠️ Las credenciales de backdoor están en el código del frontend (no es seguro para producción)
- ✅ Los tokens JWT reales se validan antes de usarse
- ✅ Los tokens expirados son rechazados automáticamente
- ✅ La sesión persiste en localStorage (puede ser vulnerado por XSS)

## Desarrollo

Para ejecutar el proyecto en desarrollo:

```bash
npm run dev
```

El login aparecerá automáticamente si no hay una sesión activa.

