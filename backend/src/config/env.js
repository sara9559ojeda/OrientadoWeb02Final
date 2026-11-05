// Utilidades de configuración compartidas (JWT, errores públicos).

export const isProduction = () => process.env.NODE_ENV === 'production';

// Valores de ejemplo que NUNCA deben usarse como secreto real en producción.
const PLACEHOLDER_SECRETS = new Set([
  'tu_secreto_jwt_super_seguro_cambiar_en_produccion',
  'changeme',
  'secret',
]);
const DEV_FALLBACK_SECRET = 'dev-only-insecure-jwt-secret-do-not-use-in-production';
const MIN_SECRET_LENGTH = 16;

/**
 * Devuelve el secreto para firmar/verificar JWT.
 * - Producción: exige JWT_SECRET definido, no-placeholder y de longitud mínima; si no, lanza Error.
 * - Desarrollo: si falta, usa un valor local (con aviso, una sola vez).
 */
let warnedDevSecret = false;
export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (isProduction()) {
    if (!secret) {
      throw new Error('JWT_SECRET no está definido (obligatorio con NODE_ENV=production).');
    }
    if (PLACEHOLDER_SECRETS.has(secret) || secret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET es inseguro (valor de ejemplo o menos de ${MIN_SECRET_LENGTH} caracteres). Define uno aleatorio largo.`
      );
    }
    return secret;
  }
  if (!secret) {
    if (!warnedDevSecret) {
      console.warn('⚠️  JWT_SECRET no definido: usando un secreto de desarrollo (NO válido para producción).');
      warnedDevSecret = true;
    }
    return DEV_FALLBACK_SECRET;
  }
  return secret;
};

// Mensaje de error apto para enviar al cliente: detalle solo fuera de producción.
export const publicError = (error) =>
  isProduction() ? 'Error interno del servidor' : error?.message;
