/**
 * Servicio para manejar puntuaciones del juego
 * Interactúa con el backend para guardar y obtener puntuaciones
 */

import { API_ENDPOINTS } from '../config/api.js';
import { getToken } from './authService.js';

/**
 * Guarda una puntuación en el backend
 * @param {number} totalPoints - Puntos totales
 * @param {Object} pointsByLevel - Objeto con puntos por nivel { level1, level2, level3 }
 * @param {number} gameTime - Tiempo de juego en segundos (opcional)
 * @returns {Promise<Object>} - Datos de la puntuación guardada
 */
export const saveScore = async (totalPoints, pointsByLevel, gameTime = null) => {
  try {
    const token = getToken();
    
    if (!token) {
      console.warn('⚠️ No hay token de autenticación, no se puede guardar la puntuación');
      return null;
    }
    
    // Verificar si el token es un JWT válido (tiene formato JWT: header.payload.signature)
    const isJWT = token.includes('.') && token.split('.').length === 3;
    if (!isJWT) {
      console.warn('⚠️ Token no es un JWT válido (probablemente es backdoor), no se puede guardar la puntuación');
      console.warn('💡 Para guardar puntuaciones, inicia sesión con un usuario real del backend');
      return null;
    }

    const response = await fetch(API_ENDPOINTS.scores.save, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        totalPoints,
        pointsByLevel: {
          level1: pointsByLevel[1] || 0,
          level2: pointsByLevel[2] || 0,
          level3: pointsByLevel[3] || 0,
        },
        gameTime: gameTime || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Error al guardar puntuación:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      console.error('📤 Datos enviados:', {
        totalPoints,
        pointsByLevel: {
          level1: pointsByLevel[1] || 0,
          level2: pointsByLevel[2] || 0,
          level3: pointsByLevel[3] || 0,
        },
        gameTime
      });
      return null;
    }

    const data = await response.json();
    console.log('✅ Puntuación guardada exitosamente:', data);
    return data.data;
  } catch (error) {
    console.error('❌ Error al guardar puntuación:', error);
    return null;
  }
};

/**
 * Verifica si el token actual es un JWT válido (no backdoor)
 * @returns {boolean}
 */
export const hasValidJWT = () => {
  const token = getToken();
  if (!token) return false;
  // JWT tiene formato: header.payload.signature (3 partes separadas por punto)
  return token.includes('.') && token.split('.').length === 3;
};

/**
 * Obtiene el ranking global
 * @param {number} limit - Número de resultados (por defecto 10)
 * @returns {Promise<Array>} - Array de puntuaciones ordenadas
 */
export const getRanking = async (limit = 10) => {
  try {
    const response = await fetch(`${API_ENDPOINTS.scores.ranking}?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Error al obtener ranking');
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('❌ Error al obtener ranking:', error);
    return [];
  }
};

/**
 * Obtiene las puntuaciones del usuario actual
 * @returns {Promise<Object>} - Objeto con scores, bestScore y totalGames
 */
export const getMyScores = async () => {
  try {
    const token = getToken();
    
    if (!token) {
      console.warn('⚠️ No hay token de autenticación');
      return null;
    }

    const response = await fetch(API_ENDPOINTS.scores.me, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('❌ Error al obtener puntuaciones del usuario');
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('❌ Error al obtener puntuaciones del usuario:', error);
    return null;
  }
};

/**
 * Obtiene la mejor puntuación del usuario actual
 * @returns {Promise<Object>} - Mejor puntuación del usuario
 */
export const getMyBestScore = async () => {
  try {
    const token = getToken();
    
    if (!token) {
      console.warn('⚠️ No hay token de autenticación');
      return null;
    }

    const response = await fetch(API_ENDPOINTS.scores.best, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('❌ Error al obtener mejor puntuación');
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('❌ Error al obtener mejor puntuación:', error);
    return null;
  }
};

/**
 * Verifica si el backend está disponible para guardar puntuaciones
 * @returns {Promise<boolean>}
 */
export const isBackendAvailable = async () => {
  try {
    const token = getToken();
    return !!token; // Si hay token, asumimos que el backend está disponible
  } catch {
    return false;
  }
};

