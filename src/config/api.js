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

// ── Health check ─────────────────────────────────────────────────────────────

// ¿La API apunta a la máquina local (desarrollo)?
const isLocalApi = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
// ¿La página se sirve desde un host que no es local (producción)?
const isLocalPage = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1';

// Render (plan free) duerme el servicio tras inactividad y tarda ~50 s en despertar,
// así que el health check "paciente" reintenta hasta ~60 s antes de darse por vencido.
export const HEALTH_WAIT_TOTAL_MS = 60000;   // tiempo máximo total de espera
const HEALTH_ATTEMPT_TIMEOUT_MS = 15000;     // timeout de cada intento individual
const HEALTH_RETRY_DELAY_MS = 2000;          // pausa entre intentos

// Espera `ms` milisegundos (se corta antes si la señal se aborta)
const sleep = (ms, signal) => new Promise((resolve) => {
  if (signal?.aborted) return resolve();
  const done = () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', done);
    resolve();
  };
  const timer = setTimeout(done, ms);
  signal?.addEventListener('abort', done, { once: true });
});

/**
 * Un único intento de health check (por defecto con timeout de 5 s).
 * Devuelve true solo si el backend responde 2xx y su BD está conectada. Nunca lanza.
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 */
export const checkBackendHealth = async ({ timeoutMs = 5000, signal } = {}) => {
  // Si la URL del backend apunta a localhost y estamos en producción, asumir que no está disponible
  if (isLocalApi && !isLocalPage) {
    console.log('⚠️ Backend configurado para localhost en producción, asumiendo no disponible');
    return false;
  }
  if (signal?.aborted) return false;

  // AbortController propio para el timeout; también escucha la señal externa (cancelación)
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // GET "simple" (sin Content-Type) para no depender de un preflight CORS
    const response = await fetch(API_ENDPOINTS.health, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return false;

    // El backend responde 200 enseguida aunque la BD aún esté conectando:
    // solo se da por disponible si db === 'connected' (o si la respuesta no trae
    // el campo `db`, para ser compatible con versiones anteriores del backend).
    const body = await response.json().catch(() => null);
    if (body && body.db !== undefined && body.db !== 'connected') {
      console.log(`⏳ Servidor despertando (db: ${body.db})`);
      return false;
    }
    return true;
  } catch (error) {
    // Cualquier error (red, timeout, CORS, etc.) significa que el backend no está disponible
    console.log('⚠️ Backend no disponible:', error.name === 'AbortError' ? 'Timeout/cancelado' : error.message);
    return false;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
};

/**
 * Health check paciente para backends que se duermen (Render free).
 * Reintenta hasta `totalTimeoutMs` en total. Si la API es local (desarrollo) no hay
 * "arranque en frío": se hace un único intento rápido, como antes.
 * Se puede cancelar con `signal` (resuelve false).
 * @param {{ totalTimeoutMs?: number, attemptTimeoutMs?: number, retryDelayMs?: number,
 *           signal?: AbortSignal, onAttempt?: (attempt: number) => void }} [options]
 * @returns {Promise<boolean>}
 */
export const waitForBackend = async ({
  totalTimeoutMs = HEALTH_WAIT_TOTAL_MS,
  attemptTimeoutMs = HEALTH_ATTEMPT_TIMEOUT_MS,
  retryDelayMs = HEALTH_RETRY_DELAY_MS,
  signal,
  onAttempt,
} = {}) => {
  if (isLocalApi) return checkBackendHealth({ signal });

  const deadline = Date.now() + totalTimeoutMs;
  let attempt = 0;

  while (!signal?.aborted) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    attempt += 1;
    onAttempt?.(attempt);
    const ok = await checkBackendHealth({ timeoutMs: Math.min(attemptTimeoutMs, remaining), signal });
    if (ok) return true;

    if (deadline - Date.now() <= retryDelayMs) break;
    await sleep(retryDelayMs, signal);
  }
  return false;
};
