/**
 * Configuración centralizada de la API
 * Define la URL base del backend de forma consistente en toda la aplicación
 */

// URL base del backend - puede ser configurada mediante variable de entorno
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Endpoints disponibles
export const API_ENDPOINTS = {
  // Autenticación
  auth: {
    register: `${API_BASE_URL}/auth/register`,
    login: `${API_BASE_URL}/auth/login`,
    me: `${API_BASE_URL}/auth/me`,
  },
  
  // Niveles
  levels: {
    all: `${API_BASE_URL}/levels`,
    byId: (id) => `${API_BASE_URL}/levels/${id}`,
    coinsCount: (id) => `${API_BASE_URL}/levels/${id}/coins-count`,
  },
  
  // Puntuaciones
  scores: {
    save: `${API_BASE_URL}/scores`,
    ranking: `${API_BASE_URL}/scores`,
    me: `${API_BASE_URL}/scores/me`,
    best: `${API_BASE_URL}/scores/best`,
  },
  
  // Health check
  health: `${API_BASE_URL}/health`,
  
  // Blocks (para ToyCarLoader)
  blocks: `${API_BASE_URL}/blocks`,
};

// Función helper para verificar si el backend está disponible
export const checkBackendHealth = async () => {
  // Si la URL del backend apunta a localhost y estamos en producción, asumir que no está disponible
  const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
  const isProduction = window.location.hostname !== 'localhost' && 
                       window.location.hostname !== '127.0.0.1';
  
  if (isLocalhost && isProduction) {
    console.log('⚠️ Backend configurado para localhost en producción, asumiendo no disponible');
    return false;
  }
  
  try {
    // Crear un AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout
    
    const response = await fetch(API_ENDPOINTS.health, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    // Cualquier error (red, timeout, CORS, etc.) significa que el backend no está disponible
    console.log('⚠️ Backend no disponible:', error.name === 'AbortError' ? 'Timeout' : error.message);
    return false;
  }
};

