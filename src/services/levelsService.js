/**
 * Servicio para obtener configuración de niveles desde el backend
 */

import { API_ENDPOINTS, checkBackendHealth } from '../config/api.js';

/**
 * Obtiene la cantidad de coins para un nivel específico desde el backend
 * @param {number} levelId - ID del nivel (1, 2, 3, etc.)
 * @returns {Promise<number>} - Cantidad de coins (o 10 por defecto si falla)
 */
export const getCoinsCountByLevel = async (levelId) => {
  try {
    const response = await fetch(API_ENDPOINTS.levels.coinsCount(levelId), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.coinsCount) {
      console.log(`✅ Coins del nivel ${levelId} obtenidos desde backend: ${data.coinsCount}`);
      return data.coinsCount;
    } else {
      console.warn(`⚠️ Respuesta del backend sin coinsCount, usando valor por defecto`);
      return 10; // Valor por defecto
    }
  } catch (error) {
    console.warn(`⚠️ No se pudo obtener coins desde backend para nivel ${levelId}:`, error.message);
    console.log(`📦 Usando valor por defecto: 10 coins`);
    return 10; // Valor por defecto si el backend no está disponible
  }
};

/**
 * Obtiene la configuración completa de un nivel
 * @param {number} levelId - ID del nivel
 * @returns {Promise<object|null>} - Configuración del nivel o null si falla
 */
export const getLevelConfig = async (levelId) => {
  try {
    const response = await fetch(API_ENDPOINTS.levels.byId(levelId), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.data) {
      console.log(`✅ Configuración del nivel ${levelId} obtenida desde backend`);
      return data.data;
    } else {
      console.warn(`⚠️ Respuesta del backend sin datos para nivel ${levelId}`);
      return null;
    }
  } catch (error) {
    console.warn(`⚠️ No se pudo obtener configuración desde backend para nivel ${levelId}:`, error.message);
    return null;
  }
};

/**
 * Obtiene todos los niveles activos
 * @returns {Promise<Array>} - Array de niveles o array vacío si falla
 */
export const getAllLevels = async () => {
  try {
    const response = await fetch(API_ENDPOINTS.levels.all, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && Array.isArray(data.data)) {
      console.log(`✅ ${data.data.length} niveles obtenidos desde backend`);
      return data.data;
    } else {
      console.warn(`⚠️ Respuesta del backend sin datos de niveles`);
      return [];
    }
  } catch (error) {
    console.warn(`⚠️ No se pudo obtener niveles desde backend:`, error.message);
    return [];
  }
};

/**
 * Verifica si el backend está disponible
 * @returns {Promise<boolean>} - true si el backend está disponible
 */
export const isBackendAvailable = checkBackendHealth;

