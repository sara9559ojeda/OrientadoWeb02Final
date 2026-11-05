import mongoose from 'mongoose';
import { isProduction } from './env.js';

// Opciones de conexión: falla rápido si no hay servidor (Atlas inaccesible, IP no permitida, etc.)
const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
};

// Estado legible de la conexión (para /api/health y logs)
export const getDbState = () =>
  ({ 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }[mongoose.connection.readyState] || 'unknown');

/**
 * Conecta a MongoDB.
 * - exitOnFailure=true (por defecto, usado por los scripts de seed): termina el proceso con código 1 si falla.
 * - exitOnFailure=false (usado por el servidor): lanza el error para que el llamador reintente.
 */
export const connectDB = async ({ exitOnFailure = true } = {}) => {
  try {
    // Intentar usar MONGODB_URI primero (formato completo)
    let mongoURI = process.env.MONGODB_URI;
    
    // Si no existe, construir desde variables individuales
    if (!mongoURI && isProduction() && !process.env.DATABASE_URL) {
      throw new Error('MONGODB_URI no está definida (obligatoria con NODE_ENV=production).');
    }

    if (!mongoURI) {
      let dbUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017';
      const dbName = process.env.DATABASE_NAME || 'multimedia_db';
      const dbUsername = process.env.DATABASE_USERNAME;
      const dbPassword = process.env.DATABASE_PASSWORD;
      
      // Si DATABASE_URL no tiene el protocolo, agregarlo
      if (!dbUrl.startsWith('mongodb://') && !dbUrl.startsWith('mongodb+srv://')) {
        dbUrl = `mongodb://${dbUrl}`;
      }
      
      if (dbUsername && dbPassword) {
        // Construir URI con autenticación
        // Extraer host y puerto de DATABASE_URL
        const urlMatch = dbUrl.match(/mongodb:\/\/([^:]+):?(\d+)?/);
        const host = urlMatch ? urlMatch[1] : 'localhost';
        const port = urlMatch && urlMatch[2] ? urlMatch[2] : '27017';
        
        // Si el host es 'mongodb' (nombre del servicio Docker), cambiar a 'localhost' para conexiones externas
        const finalHost = host === 'mongodb' ? 'localhost' : host;
        
        // Intentar con authSource=admin primero, si falla probar sin authSource
        mongoURI = `mongodb://${dbUsername}:${dbPassword}@${finalHost}:${port}/${dbName}?authSource=admin`;
      } else {
        // Sin autenticación
        mongoURI = `${dbUrl}/${dbName}`;
      }
    } else {
      // Si MONGODB_URI existe pero tiene 'mongodb' como host (servicio Docker)
      // Solo cambiar a 'localhost' si NO estamos dentro de Docker
      // Detectamos si estamos en Docker verificando si podemos resolver 'mongodb' como hostname
      // o si el proceso está corriendo en un contenedor (verificamos HOSTNAME)
      const isInDocker = process.env.HOSTNAME || process.env.DOCKER_CONTAINER || 
                         (typeof process.env.USER === 'undefined');
      
      if (mongoURI.includes('@mongodb:') && !mongoURI.includes('@localhost:') && !isInDocker) {
        // Reemplazar cualquier referencia a 'mongodb' como hostname por 'localhost'
        // Solo si estamos ejecutando FUERA de Docker
        mongoURI = mongoURI.replace(/@mongodb(:\d+)?\//, '@localhost$1/');
        console.log('🔄 Ajustando host de Docker (mongodb) a localhost para conexión externa');
      }
      // Si estamos en Docker, mantener 'mongodb' como hostname (funciona dentro de la red Docker)
    }
    
    console.log(`🔌 Conectando a MongoDB: ${mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Ocultar credenciales en el log
    
    try {
      await mongoose.connect(mongoURI, MONGO_OPTIONS);
      console.log('✅ MongoDB conectado exitosamente');
    } catch (authError) {
      // Si falla la autenticación, intentar con admin123 (contraseña por defecto de Docker)
      if (!isProduction() && authError.message.includes('Authentication failed')) {
        console.log('🔄 Autenticación falló, intentando con contraseña por defecto (admin123)...');
        
        // Extraer componentes de la URI
        const uriMatch = mongoURI.match(/mongodb:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)(\?.*)?/);
        if (uriMatch) {
          const [, username, , host, database, queryString] = uriMatch;
          const fallbackURI = `mongodb://${username}:admin123@${host}/${database}${queryString || '?authSource=admin'}`;
          
          try {
            await mongoose.connect(fallbackURI, MONGO_OPTIONS);
            console.log('✅ MongoDB conectado exitosamente con contraseña por defecto');
            console.log('💡 Sugerencia: Actualiza tu .env para usar: admin123 como contraseña');
          } catch (secondError) {
            // Si también falla, mostrar información útil
            console.error('\n💡 Posibles soluciones:');
            console.error('   1. Verifica que la contraseña en .env coincida con la de MongoDB');
            console.error('   2. Si usas Docker, la contraseña por defecto es: admin123');
            console.error('   3. Verifica que MongoDB esté corriendo: docker ps');
            throw authError; // Lanzar el error original
          }
        } else {
          throw authError;
        }
      } else {
        throw authError;
      }
    }
  } catch (error) {
    console.error(`❌ Error al conectar con MongoDB: ${error.message}`);
    console.error(`   MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Definida' : '❌ No definida'}`);
    if (isProduction()) {
      console.error('💡 Revisa MONGODB_URI, usuario/contraseña de Atlas y que Network Access permita la IP de Render (0.0.0.0/0).');
    } else {
      console.error('💡 Verifica las credenciales en tu archivo .env y que MongoDB esté corriendo (docker ps).');
      console.error(`   DATABASE_URL: ${process.env.DATABASE_URL || 'No definida'}`);
      console.error(`   DATABASE_NAME: ${process.env.DATABASE_NAME || 'No definida'}`);
      console.error(`   DATABASE_USERNAME: ${process.env.DATABASE_USERNAME || 'No definida'}`);
      console.error(`   DATABASE_PASSWORD: ${process.env.DATABASE_PASSWORD ? '***' : 'No definida'}`);
      console.error('   Ejemplo: MONGODB_URI=mongodb://admin:admin123@localhost:27017/multimedia_db?authSource=admin');
    }
    if (exitOnFailure) process.exit(1);
    throw error;
  }
};

/**
 * Conexión para el servidor web: NO tumba el proceso. Reintenta con espera creciente
 * (Atlas puede tardar en responder o Render arrancar antes que la red esté lista).
 * Mientras tanto la API responde 503 en las rutas que necesitan base de datos.
 */
export const connectDBWithRetry = async () => {
  let delay = 2000;
  for (let attempt = 1; ; attempt++) {
    try {
      await connectDB({ exitOnFailure: false });
      return;
    } catch {
      console.error(`⏳ Reintento ${attempt} de conexión a MongoDB en ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 30000);
    }
  }
};
