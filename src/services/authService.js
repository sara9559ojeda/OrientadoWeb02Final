// Servicio de autenticación con fallback hardcodeado
import { API_ENDPOINTS, checkBackendHealth } from '../config/api.js';

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

/**
 * Verifica si el backend está disponible (con cache)
 * @returns {Promise<boolean>}
 */
export const isBackendAvailable = async () => {
  const now = Date.now();
  
  // Usar cache si está disponible y no ha expirado
  if (backendAvailableCache !== null && (now - backendCheckTime) < CACHE_DURATION) {
    return backendAvailableCache;
  }
  
  // Verificar backend
  const available = await checkBackendHealth();
  backendAvailableCache = available;
  backendCheckTime = now;
  
  return available;
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
  // Verificar si el backend está disponible
  const backendAvailable = await isBackendAvailable();
  
  // Si son credenciales de backdoor y backend NO está disponible, usar backdoor
  if (email === BACKDOOR_CREDENTIALS.email && password === BACKDOOR_CREDENTIALS.password) {
    if (backendAvailable) {
      throw new Error('El backend está disponible. Por favor, usa credenciales válidas del servidor.');
    }
    console.warn('⚠️ Usando puerta trasera (backdoor) - Acceso directo sin BD');
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

  // SEGUNDO: Si NO son credenciales de backdoor, ir al backend para obtener JWT
  try {
    const response = await fetch(API_ENDPOINTS.auth.login, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      // Si el backend responde con error, lanzar excepción
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Credenciales inválidas');
    }

    // Si el backend responde correctamente, devolver el JWT
    const data = await response.json();
    console.log('✅ Login exitoso con backend, token JWT recibido');
    return data;
  } catch (error) {
    // Si hay error de conexión (red, backend caído, etc.)
    console.error('❌ Error conectando con el backend:', error);
    
    // Si no son credenciales de backdoor y hay error de conexión, lanzar error
    throw new Error('No se pudo conectar con el servidor. Verifica tu conexión.');
  }
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

