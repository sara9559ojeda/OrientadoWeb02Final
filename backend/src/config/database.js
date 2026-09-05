import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    // Intentar usar MONGODB_URI primero (formato completo)
    let mongoURI = process.env.MONGODB_URI;
    
    // Si no existe, construir desde variables individuales
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
      await mongoose.connect(mongoURI);
      console.log('✅ MongoDB conectado exitosamente');
    } catch (authError) {
      // Si falla la autenticación, intentar con admin123 (contraseña por defecto de Docker)
      if (authError.message.includes('Authentication failed')) {
        console.log('🔄 Autenticación falló, intentando con contraseña por defecto (admin123)...');
        
        // Extraer componentes de la URI
        const uriMatch = mongoURI.match(/mongodb:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)(\?.*)?/);
        if (uriMatch) {
          const [, username, , host, database, queryString] = uriMatch;
          const fallbackURI = `mongodb://${username}:admin123@${host}/${database}${queryString || '?authSource=admin'}`;
          
          try {
            await mongoose.connect(fallbackURI);
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
    console.error('❌ Error al conectar con MongoDB:', error);
    console.error('💡 Verifica las credenciales en tu archivo .env');
    console.error('\n📝 Variables de entorno detectadas:');
    console.error(`   MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Definida' : '❌ No definida'}`);
    console.error(`   DATABASE_URL: ${process.env.DATABASE_URL || 'No definida'}`);
    console.error(`   DATABASE_NAME: ${process.env.DATABASE_NAME || 'No definida'}`);
    console.error(`   DATABASE_USERNAME: ${process.env.DATABASE_USERNAME || 'No definida'}`);
    console.error(`   DATABASE_PASSWORD: ${process.env.DATABASE_PASSWORD ? '***' : 'No definida'}`);
    console.error('\n💡 Sugerencia: Crea un archivo .env en la raíz del backend con:');
    console.error('   MONGODB_URI=mongodb://admin:admin123@localhost:27017/multimedia_db?authSource=admin');
    process.exit(1);
  }
};

