import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { connectDBWithRetry } from './config/database.js';
import { getJwtSecret, isProduction } from './config/env.js';
import routes from './routes/index.js';

// Cargar variables de entorno
dotenv.config();

// Validar configuración crítica ANTES de arrancar: falla con mensaje claro (Render lo muestra en los logs).
try {
  getJwtSecret();
  if (isProduction() && !process.env.MONGODB_URI && !process.env.DATABASE_URL) {
    throw new Error('MONGODB_URI no está definida (obligatoria con NODE_ENV=production).');
  }
} catch (error) {
  console.error(`❌ Configuración inválida: ${error.message}`);
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

// Render (y Vercel/otros proxies) ponen el cliente real en X-Forwarded-For: necesario para el rate limit.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Orígenes permitidos por CORS. En producción se define CORS_ORIGINS con el dominio
// del frontend (separado por comas), p. ej. https://mi-juego.vercel.app
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);
if (isProduction() && !process.env.CORS_ORIGINS) {
  console.warn('⚠️  CORS_ORIGINS no definido en producción: el navegador del frontend será rechazado por CORS.');
}

// Middlewares
// API JSON pura: cabeceras de seguridad de helmet; CORP cross-origin para no interferir con el frontend en otro dominio.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
// Límite de tamaño del body (los payloads reales son diminutos: credenciales y puntuaciones)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// /api/health responde siempre (aunque Mongo siga conectando); el resto de /api necesita BD.
app.get('/api/health', (req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'connected' : 'connecting';
  res.json({ status: 'OK', message: 'Servidor funcionando correctamente', db });
});

app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  res.status(503).json({
    success: false,
    message: 'Base de datos no disponible todavía, inténtalo de nuevo en unos segundos',
  });
});

// Rate limit contra fuerza bruta en login/registro (por IP). Va DESPUÉS del 503: así los
// reintentos del frontend mientras Mongo arranca (Render dormido) no gastan el cupo.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos, inténtalo de nuevo en unos minutos' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Rutas
app.use('/api', routes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenido al API del Juego 3D Multinivel',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/me',
      },
      levels: {
        all: 'GET /api/levels',
        byId: 'GET /api/levels/:levelId',
        coinsCount: 'GET /api/levels/:levelId/coins-count',
      },
    },
  });
});

// 404 para rutas /api desconocidas (JSON, no HTML)
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Manejador global de errores: nunca devuelve stack traces ni detalles internos.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ message: 'El cuerpo de la petición es demasiado grande' });
    return;
  }
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    res.status(400).json({ message: 'JSON no válido' });
    return;
  }
  console.error('Error no controlado:', err);
  res.status(err?.status && err.status >= 400 && err.status < 500 ? err.status : 500).json({
    message: 'Error interno del servidor',
  });
});

// Iniciar servidor primero (para que /api/health responda y Render detecte el puerto)
// y conectar a MongoDB en segundo plano con reintentos.
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor escuchando en http://${HOST}:${PORT}`);
  console.log(`📝 Entorno: ${process.env.NODE_ENV || 'development'}`);
  connectDBWithRetry();
});

// Apagado ordenado (Render envía SIGTERM en cada deploy)
const shutdown = (signal) => {
  console.log(`🛑 ${signal} recibido, cerrando...`);
  server.close(async () => {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Un rechazo de promesa aislado se registra sin tumbar el proceso; una excepción no capturada
// deja el proceso en estado indefinido, así que se registra con claridad y se sale (Render reinicia).
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ unhandledRejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('💥 uncaughtException:', error);
  process.exit(1);
});

export default app;
