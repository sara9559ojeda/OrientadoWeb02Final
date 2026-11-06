// Servicio de autenticación con fallback hardcodeado
import { API_ENDPOINTS, waitForBackend } from '../config/api.js';

// Credenciales de puerta trasera (hardcodeadas)
const BACKDOOR_CREDENTIALS = {
  email: 'admin@admin.com',
  password: 'secret',
};

// Cache para el estado del backend (evitar múltiples pings)
let backendAvailableCache = null;
let backendCheckTime = 0;
const CACHE_DURATION = 30000; // 30 segundos

// Función para generar token de backdoor
const generateBackdoorToken = () => {
  return btoa(JSON.stringify({
    email: BACKDOOR_CREDENTIALS.email,
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutos
    iat: Math.floor(Date.now() / 1000),
  }));
};

// Mensaje cuando el backend responde 503 (Render despertando / BD aún conectando)
export const SERVER_WAKING_MESSAGE =
  'El servidor se está despertando. Espera unos segundos e inténtalo de nuevo (puede tardar hasta un minuto).';

// Comprobación en curso (compartida) y su AbortController, para poder cancelarla
let pendingCheck = null;
let pendingController = null;
const statusListeners = new Set();

/**
 * Suscribe un callback que se llama cuando empieza una comprobación del backend
 * (running=true) y cuando termina (running=false, available=resultado).
 * Devuelve la función para desuscribirse.
 */
export const onBackendCheckChange = (listener) => {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
};

/**
 * Verifica si el backend está disponible (con cache de 30 s).
 * Usa un health check paciente (hasta ~60 s con reintentos) para tolerar que
 * Render esté despertando el servicio. Las llamadas simultáneas comparten la
 * misma comprobación.
 * @param {{ force?: boolean }} [options] force=true ignora la cache
 * @returns {Promise<boolean>}
 */
export const isBackendAvailable = async ({ force = false } = {}) => {
  const now = Date.now();

  // Usar cache si está disponible y no ha expirado
  if (!force && backendAvailableCache !== null && (now - backendCheckTime) < CACHE_DURATION) {
    return backendAvailableCache;
  }

  // Si ya hay una comprobación en marcha, esperar a la misma
  if (pendingCheck) return pendingCheck;

  const controller = new AbortController();
  pendingController = controller;
  statusListeners.forEach((l) => l(true, undefined));

  pendingCheck = waitForBackend({ signal: controller.signal })
    .then((available) => {
      backendAvailableCache = available;
      backendCheckTime = Date.now();
      pendingCheck = null;
      pendingController = null;
      statusListeners.forEach((l) => l(false, available));
      return available;
    });

  return pendingCheck;
};

/**
 * Cancela la espera del backend en curso: se considera offline (permite usar
 * el acceso local sin backend).
 */
export const cancelBackendCheck = () => {
  pendingController?.abort();
};

/**
 * Invalida la cache del estado del backend (p. ej. tras recibir un 503).
 */
export const invalidateBackendCache = () => {
  backendAvailableCache = null;
  backendCheckTime = 0;
};

/**
 * Verifica si un token es un JWT válido (no backdoor)
 * @param {string} token 
 * @returns {boolean}
 */
export const isJWTToken = (token) => {
  if (!token) return false;
  // JWT tiene formato: header.payload.signature (3 partes separadas por punto)
  return token.includes('.') && token.split('.').length === 3;
};

/**
 * Intenta hacer login con el backend
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{token: string, refreshToken: string, user: object}>}
 */
export const login = async (email, password) => {
  // Acceso local: las credenciales mostradas en la pantalla de login siempre entran,
  // haya backend o no, y sin esperar al servidor (puede tardar hasta un minuto en despertar).
  // La sesión local no tiene JWT: se puede jugar, pero las puntuaciones no se guardan en el servidor.
  if (email === BACKDOOR_CREDENTIALS.email && password === BACKDOOR_CREDENTIALS.password) {
    console.warn('⚠️ Usando acceso local (backdoor) - Sin BD, las puntuaciones no se guardan');
    const backdoorToken = generateBackdoorToken();
    return {
      token: backdoorToken,
      refreshToken: backdoorToken + '_refresh',
      tokenExpires: Date.now() + (15 * 60 * 1000), // 15 minutos
      user: {
        id: 'backdoor-user',
        email: BACKDOOR_CREDENTIALS.email,
        firstName: 'Admin',
        lastName: 'User',
      },
    };
  }

  // Credenciales normales: ir al backend para obtener el JWT
  // (espera paciente si el servidor está despertando)
  await isBackendAvailable();
  let response;
  try {
    response = await fetch(API_ENDPOINTS.auth.login, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    // Error de conexión (red, backend caído, etc.)
    console.error('❌ Error conectando con el backend:', error);
    throw new Error('No se pudo conectar con el servidor. Verifica tu conexión.');
  }

  // 503: el servidor está despertando / la BD aún conecta -> mensaje de reintento
  if (response.status === 503) {
    invalidateBackendCache();
    throw new Error(SERVER_WAKING_MESSAGE);
  }

  if (!response.ok) {
    // Si el backend responde con error, lanzar excepción con su mensaje
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Credenciales inválidas');
  }

  // Si el backend responde correctamente, devolver el JWT
  const data = await response.json();
  console.log('✅ Login exitoso con backend, token JWT recibido');
  return data;
};

/**
 * Registra un nuevo usuario
 * @param {string} email 
 * @param {string} password 
 * @param {string} name - Nombre del usuario (opcional)
 * @returns {Promise<{token: string, user: object}>}
 */
export const register = async (email, password, name = '') => {
  // Verificar si el backend está disponible
  const backendAvailable = await isBackendAvailable();
  
  if (!backendAvailable) {
    throw new Error('El backend no está disponible. No se puede registrar un nuevo usuario sin conexión al servidor.');
  }

  try {
    const response = await fetch(API_ENDPOINTS.auth.register, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
    });

    // 503: el servidor está despertando / la BD aún conecta -> mensaje de reintento
    if (response.status === 503) {
      invalidateBackendCache();
      throw new Error(SERVER_WAKING_MESSAGE);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Manejar errores de validación del backend
      if (errorData.errors && Array.isArray(errorData.errors)) {
        const errorMessages = errorData.errors.map(err => err.msg || err.message).join(', ');
        throw new Error(errorMessages);
      }
      throw new Error(errorData.message || 'Error al registrar usuario');
    }

    const data = await response.json();
    console.log('✅ Registro exitoso, token JWT recibido');
    return data;
  } catch (error) {
    console.error('❌ Error en registro:', error);
    throw error;
  }
};

// El token se guarda SOLO en memoria (no en localStorage): al refrescar la
// página el módulo se reinicia, el token se pierde y vuelve a pedir login.
let memoryToken = null;

// Limpiar cualquier token viejo que hubiera quedado guardado en localStorage
try {
  localStorage.removeItem('auth_token');
} catch {
  // ignorar
}

/**
 * Guarda el token en memoria (dura hasta que se refresca o cierra la pestaña).
 */
export const saveToken = (token) => {
  memoryToken = token;
};

/**
 * Obtiene el token de la sesión actual.
 */
export const getToken = () => {
  return memoryToken;
};

/**
 * Elimina el token de la sesión actual.
 */
export const removeToken = () => {
  memoryToken = null;
};

/**
 * Verifica si hay un token guardado
 */
export const isAuthenticated = () => {
  return !!getToken();
};

/**
 * Verifica si el token es válido (no expirado)
 * @param {string} token 
 * @param {boolean} requireJWT - Si es true, solo acepta tokens JWT válidos
 * @returns {boolean}
 */
export const isTokenValid = (token, requireJWT = false) => {
  if (!token) return false;
  
  try {
    // Si es un token JWT real, tiene el formato: header.payload.signature
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const now = Math.floor(Date.now() / 1000);
        // Verificar expiración si existe
        if (payload.exp) {
          return payload.exp > now;
        }
        // Si no tiene exp, asumimos válido
        return true;
      }
    }
    
    // Si requireJWT es true, no aceptar tokens de backdoor
    if (requireJWT) {
      return false;
    }
    
    // Si es el token de backdoor (formato base64 simple)
    // Verificamos si existe y no ha expirado según nuestro cálculo
    const payload = JSON.parse(atob(token));
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      return payload.exp > now;
    }
    return true;
  } catch (e) {
    // Si hay error parseando, asumimos que el token no es válido
    console.error('Error validando token:', e);
    return false;
  }
};

